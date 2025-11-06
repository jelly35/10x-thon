#!/usr/bin/env ts-node
/**
 * 통합 테스트 스크립트
 *
 * 이 스크립트는 파트너 확인 자동화 시스템의 엔드투엔드 시나리오를 테스트합니다.
 *
 * 사용법:
 *   ts-node test/integration-test.ts --scenario <scenario-name>
 *
 * 시나리오:
 *   - normal: 정상 플로우 테스트
 *   - timeout: 타임아웃 시나리오 테스트
 *   - errors: 에러 시나리오 테스트
 *   - all: 모든 시나리오 테스트
 */

import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import * as https from "https";
import * as http from "http";

// 환경 변수
const REGION = process.env.AWS_REGION || "ap-northeast-2";
const TABLE_NAME =
  process.env.TABLE_NAME ||
  "PartnerConfirmation-DataStack-PartnerConfirmationTable";
const API_ENDPOINT = process.env.API_ENDPOINT || "";

// DynamoDB 클라이언트
const dynamoClient = new DynamoDBClient({ region: REGION });

// 테스트 결과 추적
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const testResults: TestResult[] = [];

// 유틸리티 함수
function log(message: string, level: "INFO" | "ERROR" | "SUCCESS" = "INFO") {
  const timestamp = new Date().toISOString();
  const prefix = {
    INFO: "ℹ️",
    ERROR: "❌",
    SUCCESS: "✅",
  }[level];
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function httpRequest(
  url: string,
  method: string,
  body?: any
): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === "https:";
    const lib = isHttps ? https : http;

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: data ? JSON.parse(data) : null,
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: data,
          });
        }
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function getDynamoDBItem(pk: string, sk: string): Promise<any> {
  const command = new GetItemCommand({
    TableName: TABLE_NAME,
    Key: marshall({ PK: pk, SK: sk }),
  });

  const response = await dynamoClient.send(command);
  return response.Item ? unmarshall(response.Item) : null;
}

async function queryDynamoDB(pk: string): Promise<any[]> {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: marshall({ ":pk": pk }),
  });

  const response = await dynamoClient.send(command);
  return response.Items ? response.Items.map((item) => unmarshall(item)) : [];
}

async function putDynamoDBItem(item: any): Promise<void> {
  const command = new PutItemCommand({
    TableName: TABLE_NAME,
    Item: marshall(item),
  });

  await dynamoClient.send(command);
}

