import { query } from '../config/database.js';

async function checkServicePrices() {
    try {
        console.log('=== service_prices 테이블 확인 ===\n');

        // 테이블 존재 여부 확인
        const tables = await query("SHOW TABLES LIKE 'service_prices'");

        if (tables.length === 0) {
            console.log('❌ service_prices 테이블이 존재하지 않습니다!');
            console.log('\n해결 방법: 마이그레이션 실행');
            console.log('파일: backend/database/migrations/003_create_payments_table.sql\n');
            return;
        }

        console.log('✅ service_prices 테이블 존재\n');

        // 테이블 구조 확인
        console.log('테이블 구조:');
        const structure = await query('DESCRIBE service_prices');
        console.table(structure);

        // 데이터 확인
        console.log('\n현재 저장된 단가 데이터:');
        const prices = await query('SELECT * FROM service_prices');

        if (prices.length === 0) {
            console.log('❌ 단가 데이터가 없습니다!');
            console.log('\n초기 데이터를 삽입하겠습니다...\n');

            await query(`
                INSERT INTO service_prices (type, price, description) VALUES
                ('oneTime', 110000, '단기 자문 (1회)'),
                ('Basic', 110000, 'Basic 플랜'),
                ('Standard', 330000, 'Standard 플랜'),
                ('Pro', 550000, 'Pro 플랜'),
                ('Premium', 990000, 'Premium 플랜')
                ON DUPLICATE KEY UPDATE price=VALUES(price)
            `);

            const newPrices = await query('SELECT * FROM service_prices');
            console.log('✅ 초기 데이터 삽입 완료:');
            console.table(newPrices);
        } else {
            console.table(prices);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
        process.exit(1);
    }
}

checkServicePrices();
