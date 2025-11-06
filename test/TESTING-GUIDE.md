# 통합 테스트 가이드

이 문서는 파트너 확인 자동화 시스템의 통합 테스트 및 엔드투엔드 시나리오 검증 방법을 설명합니다.

## 사전 준비

### 1. 환경 변수 설정

```bash
export AWS_REGION=ap-northeast-2
export TABLE_NAME=PartnerConfirmation-DataStack-PartnerConfirmationTable
export API_ENDPOINT=<your-api-gateway-endpoint>
```

API 엔드포인트는 CDK 배포 후 출력값에서 확인할 수 있습니다:

```bash
cdk deploy --all --outputs-file outputs.json
cat outputs.json | grep ApiEndpoint
```

### 2. 의존성 설치

```bash
npm install
```

## 자동화된 통합 테스트 실행

### 모든 시나리오 테스트

```bash
ts-node test/integration-test.ts --scenario=all
```

### 개별 시나리오 테스트

```bash
# 정상 플로우만 테스트
ts-node test/integration-test.ts --scenario=normal

# 타임아웃 시나리오만 테스트
ts-node test/integration-test.ts --scenario=timeout

# 에러 시나리오만 테스트
ts-node test/integration-test.ts --scenario=errors
```

## 수동 테스트 시나리오

### 14.1 정상 플로우 테스트

**목표**: 고객 문의 제출 → 파트너 SMS 수신 → 파트너 응답 → 고객 알림

#### 단계별 테스트

**1. 테스트 예약 데이터 생성**

```bash
aws dynamodb put-item \
  --table-name PartnerConfirmation-DataStack-PartnerConfirmationTable \
  --item '{
    "PK": {"S": "RES#TEST-001"},
    "SK": {"S": "METADATA"},
    "reservationNumber": {"S": "TEST-001"},
    "customerId": {"S": "customer-001"},
    "customerName": {"S": "홍길동"},
    "customerPhone": {"S": "+821012345678"},
    "partnerId": {"S": "partner-001"},
    "partnerName": {"S": "테스트 파트너"},
    "partnerPhone": {"S": "+821087654321"},
    "serviceType": {"S": "예약변경"},
    "reservationDate": {"S": "2024-12-25T10:00:00Z"},
    "createdAt": {"N": "'$(date +%s)000'"}
  }'
```

**2. 고객 문의 제출**

```bash
curl -X POST ${API_ENDPOINT}/chat \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer-001",
    "customerPhone": "+821012345678",
    "reservationNumber": "TEST-001",
    "message": "예약 시간을 변경하고 싶습니다"
  }'
```

응답 예시:

```json
{
  "requestId": "req-123456",
  "status": "Created",
  "message": "요청이 접수되었습니다"
}
```

**3. DynamoDB에서 요청 상태 확인 (Created)**

```bash
aws dynamodb get-item \
  --table-name PartnerConfirmation-DataStack-PartnerConfirmationTable \
  --key '{"PK": {"S": "REQ#req-123456"}, "SK": {"S": "METADATA"}}'
```

확인 사항:

- `status`: "Created"
- `reservationNumber`: "TEST-001"
- `partnerId`: "partner-001"

**4. Step Functions 실행 확인**

```bash
# 요청 레코드에서 executionArn 확인
aws dynamodb get-item \
  --table-name PartnerConfirmation-DataStack-PartnerConfirmationTable \
  --key '{"PK": {"S": "REQ#req-123456"}, "SK": {"S": "METADATA"}}' \
  --query 'Item.executionArn.S'
```

**5. SMS 전송 상태 확인 (SMSSent)**

5-10초 후:

```bash
aws dynamodb get-item \
  --table-name PartnerConfirmation-DataStack-PartnerConfirmationTable \
  --key '{"PK": {"S": "REQ#req-123456"}, "SK": {"S": "METADATA"}}' \
  --query 'Item.status.S'
```

확인 사항:

- `status`: "SMSSent"

**6. 이벤트 로그 확인**

```bash
aws dynamodb query \
  --table-name PartnerConfirmation-DataStack-PartnerConfirmationTable \
  --key-condition-expression "PK = :pk AND begins_with(SK, :sk)" \
  --expression-attribute-values '{
    ":pk": {"S": "REQ#req-123456"},
    ":sk": {"S": "EVENT#"}
  }'
```

