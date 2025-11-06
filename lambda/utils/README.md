# Token Utilities

서명 토큰 생성 및 검증 유틸리티 모듈입니다.

## 모듈

### token.ts

기본 토큰 생성 및 서명 검증 기능을 제공합니다.

**주요 함수:**

- `generateToken()` - HMAC-SHA256 서명 토큰 생성
- `verifyToken()` - 서명 및 만료 시간 검증
- `parseTokenPayload()` - 토큰 페이로드 파싱 (검증 없이)
- `isTokenExpired()` - 토큰 만료 여부 확인

### token-validator.ts

DynamoDB와 연동하여 토큰의 사용 여부를 확인하는 완전한 검증 기능을 제공합니다.

**주요 함수:**

- `validateToken()` - 완전한 토큰 검증 (서명, 만료, 사용 여부)
- `markTokenAsUsed()` - 토큰을 사용됨으로 표시
- `isTokenUsed()` - 토큰 사용 여부 확인
- `getTokenRecord()` - 토큰 레코드 조회

## 사용 예제

### 1. 토큰 생성 (SMS Sender Lambda)

```typescript
import { generateToken } from "./utils/token";

const secretKey = process.env.SECRET_KEY!;
const token = generateToken("req-123", "partner-456", secretKey, 10); // 10분 만료

console.log("Generated token:", token);
// 토큰을 DynamoDB에 저장하고 SMS로 전송
```

### 2. 토큰 검증 - 서명만 (Response Handler Lambda - GET)

```typescript
import { verifyToken } from "./utils/token";

try {
  const secretKey = process.env.SECRET_KEY!;
  const payload = verifyToken(token, secretKey);

  console.log("Valid token:", payload);
  // 확인 페이지 데이터 반환
} catch (error) {
  console.error("Invalid token:", error.message);
  // 401 에러 반환
}
```

### 3. 완전한 토큰 검증 (Response Handler Lambda - POST)

```typescript
import { validateToken, markTokenAsUsed } from "./utils/token-validator";

try {
  const secretKey = process.env.SECRET_KEY!;
  const tableName = process.env.TABLE_NAME!;

  // 서명, 만료, 사용 여부 모두 검증
  const result = await validateToken(token, secretKey, tableName);

  console.log("Valid token:", result.payload);
  console.log("Token record:", result.tokenRecord);

  // 파트너 응답 처리...

  // 토큰을 사용됨으로 표시
  await markTokenAsUsed(token, tableName);
} catch (error) {
  if (error.message === "Token already used") {
    // 409 에러 반환
  } else {
    // 401 에러 반환
  }
}
```

### 4. 토큰 페이로드 파싱 (검증 없이)

```typescript
import { parseTokenPayload } from "./utils/token";

try {
  const payload = parseTokenPayload(token);
  console.log("Request ID:", payload.requestId);
  console.log("Partner ID:", payload.partnerId);
} catch (error) {
  console.error("Invalid token format");
}
```

## 에러 처리

### TokenGenerationError

토큰 생성 중 발생하는 에러입니다.

- `Secret key is required` - 비밀 키가 제공되지 않음

### TokenValidationError

토큰 검증 중 발생하는 에러입니다.

- `Secret key is required` - 비밀 키가 제공되지 않음
- `Invalid token structure` - 토큰 구조가 유효하지 않음
- `Invalid signature` - 서명이 유효하지 않음
- `Token expired` - 토큰이 만료됨
- `Invalid token format` - 토큰 형식이 유효하지 않음
- `Token not found in database` - DynamoDB에 토큰이 없음
- `Token already used` - 토큰이 이미 사용됨

## 보안 고려사항

1. **SECRET_KEY 관리**: 환경 변수로 관리하고 절대 코드에 하드코딩하지 마세요
2. **토큰 만료 시간**: 기본 10분, 보안 요구사항에 따라 조정 가능
3. **1회용 토큰**: 사용 후 반드시 `markTokenAsUsed()`로 표시
4. **Base64URL 인코딩**: URL-safe 인코딩 사용으로 SMS 링크에 안전

## 요구사항 매핑

- **요구사항 3.1**: 토큰 생성 함수 (`generateToken`)
- **요구사항 3.2**: 서명 및 만료 검증 (`verifyToken`)
- **요구사항 4.1**: 토큰 검증 (`validateToken`)
- **요구사항 5.1**: 사용 여부 확인 및 표시 (`validateToken`, `markTokenAsUsed`)
