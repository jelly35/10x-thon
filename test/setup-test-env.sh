#!/bin/bash
# 테스트 환경 설정 스크립트
# 
# 이 스크립트는 통합 테스트 실행에 필요한 환경 변수를 자동으로 설정합니다.
#
# 사용법:
#   source test/setup-test-env.sh
#   또는
#   . test/setup-test-env.sh

set -e

echo "🔧 테스트 환경 설정 중..."

# AWS 리전 설정
export AWS_REGION=${AWS_REGION:-ap-northeast-2}
echo "✅ AWS_REGION: $AWS_REGION"

# DynamoDB 테이블명 가져오기
echo "📊 DynamoDB 테이블명 조회 중..."
export TABLE_NAME=$(aws cloudformation describe-stacks \
  --stack-name PartnerConfirmation-DataStack \
  --region $AWS_REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`TableName`].OutputValue' \
  --output text 2>/dev/null || echo "")

if [ -z "$TABLE_NAME" ]; then
  echo "⚠️  DynamoDB 테이블을 찾을 수 없습니다. 기본값 사용."
  export TABLE_NAME="PartnerConfirmation-DataStack-PartnerConfirmationTable"
fi
echo "✅ TABLE_NAME: $TABLE_NAME"

# API 엔드포인트 가져오기
echo "🌐 API 엔드포인트 조회 중..."
export API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name PartnerConfirmation-ApiStack \
  --region $AWS_REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text 2>/dev/null || echo "")

if [ -z "$API_ENDPOINT" ]; then
  echo "❌ API 엔드포인트를 찾을 수 없습니다."
  echo "   CDK 스택이 배포되었는지 확인하세요:"
  echo "   npm run cdk:deploy"
  return 1
fi
echo "✅ API_ENDPOINT: $API_ENDPOINT"

# Step Functions 상태 머신 ARN 가져오기 (선택사항)
echo "⚙️  Step Functions 상태 머신 ARN 조회 중..."
export STATE_MACHINE_ARN=$(aws cloudformation describe-stacks \
  --stack-name PartnerConfirmation-WorkflowStack \
  --region $AWS_REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`StateMachineArn`].OutputValue' \
  --output text 2>/dev/null || echo "")

if [ -n "$STATE_MACHINE_ARN" ]; then
  echo "✅ STATE_MACHINE_ARN: $STATE_MACHINE_ARN"
else
  echo "⚠️  Step Functions 상태 머신 ARN을 찾을 수 없습니다."
fi

echo ""
echo "✨ 테스트 환경 설정 완료!"
echo ""
echo "다음 명령어로 테스트를 실행하세요:"
echo "  npm run test:integration    # 모든 테스트"
echo "  npm run test:normal         # 정상 플로우만"
echo "  npm run test:timeout        # 타임아웃 시나리오만"
echo "  npm run test:errors         # 에러 시나리오만"
echo ""
