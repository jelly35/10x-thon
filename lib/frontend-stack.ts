import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

/**
 * FrontendStack Props
 */
export interface FrontendStackProps extends cdk.StackProps {
  apiUrl: string;
}

/**
 * FrontendStack
 * 고객 웹 UI를 위한 S3 정적 웹사이트 호스팅 스택
 */
export class FrontendStack extends cdk.Stack {
  public readonly websiteBucket: s3.Bucket;
  public readonly websiteUrl: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const { apiUrl } = props;

    // S3 버킷 생성
    this.websiteBucket = new s3.Bucket(this, "CustomerWebsiteBucket", {
      bucketName: `partner-confirmation-customer-${this.account}-${this.region}`,
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "index.html",
      publicReadAccess: true,
      blockPublicAccess: {
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
    });

    // API URL을 포함한 설정 파일 생성
    const configContent = `window.API_BASE_URL = '${apiUrl}';`;

    // 웹사이트 파일 배포
    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [
        s3deploy.Source.asset("./frontend"),
        s3deploy.Source.data("config.js", configContent),
      ],
      destinationBucket: this.websiteBucket,
    });

    // 웹사이트 URL
    this.websiteUrl = this.websiteBucket.bucketWebsiteUrl;

    // 출력
    new cdk.CfnOutput(this, "WebsiteUrl", {
      value: this.websiteUrl,
      description: "Customer Website URL",
      exportName: "CustomerWebsiteUrl",
    });

    new cdk.CfnOutput(this, "BucketName", {
      value: this.websiteBucket.bucketName,
      description: "S3 Bucket Name",
    });
  }
}
