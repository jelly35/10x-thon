#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DataStack } from "../lib/data-stack";
import { ComputeStack } from "../lib/compute-stack";
import { ApiStack } from "../lib/api-stack";

const app = new cdk.App();

// 환경 설정
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || "ap-northeast-2",
};

// DataStack: DynamoDB 테이블
const dataStack = new DataStack(app, "PartnerConfirmation-DataStack", {
  env,
  description: "Partner Confirmation Automation - Data Layer (DynamoDB)",
});

// ComputeStack: Lambda 함수들
const computeStack = new ComputeStack(app, "PartnerConfirmation-ComputeStack", {
  env,
  description: "Partner Confirmation Automation - Compute Layer (Lambda)",
  table: dataStack.table,
});
computeStack.addDependency(dataStack);

// ApiStack: API Gateway
const apiStack = new ApiStack(app, "PartnerConfirmation-ApiStack", {
  env,
  description: "Partner Confirmation Automation - API Layer (API Gateway)",
  lexHandler: computeStack.lexHandler,
  responseHandler: computeStack.responseHandler,
});
apiStack.addDependency(computeStack);

// 태그 추가
cdk.Tags.of(app).add("Project", "PartnerConfirmation");
cdk.Tags.of(app).add("Environment", "demo");
