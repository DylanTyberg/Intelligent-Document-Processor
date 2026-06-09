import { TextractClient, GetDocumentAnalysisCommand } from "@aws-sdk/client-textract";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { PDFDocument, rgb } from "pdf-lib";

const textract = new TextractClient({ region: process.env.AWS_REGION || "us-east-1" });
const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" }));

const reinsertHyphens = (flat) => {
  // UUID format: 8-4-4-4-12
  return `${flat.slice(0,8)}-${flat.slice(8,12)}-${flat.slice(12,16)}-${flat.slice(16,20)}-${flat.slice(20)}`;
};

const getAllTextractBlocks = async (jobId) => {
  const blocks = [];
  let nextToken = undefined;

  do {
    const response = await textract.send(new GetDocumentAnalysisCommand({
      JobId: jobId,
      ...(nextToken && { NextToken: nextToken }),
    }));
    blocks.push(...response.Blocks);
    nextToken = response.NextToken;
  } while (nextToken);

  return blocks;
};

const streamToBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

export const handler = async (event) => {
  for (const record of event.Records) {
    try {
      // SNS wraps the message in an extra layer
      const snsMessage = JSON.parse(record.body);
      const textractMessage = JSON.parse(snsMessage.Message);

      const jobId = textractMessage.JobId;
      const jobStatus = textractMessage.Status;

      if (jobStatus !== "SUCCEEDED") {
        console.error(`Textract job ${jobId} failed with status ${jobStatus}`);
        // Parse userId and documentId from JobTag
        const rawTag = textractMessage.JobTag;
        const userId = reinsertHyphens(rawTag.slice(0, 32));
        const documentId = reinsertHyphens(rawTag.slice(32));
        await updateRedactionStatus(userId, `DOC#${documentId}`, "failed");
        continue;
      }

      // Parse userId and documentId from JobTag
      const rawTag = textractMessage.JobTag;
      const userId = reinsertHyphens(rawTag.slice(0, 32));
      const documentId = reinsertHyphens(rawTag.slice(32));

      // Fetch document from DynamoDB
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
        console.error(`Document not found for userId ${userId} documentId ${documentId}`);
        continue;
      }

      const piiEntities = item.piiResults?.entities ?? [];
      if (piiEntities.length === 0) {
        // Copy original to redacted path unchanged
        const redactedKey = `redacted/${userId}/${documentId}/redacted.pdf`;
        await s3.send(new CopyObjectCommand({
            CopySource: `${process.env.UPLOAD_BUCKET}/${item.key}`,
            Bucket: process.env.RESULTS_BUCKET,
            Key: redactedKey,
        }));
        await updateRedactionStatus(userId, item.sortKey, "complete", redactedKey);
        continue;
      }

      // Get all Textract blocks with pagination
      const blocks = await getAllTextractBlocks(jobId);

      // Build a map of word text → bounding boxes per page
      // { pageNumber: [{ text, left, top, width, height }] }
      const wordsByPage = {};
      for (const block of blocks) {
        if (block.BlockType !== "WORD") continue;
        const page = block.Page ?? 1;
        if (!wordsByPage[page]) wordsByPage[page] = [];
        wordsByPage[page].push({
          text: block.Text,
          ...block.Geometry.BoundingBox,
        });
      }

      // Fetch original PDF from S3
      const s3Response = await s3.send(new GetObjectCommand({
        Bucket: process.env.UPLOAD_BUCKET,
        Key: item.key,
      }));
      const pdfBuffer = await streamToBuffer(s3Response.Body);

      // Load PDF with pdf-lib
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pages = pdfDoc.getPages();

      // For each PII entity value, find matching words and redact
      for (const entity of piiEntities) {
        const entityWords = entity.value.trim().split(/\s+/);

        for (const [pageIndex, page] of pages.entries()) {
          const pageNum = pageIndex + 1;
          const pageWords = wordsByPage[pageNum] ?? [];
          const { width: pageWidth, height: pageHeight } = page.getSize();

          // Slide a window of entityWords.length across the page words
          for (let i = 0; i <= pageWords.length - entityWords.length; i++) {
            const window = pageWords.slice(i, i + entityWords.length);
            const windowText = window.map(w => w.text).join(" ");

            // Fuzzy match — normalize whitespace and case
            if (windowText.toLowerCase() !== entity.value.toLowerCase()) continue;

            // Draw a black rectangle over each word in the match
            for (const word of window) {
              const x = word.Left * pageWidth;
              const y = pageHeight - (word.Top * pageHeight) - (word.Height * pageHeight);
              const w = word.Width * pageWidth;
              const h = word.Height * pageHeight;

              page.drawRectangle({
                x,
                y,
                width: w,
                height: h,
                color: rgb(0, 0, 0),
                opacity: 1,
              });
            }
          }
        }
      }

      // Save redacted PDF
      const redactedPdfBytes = await pdfDoc.save();

      // Write to results bucket under redacted/ prefix
      const redactedKey = `redacted/${userId}/${documentId}/redacted.pdf`;
      await s3.send(new PutObjectCommand({
        Bucket: process.env.RESULTS_BUCKET,
        Key: redactedKey,
        Body: Buffer.from(redactedPdfBytes),
        ContentType: "application/pdf",
      }));

      // Update DynamoDB with redacted key and complete status
      await db.send(new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: { userId, sortKey: item.sortKey },
        UpdateExpression: "SET redactionResults = :redaction",
        ExpressionAttributeValues: {
          ":redaction": {
            status: "complete",
            redactedKey,
            completedAt: new Date().toISOString(),
          },
        },
      }));

      console.log(`Redaction complete for document ${documentId}`);

    } catch (error) {
      console.error("Redaction error:", error);
      throw error; // Re-throw so SQS retries
    }
  }
};

const updateRedactionStatus = async (userId, sortKey, status, redactedKey = null) => {
  await db.send(new UpdateCommand({
    TableName: process.env.TABLE_NAME,
    Key: { userId, sortKey },
    UpdateExpression: "SET redactionResults = :redaction",
    ExpressionAttributeValues: {
      ":redaction": {
        status,
        ...(redactedKey && { redactedKey }),
        completedAt: new Date().toISOString(),
      },
    },
  }));
};