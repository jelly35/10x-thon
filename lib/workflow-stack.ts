import * as cdk from "aws-cdk-lib";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

/**
 * WorkflowStack Props
 */
export interface WorkflowStackProps extends cdk.StackProps {
  smsSender: lambda.IFunction;
  timeoutHandler: lambda.IFunction;
  notificationGenerator: lambda.IFunction;
  orchestrator: lambda.Function;
}

/**
 * WorkflowStack
 * Step Functions 상태 머신을 정의하는 스택
 */
export class WorkflowStack extends cdk.Stack {
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: WorkflowStackProps) {
    super(scope, id, props);

    const { smsSender, timeoutHandler, notificationGenerator, orchestrator } =
      props;

    // SendSMS 상태: SMS Sender Lambda 호출
    const sendSmsTask = new tasks.LambdaInvoke(this, "SendSMS", {
      lambdaFunction: smsSender,
      payload: sfn.TaskInput.fromObject({
        requestId: sfn.JsonPath.stringAt("$.requestId"),
        partnerId: sfn.JsonPath.stringAt("$.partnerId"),
        partnerPhone: sfn.JsonPath.stringAt("$.partnerPhone"),
        taskToken: sfn.JsonPath.taskToken,
      }),
      resultPath: "$.smsResult",
    });

    // WaitPartner 상태: Callback 패턴으로 파트너 응답 대기 (300초 타임아웃)
    // CustomState를 사용하여 waitForTaskToken 패턴 구현
    const waitPartnerTask = new sfn.CustomState(this, "WaitPartner", {
      stateJson: {
        Type: "Task",
        Resource: "arn:aws:states:::lambda:invoke.waitForTaskToken",
        Parameters: {
          FunctionName: smsSender.functionName,
          "Payload.$": "$",
        },
        TimeoutSeconds: 300,
        ResultPath: "$.partnerResponse",
      },
    });

    // HandleTimeout 상태: 타임아웃 처리
    const handleTimeoutTask = new tasks.LambdaInvoke(this, "HandleTimeout", {
      lambdaFunction: timeoutHandler,
      payload: sfn.TaskInput.fromObject({
        requestId: sfn.JsonPath.stringAt("$.requestId"),
      }),
      resultPath: "$.timeoutResult",
    });

    // GenerateNotification 상태: 알림 생성
    const generateNotificationTask = new tasks.LambdaInvoke(
      this,
      "GenerateNotification",
      {
        lambdaFunction: notificationGenerator,
        payload: sfn.TaskInput.fromObject({
          requestId: sfn.JsonPath.stringAt("$.requestId"),
          partnerResponse: sfn.JsonPath.stringAt("$.partnerResponse"),
          isTimeout: sfn.JsonPath.stringAt("$.timeoutResult"),
        }),
        resultPath: "$.notificationResult",
      }
    );

    // 워크플로우 정의
    const definition = sendSmsTask
      .next(
        waitPartnerTask.addCatch(handleTimeoutTask, {
          errors: ["States.Timeout"],
          resultPath: "$.error",
        })
      )
      .next(generateNotificationTask);

    // HandleTimeout도 GenerateNotification으로 연결
    handleTimeoutTask.next(generateNotificationTask);

    // 상태 머신 생성
    this.stateMachine = new sfn.StateMachine(
      this,
      "PartnerConfirmationWorkflow",
      {
        stateMachineName: "PartnerConfirmationWorkflow",
        definitionBody: sfn.DefinitionBody.fromChainable(definition),
        timeout: cdk.Duration.minutes(10),
      }
    );

    // Orchestrator Lambda에 상태 머신 ARN 환경 변수 추가
    orchestrator.addEnvironment(
      "STATE_MACHINE_ARN",
      this.stateMachine.stateMachineArn
    );

    // Orchestrator에 Step Functions 실행 권한 부여
    this.stateMachine.grantStartExecution(orchestrator);

    // 출력
    new cdk.CfnOutput(this, "StateMachineArn", {
      value: this.stateMachine.stateMachineArn,
      description: "Partner Confirmation Workflow State Machine ARN",
      exportName: "PartnerConfirmationStateMachineArn",
    });
  }
}
