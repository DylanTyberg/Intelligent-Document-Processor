import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as kms from "aws-cdk-lib/aws-kms";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as iam from "aws-cdk-lib/aws-iam";

interface ProcessingConstructProps {
  uploadBucket: s3.Bucket;
  resultsBucket: s3.Bucket;
  table: dynamodb.Table;
  encryptionKey: kms.Key;
}

export class ProcessingConstruct extends Construct {
  public readonly eventBus: events.EventBus;
  public readonly piiQueue: sqs.Queue;
  public readonly summarizationQueue: sqs.Queue;
  public readonly analysisQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: ProcessingConstructProps) {
    super(scope, id);

    // Custom event bus for document processing events
    this.eventBus = new events.EventBus(this, "DocumentEventBus", {
      eventBusName: "document-processing-bus",
    });

    // --- PII Detection Path ---

    const piiDlq = new sqs.Queue(this, "PiiDlq", {
      retentionPeriod: Duration.days(14),
    });

    const piiQueue = new sqs.Queue(this, "PiiQueue", {
      visibilityTimeout: Duration.seconds(300),
      deadLetterQueue: {
        queue: piiDlq,
        maxReceiveCount: 3,
      },
    });

    this.piiQueue = piiQueue;

    // --- AI Analysis Path ---

    const analysisDlq = new sqs.Queue(this, "AnalysisDlq", {
      retentionPeriod: Duration.days(14),
    });

    const analysisQueue = new sqs.Queue(this, "AnalysisQueue", {
      visibilityTimeout: Duration.seconds(300),
      deadLetterQueue: {
        queue: analysisDlq,
        maxReceiveCount: 3,
      },
    });

    this.analysisQueue = analysisQueue;

    // summarization path
    const summarizationDlq = new sqs.Queue(this, "SummarizationDlq", {
      retentionPeriod: Duration.days(14),
    });

    const summarizationQueue = new sqs.Queue(this, "SummarizationQueue", {
      visibilityTimeout: Duration.seconds(300),
      deadLetterQueue: {
        queue: summarizationDlq,
        maxReceiveCount: 3,
      },
    });

    this.summarizationQueue = summarizationQueue;

    // --- EventBridge Rules ---

    new events.Rule(this, "PiiRule", {
      eventBus: this.eventBus,
      eventPattern: {
        source: ["document.upload"],
        detailType: ["DocumentUploaded"],
        detail: {
          processingType: ["pii-detection"],
        },
      },
      targets: [new targets.SqsQueue(piiQueue)],
    });

    new events.Rule(this, "AnalysisRule", {
      eventBus: this.eventBus,
      eventPattern: {
        source: ["document.upload"],
        detailType: ["DocumentUploaded"],
        detail: {
          processingType: ["ai-analysis"],
        },
      },
      targets: [new targets.SqsQueue(analysisQueue)],
    });

    new events.Rule(this, "SummarizationRule", {
      eventBus: this.eventBus,
      eventPattern: {
        source: ["document.upload"],
        detailType: ["DocumentUploaded"],
        detail: {
          processingType: ["summarization"],
        },
      },
      targets: [new targets.SqsQueue(summarizationQueue)],
    });

    // --- Processing Lambdas (placeholder handlers) ---

    // TODO: Replace handler paths once Lambda code is written

    const piiLambda = new lambda.Function(this, "PiiLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambdas/pii-detection"),
      timeout: Duration.seconds(120),
      memorySize: 512,
      environment: {
        TABLE_NAME: props.table.tableName,
        UPLOAD_BUCKET: props.uploadBucket.bucketName,
      },
    });

    piiLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        "textract:DetectDocumentText",
        "textract:AnalyzeDocument",
      ],
      resources: ["*"],
    }));

    piiLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ["comprehend:DetectPiiEntities"],
      resources: ["*"],
    }));

    const summarizationLambda = new lambda.Function(this, "SummarizationLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambdas/summarization"),
      timeout: Duration.seconds(120),
      memorySize: 512,
      environment: {
        TABLE_NAME: props.table.tableName,
        UPLOAD_BUCKET: props.uploadBucket.bucketName,
      },
    });

    summarizationLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ["bedrock:InvokeModel"],
      resources: ["arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"],
    }));

    // const analysisLambda = new lambda.Function(this, "AnalysisLambda", {
    //   runtime: lambda.Runtime.NODEJS_20_X,
    //   handler: "index.handler",
    //   code: lambda.Code.fromAsset("lambdas/ai-analysis"),
    //   timeout: Duration.seconds(120),
    //   memorySize: 512,
    // });

    // --- Permissions (uncomment when Lambdas are active) ---

    // Grant Lambdas read access to upload bucket
     props.uploadBucket.grantRead(piiLambda);
    // props.uploadBucket.grantRead(analysisLambda);
     props.uploadBucket.grantRead(summarizationLambda);

    // Grant Lambdas write access to results bucket
     props.resultsBucket.grantWrite(piiLambda);
    // props.resultsBucket.grantWrite(analysisLambda);
     props.resultsBucket.grantWrite(summarizationLambda);

    // Grant Lambdas read/write access to DynamoDB table
     props.table.grantReadWriteData(piiLambda);
    // props.table.grantReadWriteData(analysisLambda);
     props.table.grantReadWriteData(summarizationLambda);

    // Grant Lambdas decrypt access to KMS key
     props.encryptionKey.grantDecrypt(piiLambda);
    // props.encryptionKey.grantDecrypt(analysisLambda);
     props.encryptionKey.grantDecrypt(summarizationLambda);

    // Wire SQS as Lambda event sources
     piiLambda.addEventSource(new SqsEventSource(piiQueue, { batchSize: 1 }));
    // analysisLambda.addEventSource(new SqsEventSource(analysisQueue, { batchSize: 1 }));
     summarizationLambda.addEventSource(new SqsEventSource(summarizationQueue, { batchSize: 1 }));
  }
}