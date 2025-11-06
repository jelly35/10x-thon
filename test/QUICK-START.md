# 통합 테스트 빠른 시작 가이드

## 1분 안에 테스트 시작하기

### Step 1: API 엔드포인트 설정

#### 자동 설정 (권장)

**Linux/Mac:**

```bash
source test/setup-test-env.sh
```

**Windows:**

```cmd
test\setup-test-env.bat
```

#### 수동 설정

```bash
export API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name PartnerConfirmation-ApiStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)
```

### Step 2: 테스트 실행

```bash
# 모든 테스트 실행
npm run test:integration

# 또는 개별 테스트
npm run test:normal    # 정상 플로우 (~30초)
npm run test:timeout   # 타임아웃 (~10초, 실제 대기 생략)
npm run test:errors    # 에러 시나리오 (~20초)
```

## 테스트 결과 예시

### ✅ 성공

```
[2024-12-06T10:30:15.123Z] ℹ️ === 정상 플로우 테스트 시작 ===
[2024-12-06T10:30:15.234Z] ℹ️ 1. 테스트 예약 데이터 생성 중...
[2024-12-06T10:30:16.345Z] ✅ 예약 생성 완료: TEST-1733485815234
[2024-12-06T10:30:16.456Z] ℹ️ 2. 고객 문의 제출 중...
[2024-12-06T10:30:17.567Z] ✅ 요청 생성 완료: req-abc123
...
[2024-12-06T10:30:45.678Z] ✅ === 정상 플로우 테스트 완료 (30555ms) ===

=== 테스트 결과 요약 ===
✅ PASS 정상 플로우 테스트 (30555ms)
✅ PASS 타임아웃 시나리오 테스트 (8234ms)
✅ PASS 에러 시나리오 테스트 (18765ms)

총 3개 테스트 중 3개 성공, 0개 실패
```

### ❌ 실패

```
[2024-12-06T10:30:15.123Z] ❌ 정상 플로우 테스트 실패: Chat API 실패: 500

=== 테스트 결과 요약 ===
❌ FAIL 정상 플로우 테스트 (5234ms)
   오류: Chat API 실패: 500

총 1개 테스트 중 0개 성공, 1개 실패
```

## 문제 해결

### API_ENDPOINT가 비어있음

```bash
# 수동으로 설정
export API_ENDPOINT=https://abc123.execute-api.ap-northeast-2.amazonaws.com
```

### 테스트 실패 시

1. **CloudWatch Logs 확인**

   ```bash
   aws logs tail /aws/lambda/PartnerConfirmation-ComputeStack-LexHandler --follow
   ```

2. **DynamoDB 데이터 확인**

   ```bash
   aws dynamodb scan --table-name PartnerConfirmation-DataStack-PartnerConfirmationTable --limit 5
   ```

3. **Step Functions 상태 확인**
   ```bash
   aws stepfunctions list-executions \
     --state-machine-arn $(aws cloudformation describe-stacks \
       --stack-name PartnerConfirmation-WorkflowStack \
       --query 'Stacks[0].Outputs[?OutputKey==`StateMachineArn`].OutputValue' \
       --output text) \
     --max-results 5
   ```

## 다음 단계

- 상세한 테스트 가이드: [TESTING-GUIDE.md](./TESTING-GUIDE.md)
- 수동 테스트 절차: [TESTING-GUIDE.md](./TESTING-GUIDE.md)
- 테스트 코드 수정: [integration-test.ts](./integration-test.ts)

## 주요 명령어 요약

| 명령어                     | 설명                       |
| -------------------------- | -------------------------- |
| `npm run test:integration` | 모든 테스트 실행           |
| `npm run test:normal`      | 정상 플로우만 테스트       |
| `npm run test:timeout`     | 타임아웃 시나리오만 테스트 |
| `npm run test:errors`      | 에러 시나리오만 테스트     |

## 테스트 커버리지

- ✅ 고객 문의 제출 (POST /chat)
- ✅ 예약 조회 및 파트너 매칭
- ✅ Step Functions 워크플로우 실행
- ✅ SMS 전송 (Amazon SNS)
- ✅ 서명 토큰 생성 및 검증
- ✅ 파트너 확인 페이지 (GET /confirm/{token})
- ✅ 파트너 응답 제출 (POST /respond)
- ✅ 고객 알림 생성 (Amazon Bedrock)
- ✅ 타임아웃 처리
- ✅ 에러 처리 (예약 없음, 정보 불일치, 토큰 만료/재사용)
- ✅ 이벤트 로그 기록
- ✅ DynamoDB 상태 변화 추적

---

**💡 팁:** 첫 실행 시 Lambda 콜드 스타트로 인해 시간이 더 걸릴 수 있습니다.
