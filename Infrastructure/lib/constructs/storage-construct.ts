import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as kms from "aws-cdk-lib/aws-kms";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import { RemovalPolicy, Stack } from "aws-cdk-lib";

export class StorageConstruct extends Construct {
    public readonly uploadBucket: s3.Bucket;
    public readonly resultsBucket: s3.Bucket;
    public readonly table: dynamodb.Table;
    public readonly key: kms.Key;

    constructor(scope: Construct, id: string) {
        super(scope, id)

        this.key = new kms.Key(this, "storage-key",{
            enableKeyRotation: true,
            alias: "alias/storage-key",
            removalPolicy: RemovalPolicy.DESTROY
        })

        this.key.addToResourcePolicy(new iam.PolicyStatement({
            principals: [new iam.ServicePrincipal("textract.amazonaws.com")],
            actions: ["kms:Decrypt", "kms:GenerateDataKey"],
            resources: ["*"],
            conditions: {
                StringEquals: {
                    "aws:SourceAccount": Stack.of(this).account,
                },
                ArnLike: {
                    "aws:SourceArn": `arn:aws:textract:${Stack.of(this).region}:${Stack.of(this).account}:*`,
                },
            },
        }));

        this.uploadBucket = new s3.Bucket(this, "UploadBucket", {
            encryption: s3.BucketEncryption.KMS,
            encryptionKey: this.key,
            versioned: true,
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            cors: [
                {
                    allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET, s3.HttpMethods.DELETE],
                    allowedOrigins: ['http://localhost:5173', 'http://localhost:3000', "https://doc-processing-platform.htytun.com"],
                    allowedHeaders: ['*'],
                    exposedHeaders: ['ETag'],
                }
            ]
        })

        this.uploadBucket.addToResourcePolicy(new iam.PolicyStatement({
            principals: [new iam.ServicePrincipal("textract.amazonaws.com")],
            actions: ["s3:GetObject"],
            resources: [`${this.uploadBucket.bucketArn}/*`],
            conditions: {
                StringEquals: {
                    "aws:SourceAccount": Stack.of(this).account,
                },
                ArnLike: {
                    "aws:SourceArn": `arn:aws:textract:${Stack.of(this).region}:${Stack.of(this).account}:*`,
                },
            },
        }));

        this.resultsBucket = new s3.Bucket(this, "ResultsBUcket", {
            encryption: s3.BucketEncryption.KMS,
            encryptionKey: this.key,
            versioned: true,
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            cors: [
                {
                    allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET, s3.HttpMethods.DELETE],
                    allowedOrigins: ['http://localhost:5173', 'http://localhost:3000', "https://doc-processing-platform.htytun.com"],
                    allowedHeaders: ['*'],
                    exposedHeaders: ['ETag'],
                }
            ]

        })

        this.table = new dynamodb.Table(this, 'Table', {
            partitionKey: {name: 'userId', type: dynamodb.AttributeType.STRING},
            sortKey: { name: 'sortKey', type:dynamodb.AttributeType.STRING},
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
            encryptionKey: this.key,
            removalPolicy: RemovalPolicy.DESTROY
        })

    }
}

