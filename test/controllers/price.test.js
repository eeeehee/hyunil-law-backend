import { query } from '../../config/database.js';

async function testPriceAPI() {
    try {
        console.log('=== 기본단가 설정 API 테스트 ===\n');

        // 테스트 데이터
        const testPrices = {
            oneTime: 120000,
            Basic: 150000,
            Standard: 350000,
            Pro: 570000,
            Premium: 1000000
        };

        console.log('📝 저장할 단가 데이터:');
        console.log(testPrices);
        console.log('');

        // 실제 API 로직과 동일하게 저장
        for (const [type, price] of Object.entries(testPrices)) {
            console.log(`💾 저장 중: ${type} = ${price}원`);

            await query(
                `INSERT INTO service_prices (type, price)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE price = ?`,
                [type, price, price]
            );
        }

        console.log('\n✅ 저장 완료!\n');

        // 저장된 데이터 확인
        const updatedPrices = await query('SELECT * FROM service_prices ORDER BY id');
        console.log('📊 저장된 단가 데이터:');
        console.table(updatedPrices);

        // JSON 형태로 출력 (실제 API 응답과 동일)
        const response = { prices: updatedPrices };
        console.log('\n📤 API 응답 (JSON):');
        console.log(JSON.stringify(response, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('❌ 오류 발생:', error);
        process.exit(1);
    }
}

testPriceAPI();
