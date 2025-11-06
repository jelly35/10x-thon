/**
 * Timeout Handler Lambda
 * 파트너 응답 타임아웃 처리
 * 요구사항: 6.3, 6.4
 */

import {
  DynamoDBClient,
  UpdateItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { RequestStatus, EventType, Event, eventToItem } from "../lib/types";

const dynamoClient = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

/**
 * Timeout Handler Lambda Handler
 */
export async function handler(event: any) {
  console.log("Timeout Handler Lambda invoked", JSON.stringify(event, null, 2));

  const { requestId } = event;

  if (!requestId) {
    throw new Error("requestId is required");
  }

  try {
    // 요청 상태를 Timeout으로 업데이트
    await dynamoClient.send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({
          PK: `REQ#${requestId}`,
          SK: "METADATA",
        }),
        UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: marshall({
          ":status": RequestStatus.TIMEOUT,
          ":updatedAt": Date.now(),
        }),
      })
    );
    console.log("Request status updated to Timeout");

    // Timeout 이벤트 기록
    const timeoutEvent: Event = {
      requestId,
      eventType: EventType.TIMEOUT,
      timestamp: Date.now(),
      details: {
        reason: "Partner did not respond within 300 seconds",
      },
    };

    await dynamoClient.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall(eventToItem(timeoutEvent)),
      })
    );
    console.log("Timeout event recorded");

    return {
      success: true,
      requestId,
      status: RequestStatus.TIMEOUT,
    };
  } catch (error) {
    console.error("Error in Timeout Handler Lambda:", error);
    throw error;
  }
}
