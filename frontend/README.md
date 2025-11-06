# 고객 웹 UI

파트너 확인 자동화 시스템의 고객용 웹 인터페이스입니다.

## 파일 구조

```
frontend/
├── index.html      # 고객 문의 제출 페이지
├── app.js          # 고객 페이지 JavaScript 로직
├── confirm.html    # 파트너 확인 페이지
├── confirm.js      # 파트너 확인 페이지 JavaScript 로직
├── error.html      # 에러 페이지
├── error.js        # 에러 페이지 JavaScript 로직
├── styles.css      # 공통 스타일시트
├── config.js       # API URL 설정 (배포 시 자동 생성)
└── README.md       # 이 파일
```

## 기능

### 1. 고객 문의 제출 (index.html - 요구사항 1.1)

- 예약번호, 고객 연락처, 문의 내용 입력
- API Gateway `/chat` 엔드포인트 호출
- 문의 제출 후 요청 ID 저장

### 2. 알림 표시 (index.html - 요구사항 7.4)

- 5초마다 폴링으로 DynamoDB에서 알림 조회
- 파트너 응답 또는 타임아웃 시 알림 메시지 표시
- 응답 타입별 메시지 표시:
  - ✅ 수락
  - ❌ 거절
  - 📅 대안 시간 제안
  - ⏱️ 타임아웃

### 3. 파트너 확인 페이지 (confirm.html - 요구사항 4.3, 4.4, 5.1)

- SMS 링크를 통해 접근 (`/r/{token}`)
- 토큰 검증 및 요청 정보 표시
- 3가지 응답 옵션 제공:
  - ✓ 수락
  - ✗ 거절
  - 📅 대안 시간 제안
- 대안 시간 선택 시 datetime-local 입력 필드 표시
- API Gateway `/respond` 엔드포인트로 응답 제출
- 응답 성공 시 확인 메시지 표시

### 4. 에러 페이지 (error.html - 요구사항 4.2)

- 토큰 무효/만료 시 표시
- 에러 유형별 메시지:
  - `invalid_token`: 유효하지 않은 링크
  - `expired_token`: 링크 만료
  - `already_used`: 이미 사용된 링크
  - `not_found`: 요청을 찾을 수 없음
  - `default`: 일반 오류
- 고객센터 연락처 정보 표시

## 배포

CDK를 통해 자동으로 S3 버킷에 배포됩니다:

```bash
cdk deploy PartnerConfirmation-FrontendStack
```

배포 후 출력되는 `WebsiteUrl`을 통해 접근할 수 있습니다.

## 로컬 개발

로컬에서 테스트하려면:

1. `config.js` 파일을 생성하고 API URL을 설정:

```javascript
window.API_BASE_URL =
  "https://your-api-gateway-url.execute-api.region.amazonaws.com";
```

2. 로컬 웹 서버 실행:

```bash
# Python 3
python -m http.server 8000

# Node.js (http-server 패키지 필요)
npx http-server
```

3. 브라우저에서 `http://localhost:8000` 접속

## API 엔드포인트

### POST /chat

고객 문의 제출

**요청:**

```json
{
  "customerId": "CUSTOMER-1234567890",
  "customerPhone": "010-1234-5678",
  "reservationNumber": "RES-2024-001",
  "message": "예약 시간을 변경하고 싶습니다"
}
```

**응답:**

```json
{
  "requestId": "req-uuid",
  "status": "Created",
  "message": "요청이 접수되었습니다"
}
```

### GET /status/{requestId}

요청 상태 및 알림 조회

**응답:**

```json
{
  "requestId": "req-uuid",
  "status": "Responded",
  "partnerResponse": {
    "responseType": "accept",
    "timestamp": 1234567890
  },
  "notificationMessage": "파트너가 요청을 수락했습니다...",
  "createdAt": 1234567890,
  "updatedAt": 1234567890
}
```

### GET /confirm/{token}

파트너 확인 페이지 데이터 조회

**응답:**

```json
{
  "requestId": "req-uuid",
  "customerQuery": "예약 시간을 변경하고 싶습니다",
  "intent": "예약변경",
  "reservationNumber": "RES-2024-001",
  "reservationDate": "2024-12-25T14:00:00"
}
```

### POST /respond

파트너 응답 제출

**요청:**

```json
{
  "token": "base64url-encoded-token",
  "response": "accept",
  "alternativeTime": "2024-12-26T15:00:00"
}
```

**응답:**

```json
{
  "success": true,
  "message": "응답이 접수되었습니다"
}
```

## 브라우저 지원

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 주의사항

- API URL은 배포 시 자동으로 설정됩니다
- CORS가 활성화되어 있어야 합니다
- 폴링은 요청 제출 후에만 시작됩니다
- 알림이 표시되면 폴링이 자동으로 중지됩니다
