# 디자인 문서

## 개요

파트너 확인 자동화 시스템은 AWS 서버리스 서비스를 활용하여 고객 문의를 자동으로 처리하고 파트너의 응답을 수집하는 완전 자동화된 솔루션입니다. 시스템은 Amazon Lex V2로 고객 의도를 파악하고, Step Functions로 워크플로우를 오케스트레이션하며, Amazon Bedrock으로 자연스러운 응답을 생성합니다.

### 핵심 목표

- 완전 서버리스 아키텍처로 자동 확장 및 운영 오버헤드 최소화
- 파트너의 로그인 없는 간편한 응답 프로세스
- 예약번호 기반 파트너 자동 매칭
- 실시간 워크플로우 오케스트레이션
- 해커톤 데모에 적합한 간결한 구현

## 아키텍처

### 전체 구조

```
[고객 웹 UI]
    ↓ (HTTP)
[API Gateway] → [Lex Handler Lambda] → [Amazon Lex V2]
    ↓
[Orchestrator Lambda] → [Step Functions]
    ↓
[SMS Sender Lambda] → [Amazon SNS]
    ↓
[파트너 확인 페이지 (S3)]
    ↓ (HTTP)
[API Gateway] → [Response Handler Lambda] → [Step Functions Callback]
    ↓
[Notification Lambda] → [Amazon Bedrock]
    ↓
[고객 웹 UI]

[DynamoDB] ← 모든 Lambda 함수
```

### 주요 컴포넌트

1. **고객 웹 UI (S3 + CloudFront)**

   - 정적 웹 페이지로 고객이 문의를 입력하는 인터페이스
   - 예약번호와 문의 내용 입력 폼
   - 실시간 응답 표시

2. **API Gateway (HTTP API)**

   - `/chat`: 고객 문의 제출 엔드포인트
   - `/confirm/{token}`: 파트너 확인 페이지 데이터 조회
   - `/respond`: 파트너 응답 제출 엔드포인트

3. **Lex Handler Lambda**

   - Amazon Lex V2 호출 및 인텐트 분류
   - 예약번호 슬롯 검증
   - 요청 ID 생성 및 DynamoDB 저장

4. **Orchestrator Lambda**

   - Step Functions 워크플로우 시작
   - 예약 데이터베이스에서 파트너 조회
   - 워크플로우 상태 관리

5. **SMS Sender Lambda**

   - 서명 토큰 생성 (HMAC-SHA256)
   - Amazon SNS를 통한 SMS 전송
   - 확인 링크 생성

6. **Response Handler Lambda**

   - 서명 토큰 검증
   - 파트너 응답 처리
   - Step Functions SendTaskSuccess 호출

7. **Notification Lambda**

   - Amazon Bedrock 호출
   - 한국어 고객 알림 메시지 생성
   - 고객 UI로 응답 전달

8. **Step Functions 워크플로우**

   - Callback 패턴으로 파트너 응답 대기
   - 300초 타임아웃 처리
   - 상태 전환 관리

9. **DynamoDB**

   - 단일 테이블 설계
   - 요청, 예약, 이벤트 데이터 저장

10. **Amazon Lex V2**

    - ko-KR 로케일
    - 인텐트: 예약 변경, 트러블 신고, 부가 서비스 요청
    - 슬롯: 예약번호, 문의 내용

11. **Amazon Bedrock**
    - Claude 모델 사용
    - 한국어 응답 생성

## 데이터 모델

### DynamoDB 단일 테이블 설계

테이블명: `PartnerConfirmationTable`

#### 파티션 키 및 정렬 키

- PK (Partition Key): String
- SK (Sort Key): String

#### 엔티티 타입

**1. 요청 (Request)**

```
PK: REQ#{requestId}
SK: METADATA
attributes:
  - requestId: string
  - customerId: string
  - customerPhone: string
  - reservationNumber: string
  - intent: string (예약변경|트러블신고|부가서비스)
  - query: string
  - partnerId: string
  - partnerPhone: string
  - status: string (Created|SMSSent|Opened|Responded|Timeout|Failed)
  - taskToken: string (Step Functions callback token)
  - createdAt: number (timestamp)
  - updatedAt: number (timestamp)
```

