import { query } from './config/database.js';

async function checkRequests() {
    try {
        console.log('=== 요청 관리함 데이터 확인 ===\n');

        // 0. 테이블 구조 확인
        console.log('0️⃣  posts 테이블 구조:');
        const structure = await query('DESCRIBE posts');
        console.table(structure);
        console.log('');

        // 1. 자문신청 대기건 확인
        console.log('1️⃣  자문신청 (pending, phone_request):');
        const consultRequests = await query(`
            SELECT docId, category, title, status, createdAt
            FROM posts
            WHERE status IN ('pending', 'phone_request')
            ORDER BY createdAt DESC
            LIMIT 10
        `);
        console.table(consultRequests);
        console.log(`총 ${consultRequests.length}건\n`);

        // 2. 모든 pending 상태 확인
        console.log('2️⃣  모든 pending 상태 게시글:');
        const allPending = await query(`
            SELECT docId, category, title, status, createdAt
            FROM posts
            WHERE status = 'pending'
            ORDER BY createdAt DESC
            LIMIT 10
        `);
        console.table(allPending);
        console.log(`총 ${allPending.length}건\n`);

        // 3. 직원권한요청 확인
        console.log('3️⃣  직원권한요청 (member_req):');
        const memberRequests = await query(`
            SELECT docId, category, title, status, content, createdAt
            FROM posts
            WHERE category = 'member_req'
            ORDER BY createdAt DESC
            LIMIT 10
        `);
        console.table(memberRequests);
        console.log(`총 ${memberRequests.length}건\n`);

        // 4. 모든 카테고리 통계
        console.log('4️⃣  카테고리별 게시글 통계:');
        const categoryStats = await query(`
            SELECT category, status, COUNT(*) as count
            FROM posts
            GROUP BY category, status
            ORDER BY category, status
        `);
        console.table(categoryStats);

        // 5. 최근 10개 게시글
        console.log('\n5️⃣  최근 10개 게시글:');
        const recentPosts = await query(`
            SELECT docId, category, title, status, createdAt
            FROM posts
            ORDER BY createdAt DESC
            LIMIT 10
        `);
        console.table(recentPosts);

        process.exit(0);
    } catch (error) {
        console.error('❌ 오류:', error);
        process.exit(1);
    }
}

checkRequests();