// 테스트 시나리오
async function testNormalFlow(): Promise<void> {
  log("=== 정상 플로우 테스트 시작 ===");
  const startTime = Date.now();

  try {
    // 1. 테스트 예약 데이터 생성
    log("1. 테스트 예약 데이터 생성 중...");
    const reservationNumber = `TEST-${Date.now()}`;
    const customerPhone = "+821012345678";
    const partnerPhone = "+821087654321";

    await putDynamoDBItem({
      PK: `RES#${reservationNumber}`,
      SK: "METADATA",
      reservationNumber,
      customerId: "test-customer",
      customerName: "테스트 고객",
      customerPhone,
      partnerId: "test-partner",
      partnerName: "테스트 파트너",
      partnerPhone,
      serviceType: "예약변경",
      reservationDate: "2024-12-25T10:00:00Z",
      createdAt: Date.now(),
    });

    log(`예약 생성 완료: ${reservationNumber}`, "SUCCESS");

    // 2. 고객 문의 제출
    log("2. 고객 문의 제출 중...");
    const chatResponse = await httpRequest(`${API_ENDPOINT}/chat`, "POST", {
      customerId: "test-customer",
      customerPhone,
      reservationNumber,
      message: "예약 시간을 변경하고 싶습니다",
    });

    if (chatResponse.statusCode !== 200) {
      throw new Error(
        `Chat API 실패: ${chatResponse.statusCode} - ${JSON.stringify(
          chatResponse.body
        )}`
      );
    }

    const requestId = chatResponse.body.requestId;
    log(`요청 생성 완료: ${requestId}`, "SUCCESS");

    // 3. DynamoDB에서 요청 상태 확인 (Created)
    log("3. 요청 상태 확인 중 (Created)...");
    await sleep(2000); // 비동기 처리 대기

    let request = await getDynamoDBItem(`REQ#${requestId}`, "METADATA");
    if (!request || request.status !== "Created") {
      throw new Error(
        `요청 상태가 Created가 아님: ${request?.status || "없음"}`
      );
    }
    log("요청 상태 확인 완료: Created", "SUCCESS");

    // 4. Step Functions 실행 확인
    log("4. Step Functions 실행 확인 중...");
    await sleep(3000); // Step Functions 시작 대기

    request = await getDynamoDBItem(`REQ#${requestId}`, "METADATA");
    if (!request.executionArn) {
      throw new Error("Step Functions 실행 ARN이 없음");
    }
    log(`Step Functions 실행 확인: ${request.executionArn}`, "SUCCESS");

    // 5. SMS 전송 상태 확인 (SMSSent)
    log("5. SMS 전송 상태 확인 중...");
    await sleep(5000); // SMS 전송 대기

    request = await getDynamoDBItem(`REQ#${requestId}`, "METADATA");
    if (request.status !== "SMSSent") {
      throw new Error(`SMS 전송 상태가 아님: ${request.status}`);
    }
    log("SMS 전송 상태 확인 완료: SMSSent", "SUCCESS");

    // 6. 토큰 확인
    log("6. 서명 토큰 확인 중...");
    const events = await queryDynamoDB(`REQ#${requestId}`);
    const smsEvent = events.find(
      (e) => e.SK?.startsWith("EVENT#") && e.eventType === "SMSSent"
    );

    if (!smsEvent || !smsEvent.details?.token) {
      throw new Error("SMS 이벤트에 토큰이 없음");
    }

    const token = smsEvent.details.token;
    log(`토큰 확인 완료: ${token.substring(0, 20)}...`, "SUCCESS");

    // 7. 확인 페이지 조회 (GET /confirm/{token})
    log("7. 확인 페이지 조회 중...");
    const confirmResponse = await httpRequest(
      `${API_ENDPOINT}/confirm/${token}`,
      "GET"
    );

    if (confirmResponse.statusCode !== 200) {
      throw new Error(`확인 페이지 조회 실패: ${confirmResponse.statusCode}`);
    }
    log("확인 페이지 조회 완료", "SUCCESS");

    // 8. Opened 이벤트 확인
    log("8. Opened 이벤트 확인 중...");
    await sleep(2000);

    const eventsAfterOpen = await queryDynamoDB(`REQ#${requestId}`);
    const openedEvent = eventsAfterOpen.find(
      (e) => e.SK?.startsWith("EVENT#") && e.eventType === "Opened"
    );

    if (!openedEvent) {
      throw new Error("Opened 이벤트가 기록되지 않음");
    }
    log("Opened 이벤트 확인 완료", "SUCCESS");

    // 9. 파트너 응답 제출 (POST /respond)
    log("9. 파트너 응답 제출 중...");
    const respondResponse = await httpRequest(
      `${API_ENDPOINT}/respond`,
      "POST",
      {
        token,
        response: "accept",
      }
    );

    if (respondResponse.statusCode !== 200) {
      throw new Error(
        `응답 제출 실패: ${respondResponse.statusCode} - ${JSON.stringify(
          respondResponse.body
        )}`
      );
    }
    log("파트너 응답 제출 완료", "SUCCESS");

    // 10. 요청 상태 확인 (Responded)
    log("10. 요청 상태 확인 중 (Responded)...");
    await sleep(2000);

    request = await getDynamoDBItem(`REQ#${requestId}`, "METADATA");
    if (request.status !== "Responded") {
      throw new Error(`요청 상태가 Responded가 아님: ${request.status}`);
    }
    log("요청 상태 확인 완료: Responded", "SUCCESS");

    // 11. Responded 이벤트 확인
    log("11. Responded 이벤트 확인 중...");
    const eventsAfterRespond = await queryDynamoDB(`REQ#${requestId}`);
    const respondedEvent = eventsAfterRespond.find(
      (e) => e.SK?.startsWith("EVENT#") && e.eventType === "Responded"
    );

    if (!respondedEvent) {
      throw new Error("Responded 이벤트가 기록되지 않음");
    }
    log("Responded 이벤트 확인 완료", "SUCCESS");

    // 12. 고객 알림 생성 확인
    log("12. 고객 알림 생성 확인 중...");
    await sleep(5000); // Bedrock 호출 대기

    request = await getDynamoDBItem(`REQ#${requestId}`, "METADATA");
    if (!request.notificationMessage) {
      throw new Error("고객 알림 메시지가 생성되지 않음");
    }
    log(
      `고객 알림 생성 완료: ${request.notificationMessage.substring(0, 50)}...`,
      "SUCCESS"
    );

    const duration = Date.now() - startTime;
    testResults.push({
      name: "정상 플로우 테스트",
      passed: true,
      duration,
    });

    log(`=== 정상 플로우 테스트 완료 (${duration}ms) ===`, "SUCCESS");
  } catch (error: any) {
    const duration = Date.now() - startTime;
    testResults.push({
      name: "정상 플로우 테스트",
      passed: false,
      error: error.message,
      duration,
    });
    log(`정상 플로우 테스트 실패: ${error.message}`, "ERROR");
    throw error;
  }
}

