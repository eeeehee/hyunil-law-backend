import dotenv from 'dotenv';
dotenv.config({ path: '.env.dev' }); // .env.dev 파일에서 환경 변수를 로드합니다.
import { validateBizNumWithAPI } from './utils/bizNumAPI.js';

async function testBizNumAPI() {
    console.log('=== 사업자등록번호 유효성 검사 API 테스트 시작 ===\n');

    // 테스트할 사업자등록번호 목록 (실제 유효/무효 번호로 변경하여 테스트하세요)
    const testBizNums = [
        '123-45-67890', // 유효한 사업자등록번호 (가정)
        '000-00-00000', // 유효하지 않은 사업자등록번호 (가정)
        '999-88-77777', // 존재하지 않거나 폐업된 사업자등록번호 (가정)
        '111-22-33333', // 다른 유효한 번호 (가정)
        '1234567890'    // 하이픈 없는 번호 (내부에서 처리되어야 함)
    ];

    for (const bizNum of testBizNums) {
        console.log(`🔎 사업자등록번호: ${bizNum} 검증 중...`);
        const isValid = await validateBizNumWithAPI(bizNum);
        console.log(`결과: ${isValid ? '✅ 유효함' : '❌ 유효하지 않음'}\n`);
    }

    console.log('=== 사업자등록번호 유효성 검사 API 테스트 완료 ===');
}

// 테스트 함수 실행
testBizNumAPI().catch(error => {
    console.error('테스트 중 오류 발생:', error);
    process.exit(1);
});
