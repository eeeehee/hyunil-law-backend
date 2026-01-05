import { query } from './config/database.js';
import { v4 as uuidv4 } from 'uuid';

async function addTestData() {
    try {
        // 요금제 변경 신청 테스트 데이터
        const docId1 = uuidv4();
        await query(
            `INSERT INTO posts (docId, authorUid, companyName, category, title, content, status, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
                docId1,
                '117f7faa-ba95-4aa3-a804-1822cc2e0173',
                '오픈플로어',
                'plan_change',
                '요금제 변경 신청 (Basic → Standard)',
                '현재 Basic 플랜을 Standard 플랜으로 변경 신청합니다.',
                'pending'
            ]
        );
        console.log('✅ 요금제 변경 신청 테스트 데이터 추가 완료');
        console.log('DocId:', docId1);

        // 결제 요청 테스트 데이터
        const docId2 = uuidv4();
        await query(
            `INSERT INTO posts (docId, authorUid, companyName, category, title, content, status, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
                docId2,
                '117f7faa-ba95-4aa3-a804-1822cc2e0173',
                '오픈플로어',
                'payment_request',
                '세금계산서 발행 요청',
                '12월분 자문료 세금계산서 발행을 요청합니다.',
                'pending'
            ]
        );
        console.log('✅ 결제 요청 테스트 데이터 추가 완료');
        console.log('DocId:', docId2);

        process.exit(0);
    } catch (error) {
        console.error('❌ 에러:', error.message);
        process.exit(1);
    }
}

addTestData();
