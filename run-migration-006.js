// run-migration-006.js
// 승인 요청 테이블 생성 마이그레이션 실행

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function runMigration() {
    let connection;

    try {
        console.log('========================================');
        console.log('006: 승인 요청 테이블 생성 마이그레이션 시작');
        console.log('========================================\n');

        // DB 연결
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            multipleStatements: true
        });

        console.log('✅ 데이터베이스 연결 성공\n');

        // 마이그레이션 SQL 파일 읽기
        const sqlPath = path.join(__dirname, 'database', 'migrations', '006_create_approval_requests_table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📄 마이그레이션 SQL 실행 중...\n');

        // SQL 실행
        const [results] = await connection.query(sql);

        console.log('✅ 마이그레이션 완료!\n');
        console.log('========================================');
        console.log('생성된 테이블: approval_requests');
        console.log('========================================\n');

    } catch (error) {
        console.error('❌ 마이그레이션 실패:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('데이터베이스 연결 종료');
        }
    }
}

runMigration();
