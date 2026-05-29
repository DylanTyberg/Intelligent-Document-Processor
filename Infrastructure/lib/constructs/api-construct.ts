import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as kms from "aws-cdk-lib/aws-kms";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";

interface ApiConstructProps {
  userPool: cognito.UserPool;
  uploadBucket: s3.Bucket;
  resultsBucket: s3.Bucket;
  table: dynamodb.Table;
  encryptionKey: kms.Key;
  eventBus: events.EventBus;
}

export class ApiConstruct extends Construct {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    // --- Cognito Authorizer ---

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      "ApiAuthorizer",
      {
        cognitoUserPools: [props.userPool],
      }
    );

    const authOptions: apigateway.MethodOptions = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    // --- REST API ---

    this.api = new apigateway.RestApi(this, "DocumentApi", {
      restApiName: "Document Processing API",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ["Content-Type", "Authorization"],
      },
    });

    // --- Lambda Handlers ---

    // Generates a presigned S3 upload URL and creates initial DynamoDB record
    const uploadLambda = new lambda.Function(this, "UploadLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambdas/upload"),
      timeout: Duration.seconds(30),
      memorySize: 256,
      environment: {
        UPLOAD_BUCKET: props.uploadBucket.bucketName,
        TABLE_NAME: props.table.tableName,
      },
    });

    // Triggers processing by emitting EventBridge event for an existing document
    const processLambda = new lambda.Function(this, "ProcessLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambdas/process"),
      timeout: Duration.seconds(30),
      memorySize: 256,
      environment: {
        TABLE_NAME: props.table.tableName,
        EVENT_BUS_NAME: props.eventBus.eventBusName,
      },
    });

    // Returns list of documents or a single document for a user
    const getDocumentsLambda = new lambda.Function(this, "GetDocumentsLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambdas/get-documents"),
      timeout: Duration.seconds(30),
      memorySize: 256,
      environment: {
        TABLE_NAME: props.table.tableName,
      },
    });

    // Returns processing results for a specific document
    const getResultsLambda = new lambda.Function(this, "GetResultsLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambdas/get-results"),
      timeout: Duration.seconds(30),
      memorySize: 256,
      environment: {
        TABLE_NAME: props.table.tableName,
        RESULTS_BUCKET: props.resultsBucket.bucketName,
      },
    });

    const getDocumentLambda = new lambda.Function(
      this,
      "GetDocumentLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset("lambdas/get-document"),
        timeout: Duration.seconds(30),
        memorySize: 256,
        environment: {
          TABLE_NAME: props.table.tableName,
          UPLOAD_BUCKET: props.uploadBucket.bucketName,
        },
      }
    );

    // Updates document metadata
    const updateDocumentLambda = new lambda.Function(
      this,
      "UpdateDocumentLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset("lambdas/update-document"),
        timeout: Duration.seconds(30),
        memorySize: 256,
        environment: {
          TABLE_NAME: props.table.tableName,
        },
      }
    );

    // Deletes document from S3 and DynamoDB
    const deleteDocumentLambda = new lambda.Function(
      this,
      "DeleteDocumentLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset("lambdas/delete-document"),
        timeout: Duration.seconds(30),
        memorySize: 256,
        environment: {
          TABLE_NAME: props.table.tableName,
          UPLOAD_BUCKET: props.uploadBucket.bucketName,
          RESULTS_BUCKET: props.resultsBucket.bucketName,
        },
      }
    );

    // --- Permissions ---

    // Upload Lambda needs to generate presigned URLs and create DynamoDB records
    props.uploadBucket.grantPut(uploadLambda);
    props.table.grantWriteData(uploadLambda);

    // Process Lambda needs to read document metadata and emit events
    props.table.grantReadWriteData(processLambda);
    props.eventBus.grantPutEventsTo(processLambda);

    // Get Lambdas need read access
    props.table.grantReadData(getDocumentsLambda);
    props.table.grantReadData(getDocumentLambda);
    props.table.grantReadData(getResultsLambda);
    props.uploadBucket.grantRead(getDocumentLambda)
    props.resultsBucket.grantRead(getResultsLambda);

    // Update Lambda needs read/write on table
    props.table.grantReadWriteData(updateDocumentLambda);

    // Delete Lambda needs delete access on both buckets and table
    props.uploadBucket.grantDelete(deleteDocumentLambda);
    props.resultsBucket.grantDelete(deleteDocumentLambda);
    props.table.grantReadWriteData(deleteDocumentLambda);

    // --- API Routes ---

    const documents = this.api.root.addResource("documents");

    // POST /documents — get presigned upload URL + create DynamoDB record
    documents.addMethod("GET", new apigateway.LambdaIntegration(getDocumentsLambda), {/*authOptions*/});
    documents.addMethod("POST", new apigateway.LambdaIntegration(uploadLambda), {/*authOptions*/});

    const singleDocument = documents.addResource("{documentId}");

    // GET /documents/{documentId} — get document metadata
    singleDocument.addMethod("GET", new apigateway.LambdaIntegration(getDocumentLambda), {/*authOptions*/});
    // PUT /documents/{documentId} — update document metadata
    singleDocument.addMethod("PUT", new apigateway.LambdaIntegration(updateDocumentLambda), authOptions);
    // DELETE /documents/{documentId} — delete document and all associated data
    singleDocument.addMethod("DELETE", new apigateway.LambdaIntegration(deleteDocumentLambda), {/*authOptions*/});

    // POST /documents/{documentId}/process — trigger processing on existing document
    const processResource = singleDocument.addResource("process");
    processResource.addMethod("POST", new apigateway.LambdaIntegration(processLambda), authOptions);

    // GET /documents/{documentId}/results — get processing results
    const resultsResource = singleDocument.addResource("results");
    resultsResource.addMethod("GET", new apigateway.LambdaIntegration(getResultsLambda), authOptions);
  }
}