**2. 예약 (Reservation)**

```
PK: RES#{reservationNumber}
SK: METADATA
attributes:
  - reservationNumber: string
  - customerId: string
  - customerName: string
  - customerPhone: string
  - partnerId: string
  - partnerName: string
  - partnerPhone: string
  - serviceType: string
  - reservationDate: string
  - createdAt: number
```

**3. 이벤트 (Event)**

```
PK: REQ#{requestId}
SK: EVENT#{timestamp}
attributes:
  - eventType: string (Created|SMSSent|Opened|Responded|Timeout|Failed)
  - timestamp: number
  - details: map (이벤트별 추가 정보)
```

**4. 토큰 (Token)**

```
PK: TOKEN#{token}
SK: METADATA
attributes:
  - token: string
  - requestId: string
  - partnerId: string
  - used: boolean
  - expiresAt: number (timestamp)
  - createdAt: number
```

### GSI (Global Secondary Index)

**GSI1: 예약번호로 조회**

- PK: reservationNumber
- SK: customerPhone
- 용도: 예약번호와 고객 연락처로 예약 정보 조회

**GSI2: 상태별 요청 조회**

- PK: status
- SK: createdAt
- 용도: 특정 상태의 요청 목록 조회 (모니터링용)

## API 엔드포인트

### 1. POST /chat

고객 문의 제출

**Request:**

```json
{
  "customerId": "string",
  "customerPhone": "string",
  "reservationNumber": "string",
  "message": "string"
}
```

**Response:**

```json
{
  "requestId": "string",
  "status": "Created",
  "message": "요청이 접수되었습니다"
}
```

### 2. GET /confirm/{token}

파트너 확인 페이지 데이터 조회

**Response:**

```json
{
  "requestId": "string",
  "customerQuery": "string",
  "intent": "string",
  "reservationNumber": "string",
  "reservationDate": "string"
}
```

### 3. POST /respond

파트너 응답 제출

**Request:**

```json
{
  "token": "string",
  "response": "accept|reject|alternative",
  "alternativeTime": "string (optional)"
}
```

**Response:**

```json
{
  "success": true,
  "message": "응답이 접수되었습니다"
}
```

## 워크플로우

### 전체 흐름

1. **고객 문의 제출**

   - 고객이 웹 UI에서 예약번호와 문의 입력
   - API Gateway → Lex Handler Lambda
   - Lex V2로 인텐트 분류
   - 예약번호 슬롯 검증
   - 요청 ID 생성 및 DynamoDB 저장 (상태: Created)

2. **파트너 조회**

   - Orchestrator Lambda 실행
   - 예약번호와 고객 연락처로 DynamoDB 조회
   - 파트너 정보 추출 및 요청 레코드 업데이트
   - Step Functions 워크플로우 시작

3. **SMS 전송**

   - SMS Sender Lambda 실행
   - 서명 토큰 생성 (요청 ID, 파트너 ID, 만료 시간 포함)
   - 토큰 DynamoDB 저장
   - Amazon SNS로 SMS 전송
   - 요청 상태 업데이트 (상태: SMSSent)

4. **파트너 응답 대기**

   - Step Functions WaitPartner 상태 진입
   - Callback 패턴으로 300초 대기
   - 타임아웃 시 Timeout 상태로 전환

5. **파트너 확인**

   - 파트너가 SMS 링크 클릭
   - S3 정적 페이지 로드
   - API Gateway → Response Handler Lambda
   - 토큰 검증 (서명, 만료, 사용 여부)
   - 요청 정보 조회 및 확인 페이지 표시
   - Opened 이벤트 기록

6. **파트너 응답 제출**

   - 파트너가 수락/거절/대안 선택
   - API Gateway → Response Handler Lambda
   - 토큰 재사용 검증
   - Step Functions SendTaskSuccess 호출
   - 토큰 사용됨 표시
   - 요청 상태 업데이트 (상태: Responded)

