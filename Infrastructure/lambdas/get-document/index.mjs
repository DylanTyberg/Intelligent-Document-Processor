import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const db = DynamoDBDocumentClient.from(client);
const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

export const handler = async (event) => {
  try {
    const { userId } = event.queryStringParameters;
    const { documentId } = event.pathParameters;

    const { Items } = await db.send(new QueryCommand({
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: "userId = :pk AND begins_with(sortKey, :sk)",
      ExpressionAttributeValues: {
        ":pk": userId,
        ":sk": "DOC#",
      },
    }));

    if (!Items || Items.length === 0) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Document not found" }),
      };
    }

    const item = Items?.find(i => i.sortKey.endsWith(documentId));

    const s3Url = await getSignedUrl(s3, new GetObjectCommand({
      Bucket: process.env.UPLOAD_BUCKET,
      Key: item.key,
    }), { expiresIn: 3600 });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ 
        ...item, 
        s3Url,
        piiDetection: item.piiResults ?? null,
      }),
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