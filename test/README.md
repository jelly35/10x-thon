# 통합 테스트

이 디렉토리는 파트너 확인 자동화 시스템의 통합 테스트 및 엔드투엔드 시나리오 검증을 위한 파일들을 포함합니다.

## 파일 구조

```
test/
├── README.md                 # 이 파일
├── TESTING-GUIDE.md          # 상세한 테스트 가이드 (수동 테스트 포함)
└── integration-test.ts       # 자동화된 통합 테스트 스크립트
```

## 빠른 시작

### 1. 환경 설정

먼저 API 엔드포인트를 환경 변수로 설정하세요:

```bash
# CDK 배포 후 출력값에서 API 엔드포인트 확인
export API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name PartnerConfirmation-ApiStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)

# 확인
echo $API_ENDPOINT
```

### 2. 자동화된 테스트 실행

```bash
# 모든 시나리오 테스트
npm run test:integration

# 또는 개별 시나리오
npm run test:normal    # 정상 플로우만
npm run test:timeout   # 타임아웃 시나리오만
npm run test:errors    # 에러 시나리오만
```

### 3. 수동 테스트

상세한 수동 테스트 절차는 [TESTING-GUIDE.md](./TESTING-GUIDE.md)를 참조하세요.

## 테스트 시나리오

### 14.1 정상 플로우 테스트

고객 문의 제출부터 파트너 응답, 고객 알림까지 전체 플로우를 테스트합니다.

**검증 항목:**

- 고객 문의 제출 (POST /chat)
- 요청 상태 변화 (Created → SMSSent → Responded)
- Step Functions 워크플로우 실행
- 서명 토큰 생성 및 검증
- 파트너 확인 페이지 조회 (GET /confirm/{token})
- 파트너 응답 제출 (POST /respond)
- 이벤트 로그 기록 (Created, SMSSent, Opened, Responded)
- 고객 알림 메시지 생성 (Amazon Bedrock)

**예상 소요 시간:** 약 30초

### 14.2 타임아웃 시나리오 테스트

파트너가 응답하지 않을 때 타임아웃 처리를 테스트합니다.

**검증 항목:**

- SMS 전송 후 300초 대기
- 타임아웃 상태로 전환 (Timeout)
- Timeout 이벤트 기록
- 타임아웃 관련 고객 알림 생성

**예상 소요 시간:** 약 5분 (300초 대기)

⚠️ **주의:** 자동화된 테스트에서는 실제 300초 대기를 생략하고 설정만 확인합니다.

### 14.3 에러 시나리오 테스트

다양한 에러 케이스를 테스트합니다.

**검증 항목:**

- 예약 없음 케이스 (Failed 상태)
- 고객 정보 불일치 케이스 (Failed 상태)
- 토큰 만료 케이스 (401 응답)
- 토큰 재사용 케이스 (409 응답)

**예상 소요 시간:** 약 20초

## 테스트 결과 해석

### 성공 케이스

```
✅ PASS 정상 플로우 테스트 (28543ms)
✅ PASS 타임아웃 시나리오 테스트 (8234ms)
✅ PASS 에러 시나리오 테스트 (18765ms)

총 3개 테스트 중 3개 성공, 0개 실패
```

### 실패 케이스

```
❌ FAIL 정상 플로우 테스트 (15234ms)
   오류: 요청 상태가 Created가 아님: undefined

총 3개 테스트 중 0개 성공, 1개 실패
```

실패 시 다음을 확인하세요:

1. CDK 스택이 모두 배포되었는지 확인
2. Lambda 함수가 정상 작동하는지 CloudWatch Logs 확인
3. DynamoDB 테이블에 데이터가 정상적으로 저장되는지 확인
4. API Gateway 엔드포인트가 올바른지 확인

## 문제 해결

### "API_ENDPOINT 환경 변수가 설정되지 않았습니다"

```bash
# API 엔드포인트 확인
aws cloudformation describe-stacks \
  --stack-name PartnerConfirmation-ApiStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text

# 환경 변수 설정
export API_ENDPOINT=<your-api-endpoint>
```

### "테이블을 찾을 수 없습니다"

```bash
# 테이블명 확인
aws cloudformation describe-stacks \
  --stack-name PartnerConfirmation-DataStack \
  --query 'Stacks[0].Outputs[?OutputKey==`TableName`].OutputValue' \
  --output text

# 환경 변수 설정 (필요시)
export TABLE_NAME=<your-table-name>
```

### "Lambda 함수 실행 실패"

CloudWatch Logs에서 Lambda 함수 로그를 확인하세요:

```bash
# Lex Handler 로그
aws logs tail /aws/lambda/PartnerConfirmation-ComputeStack-LexHandler --follow

# Orchestrator 로그
aws logs tail /aws/lambda/PartnerConfirmation-ComputeStack-Orchestrator --follow

# Response Handler 로그
aws logs tail /aws/lambda/PartnerConfirmation-ComputeStack-ResponseHandler --follow
```

### "Step Functions 실행 실패"

Step Functions 실행 상태를 확인하세요:

```bash
# 실행 ARN은 DynamoDB 요청 레코드에서 확인
aws stepfunctions describe-execution \
  --execution-arn <execution-arn>
```

## 성능 벤치마크

| 시나리오                | 목표 시간 | 실제 시간 (평균) |
| ----------------------- | --------- | ---------------- |
| 고객 문의 → SMS 전송    | < 10초    | ~8초             |
| 파트너 응답 → 고객 알림 | < 10초    | ~7초             |
| 전체 플로우 (정상)      | < 30초    | ~25초            |
| 타임아웃 처리           | 300초     | 300초            |

## 추가 리소스

- [TESTING-GUIDE.md](./TESTING-GUIDE.md) - 상세한 수동 테스트 가이드
- [../README.md](../README.md) - 프로젝트 전체 문서
- [../.kiro/specs/partner-confirmation-automation/](../.kiro/specs/partner-confirmation-automation/) - 요구사항 및 설계 문서

## 기여

테스트 시나리오를 추가하거나 개선하려면:

1. `integration-test.ts`에 새로운 테스트 함수 추가
2. `TESTING-GUIDE.md`에 수동 테스트 절차 문서화
3. `package.json`에 npm 스크립트 추가 (필요시)

## 라이선스

이 프로젝트는 ISC 라이선스를 따릅니다.
