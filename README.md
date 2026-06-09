# Intelligent Document Processor

A cloud-native document processing platform built on AWS. Upload PDFs and images, run AI-powered analysis to detect sensitive information, generate summaries, and produce redacted versions — all through a secure, serverless pipeline.

**Live demo:** [doc-processing-platform.htytun.com](https://doc-processing-platform.htytun.com)

---

## What It Does

| Feature | Details |
|---|---|
| **Document Upload** | Secure presigned S3 upload — files never pass through the API |
| **PII Detection** | Identifies sensitive entities (SSNs, emails, names, dates) via Amazon Comprehend with confidence scores |
| **AI Summarization** | Generates concise document summaries via Amazon Bedrock (Claude) |
| **PDF Redaction** | Produces a redacted PDF with PII blacked out using Textract bounding boxes — toggle between original and redacted in the viewer |
| **Document Viewer** | In-browser PDF rendering with original/redacted toggle and per-page navigation |

---

## Architecture

<img width="1680" height="1177" alt="image" src="https://github.com/user-attachments/assets/3b3f5412-812b-44b5-871d-3ff8b0712aa3" />



### Request Flow

```
User → CloudFront → React SPA (S3)
User → WAF → API Gateway → Lambda → DynamoDB / S3

Upload:
  POST /documents → Upload Lambda → Presigned S3 URL → Client uploads directly to S3

PII / Summarization:
  POST /documents/{id}/process → Process Lambda → SQS → Worker Lambda → DynamoDB

Redaction:
  POST /documents/{id}/process → Process Lambda → Textract StartDocumentAnalysis
  → Textract completes → SNS → SQS → Redaction Lambda
  → pdf-lib draws black rectangles at Textract bounding box coordinates
  → Redacted PDF written to S3 → DynamoDB updated
```

---

## Tech Stack

### Frontend
- React + Vite, TypeScript
- Tailwind CSS + shadcn/ui
- react-pdf for in-browser PDF rendering
- Hosted on S3 + CloudFront with custom domain (Route53 + ACM)

### Backend
- API Gateway + AWS Lambda (Node.js 20)
- Amazon DynamoDB (single-table design, PAY_PER_REQUEST)
- Amazon S3 (upload bucket + results bucket, both KMS encrypted)
- Amazon SQS (per-pipeline queues with DLQs)
- Amazon SNS (Textract async completion notifications)
- Amazon EventBridge (custom event bus)

### AI / ML
- **Amazon Comprehend** — PII entity detection with confidence scoring
- **Amazon Bedrock** (Claude) — document summarization
- **Amazon Textract** — async document analysis with word-level bounding boxes for redaction coordinate mapping

### Infrastructure
- AWS CDK (TypeScript) — all infrastructure defined as code
- Amazon Cognito — user authentication with MFA, JWT-authorized API routes
- AWS KMS — customer-managed encryption key for S3, DynamoDB, and results bucket
- AWS WAF — managed rule sets (OWASP Common, Known Bad Inputs, IP Reputation) + rate limiting
- CloudTrail — API audit logging

---

## Security Design

Security is a first-class concern in this project, not an afterthought.

**No public S3 access** — all documents are served via short-lived presigned URLs (1 hour expiry). The S3 buckets have `BlockPublicAccess` fully enabled.

**Least-privilege IAM** — each Lambda function has its own execution role scoped to only the resources and actions it needs. No shared roles.

**KMS encryption at rest** — a customer-managed KMS key encrypts all S3 objects and DynamoDB data. The Textract service principal is explicitly granted decrypt access.

**WAF on API Gateway** — AWS managed rule groups block OWASP Top 10 attack patterns, known bad inputs, and malicious IPs. A rate-based rule blocks IPs exceeding 100 requests per 5-minute window to prevent Lambda cost exploitation.

**Cognito authentication** — all API routes require a valid Cognito JWT. The authorizer validates tokens on every request at the API Gateway layer before Lambda is invoked.

**Prompt injection surface** — document content passed to Bedrock for summarization is a potential prompt injection vector. Bedrock Guardrails are on the roadmap to mitigate this.

**Redaction integrity** — original documents are never modified. Redacted PDFs are written as new objects to a separate S3 prefix, preserving the source of truth.

---


## Background

Built as a portfolio project at the intersection of cloud architecture, AI/ML services, and security engineering. Deployed on AWS with all infrastructure defined in CDK.

**AWS Certifications:** Cloud Practitioner · Developer Associate · Solutions Architect Associate  
**In progress:** Security Specialty · CompTIA Security+
