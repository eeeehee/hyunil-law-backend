# Corporate Hyunil Law Backend API

법무그룹 현일 기업 관리 시스템 백엔드 API 서버

## 프로젝트 개요

Firebase에서 MariaDB로 마이그레이션한 백엔드 API 서버입니다.

## 기술 스택

- **런타임**: Node.js
- **프레임워크**: Express.js
- **데이터베이스**: MariaDB
- **인증**: JWT (JSON Web Tokens)
- **기타**: bcrypt (비밀번호 암호화), uuid (고유 ID 생성)

## 데이터베이스 정보

```
Host: 121.78.123.70
Port: 13306
Database: corporatehyunillaw_test
```

## 설치 및 실행

### 1. 패키지 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 수정하여 데이터베이스 연결 정보를 입력합니다:

```env
# Database Configuration
DB_HOST=121.78.123.70
DB_PORT=13306
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=corporatehyunillaw_test

# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRES_IN=24h

# CORS Configuration
CORS_ORIGIN=*
```

### 3. 서버 실행

```bash
# 개발 모드 (nodemon 사용)
npm run dev

# 프로덕션 모드
npm start
```

서버는 기본적으로 `http://localhost:3000`에서 실행됩니다.

## API 엔드포인트

### 인증 (Authentication)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/signup` | 회원가입 | No |
| POST | `/api/auth/login` | 로그인 | No |
| POST | `/api/auth/reset-password` | 비밀번호 재설정 | No |

### 사용자 (Users)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/users/me` | 현재 사용자 정보 조회 | Yes |
| GET | `/api/users` | 전체 사용자 목록 (관리자) | Yes (Admin) |
| GET | `/api/users/:uid` | 특정 사용자 조회 (관리자) | Yes (Admin) |
| PUT | `/api/users/me` | 사용자 정보 업데이트 | Yes |
| PUT | `/api/users/:uid` | 사용자 역할/플랜 업데이트 (관리자) | Yes (Admin) |
| DELETE | `/api/users/:uid` | 사용자 삭제 (관리자) | Yes (Admin) |

### 소송 사건 (Litigation Cases)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/litigation-cases` | 소송 사건 목록 조회 | Yes |
| GET | `/api/litigation-cases/:docId` | 특정 소송 사건 조회 | Yes |
| POST | `/api/litigation-cases` | 소송 사건 생성 | Yes (Manager+) |
| PUT | `/api/litigation-cases/:docId` | 소송 사건 업데이트 | Yes (Manager+) |
| DELETE | `/api/litigation-cases/:docId` | 소송 사건 삭제 | Yes (Manager+) |
| GET | `/api/litigation-cases/:docId/billing-history` | 청구 내역 조회 | Yes |
| POST | `/api/litigation-cases/:docId/billing-history` | 청구 내역 추가 | Yes (Manager+) |

### 기타 사건 (Cases)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/cases/debt` | 채무 사건 목록 조회 | Yes |
| POST | `/api/cases/debt` | 채무 사건 생성 | Yes (Manager+) |
| PUT | `/api/cases/debt/:docId` | 채무 사건 업데이트 | Yes (Manager+) |
| GET | `/api/cases/pasan` | 파산 사건 목록 조회 | Yes |
| POST | `/api/cases/pasan` | 파산 사건 생성 | Yes (Manager+) |
| PUT | `/api/cases/pasan/:docId` | 파산 사건 업데이트 | Yes (Manager+) |
| GET | `/api/cases/consultation` | 상담 문의 목록 조회 | Yes |
| POST | `/api/cases/consultation` | 상담 문의 생성 | No |
| PUT | `/api/cases/consultation/:docId` | 상담 문의 업데이트 | Yes (Manager+) |

## 권한 레벨

- `user`: 일반 사용자
- `manager`: 매니저
- `owner`: 소유자
- `admin`: 관리자
- `general_manager`: 총괄 매니저
- `lawyer`: 변호사

## 인증 방식

JWT 토큰을 사용한 Bearer 인증:

```
Authorization: Bearer <your_jwt_token>
```

## 에러 응답 형식

```json
{
  "error": "Error Type",
  "message": "한글 에러 메시지"
}
```

## 성공 응답 예시

### 로그인 성공

```json
{
  "message": "로그인 성공",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "uid": "uuid-here",
    "email": "user@example.com",
    "companyName": "회사명",
    "role": "user",
    "plan": "basic"
  }
}
```

## 데이터베이스 스키마

자세한 스키마 정보는 `dump-corporatehyunillaw_test-202512190957.sql` 파일을 참조하세요.

주요 테이블:
- `users` - 사용자 정보
- `litigation_cases` - 소송 사건
- `debt_cases` - 채무 사건
- `pasan_cases` - 파산 사건
- `consultation_inquiries` - 상담 문의
- `reports` - 보고서
- `credit_reports` - 신용 조회
- `leave_requests` - 휴가 신청
- `payment_history` - 결제 이력
- `company_expenses` - 회사 지출

## 개발 가이드

### 새로운 API 엔드포인트 추가하기

1. `routes/` 폴더에 새로운 라우터 파일 생성
2. `server.js`에 라우터 import 및 등록
3. 필요시 `middleware/` 폴더에 미들웨어 추가

### 데이터베이스 쿼리

`config/database.js`의 헬퍼 함수 사용:

```javascript
import { query, transaction } from '../config/database.js';

// 단순 쿼리
const users = await query('SELECT * FROM users WHERE role = ?', ['admin']);

// 트랜잭션
await transaction(async (conn) => {
    await conn.query('INSERT INTO ...');
    await conn.query('UPDATE ...');
});
```

## 프론트엔드 연결

프론트엔드에서는 `/js/api.js`를 사용하여 API와 통신합니다:

```javascript
import { auth, users, litigationCases } from '/js/api.js';

// 로그인
await auth.login(email, password);

// 사용자 정보 조회
const currentUser = await users.getMe();

// 소송 사건 목록 조회
const cases = await litigationCases.getAll();
```

## 보안 고려사항

1. **.env 파일**: 절대 Git에 커밋하지 마세요
2. **JWT_SECRET**: 프로덕션 환경에서는 강력한 시크릿 키를 사용하세요
3. **CORS**: 프로덕션 환경에서는 특정 도메인만 허용하도록 설정하세요
4. **비밀번호**: bcrypt를 사용하여 안전하게 해시됩니다

## 문제 해결

### 데이터베이스 연결 실패

- `.env` 파일의 데이터베이스 정보 확인
- 네트워크 방화벽 설정 확인
- MariaDB 서버 상태 확인

### JWT 토큰 오류

- JWT_SECRET이 올바르게 설정되었는지 확인
- 토큰 만료 시간 확인

## 라이선스

Copyright © 2024 법무그룹 현일
