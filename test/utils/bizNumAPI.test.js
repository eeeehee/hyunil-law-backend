import dotenv from 'dotenv';
dotenv.config({ path: '../../.env.dev' }); // .env.dev 파일에서 환경 변수를 로드합니다.
import { validateBizNumWithAPI } from '../../utils/bizNumAPI.js';

async function testBizNumAPI() {
    console.log('=== 사업자등록번호 유효성 검사 API 테스트 시작 ===\n');

    // 테스트할 사업자등록번호 목록 (실제 유효/무효 번호로 변경하여 테스트하세요)
    const testBizNums = [
        {
            "businesses": [

                {
                    "b_no": "7158800866",
                    "start_dt": "20170911",
                    "p_nm": "이병윤"
                }
            ]
        }
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
