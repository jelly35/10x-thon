/**
 * SMS Sender Lambda
 * 파트너에게 확인 링크가 포함된 SMS를 전송합니다.
 * 요구사항: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { marshall } from "@aws-sdk/util-dynamodb";
import { generateToken } from "./utils/token";
import {
  SmsSenderEvent,
  Token,
  tokenToItem,
  RequestStatus,
  EventType,
  eventToItem,
  Event,
} from "../lib/types";

const dynamoClient = new DynamoDBClient({});
const snsClient = new SNSClient({});

const TABLE_NAME = process.env.TABLE_NAME!;
const SECRET_KEY = process.env.SECRET_KEY!;
const CONFIRM_URL = process.env.CONFIRM_URL!;

/**
 * SMS Sender Lambda Handler
 */
export async function handler(event: SmsSenderEvent) {
  console.log("SMS Sender Lambda invoked", JSON.stringify(event, null, 2));

  const { requestId, partnerId, partnerPhone, taskToken } = event;

  try {
    // 6.1: 서명 토큰 생성
    const token = generateToken(requestId, partnerId, SECRET_KEY, 10);
    console.log("Token generated successfully");

    // 6.1: DynamoDB에 토큰 저장 (만료: 10분)
    const tokenRecord: Token = {
      token,
      requestId,
      partnerId,
      used: false,
      expiresAt: Date.now() + 10 * 60 * 1000,
      createdAt: Date.now(),
    };

    await dynamoClient.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall(tokenToItem(tokenRecord)),
      })
    );
    console.log("Token saved to DynamoDB");

    // 6.2: 확인 링크 생성
    const confirmLink = `${CONFIRM_URL}/${token}`;
    console.log("Confirmation link created:", confirmLink);

    // 6.2: SMS 메시지 템플릿 작성
    const smsMessage = `[파트너 확인 요청]\n고객 문의가 접수되었습니다.\n아래 링크를 클릭하여 확인해주세요.\n${confirmLink}\n(10분 내 응답 필요)`;

    // 6.2: Amazon SNS로 SMS 전송
    const publishResult = await snsClient.send(
      new PublishCommand({
        PhoneNumber: partnerPhone,
        Message: smsMessage,
      })
    );
    console.log("SMS sent successfully:", publishResult.MessageId);

    // 6.3: 요청 상태를 SMSSent로 업데이트
    await dynamoClient.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall({
          PK: `REQ#${requestId}`,
          SK: "METADATA",
          status: RequestStatus.SMS_SENT,
          updatedAt: Date.now(),
          taskToken, // Step Functions callback token 저장
        }),
        ConditionExpression: "attribute_exists(PK)",
      })
    );
    console.log("Request status updated to SMSSent");

    // 6.3: SMSSent 이벤트 기록
    const smsSentEvent: Event = {
      requestId,
      eventType: EventType.SMS_SENT,
      timestamp: Date.now(),
      details: {
        token,
        partnerPhone,
        messageId: publishResult.MessageId,
      },
    };

    await dynamoClient.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall(eventToItem(smsSentEvent)),
      })
    );
    console.log("SMSSent event recorded");

    return {
      success: true,
      token,
      messageId: publishResult.MessageId,
    };
  } catch (error) {
    console.error("Error in SMS Sender Lambda:", error);

    // 실패 이벤트 기록
    try {
      const failedEvent: Event = {
        requestId,
        eventType: EventType.FAILED,
        timestamp: Date.now(),
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
          stage: "SMS_SENDING",
        },
      };

      await dynamoClient.send(
        new PutItemCommand({
          TableName: TABLE_NAME,
          Item: marshall(eventToItem(failedEvent)),
        })
      );
    } catch (eventError) {
      console.error("Failed to record error event:", eventError);
    }

    throw error;
  }
}