7. **고객 알림 생성**
   - Notification Lambda 실행
   - Amazon Bedrock 호출
   - 프롬프트: 요청 정보 + 파트너 응답
   - 한국어 알림 메시지 생성
   - 고객 UI로 응답 전달

### Step Functions 상태 머신

```json
{
  "Comment": "Partner Confirmation Workflow",
  "StartAt": "SendSMS",
  "States": {
    "SendSMS": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:SmsSender",
      "Next": "WaitPartner"
    },
    "WaitPartner": {
      "Type": "Task",
      "Resource": "arn:aws:states:::lambda:invoke.waitForTaskToken",
      "Parameters": {
        "FunctionName": "ResponseHandler",
        "Payload": {
          "taskToken.$": "$$.Task.Token",
          "requestId.$": "$.requestId"
        }
      },
      "TimeoutSeconds": 300,
      "Catch": [
        {
          "ErrorEquals": ["States.Timeout"],
          "Next": "HandleTimeout"
        }
      ],
      "Next": "GenerateNotification"
    },
    "HandleTimeout": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:TimeoutHandler",
      "Next": "GenerateNotification"
    },
    "GenerateNotification": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:NotificationGenerator",
      "End": true
    }
  }
}
```

## 컴포넌트 상세 설계

### 1. Lex Handler Lambda

**입력:**

- customerId
- customerPhone
- reservationNumber
- message

**처리:**

1. Lex V2 호출 (ko-KR 로케일)
2. 인텐트 및 슬롯 추출
3. 예약번호 슬롯 검증
4. 요청 ID 생성 (UUID)
5. DynamoDB에 요청 레코드 저장
6. Created 이벤트 기록

**출력:**

- requestId
- status
- message

**에러 처리:**

- Lex 호출 실패: 3초 타임아웃, 재시도 없음
- 예약번호 누락: 고객에게 입력 요청 메시지 반환
- DynamoDB 저장 실패: 500 에러 반환

### 2. Orchestrator Lambda

**입력:**

- requestId

**처리:**

1. DynamoDB에서 요청 정보 조회
2. 예약번호와 고객 연락처로 예약 조회 (GSI1)
3. 파트너 정보 추출
4. 요청 레코드에 파트너 정보 업데이트
5. Step Functions 실행 시작

**출력:**

- executionArn
- partnerId
- partnerPhone

**에러 처리:**

- 예약 없음: Failed 상태로 업데이트, 고객에게 오류 메시지
- 고객 정보 불일치: Failed 상태로 업데이트, 고객에게 오류 메시지
- Step Functions 시작 실패: 재시도 1회

### 3. SMS Sender Lambda

**입력:**

- requestId
- partnerId
- partnerPhone

**처리:**

1. 서명 토큰 생성
   - 페이로드: {requestId, partnerId, expiresAt, scope: "confirm"}
   - HMAC-SHA256 서명 (환경 변수 SECRET_KEY 사용)
   - Base64 인코딩
2. 토큰 DynamoDB 저장 (만료: 10분)
3. 확인 링크 생성: `https://confirm.example/r/{token}`
4. Amazon SNS로 SMS 전송
5. 요청 상태 업데이트 (SMSSent)
6. SMSSent 이벤트 기록

**출력:**

- token
- smsMessageId

**에러 처리:**

- SNS 전송 실패: 재시도 2회, 실패 시 Failed 상태로 업데이트

### 4. Response Handler Lambda

**GET /confirm/{token} 처리:**

1. 토큰 파싱 및 서명 검증
2. 만료 시간 검증
3. DynamoDB에서 토큰 조회
4. 사용 여부 확인
5. 요청 정보 조회
6. Opened 이벤트 기록
7. 확인 페이지 데이터 반환

**POST /respond 처리:**

1. 토큰 검증 (서명, 만료, 사용 여부)
2. 응답 데이터 검증
3. Step Functions SendTaskSuccess 호출
4. 토큰 사용됨 표시
5. 요청 상태 업데이트 (Responded)
6. Responded 이벤트 기록

