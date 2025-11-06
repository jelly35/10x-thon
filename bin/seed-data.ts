#!/usr/bin/env node
/**
 * 샘플 예약 데이터 시드 스크립트
 * DynamoDB에 테스트용 예약 데이터를 삽입합니다.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { Reservation, reservationToItem } from "../lib/types";

// DynamoDB 클라이언트 초기화
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-northeast-2",
});
const docClient = DynamoDBDocumentClient.from(client);

// 테이블 이름
const TABLE_NAME = process.env.TABLE_NAME || "PartnerConfirmationTable";

// 샘플 예약 데이터
const sampleReservations: Reservation[] = [
  {
    reservationNumber: "RES001",
    customerId: "CUST001",
    customerName: "김철수",
    customerPhone: "+821012345678",
    partnerId: "PARTNER001",
    partnerName: "서울 헤어샵",
    partnerPhone: "+821087654321",
    serviceType: "헤어컷",
    reservationDate: "2025-11-10T14:00:00Z",
    createdAt: Date.now(),
  },
  {
    reservationNumber: "RES002",
    customerId: "CUST002",
    customerName: "이영희",
    customerPhone: "+821023456789",
    partnerId: "PARTNER002",
    partnerName: "강남 네일샵",
    partnerPhone: "+821098765432",
    serviceType: "네일아트",
    reservationDate: "2025-11-11T15:30:00Z",
    createdAt: Date.now(),
  },
  {
    reservationNumber: "RES003",
    customerId: "CUST003",
    customerName: "박민수",
    customerPhone: "+821034567890",
    partnerId: "PARTNER003",
    partnerName: "홍대 마사지샵",
    partnerPhone: "+821009876543",
    serviceType: "전신 마사지",
    reservationDate: "2025-11-12T10:00:00Z",
    createdAt: Date.now(),
  },
  {
    reservationNumber: "RES004",
    customerId: "CUST004",
    customerName: "정수진",
    customerPhone: "+821045678901",
    partnerId: "PARTNER001",
    partnerName: "서울 헤어샵",
    partnerPhone: "+821087654321",
    serviceType: "펌",
    reservationDate: "2025-11-13T16:00:00Z",
    createdAt: Date.now(),
  },
  {
    reservationNumber: "RES005",
    customerId: "CUST005",
    customerName: "최동욱",
    customerPhone: "+821056789012",
    partnerId: "PARTNER004",
    partnerName: "신촌 피부관리샵",
    partnerPhone: "+821010987654",
    serviceType: "피부관리",
    reservationDate: "2025-11-14T11:30:00Z",
    createdAt: Date.now(),
  },
];

/**
 * 예약 데이터를 DynamoDB에 삽입
 */
async function seedReservations() {
  console.log(
    `Starting to seed ${sampleReservations.length} reservations to ${TABLE_NAME}...`
  );

  for (const reservation of sampleReservations) {
    try {
      const item = reservationToItem(reservation);

      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: item,
        })
      );

      console.log(
        `✓ Inserted reservation: ${reservation.reservationNumber} (${reservation.customerName})`
      );
    } catch (error) {
      console.error(
        `✗ Failed to insert reservation ${reservation.reservationNumber}:`,
        error
      );
    }
  }

  console.log("\nSeed completed!");
  console.log(`Total reservations inserted: ${sampleReservations.length}`);
}

// 스크립트 실행
seedReservations()
  .then(() => {
    console.log("\n✓ Seed script finished successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Seed script failed:", error);
    process.exit(1);
  });
