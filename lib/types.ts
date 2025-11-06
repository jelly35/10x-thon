/**
 * 공통 타입 정의
 * 파트너 확인 자동화 시스템에서 사용하는 모든 타입을 정의합니다.
 */

// ============================================================================
// 요청 관련 타입
// ============================================================================

/**
 * 요청 상태
 */
export enum RequestStatus {
  CREATED = "Created",
  SMS_SENT = "SMSSent",
  OPENED = "Opened",
  RESPONDED = "Responded",
  TIMEOUT = "Timeout",
  FAILED = "Failed",
}

/**
 * 인텐트 타입
 */
export enum IntentType {
  RESERVATION_CHANGE = "예약변경",
  TROUBLE_REPORT = "트러블신고",
  ADDITIONAL_SERVICE = "부가서비스",
}

/**
 * 요청 레코드
 */
export interface Request {
  requestId: string;
  customerId: string;
  customerPhone: string;
  reservationNumber: string;
  intent: IntentType;
  query: string;
  partnerId?: string;
  partnerPhone?: string;
  status: RequestStatus;
  taskToken?: string;
  executionArn?: string;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// 예약 관련 타입
// ============================================================================

/**
 * 예약 레코드
 */
export interface Reservation {
  reservationNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  partnerId: string;
  partnerName: string;
  partnerPhone: string;
  serviceType: string;
  reservationDate: string;
  createdAt: number;
}

// ============================================================================
// 이벤트 관련 타입
// ============================================================================

/**
 * 이벤트 타입
 */
export enum EventType {
  CREATED = "Created",
  SMS_SENT = "SMSSent",
  OPENED = "Opened",
  RESPONDED = "Responded",
  TIMEOUT = "Timeout",
  FAILED = "Failed",
}

/**
 * 이벤트 레코드
 */
export interface Event {
  requestId: string;
  eventType: EventType;
  timestamp: number;
  details?: Record<string, any>;
}

// ============================================================================
// 토큰 관련 타입
// ============================================================================

/**
 * 토큰 페이로드
 */
export interface TokenPayload {
  requestId: string;
  partnerId: string;
  expiresAt: number;
  scope: "confirm";
}

/**
 * 서명 토큰
 */
export interface SignedToken {
  payload: TokenPayload;
  signature: string;
}

/**
 * 토큰 레코드
 */
export interface Token {
  token: string;
  requestId: string;
  partnerId: string;
  used: boolean;
  expiresAt: number;
  createdAt: number;
}

// ============================================================================
// 파트너 응답 관련 타입
// ============================================================================

/**
 * 파트너 응답 타입
 */
export enum PartnerResponseType {
  ACCEPT = "accept",
  REJECT = "reject",
  ALTERNATIVE = "alternative",
}

/**
 * 파트너 응답
 */
export interface PartnerResponse {
  responseType: PartnerResponseType;
  alternativeTime?: string;
  timestamp: number;
}

// ============================================================================
// API 요청/응답 타입
// ============================================================================

/**
 * 고객 문의 제출 요청
 */
export interface ChatRequest {
  customerId: string;
  customerPhone: string;
  reservationNumber: string;
  message: string;
}

/**
 * 고객 문의 제출 응답
 */
export interface ChatResponse {
  requestId: string;
  status: RequestStatus;
  message: string;
}

/**
 * 확인 페이지 데이터 응답
 */
export interface ConfirmPageData {
  requestId: string;
  customerQuery: string;
  intent: IntentType;
  reservationNumber: string;
  reservationDate: string;
}

/**
 * 파트너 응답 제출 요청
 */
export interface RespondRequest {
  token: string;
  response: PartnerResponseType;
  alternativeTime?: string;
}

/**
 * 파트너 응답 제출 응답
 */
export interface RespondResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// DynamoDB 아이템 타입
// ============================================================================

/**
 * DynamoDB 기본 키
 */
export interface DynamoDBKey {
  PK: string;
  SK: string;
}

/**
 * 요청 DynamoDB 아이템
 */
export interface RequestItem extends DynamoDBKey, Request {}

/**
 * 예약 DynamoDB 아이템
 */
export interface ReservationItem extends DynamoDBKey, Reservation {}

/**
 * 이벤트 DynamoDB 아이템
 */
export interface EventItem extends DynamoDBKey, Event {}

/**
 * 토큰 DynamoDB 아이템
 */
export interface TokenItem extends DynamoDBKey, Token {}

// ============================================================================
// Lambda 이벤트 타입
// ============================================================================

/**
 * Lex Handler Lambda 이벤트
 */
export interface LexHandlerEvent {
  body: string; // JSON.stringify(ChatRequest)
}

/**
 * Orchestrator Lambda 이벤트
 */
export interface OrchestratorEvent {
  requestId: string;
}

/**
 * SMS Sender Lambda 이벤트
 */
export interface SmsSenderEvent {
  requestId: string;
  partnerId: string;
  partnerPhone: string;
  taskToken: string;
}

/**
 * Response Handler Lambda 이벤트 (GET)
 */
export interface ResponseHandlerGetEvent {
  pathParameters: {
    token: string;
  };
}

/**
 * Response Handler Lambda 이벤트 (POST)
 */
export interface ResponseHandlerPostEvent {
  body: string; // JSON.stringify(RespondRequest)
}

/**
 * Notification Lambda 이벤트
 */
export interface NotificationEvent {
  requestId: string;
  partnerResponse?: PartnerResponse;
  isTimeout?: boolean;
}

// ============================================================================
// 환경 변수 타입
// ============================================================================

/**
 * Lambda 환경 변수
 */
export interface LambdaEnvironment {
  TABLE_NAME: string;
  SECRET_KEY?: string;
  CONFIRM_URL?: string;
  LEX_BOT_ID?: string;
  LEX_BOT_ALIAS_ID?: string;
  LEX_LOCALE_ID?: string;
  STATE_MACHINE_ARN?: string;
}

// ============================================================================
// DynamoDB 유틸리티 함수
// ============================================================================

/**
 * Request를 DynamoDB 아이템으로 변환
 */
export function requestToItem(request: Request): RequestItem {
  return {
    PK: `REQ#${request.requestId}`,
    SK: "METADATA",
    ...request,
  };
}

/**
 * DynamoDB 아이템을 Request로 변환
 */
export function itemToRequest(item: RequestItem): Request {
  const { PK, SK, ...request } = item;
  return request as Request;
}

/**
 * Reservation을 DynamoDB 아이템으로 변환
 */
export function reservationToItem(reservation: Reservation): ReservationItem {
  return {
    PK: `RES#${reservation.reservationNumber}`,
    SK: "METADATA",
    ...reservation,
  };
}

/**
 * DynamoDB 아이템을 Reservation으로 변환
 */
export function itemToReservation(item: ReservationItem): Reservation {
  const { PK, SK, ...reservation } = item;
  return reservation as Reservation;
}

/**
 * Event를 DynamoDB 아이템으로 변환
 */
export function eventToItem(event: Event): EventItem {
  return {
    PK: `REQ#${event.requestId}`,
    SK: `EVENT#${event.timestamp}`,
    ...event,
  };
}

/**
 * DynamoDB 아이템을 Event로 변환
 */
export function itemToEvent(item: EventItem): Event {
  const { PK, SK, ...event } = item;
  return event as Event;
}

/**
 * Token을 DynamoDB 아이템으로 변환
 */
export function tokenToItem(token: Token): TokenItem {
  return {
    PK: `TOKEN#${token.token}`,
    SK: "METADATA",
    ...token,
  };
}

/**
 * DynamoDB 아이템을 Token으로 변환
 */
export function itemToToken(item: TokenItem): Token {
  const { PK, SK, ...token } = item;
  return token as Token;
}
