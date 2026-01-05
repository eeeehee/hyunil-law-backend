import { query } from './config/database.js';

async function debugServicePrices() {
    try {
        console.log('=== service_prices 테이블 상세 분석 ===\n');

        // 1. 테이블 구조 확인
        console.log('1️⃣ 테이블 구조:');
        const structure = await query('DESCRIBE service_prices');
        console.table(structure);

        // 2. 현재 데이터 확인
        console.log('\n2️⃣ 현재 저장된 데이터:');
        const currentData = await query('SELECT * FROM service_prices ORDER BY id');
        console.table(currentData);

        // 3. 프론트엔드에서 보내는 것과 동일한 형식으로 저장 테스트
        console.log('\n3️⃣ 저장 테스트 (프론트엔드 형식):');
        const testPrices = {
            oneTime: 110000,
            Basic: 110000,
            Standard: 330000,
            Pro: 550000,
            Premium: 990000
        };

        console.log('보낼 데이터:', testPrices);

        // 백엔드 API와 동일한 로직으로 저장
        for (const [type, price] of Object.entries(testPrices)) {
            console.log(`\n📝 저장 중: ${type} = ${price}`);

            const sql = `INSERT INTO service_prices (type, price)
                         VALUES (?, ?)
                         ON DUPLICATE KEY UPDATE price = ?`;

            console.log('SQL:', sql);
            console.log('파라미터:', [type, price, price]);

            try {
                const result = await query(sql, [type, price, price]);
                console.log('✅ 성공:', result);
            } catch (err) {
                console.log('❌ 실패:', err.message);
                console.log('에러 코드:', err.code);
                console.log('SQL State:', err.sqlState);
            }
        }

        // 4. 저장 후 데이터 확인
        console.log('\n4️⃣ 저장 후 데이터:');
        const afterData = await query('SELECT * FROM service_prices ORDER BY id');
        console.table(afterData);

        // 5. JSON 형식으로 응답 생성 (API와 동일)
        console.log('\n5️⃣ API 응답 형식:');
        const response = { prices: afterData };
        const jsonResponse = JSON.stringify(response, null, 2);
        console.log(jsonResponse);

        console.log('\n✅ 모든 테스트 완료!');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ 오류 발생:', error);
        console.error('상세:', error.message);
        console.error('스택:', error.stack);
        process.exit(1);
    }
}

debugServicePrices();
