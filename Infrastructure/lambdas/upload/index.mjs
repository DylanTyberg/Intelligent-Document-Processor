import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const db = DynamoDBDocumentClient.from(client);

const s3 = new S3Client({region: process.env.AWS_REGION || "us-east-1"})

const sanitizeFileName = (name) => {
  const ext = name.includes('.') ? `.${name.split('.').pop()}` : '';
  const base = name.slice(0, name.length - ext.length);
  return base
    .replace(/\s+/g, '_')           // spaces → underscores
    .replace(/[^a-zA-Z0-9._\-]/g, '') // remove anything else special
    + ext;
};

export const handler = async (event) => {
  
  
  try {
    const userId = event.requestContext.authorizer.claims.sub;
    const {fileName, fileType, fileSize} = JSON.parse(event.body);
    const documentId = crypto.randomUUID();
    const sanitizedFileName = sanitizeFileName(fileName);
    const key = `uploads/${userId}/${documentId}/${sanitizedFileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.UPLOAD_BUCKET,
      Key: key,
      ContentType: fileType,
    })
    const signedUrl = await getSignedUrl(s3, command, {expiresIn: 300})

    const item = {
      userId,
      sortKey: `DOC#${documentId}`,
      key,                    // sanitized key
      fileName,               // original display name
      fileType,
      fileSize,
      status: "pending",
      uploadedAt: new Date().toISOString(),
    }

    await db.send(new PutCommand(
      {
        TableName: process.env.TABLE_NAME,
        Item: item
      }
    ))


    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({signedUrl, documentId}),
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
