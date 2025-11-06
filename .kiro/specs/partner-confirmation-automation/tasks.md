# 구현 태스크

- [x] 1. 프로젝트 구조 및 CDK 초기 설정

  - AWS CDK 프로젝트 초기화 (TypeScript)
  - 디렉토리 구조 생성 (lib/, lambda/, frontend/)
  - 공통 타입 정의 파일 생성 (types.ts)
  - CDK 스택 기본 구조 설정 (DataStack, ComputeStack, ApiStack)
  - _요구사항: 8.2, 8.3, 8.4_

- [x] 2. DynamoDB 테이블 및 데이터 모델 구현

  - [x] 2.1 DynamoDB 테이블 CDK 리소스 정의

    - 단일 테이블 설계 (PK, SK)
    - GSI1 (예약번호 조회용) 정의
    - GSI2 (상태별 조회용) 정의
    - On-demand 모드 설정
    - _요구사항: 8.4, 2.1_

  - [x] 2.2 데이터 모델 인터페이스 작성

    - Request, Reservation, Event, Token 타입 정의
    - DynamoDB 아이템 변환 유틸리티 함수
    - _요구사항: 2.1, 2.6_

  - [x] 2.3 샘플 예약 데이터 시드 스크립트 작성

    - 테스트용 예약 데이터 생성 스크립트
    - DynamoDB에 샘플 데이터 삽입
    - _요구사항: 2.1_

- [x] 3. 서명 토큰 생성 및 검증 유틸리티 구현

  - [x] 3.1 토큰 생성 함수 작성

    - HMAC-SHA256 서명 로직
    - Base64 인코딩
    - 페이로드 구조 정의 (requestId, partnerId, expiresAt, scope)
    - _요구사항: 3.1, 3.2_

  - [x] 3.2 토큰 검증 함수 작성

    - 서명 검증 로직
    - 만료 시간 검증
    - 사용 여부 확인
    - _요구사항: 4.1, 5.1_

-

- [ ] 4. Lex Handler Lambda 함수 구현

  - [x] 4.1 Lambda 함수 기본 구조 작성

    - 핸들러 함수 정의
    - 환경 변수 설정 (DynamoDB 테이블명)
    - _요구사항: 8.2_

  - [x] 4.2 Amazon Lex V2 호출 로직 구현

    - Lex V2 클라이언트 초기화
    - RecognizeText API 호출
    - 인텐트 및 슬롯 추출
    - _요구사항: 1.1, 1.2_

  - [x] 4.3 예약번호 검증 및 요청 생성

    - 예약번호 슬롯 검증
    - 요청 ID 생성 (UUID)
    - DynamoDB에 요청 레코드 저장 (상태: Created)
    - Created 이벤트 기록
    - _요구사항: 1.3, 1.4, 1.5_

  - [x] 4.4 에러 처리 구현

    - Lex 호출 실패 처리 (3초 타임아웃)
    - 예약번호 누락 시 오류 메시지 반환
    - _요구사항: 1.3, 1.6_

  - [-] 4.5 CDK에 Lambda 함수 리소스 추가

    - Lambda 함수 정의
    - IAM 역할 및 권한 설정 (DynamoDB, Lex)
    - _요구사항: 8.2_

- [ ] 5. Orchestrator Lambda 함수 구현

  - [ ] 5.1 예약 조회 로직 구현
    - DynamoDB GSI1로 예약 조회
    - 예약번호와 고객 연락처 매칭
    - 파트너 정보 추출
    - _요구사항: 2.1, 2.2, 2.5_
  - [ ] 5.2 에러 처리 구현
    - 예약 없음 처리 (Failed 상태)
    - 고객 정보 불일치 처리
    - _요구사항: 2.3, 2.4_
  - [ ] 5.3 Step Functions 실행 시작
    - Step Functions 클라이언트 초기화
    - StartExecution API 호출
    - 요청 레코드에 executionArn 저장
    - _요구사항: 6.1_
  - [ ] 5.4 CDK에 Lambda 함수 리소스 추가
    - Lambda 함수 정의
    - IAM 역할 및 권한 설정 (DynamoDB, Step Functions)
    - _요구사항: 8.2_

