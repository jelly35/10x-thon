import * as cdk from "aws-cdk-lib";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigatewayv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

/**
 * ApiStack Props
 */
export interface ApiStackProps extends cdk.StackProps {
  lexHandler: lambda.IFunction;
  responseHandler: lambda.IFunction;
}

/**
 * ApiStack
 * API Gateway HTTP API를 정의하는 스택
 */
export class ApiStack extends cdk.Stack {
  public readonly httpApi: apigatewayv2.HttpApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { lexHandler, responseHandler } = props;

    // HTTP API 생성
    this.httpApi = new apigatewayv2.HttpApi(this, "PartnerConfirmationApi", {
      apiName: "PartnerConfirmationApi",
      description: "Partner Confirmation Automation API",
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ["Content-Type", "Authorization"],
        maxAge: cdk.Duration.days(1),
      },
    });

    // Lambda 통합 생성
    const lexHandlerIntegration =
      new apigatewayv2Integrations.HttpLambdaIntegration(
        "LexHandlerIntegration",
        lexHandler
      );

    const responseHandlerIntegration =
      new apigatewayv2Integrations.HttpLambdaIntegration(
        "ResponseHandlerIntegration",
        responseHandler
      );

    // 라우트 추가
    // POST /chat - 고객 문의 제출
    this.httpApi.addRoutes({
      path: "/chat",
      methods: [apigatewayv2.HttpMethod.POST],
      integration: lexHandlerIntegration,
    });

    // GET /confirm/{token} - 파트너 확인 페이지 데이터 조회
    this.httpApi.addRoutes({
      path: "/confirm/{token}",
      methods: [apigatewayv2.HttpMethod.GET],
      integration: responseHandlerIntegration,
    });

    // POST /respond - 파트너 응답 제출
    this.httpApi.addRoutes({
      path: "/respond",
      methods: [apigatewayv2.HttpMethod.POST],
      integration: responseHandlerIntegration,
    });

    // 출력
    new cdk.CfnOutput(this, "ApiUrl", {
      value: this.httpApi.apiEndpoint,
      description: "API Gateway HTTP API URL",
      exportName: "PartnerConfirmationApiUrl",
    });

    new cdk.CfnOutput(this, "ApiId", {
      value: this.httpApi.apiId,
      description: "API Gateway HTTP API ID",
    });
  }
}
