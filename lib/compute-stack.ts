import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

/**
 * ComputeStack Props
 */
export interface ComputeStackProps extends cdk.StackProps {
  table: dynamodb.ITable;
}

/**
 * ComputeStack
 * Lambda 함수들을 정의하는 스택
 */
export class ComputeStack extends cdk.Stack {
  public readonly lexHandler: lambda.Function;
  public readonly orchestrator: lambda.Function;
  public readonly smsSender: lambda.Function;
  public readonly responseHandler: lambda.Function;
  public readonly notificationGenerator: lambda.Function;
  public readonly timeoutHandler: lambda.Function;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const { table } = props;

    // 공통 Lambda 환경 변수
    const commonEnvironment = {
      TABLE_NAME: table.tableName,
      NODE_OPTIONS: "--enable-source-maps",
    };

    // Lex Handler Lambda
    this.lexHandler = new lambda.Function(this, "LexHandler", {
      functionName: "PartnerConfirmation-LexHandler",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "lex-handler.handler",
      code: lambda.Code.fromAsset("dist/lambda", {
        exclude: ["**", "!lex-handler.js", "!lex-handler.js.map"],
      }),
      environment: {
        ...commonEnvironment,
        LEX_BOT_ID: process.env.LEX_BOT_ID || "PLACEHOLDER",
        LEX_BOT_ALIAS_ID: process.env.LEX_BOT_ALIAS_ID || "PLACEHOLDER",
        LEX_LOCALE_ID: "ko_KR",
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });

    // Orchestrator Lambda (추후 구현)
    this.orchestrator = new lambda.Function(this, "Orchestrator", {
      functionName: "PartnerConfirmation-Orchestrator",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Orchestrator - To be implemented');
          return { success: true };
        };
      `),
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });

    // SMS Sender Lambda (추후 구현)
    this.smsSender = new lambda.Function(this, "SmsSender", {
      functionName: "PartnerConfirmation-SmsSender",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('SmsSender - To be implemented');
          return { success: true };
        };
      `),
      environment: {
        ...commonEnvironment,
        SECRET_KEY: "PLACEHOLDER", // 추후 Secrets Manager로 교체
        CONFIRM_URL: "https://confirm.example.com/r",
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });

    // Response Handler Lambda (추후 구현)
    this.responseHandler = new lambda.Function(this, "ResponseHandler", {
      functionName: "PartnerConfirmation-ResponseHandler",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('ResponseHandler - To be implemented');
          return {
            statusCode: 200,
            body: JSON.stringify({ message: 'To be implemented' })
          };
        };
      `),
      environment: {
        ...commonEnvironment,
        SECRET_KEY: "PLACEHOLDER",
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });

    // Notification Generator Lambda (추후 구현)
    this.notificationGenerator = new lambda.Function(
      this,
      "NotificationGenerator",
      {
        functionName: "PartnerConfirmation-NotificationGenerator",
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('NotificationGenerator - To be implemented');
          return { success: true };
        };
      `),
        environment: commonEnvironment,
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
      }
    );

    // Timeout Handler Lambda (추후 구현)
    this.timeoutHandler = new lambda.Function(this, "TimeoutHandler", {
      functionName: "PartnerConfirmation-TimeoutHandler",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('TimeoutHandler - To be implemented');
          return { success: true };
        };
      `),
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });

    // DynamoDB 권한 부여
    table.grantReadWriteData(this.lexHandler);
    table.grantReadWriteData(this.orchestrator);
    table.grantReadWriteData(this.smsSender);
    table.grantReadWriteData(this.responseHandler);
    table.grantReadWriteData(this.notificationGenerator);
    table.grantReadWriteData(this.timeoutHandler);

    // Lex Handler에 Lex 권한 부여
    this.lexHandler.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ["lex:RecognizeText"],
        resources: ["*"], // 특정 봇으로 제한 가능
      })
    );

    // 출력
    new cdk.CfnOutput(this, "LexHandlerArn", {
      value: this.lexHandler.functionArn,
      description: "Lex Handler Lambda ARN",
    });

    new cdk.CfnOutput(this, "OrchestratorArn", {
      value: this.orchestrator.functionArn,
      description: "Orchestrator Lambda ARN",
    });
  }
}
