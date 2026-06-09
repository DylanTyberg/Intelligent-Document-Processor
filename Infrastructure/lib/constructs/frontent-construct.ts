import { Construct } from "constructs";
import { RemovalPolicy, CfnOutput } from "aws-cdk-lib";
import { Bucket, BlockPublicAccess } from "aws-cdk-lib/aws-s3";
import {
  Distribution,
  ViewerProtocolPolicy,
  ErrorResponse,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { Certificate, CertificateValidation } from "aws-cdk-lib/aws-certificatemanager";
import { HostedZone, ARecord, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import * as path from "path";

const DOMAIN = "doc-processing-platform.htytun.com";

export class FrontendConstruct extends Construct {
  public readonly distribution: Distribution;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Look up your existing hosted zone — no new zone created
    const hostedZone = HostedZone.fromLookup(this, "Zone", {
      domainName: "htytun.com",
    });

    // ACM cert must be in us-east-1 for CloudFront — if your stack deploys
    // to a different region, you need a cross-region cert (see note below)
    const certificate = new Certificate(this, "Certificate", {
      domainName: DOMAIN,
      validation: CertificateValidation.fromDns(hostedZone),
    });

    const siteBucket = new Bucket(this, "SiteBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const spaErrorResponses: ErrorResponse[] = [
      { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html" },
      { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html" },
    ];

    this.distribution = new Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: "index.html",
      errorResponses: spaErrorResponses,
      domainNames: [DOMAIN],
      certificate,
    });

    // A record: docs.htytun.com → CloudFront distribution
    new ARecord(this, "AliasRecord", {
        zone: hostedZone,
        recordName: "doc-processing-platform",  // not the full domain
        target: RecordTarget.fromAlias(new CloudFrontTarget(this.distribution)),
    });

    new CfnOutput(this, "CloudFrontURL", {
      value: `https://${DOMAIN}`,
      description: "Frontend URL",
    });
    new CfnOutput(this, "SiteBucketName", {
        value: siteBucket.bucketName,
        description: "S3 bucket for frontend assets",
    });
  }
}