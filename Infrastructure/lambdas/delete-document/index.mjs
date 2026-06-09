import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb"
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3"

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const db = DynamoDBDocumentClient.from(client);
const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

export const handler = async (event) => {
  try {
    const { documentId } = event.pathParameters;
    const {sortKey } = event.queryStringParameters;
    const userId = event.requestContext.authorizer.claims.sub;

    // Fetch item first to get the S3 key
    const { Item } = await db.send(new GetCommand({
      TableName: process.env.TABLE_NAME,
      Key: { userId, sortKey }
    }));

    if (!Item) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Document not found" }),
      };
    }

    // Delete from S3
    await s3.send(new DeleteObjectCommand({
      Bucket: process.env.UPLOAD_BUCKET,
      Key: Item.key,
    }));

    // Delete from DynamoDB
    await db.send(new DeleteCommand({
      TableName: process.env.TABLE_NAME,
      Key: { userId, sortKey }
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ deleted: documentId }),
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