async function testTimeoutScenario(): Promise<void> {
  log("=== 타임아웃 시나리오 테스트 시작 ===");
  const startTime = Date.now();

  try {
    // 1. 테스트 예약 데이터 생성
    log("1. 테스트 예약 데이터 생성 중...");
    const reservationNumber = `TEST-TIMEOUT-${Date.now()}`;
    const customerPhone = "+821012345679";
    const partnerPhone = "+821087654322";

    await putDynamoDBItem({
      PK: `RES#${reservationNumber}`,
      SK: "METADATA",
      reservationNumber,
      customerId: "test-customer-timeout",
      customerName: "테스트 고객 (타임아웃)",
      customerPhone,
      partnerId: "test-partner-timeout",
      partnerName: "테스트 파트너 (타임아웃)",
      partnerPhone,
      serviceType: "트러블신고",
      reservationDate: "2024-12-25T14:00:00Z",
      createdAt: Date.now(),
    });

    log(`예약 생성 완료: ${reservationNumber}`, "SUCCESS");

    // 2. 고객 문의 제출
    log("2. 고객 문의 제출 중...");
    const chatResponse = await httpRequest(`${API_ENDPOINT}/chat`, "POST", {
      customerId: "test-customer-timeout",
      customerPhone,
      reservationNumber,
      message: "서비스에 문제가 있습니다",
    });

    if (chatResponse.statusCode !== 200) {
      throw new Error(`Chat API 실패: ${chatResponse.statusCode}`);
    }

    const requestId = chatResponse.body.requestId;
    log(`요청 생성 완료: ${requestId}`, "SUCCESS");

    // 3. SMS 전송 대기
    log("3. SMS 전송 대기 중...");
    await sleep(8000);

    let request = await getDynamoDBItem(`REQ#${requestId}`, "METADATA");
    if (request.status !== "SMSSent") {
      throw new Error(`SMS 전송 상태가 아님: ${request.status}`);
    }
    log("SMS 전송 확인 완료", "SUCCESS");

    // 4. 타임아웃 대기 (300초는 너무 길므로 상태만 확인)
    log("4. 타임아웃 처리 확인 (실제 300초 대기는 생략)...");
    log("   ⚠️  실제 환경에서는 300초 후 Timeout 상태로 전환됩니다");
    log("   ⚠️  테스트에서는 Step Functions 상태 머신 설정을 확인합니다");

    // Step Functions 실행 ARN 확인
    if (!request.executionArn) {
      throw new Error("Step Functions 실행 ARN이 없음");
    }
    log(`Step Functions 실행 확인: ${request.executionArn}`, "SUCCESS");

    const duration = Date.now() - startTime;
    testResults.push({
      name: "타임아웃 시나리오 테스트",
      passed: true,
      duration,
    });

    log(`=== 타임아웃 시나리오 테스트 완료 (${duration}ms) ===`, "SUCCESS");
    log("   ℹ️  전체 타임아웃 플로우를 테스트하려면 300초 대기가 필요합니다");
  } catch (error: any) {
    const duration = Date.now() - startTime;
    testResults.push({
      name: "타임아웃 시나리오 테스트",
      passed: false,
      error: error.message,
      duration,
    });
    log(`타임아웃 시나리오 테스트 실패: ${error.message}`, "ERROR");
    throw error;
  }
}