**에러 처리:**

- 토큰 무효: 401 에러, Failed 이벤트 기록
- 토큰 만료: 401 에러, 오류 페이지 표시
- 토큰 이미 사용됨: 409 에러, "이미 사용된 링크" 메시지
- SendTaskSuccess 실패: 재시도 1회

### 5. Notification Lambda

**입력:**

- requestId
- partnerResponse (accept|reject|alternative|timeout)
- alternativeTime (optional)

**처리:**

1. DynamoDB에서 요청 정보 조회
2. Bedrock 프롬프트 생성
3. Amazon Bedrock 호출 (Claude 모델)
4. 한국어 알림 메시지 생성
5. 고객 UI로 응답 전달 (WebSocket 또는 폴링)

**Bedrock 프롬프트 템플릿:**

```
당신은 고객 서비스 담당자입니다. 다음 정보를 바탕으로 고객에게 전달할 친절한 알림 메시지를 한국어로 작성해주세요.

고객 문의: {query}
문의 유형: {intent}
예약번호: {reservationNumber}
파트너 응답: {partnerResponse}
대안 시간: {alternativeTime}

고객이 이해하기 쉽고 다음 행동을 명확히 알 수 있도록 작성해주세요.
```

**출력:**

- notificationMessage

**에러 처리:**

- Bedrock 호출 실패: 기본 메시지 사용, 재시도 없음

## 보안 설계

### 1. 서명 토큰

**생성:**

```javascript
const payload = {
  requestId,
  partnerId,
  expiresAt: Date.now() + 10 * 60 * 1000, // 10분
  scope: "confirm",
};
const message = JSON.stringify(payload);
const signature = crypto
  .createHmac("sha256", process.env.SECRET_KEY)
  .update(message)
  .digest("base64");
const token = Buffer.from(
  JSON.stringify({
    payload,
    signature,
  })
).toString("base64url");
```

**검증:**

```javascript
const decoded = JSON.parse(Buffer.from(token, "base64url").toString());
const { payload, signature } = decoded;

// 서명 검증
const expectedSignature = crypto
  .createHmac("sha256", process.env.SECRET_KEY)
  .update(JSON.stringify(payload))
  .digest("base64");

if (signature !== expectedSignature) {
  throw new Error("Invalid signature");
}

// 만료 검증
if (Date.now() > payload.expiresAt) {
  throw new Error("Token expired");
}

// 사용 여부 검증
const tokenRecord = await dynamodb.get({
  TableName: "PartnerConfirmationTable",
  Key: { PK: `TOKEN#${token}`, SK: "METADATA" },
});

