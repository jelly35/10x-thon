/**
 * 토큰 검증 유틸리티 (DynamoDB 연동)
 *
 * 서명 검증, 만료 시간 검증, 사용 여부 확인을 포함한 완전한 토큰 검증을 수행합니다.
 * 요구사항: 4.1, 5.1
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { TokenPayload, Token, TokenItem } from "../../lib/types";
import { verifyToken, TokenValidationError } from "./token";

/**
 * DynamoDB 클라이언트 초기화
 */
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * 토큰 검증 결과
 */
export interface TokenValidationResult {
  payload: TokenPayload;
  tokenRecord: Token;
}

/**
 * 완전한 토큰 검증 (서명, 만료, 사용 여부)
 *
 * @param token - Base64URL 인코딩된 서명 토큰
 * @param secretKey - HMAC 서명 검증에 사용할 비밀 키
 * @param tableName - DynamoDB 테이블 이름
 * @returns 검증 결과 (페이로드 및 토큰 레코드)
 *
 * @throws {TokenValidationError} 토큰이 유효하지 않거나 이미 사용된 경우
 *
 * @example
 * try {
 *   const result = await validateToken(token, secretKey, tableName);
 *   console.log('Valid token:', result.payload);
 * } catch (error) {
 *   console.error('Token validation failed:', error.message);
 * }
 */
export async function validateToken(
  token: string,
  secretKey: string,
  tableName: string
): Promise<TokenValidationResult> {
  // 1. 서명 및 만료 시간 검증
  const payload = verifyToken(token, secretKey);

  // 2. DynamoDB에서 토큰 레코드 조회
  const getCommand = new GetCommand({
    TableName: tableName,
    Key: {
      PK: `TOKEN#${token}`,
      SK: "METADATA",
    },
  });

  const result = await docClient.send(getCommand);

  if (!result.Item) {
    throw new TokenValidationError("Token not found in database");
  }

  const tokenRecord = result.Item as TokenItem;

  // 3. 사용 여부 확인
  if (tokenRecord.used) {
    throw new TokenValidationError("Token already used");
  }

  // 4. 토큰 레코드의 만료 시간도 확인 (이중 검증)
  if (Date.now() > tokenRecord.expiresAt) {
    throw new TokenValidationError("Token expired");
  }

  return {
    payload,
    tokenRecord: {
      token: tokenRecord.token,
      requestId: tokenRecord.requestId,
      partnerId: tokenRecord.partnerId,
      used: tokenRecord.used,
      expiresAt: tokenRecord.expiresAt,
      createdAt: tokenRecord.createdAt,
    },
  };
}

/**
 * 토큰을 사용됨으로 표시
 *
 * @param token - Base64URL 인코딩된 서명 토큰
 * @param tableName - DynamoDB 테이블 이름
 *
 * @throws {Error} DynamoDB 업데이트 실패 시
 *
 * @example
 * await markTokenAsUsed(token, tableName);
 * console.log('Token marked as used');
 */
export async function markTokenAsUsed(
  token: string,
  tableName: string
): Promise<void> {
  const updateCommand = new UpdateCommand({
    TableName: tableName,
    Key: {
      PK: `TOKEN#${token}`,
      SK: "METADATA",
    },
    UpdateExpression: "SET #used = :used",
    ExpressionAttributeNames: {
      "#used": "used",
    },
    ExpressionAttributeValues: {
      ":used": true,
    },
  });

  await docClient.send(updateCommand);
}

/**
 * 토큰 사용 여부 확인
 *
 * @param token - Base64URL 인코딩된 서명 토큰
 * @param tableName - DynamoDB 테이블 이름
 * @returns 사용 여부 (true: 사용됨, false: 미사용)
 *
 * @throws {Error} DynamoDB 조회 실패 시
 *
 * @example
 * const isUsed = await isTokenUsed(token, tableName);
 * if (isUsed) {
 *   console.log('Token has already been used');
 * }
 */
export async function isTokenUsed(
  token: string,
  tableName: string
): Promise<boolean> {
  const getCommand = new GetCommand({
    TableName: tableName,
    Key: {
      PK: `TOKEN#${token}`,
      SK: "METADATA",
    },
  });

  const result = await docClient.send(getCommand);

  if (!result.Item) {
    return false;
  }

  const tokenRecord = result.Item as TokenItem;
  return tokenRecord.used;
}

/**
 * 토큰 레코드 조회
 *
 * @param token - Base64URL 인코딩된 서명 토큰
 * @param tableName - DynamoDB 테이블 이름
 * @returns 토큰 레코드 (없으면 null)
 *
 * @example
 * const tokenRecord = await getTokenRecord(token, tableName);
 * if (tokenRecord) {
 *   console.log('Token found:', tokenRecord);
 * }
 */
export async function getTokenRecord(
  token: string,
  tableName: string
): Promise<Token | null> {
  const getCommand = new GetCommand({
    TableName: tableName,
    Key: {
      PK: `TOKEN#${token}`,
      SK: "METADATA",
    },
  });

  const result = await docClient.send(getCommand);

  if (!result.Item) {
    return null;
  }

  const item = result.Item as TokenItem;

  return {
    token: item.token,
    requestId: item.requestId,
    partnerId: item.partnerId,
    used: item.used,
    expiresAt: item.expiresAt,
    createdAt: item.createdAt,
  };
}