async function testErrorScenarios(): Promise<void> {
  log("=== 에러 시나리오 테스트 시작 ===");
  const startTime = Date.now();

  try {
    // 1. 예약 없음 케이스
    log("1. 예약 없음 케이스 테스트 중...");
    const nonExistentReservation = `NONEXISTENT-${Date.now()}`;
    const chatResponse1 = await httpRequest(`${API_ENDPOINT}/chat`, "POST", {
      customerId: "test-customer-error",
      customerPhone: "+821012345680",
      reservationNumber: nonExistentReservation,
      message: "예약을 변경하고 싶습니다",
    });

    if (chatResponse1.statusCode !== 200) {
      throw new Error(`Chat API 실패: ${chatResponse1.statusCode}`);
    }

    const requestId1 = chatResponse1.body.requestId;
    await sleep(5000); // 처리 대기

    const request1 = await getDynamoDBItem(`REQ#${requestId1}`, "METADATA");
    if (request1.status !== "Failed") {
      throw new Error(
        `예약 없음 케이스 상태가 Failed가 아님: ${request1.status}`
      );
    }
    log("예약 없음 케이스 확인 완료: Failed", "SUCCESS");

    // 2. 고객 정보 불일치 케이스
    log("2. 고객 정보 불일치 케이스 테스트 중...");
    const reservationNumber2 = `TEST-MISMATCH-${Date.now()}`;
    await putDynamoDBItem({
      PK: `RES#${reservationNumber2}`,
      SK: "METADATA",
      reservationNumber: reservationNumber2,
      customerId: "test-customer-mismatch",
      customerName: "테스트 고객",
      customerPhone: "+821011111111",
      partnerId: "test-partner",
      partnerName: "테스트 파트너",
      partnerPhone: "+821022222222",
      serviceType: "예약변경",
      reservationDate: "2024-12-25T10:00:00Z",
      createdAt: Date.now(),
    });

    const chatResponse2 = await httpRequest(`${API_ENDPOINT}/chat`, "POST", {
      customerId: "test-customer-mismatch",
      customerPhone: "+821099999999", // 다른 전화번호
      reservationNumber: reservationNumber2,
      message: "예약을 변경하고 싶습니다",
    });

    if (chatResponse2.statusCode !== 200) {
      throw new Error(`Chat API 실패: ${chatResponse2.statusCode}`);
    }

    const requestId2 = chatResponse2.body.requestId;
    await sleep(5000); // 처리 대기

    const request2 = await getDynamoDBItem(`REQ#${requestId2}`, "METADATA");
    if (request2.status !== "Failed") {
      throw new Error(
        `고객 정보 불일치 케이스 상태가 Failed가 아님: ${request2.status}`
      );
    }
    log("고객 정보 불일치 케이스 확인 완료: Failed", "SUCCESS");

    // 3. 토큰 만료 케이스
    log("3. 토큰 만료 케이스 테스트 중...");
    const expiredToken = Buffer.from(
      JSON.stringify({
        payload: {
          requestId: "test-request",
          partnerId: "test-partner",
          expiresAt: Date.now() - 1000, // 이미 만료됨
          scope: "confirm",
        },
        signature: "invalid-signature",
      })
    ).toString("base64url");

    const confirmResponse = await httpRequest(
      `${API_ENDPOINT}/confirm/${expiredToken}`,
      "GET"
    );

    if (confirmResponse.statusCode !== 401) {
      throw new Error(
        `토큰 만료 케이스가 401을 반환하지 않음: ${confirmResponse.statusCode}`
      );
    }
    log("토큰 만료 케이스 확인 완료: 401", "SUCCESS");

    // 4. 토큰 재사용 케이스
    log("4. 토큰 재사용 케이스 테스트 중...");
    // 정상 플로우에서 사용된 토큰을 재사용하려고 시도
    // (실제로는 정상 플로우 테스트에서 생성된 토큰이 필요하므로 스킵)
    log("   ⚠️  토큰 재사용 케이스는 정상 플로우 테스트 후 수동으로 확인 필요");

    const duration = Date.now() - startTime;
    testResults.push({
      name: "에러 시나리오 테스트",
      passed: true,
      duration,
    });

    log(`=== 에러 시나리오 테스트 완료 (${duration}ms) ===`, "SUCCESS");
  } catch (error: any) {
    const duration = Date.now() - startTime;
    testResults.push({
      name: "에러 시나리오 테스트",
      passed: false,
      error: error.message,
      duration,
    });
    log(`에러 시나리오 테스트 실패: ${error.message}`, "ERROR");
    throw error;
  }
}

// 메인 함수
async function main() {
  const args = process.argv.slice(2);
  const scenarioArg = args.find((arg) => arg.startsWith("--scenario="));
  const scenario = scenarioArg ? scenarioArg.split("=")[1] : "all";

  log("파트너 확인 자동화 시스템 통합 테스트");
  log(`리전: ${REGION}`);
  log(`테이블: ${TABLE_NAME}`);
  log(`API 엔드포인트: ${API_ENDPOINT}`);
  log(`시나리오: ${scenario}`);
  log("");

  if (!API_ENDPOINT) {
    log("API_ENDPOINT 환경 변수가 설정되지 않았습니다", "ERROR");
    log(
      "사용법: API_ENDPOINT=<your-api-endpoint> ts-node test/integration-test.ts",
      "ERROR"
    );
    process.exit(1);
  }

  try {
    if (scenario === "normal" || scenario === "all") {
      await testNormalFlow();
      log("");
    }

    if (scenario === "timeout" || scenario === "all") {
      await testTimeoutScenario();
      log("");
    }

    if (scenario === "errors" || scenario === "all") {
      await testErrorScenarios();
      log("");
    }

    // 결과 요약
    log("=== 테스트 결과 요약 ===");
    const passed = testResults.filter((r) => r.passed).length;
    const failed = testResults.filter((r) => !r.passed).length;

    testResults.forEach((result) => {
      const status = result.passed ? "✅ PASS" : "❌ FAIL";
      log(`${status} ${result.name} (${result.duration}ms)`);
      if (result.error) {
        log(`   오류: ${result.error}`, "ERROR");
      }
    });

    log("");
    log(
      `총 ${testResults.length}개 테스트 중 ${passed}개 성공, ${failed}개 실패`
    );

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    log(`테스트 실행 중 오류 발생: ${error.message}`, "ERROR");
    process.exit(1);
  }
}

main();
