import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { TextractClient, StartDocumentAnalysisCommand } from "@aws-sdk/client-textract";

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const db = DynamoDBDocumentClient.from(client);
const sqs = new SQSClient({ region: process.env.AWS_REGION || "us-east-1" });
const textract = new TextractClient({ region: process.env.AWS_REGION || "us-east-1" });

export const handler = async (event) => {
  try {
    const userId = event.requestContext.authorizer.claims.sub;
    const { processingType } = JSON.parse(event.body);
    const { documentId } = event.pathParameters;

    if (!processingType || !userId || !documentId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    // Fetch document to get s3Key and sortKey
    const { Items } = await db.send(new QueryCommand({
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: "userId = :pk AND begins_with(sortKey, :sk)",
      ExpressionAttributeValues: {
        ":pk": userId,
        ":sk": "DOC#",
      },
    }));

    const item = Items?.find(i => i.sortKey.endsWith(documentId));

    if (!item) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Document not found" }),
      };
    }

    if (processingType === "pii") {
      // Update status to processing
      await db.send(new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: { userId, sortKey: item.sortKey },
        UpdateExpression: "SET #status = :status",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":status": "processing" },
      }));

      // Send to PII queue
      await sqs.send(new SendMessageCommand({
        QueueUrl: process.env.PII_QUEUE_URL,
        MessageBody: JSON.stringify({
          documentId,
          userId,
          s3Key: item.key,
          sortKey: item.sortKey,
        }),
      }));
    } 
    else if (processingType === "summarization") {
      // Update status to processing
      await db.send(new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: { userId, sortKey: item.sortKey },
        UpdateExpression: "SET #status = :status",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":status": "processing" },
      }));

      // Send to summ queue
      await sqs.send(new SendMessageCommand({
        QueueUrl: process.env.SUM_QUEUE_URL,
        MessageBody: JSON.stringify({
          documentId,
          userId,
          s3Key: item.key,
          sortKey: item.sortKey,
          processingType
        }),
      }));
    }
    else if (processingType === "redaction") {
      // Gate check — PII detection must be complete
      if (item.piiResults?.status !== "complete") {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ error: "PII detection must be complete before redaction" }),
        };
      }

      // Write pending status to DynamoDB
      await db.send(new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: { userId, sortKey: item.sortKey },
        UpdateExpression: "SET redactionResults = :redaction",
        ExpressionAttributeValues: {
          ":redaction": { status: "pending" },
        },
      }));

      console.log("Starting Textract job", {
        bucket: process.env.UPLOAD_BUCKET,
        key: item.key,
        snsTopicArn: process.env.TEXTRACT_SNS_TOPIC_ARN,
        roleArn: process.env.TEXTRACT_ROLE_ARN,
      });

      // Start async Textract job
      const textractResponse = await textract.send(new StartDocumentAnalysisCommand({
        DocumentLocation: {
          S3Object: {
            Bucket: process.env.UPLOAD_BUCKET,
            Name: item.key,
          },
        },
        FeatureTypes: ["TABLES", "FORMS"],
        NotificationChannel: {
          SNSTopicArn: process.env.TEXTRACT_SNS_TOPIC_ARN,
          RoleArn: process.env.TEXTRACT_ROLE_ARN,
        },
        JobTag: `${userId.replace(/-/g, '')}${documentId.replace(/-/g, '')}`,
      }));

      // Store Textract JobId on the document item
      await db.send(new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: { userId, sortKey: item.sortKey },
        UpdateExpression: "SET redactionResults.jobId = :jobId",
        ExpressionAttributeValues: {
          ":jobId": textractResponse.JobId,
        },
      }));
    }
    else {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: `Unsupported processing type: ${processingType}` }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "Processing started", documentId, processingType }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};