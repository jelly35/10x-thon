# Partner Confirmation Automation System

파트너 확인 자동화 시스템 - AWS CDK 기반 서버리스 솔루션

## 프로젝트 구조

```
.
├── bin/
│   └── partner-confirmation.ts    # CDK 앱 엔트리포인트
├── lib/
│   ├── types.ts                   # 공통 타입 정의
│   ├── data-stack.ts              # DynamoDB 스택
│   ├── compute-stack.ts           # Lambda 함수 스택
│   └── api-stack.ts               # API Gateway 스택
├── lambda/                        # Lambda 함수 코드 (추후 구현)
├── frontend/                      # 정적 웹 페이지 (추후 구현)
├── cdk.json                       # CDK 설정
├── tsconfig.json                  # TypeScript 설정
└── package.json                   # 프로젝트 의존성
```

## 스택 구조

### 1. DataStack

- DynamoDB 단일 테이블 설계
- GSI1: 예약번호 조회용
- GSI2: 상태별 조회용

### 2. ComputeStack

- Lex Handler Lambda
- Orchestrator Lambda
- SMS Sender Lambda
- Response Handler Lambda
- Notification Generator Lambda
- Timeout Handler Lambda

### 3. ApiStack

- API Gateway HTTP API
- 라우트: POST /chat, GET /confirm/{token}, POST /respond

## 시작하기

### 사전 요구사항

- Node.js 18.x 이상
- AWS CLI 설정 완료
- AWS CDK CLI 설치: `npm install -g aws-cdk`

### 설치

```bash
npm install
```

### 빌드

```bash
npm run build
```

### CDK 명령어

#### CloudFormation 템플릿 생성

```bash
npm run cdk:synth
```

#### 스택 배포

```bash
npm run cdk:deploy
```

#### 스택 삭제

```bash
npm run cdk:destroy
```

#### 변경사항 확인

```bash
npm run cdk:diff
```

## 다음 단계

1. DynamoDB 테이블 및 데이터 모델 구현 (Task 2)
2. Lambda 함수 구현 (Task 4-9)
3. Step Functions 워크플로우 정의 (Task 7)
4. 프론트엔드 구현 (Task 11-12)
5. Amazon Lex 봇 설정 (Task 13)

## 참고 문서

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [요구사항 문서](.kiro/specs/partner-confirmation-automation/requirements.md)
- [디자인 문서](.kiro/specs/partner-confirmation-automation/design.md)
- [구현 태스크](.kiro/specs/partner-confirmation-automation/tasks.md)
