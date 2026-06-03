import { TextractClient, AnalyzeDocumentCommand } from "@aws-sdk/client-textract";
import { ComprehendClient, DetectPiiEntitiesCommand } from "@aws-sdk/client-comprehend";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import pdf from "pdf-parse";

const textract = new TextractClient({ region: process.env.AWS_REGION || "us-east-1" });
const comprehend = new ComprehendClient({ region: process.env.AWS_REGION || "us-east-1" });
const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" }));

const MIN_TEXT_LENGTH = 50;

const extractTextDirect = async (bucket, key) => {
  const s3Response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks = [];
  for await (const chunk of s3Response.Body) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  const parsed = await pdf(buffer);
  return parsed.text?.trim() ?? "";
};

const extractTextTextract = async (bucket, key) => {
  const result = await textract.send(new AnalyzeDocumentCommand({
    Document: {
      S3Object: { Bucket: bucket, Name: key }
    },
    FeatureTypes: ["TABLES", "FORMS"],
  }));
  return result.Blocks
    .filter(block => block.BlockType === "LINE")
    .map(block => block.Text)
    .join(" ");
};

export const handler = async (event) => {
  const { userId, s3Key, sortKey } = JSON.parse(event.Records[0].body);

  const bucket = process.env.UPLOAD_BUCKET;
  let text = "";
  let extractionMethod = "direct";

  // Try direct text extraction first
  const isPdf = s3Key.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    text = await extractTextDirect(bucket, s3Key);
    extractionMethod = "direct";
  }

  // Fall back to Textract for scanned/image PDFs
  if (text.length < MIN_TEXT_LENGTH) {
    extractionMethod = "textract";
    text = await extractTextTextract(bucket, s3Key);
  }

  console.log(`Extracted ${text.length} chars via ${extractionMethod}`);

  // Detect PII
  const comprehendResult = await comprehend.send(new DetectPiiEntitiesCommand({
    Text: text.slice(0, 5000), // Comprehend limit is 5000 bytes
    LanguageCode: "en",
  }));

  const entities = comprehendResult.Entities;

  const riskLevel = entities.length === 0 ? "none"
    : entities.length <= 2 ? "low"
    : entities.length <= 5 ? "medium"
    : "high";

  await db.send(new UpdateCommand({
    TableName: process.env.TABLE_NAME,
    Key: { userId, sortKey },
    UpdateExpression: "SET #status = :status, piiResults = :piiResults",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: {
      ":status": "complete",
      ":piiResults": {
        status: "complete",
        runAt: new Date().toISOString(),
        entityCount: entities.length,
        riskLevel,
        extractionMethod,
        entities: entities.map(e => ({
          type: e.Type,
          confidence: e.Score,
          value: text.slice(e.BeginOffset, e.EndOffset),
        })),
      },
    },
  }));
};