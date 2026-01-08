import dotenv from 'dotenv';
dotenv.config({ path: '.env.dev' });

const BIZ_NUM_API_KEY = process.env.BIZ_NUM_API_KEY;
const BIZ_NUM_API_URL = 'https://api.odcloud.kr/api/nts-businessman/v1/validate'; // 국세청 진위여부 API

/**
 * 외부 API를 통해 사업자등록번호 진위여부 검사합니다.
 * 이 함수는 국세청 홈택스의 '사업자등록상태조회' API를 예시로 구현되었습니다.
 * 실제 사용 시에는 사용하는 외부 API의 명세에 맞춰 URL, 파라미터, 응답 처리 로직을 수정해야 합니다.
 *
 *
 * @returns {Promise<boolean>} 유효하면 true, 아니면 false를 반환합니다.
 */
export async function validateBizNumWithAPI(bizNum, openDate, representativeName) {
    if (!BIZ_NUM_API_KEY) {
        console.error('❌ BIZ_NUM_API_KEY 환경 변수가 설정되지 않았습니다.');
        return true;
    }

    try {
        // openDate 포맷 정리 (YYYY-MM-DD -> YYYYMMDD)
        const formattedDate = openDate ? openDate.replace(/-/g, '') : '';
        const requestBody = {
            "businesses": [
                {
                    "b_no": bizNum.replace(/-/g, ''), // 하이픈 제거
                    "start_dt": formattedDate,
                    "p_nm": representativeName
                }
            ]
        };

        const response = await fetch(`${BIZ_NUM_API_URL}?serviceKey=${BIZ_NUM_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            console.error(`❌ 외부 사업자등록번호 API 호출 실패: ${response.status} ${response.statusText}`);
            return false;
        }

        const data = await response.json();
        
        // 국세청 진위여부 API 응답 처리
        // {
        //     "status_code": "OK",
        //     "data": [
        //         {
        //             "b_no": "...",
        //             "valid": "01",  // 01: 유효, 02: 유효하지 않음
        //             "valid_msg": "확인 완료" (혹은 불일치 메시지)
        //             ...
        //             "status": {
        //                 "b_stt": "계속사업자",
        //                 "b_stt_cd": "01"
        //             }
        //         }
        //     ]
        // }
        
        if (data && data.data && data.data.length > 0) {
            const result = data.data[0];
            // valid 코드가 '01'이면 일치, '02'이면 불일치
            // 그리고 status.b_stt_cd가 '01'이어야 계속사업자
            // 하지만 진위여부 API(/validate)는 일치 여부(valid)를 주로 봄.
            // 여기서는 'valid'가 '01'이고 (정보 일치), 'status.b_stt_cd'가 '01' (계속사업자) 인 경우를 성공으로 봅니다.
            
            const isValidInfo = result.valid === '01';
            const isActiveBusiness = result.status?.b_stt_cd === '01';

            if (!isValidInfo) {
                 console.log(`❌ 사업자 정보 불일치: ${result.valid_msg}`);
            }
            if (!isActiveBusiness) {
                console.log(`❌ 휴/폐업 사업자 상태: ${result.status?.b_stt}`);
            }

            return isValidInfo && isActiveBusiness;
        }

        return false;
    } catch (error) {
        console.error('❌ 사업자등록번호 유효성 검사 중 오류 발생:', error);
        return false;
    }
}