확인 사항:

- Created 이벤트
- SMSSent 이벤트 (토큰 포함)

**7. 토큰 추출 및 확인 페이지 조회**

```bash
# SMSSent 이벤트에서 토큰 추출
TOKEN="<token-from-event>"

# 확인 페이지 조회
curl -X GET ${API_ENDPOINT}/confirm/${TOKEN}
```

응답 예시:

```json
{
  "requestId": "req-123456",
  "customerQuery": "예약 시간을 변경하고 싶습니다",
  "intent": "예약변경",
  "reservationNumber": "TEST-001",
  "reservationDate": "2024-12-25T10:00:00Z"
}
```

**8. Opened 이벤트 확인**

```bash
aws dynamodb query \
  --table-name PartnerConfirmation-DataStack-PartnerConfirmationTable \
  --key-condition-expression "PK = :pk AND begins_with(SK, :sk)" \
  --expression-attribute-values '{
    ":pk": {"S": "REQ#req-123456"},
    ":sk": {"S": "EVENT#"}
  }' \
  --query 'Items[?eventType.S==`Opened`]'
```

**9. 파트너 응답 제출**

```bash
curl -X POST ${API_ENDPOINT}/respond \
  -H "Content-Type: application/json" \
  -d '{
    "token": "'${TOKEN}'",
    "response": "accept"
  }'
```

응답 예시:

```json
{
  "success": true,
  "message": "응답이 접수되었습니다"
}
```

**10. 요청 상태 확인 (Responded)**

```bash
aws dynamodb get-item \
  --table-name PartnerConfirmation-DataStack-PartnerConfirmationTable \
  --key '{"PK": {"S": "REQ#req-123456"}, "SK": {"S": "METADATA"}}' \
  --query 'Item.status.S'
```

확인 사항:

- `status`: "Responded"
- `partnerResponse`: "accept"

**11. Responded 이벤트 확인**

```bash
aws dynamodb query \
  --table-name PartnerConfirmation-DataStack-PartnerConfirmationTable \
  --key-condition-expression "PK = :pk AND begins_with(SK, :sk)" \
  --expression-attribute-values '{
    ":pk": {"S": "REQ#req-123456"},
    ":sk": {"S": "EVENT#"}
  }' \
  --query 'Items[?eventType.S==`Responded`]'
```

**12. 고객 알림 생성 확인**

5-10초 후:

```bash
aws dynamodb get-item \
  --table-name PartnerConfirmation-DataStack-PartnerConfirmationTable \
  --key '{"PK": {"S": "REQ#req-123456"}, "SK": {"S": "METADATA"}}' \
  --query 'Item.notificationMessage.S'
```

확인 사항:

- `notificationMessage`: 한국어 알림 메시지 존재

---

### 14.2 타임아웃 시나리오 테스트

**목표**: 파트너 응답 없이 300초 대기 → 타임아웃 처리 → 고객 알림

#### 단계별 테스트

**1. 테스트 예약 데이터 생성**

```bash
aws dynamodb put-item \
  --table-name PartnerConfirmation-DataStack-PartnerConfirmationTable \
  --item '{
    "PK": {"S": "RES#TEST-TIMEOUT-001"},
    "SK": {"S": "METADATA"},
    "reservationNumber": {"S": "TEST-TIMEOUT-001"},
    "customerId": {"S": "customer-timeout"},
    "customerName": {"S": "타임아웃 테스트"},
    "customerPhone": {"S": "+821012345679"},
    "partnerId": {"S": "partner-timeout"},
    "partnerName": {"S": "타임아웃 파트너"},
    "partnerPhone": {"S": "+821087654322"},
    "serviceType": {"S": "트러블신고"},
    "reservationDate": {"S": "2024-12-25T14:00:00Z"},
    "createdAt": {"N": "'$(date +%s)000'"}
  }'
```

**2. 고객 문의 제출**

```bash
curl -X POST ${API_ENDPOINT}/chat \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer-timeout",
    "customerPhone": "+821012345679",
    "reservationNumber": "TEST-TIMEOUT-001",
    "message": "서비스에 문제가 있습니다"
  }'
```

