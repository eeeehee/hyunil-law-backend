// DB 사용자 확인 스크립트
import { query } from './config/database.js';

async function checkUsers() {
    try {
        console.log('사용자 정보 조회 중...\n');

        const users = await query(`
            SELECT uid, email, manager_name, representative_name, role, department, departments, biz_num
            FROM users
            WHERE email IN ('test@openfloor.kr', 'jh.youn@openfloor.kr', 'by.lee@openfloor.kr')
            ORDER BY created_at
        `);

        console.log('총', users.length, '명의 사용자 발견\n');

        users.forEach((user, index) => {
            console.log(`===== 사용자 ${index + 1} =====`);
            console.log('UID:', user.uid);
            console.log('이메일:', user.email);
            console.log('이름:', user.manager_name || user.representative_name || '-');
            console.log('역할(role):', user.role);
            console.log('부서:', user.department || '-');
            console.log('전체 부서 목록(departments):', user.departments || '-');
            console.log('사업자번호:', user.biz_num || '-');
            console.log('');
        });

        // 대표 계정 확인
        console.log('\n===== 대표(owner) 계정 확인 =====');
        const owners = await query(`
            SELECT uid, email, manager_name, representative_name, role, departments, biz_num
            FROM users
            WHERE role = 'owner'
            ORDER BY created_at
        `);

        owners.forEach((owner, index) => {
            console.log(`대표 ${index + 1}:`, owner.email, '/', owner.manager_name || owner.representative_name, '/ departments:', owner.departments || 'NULL');
        });

        process.exit(0);
    } catch (error) {
        console.error('오류 발생:', error);
        process.exit(1);
    }
}

checkUsers();
