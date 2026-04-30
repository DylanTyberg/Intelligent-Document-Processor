import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as kms from "aws-cdk-lib/aws-kms";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { RemovalPolicy } from "aws-cdk-lib";

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

        this.uploadBucket = new s3.Bucket(this, "UploadBucket", {
            encryption: s3.BucketEncryption.KMS,
            encryptionKey: this.key,
            versioned: true,
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        })

        this.resultsBucket = new s3.Bucket(this, "ResultsBUcket", {
            encryption: s3.BucketEncryption.KMS,
            encryptionKey: this.key,
            versioned: true,
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true

        })

        this.table = new dynamodb.Table(this, 'Table', {
            partitionKey: {name: 'user', type: dynamodb.AttributeType.STRING},
            sortKey: { name: 'processingType#TBD', type:dynamodb.AttributeType.STRING},
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
            encryptionKey: this.key,
            removalPolicy: RemovalPolicy.DESTROY
        })

    }
}

