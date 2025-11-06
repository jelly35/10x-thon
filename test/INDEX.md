# 테스트 문서 인덱스

통합 테스트 관련 모든 문서의 빠른 참조 가이드입니다.

## 📚 문서 목록

### 🚀 시작하기

1. **[QUICK-START.md](./QUICK-START.md)** - 1분 안에 테스트 시작하기
   - 환경 설정 방법
   - 기본 테스트 실행 명령어
   - 문제 해결 팁

### 📖 상세 가이드

2. **[README.md](./README.md)** - 테스트 디렉토리 전체 개요

   - 파일 구조
   - 테스트 시나리오 설명
   - 사용 방법 및 문제 해결

3. **[TESTING-GUIDE.md](./TESTING-GUIDE.md)** - 상세한 수동 테스트 가이드
   - 14.1 정상 플로우 테스트 (단계별)
   - 14.2 타임아웃 시나리오 테스트 (단계별)
   - 14.3 에러 시나리오 테스트 (단계별)
   - AWS CLI 명령어 예시
   - 테스트 체크리스트

### 📊 참고 자료

4. **[TEST-SUMMARY.md](./TEST-SUMMARY.md)** - 구현 요약

   - 완료된 작업 목록
   - 생성된 파일 설명
   - 테스트 커버리지
   - 요구사항 매핑
   - 성능 메트릭

5. **[EXAMPLE-OUTPUT.md](./EXAMPLE-OUTPUT.md)** - 테스트 실행 예시 출력
   - 성공 케이스 출력
   - 실패 케이스 출력
   - 수동 테스트 예시
   - CloudWatch Logs 예시
   - 성능 메트릭

### 💻 코드 및 스크립트

6. **[integration-test.ts](./integration-test.ts)** - 자동화된 통합 테스트 스크립트

   - TypeScript로 작성
   - 3가지 시나리오 자동화
   - DynamoDB 및 API 테스트

7. **[setup-test-env.sh](./setup-test-env.sh)** - Linux/Mac 환경 설정 스크립트

   - API 엔드포인트 자동 조회
   - 환경 변수 자동 설정

8. **[setup-test-env.bat](./setup-test-env.bat)** - Windows 환경 설정 스크립트
   - API 엔드포인트 자동 조회
   - 환경 변수 자동 설정

## 🎯 사용 시나리오별 추천 문서

### "빠르게 테스트를 실행하고 싶어요"

→ [QUICK-START.md](./QUICK-START.md)

### "각 테스트 단계를 자세히 알고 싶어요"

→ [TESTING-GUIDE.md](./TESTING-GUIDE.md)

### "테스트 결과를 어떻게 해석하나요?"

→ [EXAMPLE-OUTPUT.md](./EXAMPLE-OUTPUT.md)

### "어떤 테스트가 구현되었나요?"

→ [TEST-SUMMARY.md](./TEST-SUMMARY.md)

### "테스트 코드를 수정하고 싶어요"

→ [integration-test.ts](./integration-test.ts)

### "전체적인 구조를 이해하고 싶어요"

→ [README.md](./README.md)

## 📋 빠른 명령어 참조

```bash
# 환경 설정
source test/setup-test-env.sh        # Linux/Mac
test\setup-test-env.bat              # Windows

# 테스트 실행
npm run test:integration             # 모든 테스트
npm run test:normal                  # 정상 플로우만
npm run test:timeout                 # 타임아웃만
npm run test:errors                  # 에러 시나리오만

# 수동 테스트
curl -X POST $API_ENDPOINT/chat ...  # 고객 문의 제출
aws dynamodb get-item ...            # DynamoDB 조회
aws logs tail ...                    # CloudWatch Logs 확인
```

## 🔗 관련 문서

- [프로젝트 README](../README.md)
- [요구사항 문서](../.kiro/specs/partner-confirmation-automation/requirements.md)
- [디자인 문서](../.kiro/specs/partner-confirmation-automation/design.md)
- [구현 태스크](../.kiro/specs/partner-confirmation-automation/tasks.md)

## 📞 도움이 필요하신가요?

1. **환경 설정 문제**: [QUICK-START.md](./QUICK-START.md) 문제 해결 섹션 참조
2. **테스트 실패**: [EXAMPLE-OUTPUT.md](./EXAMPLE-OUTPUT.md) 실패 케이스 참조
3. **수동 테스트**: [TESTING-GUIDE.md](./TESTING-GUIDE.md) 단계별 가이드 참조
4. **코드 수정**: [integration-test.ts](./integration-test.ts) 주석 참조

## ✅ 체크리스트

테스트 실행 전 확인사항:

- [ ] CDK 스택이 모두 배포되었는가?
- [ ] API 엔드포인트가 설정되었는가?
- [ ] DynamoDB 테이블이 존재하는가?
- [ ] AWS CLI가 설정되었는가?
- [ ] Node.js 및 TypeScript가 설치되었는가?

## 🎉 시작하기

1. [QUICK-START.md](./QUICK-START.md)를 열어 1분 안에 테스트를 시작하세요!
2. 더 자세한 내용은 [README.md](./README.md)를 참조하세요.
3. 문제가 발생하면 [TESTING-GUIDE.md](./TESTING-GUIDE.md)의 문제 해결 섹션을 확인하세요.

---

**마지막 업데이트:** 2024-12-06  
**버전:** 1.0.0  
**상태:** ✅ 완료