if (tokenRecord.Item.used) {
  throw new Error("Token already used");
}
```

### 2. API 보안

- API Gateway에서 CORS 설정
- Rate limiting: 100 req/min per IP
- Lambda 함수별 최소 권한 IAM 역할

### 3. 데이터 보호

- DynamoDB 암호화 활성화 (AWS managed key)
- Lambda 환경 변수 암호화
- CloudWatch Logs 암호화

## 에러 처리 전략

### 1. 재시도 정책

**Lambda 함수:**

- Lex Handler: 재시도 없음 (빠른 실패)
- Orchestrator: 1회 재시도
- SMS Sender: 2회 재시도
- Response Handler: 1회 재시도
- Notification: 재시도 없음 (기본 메시지 사용)

**Step Functions:**

- 각 상태별 재시도 설정
- Exponential backoff (1초, 2초, 4초)

### 2. 에러 응답

**클라이언트 에러 (4xx):**

- 400: 잘못된 요청 (예약번호 누락 등)
- 401: 인증 실패 (토큰 무효)
- 404: 리소스 없음 (예약 없음)
- 409: 충돌 (토큰 이미 사용됨)

**서버 에러 (5xx):**

- 500: 내부 서버 오류
- 503: 서비스 일시 불가 (Lex/Bedrock 장애)

### 3. 폴백 메커니즘

- Bedrock 실패 시 기본 메시지 사용
- Lex 실패 시 기본 인텐트로 처리
- SMS 전송 실패 시 Failed 상태로 전환

## 테스트 전략

### 1. 단위 테스트

- 각 Lambda 함수별 핵심 로직 테스트
- 토큰 생성/검증 로직 테스트
- DynamoDB 쿼리 로직 테스트

### 2. 통합 테스트

- API Gateway → Lambda 통합
- Step Functions 워크플로우 전체 흐름
- DynamoDB 데이터 일관성

### 3. 엔드투엔드 테스트

- 고객 문의 제출부터 알림 수신까지 전체 시나리오
- 타임아웃 시나리오
- 에러 시나리오 (예약 없음, 토큰 만료 등)

## 배포 전략

### 1. IaC (Infrastructure as Code)

- AWS CDK (TypeScript) 사용
- 스택 구성:
  - NetworkStack: VPC (필요시)
  - DataStack: DynamoDB
  - ComputeStack: Lambda 함수
  - WorkflowStack: Step Functions
  - ApiStack: API Gateway
  - FrontendStack: S3 + CloudFront

### 2. 환경 분리

- dev: 개발 환경
- demo: 해커톤 데모 환경

### 3. CI/CD

- GitHub Actions 사용
- 자동 테스트 실행
- CDK deploy 자동화

## 모니터링 및 로깅

### 1. CloudWatch Logs

- Lambda 함수별 로그 그룹
- 로그 레벨: INFO, WARN, ERROR
- 구조화된 로깅 (JSON 형식)

### 2. CloudWatch Metrics

- API Gateway 요청 수, 레이턴시
- Lambda 실행 시간, 에러율
- Step Functions 실행 상태
- DynamoDB 읽기/쓰기 용량

### 3. X-Ray

- 분산 추적 활성화
- 요청 흐름 시각화
- 병목 지점 식별

## 성능 최적화

### 1. Lambda 최적화

- 메모리: 512MB (기본)
- 타임아웃: 30초 (기본)
- 동시 실행: 100 (기본)
- Provisioned Concurrency: 사용 안 함 (데모용)

### 2. DynamoDB 최적화

- On-demand 모드 사용
- GSI 최소화 (2개만 사용)
- 단일 테이블 설계로 조인 최소화

### 3. API Gateway 최적화

- HTTP API 사용 (REST API보다 저렴하고 빠름)
- 캐싱: 사용 안 함 (실시간 데이터)

## 비용 추정 (해커톤 데모)

### 예상 사용량

- 요청: 100건/일
- Lambda 실행: 500회/일
- DynamoDB 읽기/쓰기: 1,000회/일
- SMS: 100건/일
- Bedrock 호출: 100회/일

### 예상 비용 (월간)

- Lambda: $0.20
- DynamoDB: $0.25
- API Gateway: $0.10
- SNS (SMS): $7.00 (한국 SMS 기준)
- Bedrock: $3.00
- S3 + CloudFront: $0.50
- **총계: 약 $11/월**

## 제약사항 및 가정

### 제약사항

1. SMS는 한국 번호만 지원
2. Lex는 ko-KR 로케일만 지원
3. 파트너 응답 타임아웃: 5분 (재시도 없음)
4. 토큰 만료: 10분
5. 동시 요청 처리: 100건

### 가정

1. 예약 데이터는 사전에 DynamoDB에 입력되어 있음
2. 파트너 전화번호는 유효하고 SMS 수신 가능
3. 고객은 웹 브라우저를 통해 접근
4. 네트워크 연결은 안정적
5. AWS 서비스는 정상 작동

## 향후 개선 사항

### Phase 2 (해커톤 이후)

1. 관리자 대시보드 추가
2. SMS 재시도 로직 구현
3. 이메일 알림 추가
4. 다국어 지원 (영어, 일본어)
5. 파트너 앱 개발

### Phase 3 (프로덕션)

1. AWS Secrets Manager로 비밀 키 관리
2. WAF 적용
3. 고급 모니터링 (알람, 대시보드)
4. 부하 테스트 및 성능 튜닝
5. 재해 복구 계획
