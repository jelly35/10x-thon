/**
 * Response Handler Lambda
 * 파트너 확인 페이지 데이터 조회 및 응답 제출 처리
 *
 * 요구사항: 4.1, 4.2, 4.3, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { SFNClient, SendTaskSuccessCommand } from "@aws-sdk/client-sfn";
import {
  ResponseHandlerGetEvent,
  ResponseHandlerPostEvent,
  ConfirmPageData,
  RespondRequest,
  RespondResponse,
  Request,
  RequestItem,
  Reservation,
  ReservationItem,
  RequestStatus,
  EventType,
  PartnerResponseType,
  eventToItem,
} from "../lib/types";
import {
  validateToken,
  markTokenAsUsed,
  TokenValidationError,
} from "./utils/token-validator";

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sfnClient = new SFNClient({});

const TABLE_NAME = process.env.TABLE_NAME!;
const SECRET_KEY = process.env.SECRET_KEY!;

/**
 * Response Handler Lambda Handler
 * GET /confirm/{token} 및 POST /respond 엔드포인트 처리
 */
export async function handler(
  event: ResponseHandlerGetEvent | ResponseHandlerPostEvent
) {
  console.log("Response Handler invoked", { event });

  try {
    // HTTP 메서드 확인
    const httpMethod = (event as any).requestContext?.http?.method || "GET";
    const path = (event as any).requestContext?.http?.path || "";

    if (httpMethod === "GET" && path.includes("/confirm/")) {
      return await handleGetConfirm(event as ResponseHandlerGetEvent);
    } else if (httpMethod === "GET" && path.includes("/status/")) {
      return await handleGetStatus(event as any);
    } else if (httpMethod === "POST") {
      return await handlePostRespond(event as ResponseHandlerPostEvent);
    } else {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }
  } catch (error: unknown) {
    console.error("Response Handler error", { error });

    if (error instanceof TokenValidationError) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          error: "Unauthorized",
          message: error.message,
        }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
}

/**
 * GET /confirm/{token} 처리
 * 토큰 검증 및 확인 페이지 데이터 반환
 */
async function handleGetConfirm(event: ResponseHandlerGetEvent): Promise<any> {
  console.log("Handling GET /confirm/{token}", { event });

  const token = event.pathParameters?.token;

  if (!token) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Token is required" }),
    };
  }

  try {
    // 1. 토큰 검증 (서명, 만료, 사용 여부)
    const validationResult = await validateToken(token, SECRET_KEY, TABLE_NAME);
    const { payload } = validationResult;

    console.log("Token validated", { payload });

    // 2. DynamoDB에서 요청 정보 조회
    const request = await getRequest(payload.requestId);

    if (!request) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Request not found" }),
      };
    }

    console.log("Request retrieved", { request });

    // 3. 예약 정보 조회
    const reservation = await getReservation(request.reservationNumber);

    if (!reservation) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Reservation not found" }),
      };
    }

    console.log("Reservation retrieved", { reservation });

    // 4. Opened 이벤트 기록
    await recordEvent(payload.requestId, EventType.OPENED, {
      token,
      timestamp: Date.now(),
    });

    console.log("Opened event recorded");

    // 5. 확인 페이지 데이터 반환
    const confirmPageData: ConfirmPageData = {
      requestId: request.requestId,
      customerQuery: request.query,
      intent: request.intent,
      reservationNumber: request.reservationNumber,
      reservationDate: reservation.reservationDate,
    };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(confirmPageData),
    };
  } catch (error: unknown) {
    console.error("GET /confirm error", { error });

    if (error instanceof TokenValidationError) {
      // 토큰 무효/만료 처리
      await recordEvent(token, EventType.FAILED, {
        reason: "Token validation failed",
        error: error.message,
      });

      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "Unauthorized",
          message: error.message,
        }),
      };
    }

    throw error;
  }
}

/**
 * 요청 정보 조회
 */
async function getRequest(requestId: string): Promise<Request | null> {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `REQ#${requestId}`,
      SK: "METADATA",
    },
  });

  const response = await docClient.send(command);

  if (!response.Item) {
    return null;
  }

  const item = response.Item as RequestItem;
  const { PK, SK, ...request } = item;

  return request as Request;
}

/**
 * 예약 정보 조회
 */
async function getReservation(
  reservationNumber: string
): Promise<Reservation | null> {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `RES#${reservationNumber}`,
      SK: "METADATA",
    },
  });

  const response = await docClient.send(command);

  if (!response.Item) {
    return null;
  }

  const item = response.Item as ReservationItem;
  const { PK, SK, ...reservation } = item;

  return reservation as Reservation;
}

/**
 * 이벤트 기록
 */
