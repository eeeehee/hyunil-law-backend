import { query } from '../config/database.js';

async function checkTables() {
    try {
        console.log('=== companies 테이블 구조 ===');
        const companiesSchema = await query('DESCRIBE companies');
        companiesSchema.forEach(col => {
            console.log(`${col.Field} - ${col.Type}`);
        });

        console.log('\n=== users 테이블 구조 ===');
        const usersSchema = await query('DESCRIBE users');
        usersSchema.forEach(col => {
            console.log(`${col.Field} - ${col.Type}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('에러:', error.message);
        process.exit(1);
    }
}

checkTables();