- [ ] 6. SMS Sender Lambda 함수 구현

  - [ ] 6.1 서명 토큰 생성 및 저장
    - 토큰 생성 유틸리티 호출
    - DynamoDB에 토큰 저장 (만료: 10분)
    - _요구사항: 3.1, 3.2, 3.3_
  - [ ] 6.2 확인 링크 생성 및 SMS 전송
    - 확인 링크 URL 생성
    - Amazon SNS PublishCommand 호출
    - SMS 메시지 템플릿 작성
    - _요구사항: 3.4, 3.5_
  - [ ] 6.3 요청 상태 업데이트
    - 요청 상태를 SMSSent로 업데이트
    - SMSSent 이벤트 기록
    - _요구사항: 3.5_
  - [ ] 6.4 CDK에 Lambda 함수 리소스 추가
    - Lambda 함수 정의
    - IAM 역할 및 권한 설정 (DynamoDB, SNS)
    - 환경 변수 설정 (SECRET_KEY, CONFIRM_URL)
    - _요구사항: 8.2_

- [ ] 7. Step Functions 워크플로우 정의

  - [ ] 7.1 상태 머신 정의 작성
    - SendSMS 상태 (SMS Sender Lambda 호출)
    - WaitPartner 상태 (Callback 패턴, 300초 타임아웃)
    - HandleTimeout 상태 (타임아웃 처리)
    - GenerateNotification 상태 (Notification Lambda 호출)
    - _요구사항: 6.1, 6.2, 6.3_
  - [ ] 7.2 타임아웃 처리 로직 구현
    - Catch 블록으로 States.Timeout 처리
    - HandleTimeout Lambda 함수 작성
    - 요청 상태를 Timeout으로 업데이트
    - _요구사항: 6.3, 6.4_
  - [ ] 7.3 CDK에 Step Functions 리소스 추가
    - 상태 머신 정의
    - IAM 역할 및 권한 설정
    - _요구사항: 8.3_

- [ ] 8. Response Handler Lambda 함수 구현

  - [ ] 8.1 GET /confirm/{token} 엔드포인트 구현
    - 토큰 파싱 및 검증
    - DynamoDB에서 요청 정보 조회
    - Opened 이벤트 기록
    - 확인 페이지 데이터 반환
    - _요구사항: 4.1, 4.2, 4.3, 4.5_
  - [ ] 8.2 POST /respond 엔드포인트 구현
    - 토큰 검증 (서명, 만료, 사용 여부)
    - 응답 데이터 검증
    - Step Functions SendTaskSuccess 호출
    - 토큰 사용됨 표시
    - 요청 상태를 Responded로 업데이트
    - Responded 이벤트 기록
    - _요구사항: 5.1, 5.2, 5.3, 5.4_
  - [ ] 8.3 에러 처리 구현
    - 토큰 무효/만료 처리 (401)
    - 토큰 이미 사용됨 처리 (409)
    - _요구사항: 4.2, 5.5_
  - [ ] 8.4 CDK에 Lambda 함수 리소스 추가
    - Lambda 함수 정의
    - IAM 역할 및 권한 설정 (DynamoDB, Step Functions)
    - _요구사항: 8.2_

- [ ] 9. Notification Lambda 함수 구현

  - [ ] 9.1 Amazon Bedrock 호출 로직 구현
    - Bedrock Runtime 클라이언트 초기화
    - InvokeModel API 호출 (Claude 모델)
    - 프롬프트 템플릿 작성
    - _요구사항: 7.1, 7.2_
  - [ ] 9.2 한국어 알림 메시지 생성
    - 요청 정보 및 파트너 응답 포함
    - 응답 타입별 메시지 생성 (수락/거절/대안/타임아웃)
    - _요구사항: 7.3_
  - [ ] 9.3 고객 UI로 응답 전달
    - 알림 메시지를 DynamoDB에 저장
    - 고객 UI에서 폴링으로 조회 가능하도록 구성
    - _요구사항: 7.4_
  - [ ] 9.4 CDK에 Lambda 함수 리소스 추가
    - Lambda 함수 정의
    - IAM 역할 및 권한 설정 (DynamoDB, Bedrock)
    - _요구사항: 8.2_

