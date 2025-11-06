/**
 * 서명 토큰 생성 및 검증 유틸리티
 *
 * HMAC-SHA256 서명을 사용하여 1회용 인증 토큰을 생성하고 검증합니다.
 * 요구사항: 3.1, 3.2, 4.1, 5.1
 */

import * as crypto from "crypto";
import { TokenPayload, SignedToken } from "../../lib/types";

/**
 * 토큰 생성 에러
 */
export class TokenGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenGenerationError";
  }
}

/**
 * 토큰 검증 에러
 */
export class TokenValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenValidationError";
  }
}

/**
 * 서명 토큰 생성
 *
 * @param requestId - 요청 ID
 * @param partnerId - 파트너 ID
 * @param secretKey - HMAC 서명에 사용할 비밀 키
 * @param expiresInMinutes - 토큰 만료 시간 (분 단위, 기본값: 10분)
 * @returns Base64URL 인코딩된 서명 토큰
 *
 * @throws {TokenGenerationError} secretKey가 제공되지 않은 경우
 *
 * @example
 * const token = generateToken('req-123', 'partner-456', 'my-secret-key');
 */
export function generateToken(
  requestId: string,
  partnerId: string,
  secretKey: string,
  expiresInMinutes: number = 10
): string {
  if (!secretKey) {
    throw new TokenGenerationError("Secret key is required");
  }

  // 페이로드 생성
  const payload: TokenPayload = {
    requestId,
    partnerId,
    expiresAt: Date.now() + expiresInMinutes * 60 * 1000,
    scope: "confirm",
  };

  // 페이로드를 JSON 문자열로 변환
  const message = JSON.stringify(payload);

  // HMAC-SHA256 서명 생성
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(message)
    .digest("base64");

  // 서명된 토큰 객체 생성
  const signedToken: SignedToken = {
    payload,
    signature,
  };

  // Base64URL 인코딩 (URL-safe)
  const token = Buffer.from(JSON.stringify(signedToken)).toString("base64url");

  return token;
}

/**
 * 서명 토큰 검증 (서명 및 만료 시간만 검증)
 *
 * @param token - Base64URL 인코딩된 서명 토큰
 * @param secretKey - HMAC 서명 검증에 사용할 비밀 키
 * @returns 검증된 토큰 페이로드
 *
 * @throws {TokenValidationError} 토큰이 유효하지 않은 경우
 *
 * @example
 * try {
 *   const payload = verifyToken(token, 'my-secret-key');
 *   console.log('Valid token:', payload);
 * } catch (error) {
 *   console.error('Invalid token:', error.message);
 * }
 */
export function verifyToken(token: string, secretKey: string): TokenPayload {
  if (!secretKey) {
    throw new TokenValidationError("Secret key is required");
  }

  try {
    // Base64URL 디코딩
    const decoded = JSON.parse(
      Buffer.from(token, "base64url").toString("utf-8")
    );

    const { payload, signature } = decoded as SignedToken;

    // 페이로드 검증
    if (!payload || !signature) {
      throw new TokenValidationError("Invalid token structure");
    }

    // 서명 검증
    const message = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac("sha256", secretKey)
      .update(message)
      .digest("base64");

    if (signature !== expectedSignature) {
      throw new TokenValidationError("Invalid signature");
    }

    // 만료 시간 검증
    if (Date.now() > payload.expiresAt) {
      throw new TokenValidationError("Token expired");
    }

    return payload;
  } catch (error) {
    if (error instanceof TokenValidationError) {
      throw error;
    }
    throw new TokenValidationError("Invalid token format");
  }
}

/**
 * 토큰 페이로드 파싱 (검증 없이)
 *
 * @param token - Base64URL 인코딩된 서명 토큰
 * @returns 토큰 페이로드 (검증되지 않음)
 *
 * @throws {TokenValidationError} 토큰 형식이 유효하지 않은 경우
 *
 * @example
 * const payload = parseTokenPayload(token);
 * console.log('Request ID:', payload.requestId);
 */
export function parseTokenPayload(token: string): TokenPayload {
  try {
    const decoded = JSON.parse(
      Buffer.from(token, "base64url").toString("utf-8")
    );

    const { payload } = decoded as SignedToken;

    if (!payload) {
      throw new TokenValidationError("Invalid token structure");
    }

    return payload;
  } catch (error) {
    throw new TokenValidationError("Invalid token format");
  }
}

/**
 * 토큰 만료 여부 확인
 *
 * @param payload - 토큰 페이로드
 * @returns 만료 여부 (true: 만료됨, false: 유효함)
 *
 * @example
 * const payload = parseTokenPayload(token);
 * if (isTokenExpired(payload)) {
 *   console.log('Token has expired');
 * }
 */
export function isTokenExpired(payload: TokenPayload): boolean {
  return Date.now() > payload.expiresAt;
}
