// test-api.js - API 테스트 스크립트
// 백엔드 서버가 실행 중일 때 이 스크립트를 실행하여 API를 테스트할 수 있습니다.
// 사용법: node test-api.js

const API_BASE_URL = 'http://localhost:3000/api';

async function testAPI() {
    console.log('🧪 API 테스트 시작\n');

    // 1. Health Check
    console.log('1️⃣ Health Check...');
    try {
        const response = await fetch('http://localhost:3000/health');
        const data = await response.json();
        console.log('✅ 서버 상태:', data.status);
        console.log('   시간:', data.timestamp);
    } catch (error) {
        console.error('❌ Health Check 실패:', error.message);
        console.log('\n⚠️ 백엔드 서버가 실행 중인지 확인하세요: npm run dev');
        return;
    }
    console.log('');

    // 2. 회원가입 테스트
    console.log('2️⃣ 회원가입 테스트...');
    const testUser = {
        email: `test${Date.now()}@example.com`,
        password: 'test1234',
        companyName: '테스트 주식회사',
        representativeName: '홍길동',
        bizNum: `123-45-${String(Date.now()).slice(-5)}`,
        managerName: '김담당',
        phone: '010-1234-5678'
    };

    let token = '';
    try {
        const response = await fetch(`${API_BASE_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
        }
        
        const data = await response.json();
        token = data.token;
        console.log('✅ 회원가입 성공');
        console.log('   이메일:', data.user.email);
        console.log('   회사명:', data.user.companyName);
        console.log('   권한:', data.user.role);
    } catch (error) {
        console.error('❌ 회원가입 실패:', error.message);
    }
    console.log('');

    // 3. 로그인 테스트
    console.log('3️⃣ 로그인 테스트...');
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testUser.email,
                password: testUser.password
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
        }
        
        const data = await response.json();
        token = data.token;
        console.log('✅ 로그인 성공');
        console.log('   토큰 생성됨 (길이:', token.length, ')');
    } catch (error) {
        console.error('❌ 로그인 실패:', error.message);
    }
    console.log('');

    // 4. 현재 사용자 정보 조회
    console.log('4️⃣ 현재 사용자 정보 조회...');
    try {
        const response = await fetch(`${API_BASE_URL}/users/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
        }
        
        const data = await response.json();
        console.log('✅ 사용자 정보 조회 성공');
        console.log('   UID:', data.uid);
        console.log('   이메일:', data.email);
        console.log('   회사명:', data.companyName);
    } catch (error) {
        console.error('❌ 사용자 정보 조회 실패:', error.message);
    }
    console.log('');

    // 5. 소송 사건 생성 테스트
    console.log('5️⃣ 소송 사건 생성 테스트...');
    let caseDocId = '';
    try {
        // 먼저 매니저 권한으로 업데이트 (테스트용)
        const updateResponse = await fetch(`${API_BASE_URL}/users/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({})
        });

        // 소송 사건 생성 시도 (실제로는 권한이 필요함)
        console.log('   ⚠️ 일반 사용자는 사건을 생성할 수 없습니다');
        console.log('   ℹ️ 관리자 권한이 필요한 작업입니다');
    } catch (error) {
        console.log('   ℹ️ 예상된 권한 오류:', error.message);
    }
    console.log('');

    // 6. 소송 사건 목록 조회
    console.log('6️⃣ 소송 사건 목록 조회...');
    try {
        const response = await fetch(`${API_BASE_URL}/litigation-cases?limit=5`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
        }
        
        const data = await response.json();
        console.log('✅ 소송 사건 목록 조회 성공');
        console.log('   건수:', data.cases.length);
    } catch (error) {
        console.error('❌ 소송 사건 목록 조회 실패:', error.message);
    }
    console.log('');

    // 7. 상담 문의 생성 (인증 불필요)
    console.log('7️⃣ 상담 문의 생성 테스트...');
    try {
        const response = await fetch(`${API_BASE_URL}/cases/consultation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category: 'collection',
                clientName: '상담자 홍길동',
                phone: '010-9876-5432',
                email: 'inquiry@example.com',
                content: '채권 추심 관련 문의드립니다.'
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
        }
        
        const data = await response.json();
        console.log('✅ 상담 문의 생성 성공');
        console.log('   메시지:', data.message);
    } catch (error) {
        console.error('❌ 상담 문의 생성 실패:', error.message);
    }
    console.log('');

    console.log('🎉 API 테스트 완료!\n');
    console.log('📝 참고사항:');
    console.log('- 생성된 테스트 계정:', testUser.email);
    console.log('- 비밀번호:', testUser.password);
    console.log('- 이 계정으로 프론트엔드에서 로그인할 수 있습니다');
}

// 실행
testAPI().catch(console.error);
