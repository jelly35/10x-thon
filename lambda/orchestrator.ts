/**
 * Orchestrator Lambda
 * 예약 조회 및 Step Functions 워크플로우 시작
 */

import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  OrchestratorEvent,
  Request,
  Reservation,
  RequestStatus,
  EventType,
  itemToRequest,
  itemToReservation,
  eventToItem,
} from "../lib/types";

const dynamoClient = new DynamoDBClient({});
const sfnClient = new SFNClient({});

const TABLE_NAME = process.env.TABLE_NAME!;
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN!;

/**
 * Orchestrator Lambda Handler
 */
export async function handler(event: OrchestratorEvent) {
  console.log("Orchestrator started", { event });

  const { requestId } = event;

  try {
    // 1. 요청 정보 조회
    const request = await getRequest(requestId);
    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    console.log("Request retrieved", { request });

    // 2. 예약 조회 (GSI1 사용)
    const reservation = await findReservation(
      request.reservationNumber,
      request.customerPhone
    );

    if (!reservation) {
      // 예약 없음 처리
      await updateRequestStatus(requestId, RequestStatus.FAILED, {
        error: "예약을 찾을 수 없습니다",
      });
      await recordEvent(requestId, EventType.FAILED, {
        reason: "Reservation not found",
      });

      return {
        success: false,
        error: "예약을 찾을 수 없습니다",
      };
    }

    console.log("Reservation found", { reservation });

    // 3. 고객 정보 매칭 검증
    if (reservation.customerPhone !== request.customerPhone) {
      // 고객 정보 불일치 처리
      await updateRequestStatus(requestId, RequestStatus.FAILED, {
        error: "예약 정보가 일치하지 않습니다",
      });
      await recordEvent(requestId, EventType.FAILED, {
        reason: "Customer information mismatch",
      });

      return {
        success: false,
        error: "예약 정보가 일치하지 않습니다",
      };
    }

    // 4. 파트너 정보 추출 및 요청 레코드 업데이트
    await updateRequestWithPartnerInfo(requestId, reservation);

    console.log("Partner info updated", {
      partnerId: reservation.partnerId,
      partnerPhone: reservation.partnerPhone,
    });

    // 5. Step Functions 실행 시작
    const executionArn = await startStepFunctionsExecution(
      requestId,
      reservation
    );

    console.log("Step Functions execution started", { executionArn });

    // 6. executionArn 저장
    await saveExecutionArn(requestId, executionArn);

    return {
      success: true,
      executionArn,
      partnerId: reservation.partnerId,
      partnerPhone: reservation.partnerPhone,
    };
  } catch (error) {
    console.error("Orchestrator error", { error, requestId });

    // 에러 발생 시 Failed 상태로 업데이트
    await updateRequestStatus(requestId, RequestStatus.FAILED, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    await recordEvent(requestId, EventType.FAILED, {
      reason: error instanceof Error ? error.message : "Unknown error",
    });

    throw error;
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
 * 예약 조회 (GSI1 사용)
 */
async function findReservation(
  reservationNumber: string,
  customerPhone: string
): Promise<Reservation | null> {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: "GSI1",
    KeyConditionExpression:
      "reservationNumber = :reservationNumber AND customerPhone = :customerPhone",
    ExpressionAttributeValues: marshall({
      ":reservationNumber": reservationNumber,
      ":customerPhone": customerPhone,
    }),
  });

  const response = await dynamoClient.send(command);

  if (!response.Items || response.Items.length === 0) {
    return null;
  }

  return itemToReservation(unmarshall(response.Items[0]) as any);
}

/**
 * 요청 상태 업데이트
 */
async function updateRequestStatus(
  requestId: string,
  status: RequestStatus,
  additionalData?: Record<string, any>
): Promise<void> {
  const updateExpression = ["status = :status", "updatedAt = :updatedAt"];
  const expressionAttributeValues: Record<string, any> = {
    ":status": status,
    ":updatedAt": Date.now(),
  };

  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      updateExpression.push(`${key} = :${key}`);
      expressionAttributeValues[`:${key}`] = value;
    });
  }

  const command = new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: marshall({
      PK: `REQ#${requestId}`,
      SK: "METADATA",
    }),
    UpdateExpression: `SET ${updateExpression.join(", ")}`,
    ExpressionAttributeValues: marshall(expressionAttributeValues),
  });

  await dynamoClient.send(command);
}

/**
 * 파트너 정보로 요청 레코드 업데이트
 */
async function updateRequestWithPartnerInfo(
  requestId: string,
  reservation: Reservation
): Promise<void> {
  const command = new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: marshall({
      PK: `REQ#${requestId}`,
      SK: "METADATA",
    }),
    UpdateExpression:
      "SET partnerId = :partnerId, partnerPhone = :partnerPhone, updatedAt = :updatedAt",
    ExpressionAttributeValues: marshall({
      ":partnerId": reservation.partnerId,
      ":partnerPhone": reservation.partnerPhone,
      ":updatedAt": Date.now(),
    }),
  });

  await dynamoClient.send(command);
}

/**
 * Step Functions 실행 시작
 */
async function startStepFunctionsExecution(
  requestId: string,
  reservation: Reservation
): Promise<string> {
  const input = {
    requestId,
    partnerId: reservation.partnerId,
    partnerPhone: reservation.partnerPhone,
  };

  const command = new StartExecutionCommand({
    stateMachineArn: STATE_MACHINE_ARN,
    name: `execution-${requestId}-${Date.now()}`,
    input: JSON.stringify(input),
  });

  const response = await sfnClient.send(command);

  if (!response.executionArn) {
    throw new Error("Failed to start Step Functions execution");
  }

  return response.executionArn;
}

/**
 * executionArn 저장
 */
async function saveExecutionArn(
  requestId: string,
  executionArn: string
): Promise<void> {
  const command = new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: marshall({
      PK: `REQ#${requestId}`,
      SK: "METADATA",
    }),
    UpdateExpression:
      "SET executionArn = :executionArn, updatedAt = :updatedAt",
    ExpressionAttributeValues: marshall({
      ":executionArn": executionArn,
      ":updatedAt": Date.now(),
    }),
  });

  await dynamoClient.send(command);
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

  const command = new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: marshall({
      PK: event.PK,
      SK: event.SK,
    }),
    UpdateExpression:
      "SET eventType = :eventType, #ts = :timestamp, details = :details",
    ExpressionAttributeNames: {
      "#ts": "timestamp",
    },
    ExpressionAttributeValues: marshall({
      ":eventType": eventType,
      ":timestamp": event.timestamp,
      ":details": details || {},
    }),
  });

  await dynamoClient.send(command);
}
