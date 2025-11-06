/**
 * Lex Handler Lambda
 * 고객 문의를 받아 Amazon Lex V2로 인텐트를 분류하고 요청을 생성합니다.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  LexRuntimeV2Client,
  RecognizeTextCommand,
} from "@aws-sdk/client-lex-runtime-v2";
import { randomUUID } from "crypto";
import {
  ChatRequest,
  ChatResponse,
  Request,
  RequestStatus,
  IntentType,
  EventType,
  requestToItem,
  eventToItem,
  LambdaEnvironment,
} from "../lib/types";

// DynamoDB 클라이언트 초기화
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Lex V2 클라이언트 초기화
const lexClient = new LexRuntimeV2Client({});

// 환경 변수
const env: LambdaEnvironment = {
  TABLE_NAME: process.env.TABLE_NAME!,
  LEX_BOT_ID: process.env.LEX_BOT_ID,
  LEX_BOT_ALIAS_ID: process.env.LEX_BOT_ALIAS_ID,
  LEX_LOCALE_ID: process.env.LEX_LOCALE_ID || "ko_KR",
};

/**
 * Amazon Lex V2 호출
 */
async function callLexV2(sessionId: string, text: string): Promise<any> {
  if (!env.LEX_BOT_ID || !env.LEX_BOT_ALIAS_ID) {
    throw new Error("Lex bot configuration is missing");
  }

  const command = new RecognizeTextCommand({
    botId: env.LEX_BOT_ID,
    botAliasId: env.LEX_BOT_ALIAS_ID,
    localeId: env.LEX_LOCALE_ID,
    sessionId,
    text,
  });

  try {
    // 3초 타임아웃 적용
    const response = await Promise.race([
      lexClient.send(command),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Lex call timeout")), 3000)
      ),
    ]);

    console.log("Lex response:", JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error("Lex call failed:", error);

    if (error instanceof Error && error.message === "Lex call timeout") {
      throw new Error("인텐트 분류 시간이 초과되었습니다");
    }

    throw new Error("인텐트 분류에 실패했습니다");
  }
}

/**
 * 인텐트 추출
 */
function extractIntent(lexResponse: any): IntentType {
  const intentName = lexResponse.sessionState?.intent?.name;

  switch (intentName) {
    case "ReservationChange":
      return IntentType.RESERVATION_CHANGE;
    case "TroubleReport":
      return IntentType.TROUBLE_REPORT;
    case "AdditionalService":
      return IntentType.ADDITIONAL_SERVICE;
    default:
      // 기본값으로 예약변경 처리
      return IntentType.RESERVATION_CHANGE;
  }
}

/**
 * 예약번호 슬롯 추출
 */
function extractReservationNumber(lexResponse: any): string | undefined {
  const slots = lexResponse.sessionState?.intent?.slots;
  if (!slots || !slots.ReservationNumber) {
    return undefined;
  }

  const reservationSlot = slots.ReservationNumber;
  return (
    reservationSlot.value?.interpretedValue ||
    reservationSlot.value?.originalValue
  );
}

/**
 * 요청을 DynamoDB에 저장
 */
async function saveRequest(request: Request): Promise<void> {
  const item = requestToItem(request);

  await docClient.send(
    new PutCommand({
      TableName: env.TABLE_NAME,
      Item: item,
    })
  );

  console.log("Request saved:", request.requestId);
}

/**
 * 이벤트 기록
 */
async function recordEvent(
  requestId: string,
  eventType: EventType,
  details?: Record<string, any>
): Promise<void> {
  const event = {
    requestId,
    eventType,
    timestamp: Date.now(),
    details,
  };

  const item = eventToItem(event);

  await docClient.send(
    new PutCommand({
      TableName: env.TABLE_NAME,
      Item: item,
    })
  );

  console.log("Event recorded:", eventType, requestId);
}

/**
 * Lambda 핸들러
 */
export async function handler(event: any): Promise<any> {
  console.log("LexHandler invoked", JSON.stringify(event, null, 2));

  try {
    // 요청 파싱
    const chatRequest: ChatRequest = JSON.parse(event.body);

    // 입력 검증
    if (
      !chatRequest.customerId ||
      !chatRequest.customerPhone ||
      !chatRequest.reservationNumber ||
      !chatRequest.message
    ) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Missing required fields",
        }),
      };
    }

    // Lex V2 호출하여 인텐트 분류
    const lexResponse = await callLexV2(
      chatRequest.customerId,
      chatRequest.message
    );

    // 인텐트 및 슬롯 추출
    const intent = extractIntent(lexResponse);
    const reservationNumber = extractReservationNumber(lexResponse);

    // 예약번호 검증
    if (!reservationNumber) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "예약번호를 입력해주세요",
          message:
            "예약번호가 필요합니다. 예약번호를 포함하여 다시 문의해주세요.",
        }),
      };
    }

    // 요청 ID 생성
    const requestId = randomUUID();
    const now = Date.now();

    // 요청 레코드 생성
    const request: Request = {
      requestId,
      customerId: chatRequest.customerId,
      customerPhone: chatRequest.customerPhone,
      reservationNumber,
      intent,
      query: chatRequest.message,
      status: RequestStatus.CREATED,
      createdAt: now,
      updatedAt: now,
    };

    // DynamoDB에 요청 저장
    await saveRequest(request);

    // Created 이벤트 기록
    await recordEvent(requestId, EventType.CREATED, {
      intent,
      reservationNumber,
    });

    // 응답 생성
    const response: ChatResponse = {
      requestId,
      status: RequestStatus.CREATED,
      message: "요청이 접수되었습니다",
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("Error in LexHandler:", error);

    // Lex 호출 실패 처리
    if (
      error instanceof Error &&
      (error.message.includes("인텐트 분류") ||
        error.message.includes("Lex bot configuration"))
    ) {
      return {
        statusCode: 503,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Service temporarily unavailable",
          message: error.message,
        }),
      };
    }

    // 일반 에러 처리
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Internal server error",
        message: "요청 처리 중 오류가 발생했습니다",
      }),
    };
  }
}
