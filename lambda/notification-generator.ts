/**
 * Notification Generator Lambda
 * Amazon Bedrock을 사용하여 고객 알림 메시지를 생성합니다.
 * 요구사항: 7.1, 7.2, 7.3, 7.4
 */

import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  NotificationEvent,
  Request,
  PartnerResponseType,
  itemToRequest,
} from "../lib/types";

const dynamoClient = new DynamoDBClient({});
const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });

const TABLE_NAME = process.env.TABLE_NAME!;
const BEDROCK_MODEL_ID = "anthropic.claude-3-sonnet-20240229-v1:0";

/**
 * Notification Generator Lambda Handler
 */
export async function handler(event: NotificationEvent) {
  console.log("Notification Generator started", { event });

  const { requestId, partnerResponse, isTimeout } = event;

  try {
    // 9.1: DynamoDB에서 요청 정보 조회
    const request = await getRequest(requestId);
    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    console.log("Request retrieved", { request });

    // 9.2: Bedrock 프롬프트 생성
    const prompt = buildPrompt(request, partnerResponse, isTimeout);
    console.log("Prompt built", { prompt });

    // 9.1: Amazon Bedrock 호출 (Claude 모델)
    const notificationMessage = await invokeBedrockModel(prompt);
    console.log("Notification message generated", { notificationMessage });

    // 9.3: 알림 메시지를 DynamoDB에 저장
    await saveNotification(requestId, notificationMessage);
    console.log("Notification saved to DynamoDB");

    return {
      success: true,
      requestId,
      notificationMessage,
    };
  } catch (error) {
    console.error("Notification Generator error", { error, requestId });

    // 에러 발생 시 기본 메시지 사용 (폴백)
    const fallbackMessage = generateFallbackMessage(partnerResponse, isTimeout);
    console.log("Using fallback message", { fallbackMessage });

    try {
      await saveNotification(requestId, fallbackMessage);
    } catch (saveError) {
      console.error("Failed to save fallback notification", { saveError });
    }

    return {
      success: false,
      requestId,
      notificationMessage: fallbackMessage,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 요청 정보 조회
 */
async function getRequest(requestId: string): Promise<Request | null> {
  const command = new GetItemCommand({
    TableName: TABLE_NAME,
    Key: marshall({
      PK: `REQ#${requestId}`,
      SK: "METADATA",
    }),
  });

  const response = await dynamoClient.send(command);

  if (!response.Item) {
    return null;
  }

  return itemToRequest(unmarshall(response.Item) as any);
}

/**
 * 9.2: Bedrock 프롬프트 생성
 * 요청 정보 및 파트너 응답 포함
 * 응답 타입별 메시지 생성 (수락/거절/대안/타임아웃)
 */
function buildPrompt(
  request: Request,
  partnerResponse?: any,
  isTimeout?: boolean
): string {
  let responseText = "";

  if (isTimeout) {
    responseText = "타임아웃 (파트너 응답 없음)";
  } else if (partnerResponse) {
    switch (partnerResponse.responseType) {
      case PartnerResponseType.ACCEPT:
        responseText = "수락";
        break;
      case PartnerResponseType.REJECT:
        responseText = "거절";
        break;
      case PartnerResponseType.ALTERNATIVE:
        responseText = `대안 시간 제안: ${
          partnerResponse.alternativeTime || "미지정"
        }`;
        break;
      default:
        responseText = "알 수 없음";
    }
  }

  return `당신은 고객 서비스 담당자입니다. 다음 정보를 바탕으로 고객에게 전달할 친절한 알림 메시지를 한국어로 작성해주세요.

고객 문의: ${request.query}
문의 유형: ${request.intent}
예약번호: ${request.reservationNumber}
파트너 응답: ${responseText}

고객이 이해하기 쉽고 다음 행동을 명확히 알 수 있도록 작성해주세요. 메시지는 간결하고 친절하게 작성하며, 200자 이내로 작성해주세요.`;
}

/**
 * 9.1: Amazon Bedrock InvokeModel API 호출
 */
async function invokeBedrockModel(prompt: string): Promise<string> {
  const requestBody = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.7,
  };

  const command = new InvokeModelCommand({
    modelId: BEDROCK_MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(requestBody),
  });

  const response = await bedrockClient.send(command);

  if (!response.body) {
    throw new Error("Empty response from Bedrock");
  }

  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  if (!responseBody.content || responseBody.content.length === 0) {
    throw new Error("No content in Bedrock response");
  }

  return responseBody.content[0].text;
}

/**
 * 9.3: 알림 메시지를 DynamoDB에 저장
 * 고객 UI에서 폴링으로 조회 가능하도록 구성
 */
async function saveNotification(
  requestId: string,
  notificationMessage: string
): Promise<void> {
  const command = new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: marshall({
      PK: `REQ#${requestId}`,
      SK: "METADATA",
    }),
    UpdateExpression:
      "SET notificationMessage = :message, notificationTimestamp = :timestamp, updatedAt = :updatedAt",
    ExpressionAttributeValues: marshall({
      ":message": notificationMessage,
      ":timestamp": Date.now(),
      ":updatedAt": Date.now(),
    }),
  });

  await dynamoClient.send(command);
}

/**
 * 폴백 메시지 생성 (Bedrock 실패 시)
 */
function generateFallbackMessage(
  partnerResponse?: any,
  isTimeout?: boolean
): string {
  if (isTimeout) {
    return "파트너의 응답을 받지 못했습니다. 고객센터로 문의해주시기 바랍니다.";
  }

  if (!partnerResponse) {
    return "요청이 처리되었습니다. 자세한 내용은 고객센터로 문의해주세요.";
  }

  switch (partnerResponse.responseType) {
    case PartnerResponseType.ACCEPT:
      return "파트너가 요청을 수락했습니다. 곧 연락드리겠습니다.";
    case PartnerResponseType.REJECT:
      return "파트너가 요청을 거절했습니다. 고객센터로 문의해주시기 바랍니다.";
    case PartnerResponseType.ALTERNATIVE:
      return `파트너가 대안 시간을 제안했습니다: ${
        partnerResponse.alternativeTime || "미지정"
      }`;
    default:
      return "요청이 처리되었습니다. 자세한 내용은 고객센터로 문의해주세요.";
  }
}
