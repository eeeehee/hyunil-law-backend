import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// .env 파일 로드
dotenv.config({ path: join(__dirname, '../../.env') });

async function runMigration() {
    let connection;

    try {
        console.log('📡 데이터베이스 연결 중...');

        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT),
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('✅ 데이터베이스 연결 성공');

        // SQL 파일 읽기
        const sqlPath = join(__dirname, 'add_service_prices_table.sql');
        const sql = await fs.readFile(sqlPath, 'utf-8');

        console.log('📝 마이그레이션 실행 중...');

        // SQL 문을 세미콜론으로 분리하여 실행
        const statements = sql.split(';').filter(stmt => stmt.trim());

        for (const statement of statements) {
            if (statement.trim()) {
                await connection.query(statement);
                console.log('  ✅', statement.substring(0, 50) + '...');
            }
        }

        console.log('✅ 마이그레이션 완료!');

        // 테이블 확인
        const [rows] = await connection.query('SELECT * FROM service_prices');
        console.log('\n📊 현재 저장된 서비스 단가:');
        console.table(rows);

    } catch (error) {
        console.error('❌ 마이그레이션 실패:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 데이터베이스 연결 종료');
        }
    }
}

runMigration();