- [ ] 10. API Gateway 구성

  - [ ] 10.1 HTTP API 생성
    - API Gateway HTTP API 리소스 정의
    - CORS 설정
    - _요구사항: 8.1_
  - [ ] 10.2 라우트 및 통합 설정
    - POST /chat → Lex Handler Lambda
    - GET /confirm/{token} → Response Handler Lambda
    - POST /respond → Response Handler Lambda
    - _요구사항: 8.1_
  - [ ] 10.3 CDK에 API Gateway 리소스 추가
    - HTTP API 정의
    - Lambda 통합 설정
    - _요구사항: 8.1_

- [ ] 11. 고객 웹 UI 구현

  - [ ] 11.1 고객 문의 제출 페이지 작성
    - HTML/CSS/JavaScript로 간단한 폼 작성
    - 예약번호, 고객 연락처, 문의 내용 입력 필드
    - API Gateway /chat 엔드포인트 호출
    - _요구사항: 1.1_
  - [ ] 11.2 알림 표시 기능 구현
    - 폴링으로 DynamoDB에서 알림 조회
    - 알림 메시지 표시
    - _요구사항: 7.4_
  - [ ] 11.3 S3 버킷 및 정적 웹사이트 호스팅 설정
    - S3 버킷 생성
    - Static Website Hosting 활성화
    - 웹 페이지 업로드
    - _요구사항: 8.5_

- [ ] 12. 파트너 확인 페이지 구현

  - [ ] 12.1 확인 페이지 HTML 작성
    - 요청 정보 표시 (고객 문의, 예약번호 등)
    - 응답 옵션 버튼 (수락/거절/대안)
    - 대안 시간 입력 필드
    - _요구사항: 4.3, 4.4_
  - [ ] 12.2 응답 제출 로직 구현
    - API Gateway /respond 엔드포인트 호출
    - 응답 성공/실패 메시지 표시
    - _요구사항: 5.1_
  - [ ] 12.3 에러 페이지 작성
    - 토큰 무효/만료 시 표시할 페이지
    - _요구사항: 4.2_
  - [ ] 12.4 S3에 페이지 업로드
    - 확인 페이지 및 에러 페이지 업로드
    - _요구사항: 8.5_

- [ ] 13. Amazon Lex V2 봇 설정

  - [ ] 13.1 Lex 봇 생성 및 인텐트 정의
    - ko-KR 로케일 설정
    - 인텐트 3개 생성: 예약변경, 트러블신고, 부가서비스
    - 예약번호 슬롯 정의
    - _요구사항: 1.1, 1.2, 1.7_
  - [ ] 13.2 샘플 발화 추가
    - 각 인텐트별 샘플 발화 작성
    - 슬롯 엘리시테이션 프롬프트 작성
    - _요구사항: 1.7_
  - [ ] 13.3 봇 빌드 및 배포
    - 봇 빌드
    - 별칭 생성 (demo)
    - _요구사항: 1.1_

- [ ] 14. 통합 테스트 및 엔드투엔드 시나리오 검증

  - [ ] 14.1 정상 플로우 테스트
    - 고객 문의 제출 → 파트너 SMS 수신 → 파트너 응답 → 고객 알림
    - 각 단계별 DynamoDB 상태 확인
    - _요구사항: 1.1~7.4_
  - [ ] 14.2 타임아웃 시나리오 테스트
    - 파트너 응답 없이 300초 대기
    - 타임아웃 처리 확인
    - 고객 알림 생성 확인
    - _요구사항: 6.3, 6.4_
  - [ ] 14.3 에러 시나리오 테스트
    - 예약 없음 케이스
    - 고객 정보 불일치 케이스
    - 토큰 만료 케이스
    - 토큰 재사용 케이스
    - _요구사항: 2.3, 2.4, 4.2, 5.5_

- [ ] 15. 배포 및 데모 준비
  - [ ] 15.1 CDK 배포
    - cdk synth로 CloudFormation 템플릿 생성
    - cdk deploy로 스택 배포
    - 출력값 확인 (API Gateway URL, S3 URL 등)
    - _요구사항: 8.1~8.5_
  - [ ] 15.2 환경 변수 설정
    - Lambda 함수별 환경 변수 설정
    - SECRET_KEY 생성 및 설정
    - _요구사항: 3.2_
  - [ ] 15.3 데모 시나리오 준비
    - 샘플 예약 데이터 확인
    - 데모 스크립트 작성
    - 테스트 전화번호 준비
    - _요구사항: 전체_
