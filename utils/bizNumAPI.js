import dotenv from 'dotenv';
dotenv.config();

const BIZ_NUM_API_KEY = process.env.BIZ_NUM_API_KEY;
const BIZ_NUM_API_URL = 'https://api.odcloud.kr/api/nts-businessman/v1/status'; // 국세청 사업자상태조회 API 예시

/**
 * 외부 API를 통해 사업자등록번호 유효성을 검사합니다.
 * 이 함수는 국세청 홈택스의 '사업자등록상태조회' API를 예시로 구현되었습니다.
 * 실제 사용 시에는 사용하는 외부 API의 명세에 맞춰 URL, 파라미터, 응답 처리 로직을 수정해야 합니다.
 *
 * @param {string} bizNum - 검증할 사업자등록번호 (예: '123-45-67890')
 * @returns {Promise<boolean>} 유효하면 true, 아니면 false를 반환합니다.
 */
export async function validateBizNumWithAPI(bizNum) {
    if (!BIZ_NUM_API_KEY) {
        console.error('❌ BIZ_NUM_API_KEY 환경 변수가 설정되지 않았습니다.');
        // API 키가 없으면 일단 유효하다고 간주하거나, 에러를 발생시킬 수 있습니다.
        // 여기서는 개발 편의를 위해 true를 반환하지만, 실제 프로덕션에서는 false 또는 throw error가 더 안전합니다.
        return true;
    }

    // 사업자등록번호에서 하이픈 제거
    const cleanedBizNum = bizNum.replace(/-/g, '');

    try {
        const requestBody = {
            b_no: [cleanedBizNum]
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
        
        // 국세청 API 응답 형식에 따라 유효성 검사
        // data.data 배열에 각 사업자등록번호에 대한 결과가 담깁니다.
        // '사업자등록상태' 필드가 '계속사업자' 또는 '휴업자', '폐업자' 등을 반환합니다.
        // 여기서는 '계속사업자'만 유효하다고 간주합니다. (요구사항에 따라 변경 가능)
        // {
        //     "status_code": "OK",
        //     "match_cnt": 1,
        //     "request_cnt": 1,
        //     "data": [
        //     {
        //         "b_no": "0000000000",
        //         "b_stt": "계속사업자",
        //         "b_stt_cd": "01",
        //         "tax_type": "부가가치세 일반과세자",
        //         "tax_type_cd": "01",
        //         "end_dt": "20000101",
        //         "utcc_yn": "Y",
        //         "tax_type_change_dt": "20000101",
        //         "invoice_apply_dt": "20000101",
        //         "rbf_tax_type": "부가가치세 일반과세자",
        //         "rbf_tax_type_cd": "01"
        //     }
        // ]
        // }
        if (data && data.data && data.data.length > 0) {
            const status = data.data[0].b_stt_cd; // 사업자등록상태코드
            // b_stt_cd가 01이면 계속사업자
            return status === '01'; // '계속사업자' 코드
        }

        return false; // API 응답 형식이 예상과 다름
    } catch (error) {
        console.error('❌ 사업자등록번호 유효성 검사 중 오류 발생:', error);
        return false;
    }
}