async function recordEvent(
  requestId: string,
  eventType: EventType,
  details?: Record<string, any>
): Promise<void> {
  const event = eventToItem({
    requestId,
    eventType,
    timestamp: Date.now(),
    details,
  });

  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: event,
  });

  await docClient.send(command);
}

/**
 * GET /status/{requestId} 처리
 * 요청 상태 및 알림 조회
 */
async function handleGetStatus(event: any): Promise<any> {
  console.log("Handling GET /status/{requestId}", { event });

  const requestId = event.pathParameters?.requestId;

  if (!requestId) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Request ID is required" }),
    };
  }

  try {
    // 요청 정보 조회
    const request = await getRequest(requestId);

    if (!request) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Request not found" }),
      };
    }

    // 응답 데이터 구성
    const statusData = {
      requestId: request.requestId,
      status: request.status,
      partnerResponse: request.partnerResponse || null,
      notificationMessage: request.notificationMessage || null,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(statusData),
    };
  } catch (error: unknown) {
    console.error("GET /status error", { error });

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
}

/**
 * POST /respond 처리
 * 파트너 응답 제출 및 Step Functions 재개
 */
async function handlePostRespond(
  event: ResponseHandlerPostEvent
): Promise<any> {
  console.log("Handling POST /respond", { event });

  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Request body is required" }),
    };
  }

  try {
    // 1. 요청 데이터 파싱
    const respondRequest: RespondRequest = JSON.parse(event.body);
    const { token, response, alternativeTime } = respondRequest;

    if (!token || !response) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Token and response are required",
        }),
      };
    }

    // 응답 타입 검증
    if (
      !Object.values(PartnerResponseType).includes(
        response as PartnerResponseType
      )
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Invalid response type",
          validTypes: Object.values(PartnerResponseType),
        }),
      };
    }

    console.log("Request parsed", { token, response, alternativeTime });

    // 2. 토큰 검증 (서명, 만료, 사용 여부)
    const validationResult = await validateToken(token, SECRET_KEY, TABLE_NAME);
    const { payload } = validationResult;

    console.log("Token validated", { payload });

    // 3. 요청 정보 조회
    const request = await getRequest(payload.requestId);

    if (!request) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Request not found" }),
      };
    }

    if (!request.taskToken) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Task token not found in request" }),
      };
    }

    console.log("Request retrieved", { request });

    // 4. Step Functions SendTaskSuccess 호출
    const partnerResponse = {
      responseType: response,
      alternativeTime: alternativeTime || null,
      timestamp: Date.now(),
    };

    await sendTaskSuccess(request.taskToken, {
      requestId: payload.requestId,
      partnerResponse,
    });

    console.log("Task success sent", { partnerResponse });

    // 5. 토큰 사용됨 표시
    await markTokenAsUsed(token, TABLE_NAME);

    console.log("Token marked as used");

    // 6. 요청 상태를 Responded로 업데이트
    await updateRequestStatus(
      payload.requestId,
      RequestStatus.RESPONDED,
      partnerResponse
    );

    console.log("Request status updated to Responded");

    // 7. Responded 이벤트 기록
    await recordEvent(payload.requestId, EventType.RESPONDED, {
      partnerResponse,
      token,
    });

    console.log("Responded event recorded");

    // 8. 성공 응답 반환
    const respondResponse: RespondResponse = {
      success: true,
      message: "응답이 접수되었습니다",
    };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(respondResponse),
    };
  } catch (error: unknown) {
    console.error("POST /respond error", { error });

    if (error instanceof TokenValidationError) {
      // 토큰 무효/만료/이미 사용됨 처리
      const statusCode = error.message.includes("already used") ? 409 : 401;

      return {
        statusCode,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: statusCode === 409 ? "Conflict" : "Unauthorized",
          message: error.message,
        }),
      };
    }

    throw error;
  }
}

/**
 * Step Functions SendTaskSuccess 호출
 */
async function sendTaskSuccess(taskToken: string, output: any): Promise<void> {
  const command = new SendTaskSuccessCommand({
    taskToken,
    output: JSON.stringify(output),
  });

  await sfnClient.send(command);
}

/**
 * 요청 상태 업데이트
 */
async function updateRequestStatus(
  requestId: string,
  status: RequestStatus,
  partnerResponse?: any
): Promise<void> {
  const updateExpression = ["#status = :status", "updatedAt = :updatedAt"];
  const expressionAttributeNames: Record<string, string> = {
    "#status": "status",
  };
  const expressionAttributeValues: Record<string, any> = {
    ":status": status,
    ":updatedAt": Date.now(),
  };

  if (partnerResponse) {
    updateExpression.push("partnerResponse = :partnerResponse");
    expressionAttributeValues[":partnerResponse"] = partnerResponse;
  }

  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `REQ#${requestId}`,
      SK: "METADATA",
    },
    UpdateExpression: `SET ${updateExpression.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
  });

  await docClient.send(command);
}
