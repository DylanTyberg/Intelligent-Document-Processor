import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const db = DynamoDBDocumentClient.from(client);
const sqs = new SQSClient({ region: process.env.AWS_REGION || "us-east-1" });

export const handler = async (event) => {
  try {
    const { processingType, userId } = JSON.parse(event.body);
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
    } else {
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