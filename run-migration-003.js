import {query} from './config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'database/migrations/003_create_payments_table.sql'), 'utf8');

        // SQL을 구문별로 분리하여 실행
        const statements = sql.split(';').filter(s => s.trim());

        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    await query(statement);
                    console.log('✅ 실행 완료:', statement.substring(0, 50).trim() + '...');
                } catch (error) {
                    // ALTER TABLE의 중복 컬럼 에러는 무시
                    if (error.code === 'ER_DUP_FIELDNAME') {
                        console.log('⚠️  컬럼이 이미 존재합니다 (무시):', statement.substring(0, 50).trim() + '...');
                    } else {
                        throw error;
                    }
                }
            }
        }

        console.log('✅ payments 테이블 마이그레이션 완료');
    } catch (error) {
        console.error('❌ 마이그레이션 실패:', error.message);
        throw error;
    }
}

runMigration();
