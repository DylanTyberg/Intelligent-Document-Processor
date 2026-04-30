import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as kms from "aws-cdk-lib/aws-kms";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

interface ProcessingConstructProps {
  uploadBucket: s3.Bucket;
  resultsBucket: s3.Bucket;
  table: dynamodb.Table;
  encryptionKey: kms.Key;
}

export class ProcessingConstruct extends Construct {
  public readonly eventBus: events.EventBus;

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

    // --- Processing Lambdas (placeholder handlers) ---

    // TODO: Replace handler paths once Lambda code is written

    // const piiLambda = new lambda.Function(this, "PiiLambda", {
    //   runtime: lambda.Runtime.NODEJS_20_X,
    //   handler: "index.handler",
    //   code: lambda.Code.fromAsset("lambdas/pii-detection"),
    //   timeout: Duration.seconds(120),
    //   memorySize: 512,
    // });

    // const analysisLambda = new lambda.Function(this, "AnalysisLambda", {
    //   runtime: lambda.Runtime.NODEJS_20_X,
    //   handler: "index.handler",
    //   code: lambda.Code.fromAsset("lambdas/ai-analysis"),
    //   timeout: Duration.seconds(120),
    //   memorySize: 512,
    // });

    // --- Permissions (uncomment when Lambdas are active) ---

    // Grant Lambdas read access to upload bucket
    // props.uploadBucket.grantRead(piiLambda);
    // props.uploadBucket.grantRead(analysisLambda);

    // Grant Lambdas write access to results bucket
    // props.resultsBucket.grantWrite(piiLambda);
    // props.resultsBucket.grantWrite(analysisLambda);

    // Grant Lambdas read/write access to DynamoDB table
    // props.table.grantReadWriteData(piiLambda);
    // props.table.grantReadWriteData(analysisLambda);

    // Grant Lambdas decrypt access to KMS key
    // props.encryptionKey.grantDecrypt(piiLambda);
    // props.encryptionKey.grantDecrypt(analysisLambda);

    // Wire SQS as Lambda event sources
    // piiLambda.addEventSource(new SqsEventSource(piiQueue, { batchSize: 1 }));
    // analysisLambda.addEventSource(new SqsEventSource(analysisQueue, { batchSize: 1 }));
  }
}