**3. SMS 전송 확인**

5-10초 후:

```bash
aws dynamodb get-item \
  --table-name PartnerConfirmation-DataStack-PartnerConfirmationTable \
  --key '{"PK": {"S": "REQ#<request-id>"}, "SK": {"S": "METADATA"}}' \
  --query 'Item.status.S'
```

확인 사항:

- `status`: "SMSSent"

**4. 타임아웃 대기 (300초)**

⚠️ 실제로 300초(5분)를 기다려야 합니다.

```bash
# 300초 대기
sleep 300
```

**5. 타임아웃 상태 확인**

```bash
aws dynamodb get-item \
  --table-name PartnerConfirmation-DataStack-PartnerConfirmationTable \
  --key '{"PK": {"S": "REQ#<request-id>"}, "SK": {"S": "METADATA"}}' \
  --query 'Item.status.S'
```

확인 사항:

- `status`: "Timeout"

**6. Timeout 이벤트 확인**

```bash
aws dynamodb query \
  --table-name PartnerConfirmation-DataStack-PartnerConfirmationTable \
  --key-condition-expression "PK = :pk AND begins_with(SK, :sk)" \
  --expression-attribute-values '{
    ":pk": {"S": "REQ#<request-id>"},
    ":sk": {"S": "EVENT#"}
  }' \
  --query 'Items[?eventType.S==`Timeout`]'
```

**7. 고객 알림 생성 확인**

```bash
aws dynamodb get-item \
  --table-name PartnerConfirmation-DataStack-PartnerConfirmationTable \
  --key '{"PK": {"S": "REQ#<request-id>"}, "SK": {"S": "METADATA"}}' \
  --query 'Item.notificationMessage.S'
```

확인 사항:

- `notificationMessage`: 타임아웃 관련 한국어 알림 메시지

---

### 14.3 에러 시나리오 테스트

**목표**: 다양한 에러 케이스 처리 확인

#### 1. 예약 없음 케이스

```bash
curl -X POST ${API_ENDPOINT}/chat \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer-error",
    "customerPhone": "+821012345680",
    "reservationNumber": "NONEXISTENT-001",
    "message": "예약을 변경하고 싶습니다"
  }'
```

5-10초 후 상태 확인:

```bash
aws dynamodb get-item \
  --table-name PartnerConfirmation-DataStack-PartnerConfirmationTable \
  --key '{"PK": {"S": "REQ#<request-id>"}, "SK": {"S": "METADATA"}}' \
  --query 'Item.status.S'
```

확인 사항:

- `status`: "Failed"
- `errorMessage`: "예약을 찾을 수 없습니다"

#### 2. 고객 정보 불일치 케이스

먼저 예약 생성:

```bash
aws dynamodb put-item \
  --table-name PartnerConfirmation-DataStack-PartnerConfirmationTable \
  --item '{
    "PK": {"S": "RES#TEST-MISMATCH-001"},
    "SK": {"S": "METADATA"},
    "reservationNumber": {"S": "TEST-MISMATCH-001"},
    "customerId": {"S": "customer-mismatch"},
    "customerName": {"S": "불일치 테스트"},
    "customerPhone": {"S": "+821011111111"},
    "partnerId": {"S": "partner-001"},
    "partnerName": {"S": "테스트 파트너"},
    "partnerPhone": {"S": "+821022222222"},
    "serviceType": {"S": "예약변경"},
    "reservationDate": {"S": "2024-12-25T10:00:00Z"},
    "createdAt": {"N": "'$(date +%s)000'"}
  }'
```

다른 전화번호로 문의:

```bash
curl -X POST ${API_ENDPOINT}/chat \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer-mismatch",
    "customerPhone": "+821099999999",
    "reservationNumber": "TEST-MISMATCH-001",
    "message": "예약을 변경하고 싶습니다"
  }'
```

5-10초 후 상태 확인:

```bash
aws dynamodb get-item \
  --table-name PartnerConfirmation-DataStack-PartnerConfirmationTable \
  --key '{"PK": {"S": "REQ#<request-id>"}, "SK": {"S": "METADATA"}}' \
  --query 'Item.status.S'
```

확인 사항:

- `status`: "Failed"
- `errorMessage`: "예약 정보가 일치하지 않습니다"

#### 3. 토큰 만료 케이스

만료된 토큰으로 확인 페이지 조회:

```bash
# 만료된 토큰 생성 (실제로는 10분 이상 지난 토큰 사용)
EXPIRED_TOKEN="<expired-token>"

curl -X GET ${API_ENDPOINT}/confirm/${EXPIRED_TOKEN}
```

확인 사항:

- HTTP 상태 코드: 401
- 응답 메시지: "토큰이 만료되었습니다"

#### 4. 토큰 재사용 케이스

이미 사용된 토큰으로 다시 응답 시도:

```bash
# 정상 플로우에서 사용된 토큰
USED_TOKEN="<used-token>"

curl -X POST ${API_ENDPOINT}/respond \
  -H "Content-Type: application/json" \
  -d '{
    "token": "'${USED_TOKEN}'",
    "response": "accept"
  }'
```

확인 사항:

- HTTP 상태 코드: 409
- 응답 메시지: "링크가 이미 사용되었습니다"

---

## 테스트 체크리스트

### 14.1 정상 플로우 테스트

- [ ] 고객 문의 제출 성공
- [ ] 요청 상태가 Created로 저장됨
- [ ] Step Functions 실행 시작됨
- [ ] SMS 전송 완료 (상태: SMSSent)
- [ ] 서명 토큰 생성 및 저장됨
- [ ] 확인 페이지 조회 성공
- [ ] Opened 이벤트 기록됨
- [ ] 파트너 응답 제출 성공
- [ ] 요청 상태가 Responded로 업데이트됨
- [ ] Responded 이벤트 기록됨
- [ ] 고객 알림 메시지 생성됨
- [ ] 알림 메시지가 한국어로 작성됨

### 14.2 타임아웃 시나리오 테스트

- [ ] 고객 문의 제출 성공
- [ ] SMS 전송 완료
- [ ] 300초 대기 후 타임아웃 처리됨
- [ ] 요청 상태가 Timeout으로 업데이트됨
- [ ] Timeout 이벤트 기록됨
- [ ] 타임아웃 관련 고객 알림 생성됨

### 14.3 에러 시나리오 테스트

- [ ] 예약 없음 케이스: Failed 상태, 적절한 오류 메시지
- [ ] 고객 정보 불일치 케이스: Failed 상태, 적절한 오류 메시지
- [ ] 토큰 만료 케이스: 401 응답
- [ ] 토큰 재사용 케이스: 409 응답

---

## 문제 해결

### API 엔드포인트를 찾을 수 없음

```bash
aws cloudformation describe-stacks \
  --stack-name PartnerConfirmation-ApiStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text
```

### DynamoDB 테이블명 확인

```bash
aws cloudformation describe-stacks \
  --stack-name PartnerConfirmation-DataStack \
  --query 'Stacks[0].Outputs[?OutputKey==`TableName`].OutputValue' \
  --output text
```

### Step Functions 실행 상태 확인

```bash
aws stepfunctions describe-execution \
  --execution-arn <execution-arn>
```

### CloudWatch Logs 확인

```bash
# Lambda 함수 로그 확인
aws logs tail /aws/lambda/PartnerConfirmation-ComputeStack-LexHandler --follow

# Step Functions 로그 확인
aws logs tail /aws/vendedlogs/states/PartnerConfirmation-WorkflowStack --follow
```

---

## 성능 메트릭

테스트 중 다음 메트릭을 측정하세요:

- **고객 문의 제출 → SMS 전송**: 목표 < 10초
- **파트너 응답 제출 → 고객 알림 생성**: 목표 < 10초
- **전체 플로우 (응답 포함)**: 목표 < 30초
- **타임아웃 처리**: 정확히 300초 후

---

## 추가 참고 사항

- 실제 SMS 전송을 테스트하려면 유효한 전화번호를 사용해야 합니다
- Amazon Bedrock 호출은 비용이 발생하므로 테스트 횟수를 제한하세요
- Step Functions 실행은 CloudWatch Logs에서 상세 로그를 확인할 수 있습니다
- DynamoDB 쿼리 시 GSI를 활용하면 더 효율적입니다
