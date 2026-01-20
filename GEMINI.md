# 법무법인 현일 기업 관리 시스템 백엔드 API

법무법인 현일 기업 관리 시스템을 위한 백엔드 API 프로젝트입니다. Node.js (Express)와 MariaDB를 사용하여 구축되었습니다.

## 프로젝트 개요

*   **유형:** 백엔드 API 서버
*   **언어:** JavaScript (Node.js)
*   **프레임워크:** Express.js
*   **데이터베이스:** MariaDB (`mariadb` 드라이버 사용)
*   **인증:** JWT (JSON Web Tokens)
*   **아키텍처:** MVC 패턴과 유사한 구조 (라우터에 컨트롤러 로직 포함), 일부 서비스 레이어 패턴 적용.

## 기술 스택

*   **런타임:** Node.js (ES Modules 사용)
*   **웹 프레임워크:** Express.js
*   **데이터베이스 드라이버:** `mariadb` (메인 애플리케이션), `mysql2` (일부 마이그레이션 스크립트)
*   **인증/보안:** `jsonwebtoken` (JWT), `bcrypt` (비밀번호 해싱)
*   **유틸리티:** `uuid` (ID 생성), `dotenv` (환경 변수), `cors`, `multer` (파일 업로드)
*   **로깅:** `winston` (로그 생성/저장), `morgan` (HTTP 요청 로깅), `winston-daily-rotate-file` (일별 로그 파일 관리), `cls-rtracer` (요청 ID 추적)

## 디렉토리 구조

*   `server.js`: 프로덕션용 애플리케이션 진입점. Express 설정, 미들웨어, 라우터 등록.
*   `dev_server.js`: 개발용 애플리케이션 진입점 (`.env.dev` 사용).
*   `config/`: 설정 파일.
    *   `database.js`: 데이터베이스 연결.
    *   `logger.js`: Winston 로거 설정.
*   `routes/`: API 라우트 정의 및 요청 처리 로직. 도메인별로 분리됨.
*   `middleware/`: Express 미들웨어 (예: JWT 인증 `auth.js`).
*   `database/`: 데이터베이스 관련 파일.
    *   `migrations/`: SQL 마이그레이션 스크립트.
    *   `schema.sql`, `additional_tables.sql`: 데이터베이스 스키마 정의 파일.
*   `scripts/`: 유지보수 및 마이그레이션 실행 스크립트 (예: `check-tables.js`, `run-migration-006.js`).
*   `test/`: 테스트 코드 (`controllers/`, `utils/` 등으로 구조화).
*   `utils/`: 유틸리티 함수 (예: `safe-json.js`, `post_service.js`).
*   `.env`: 환경 변수 (Git에 포함되지 않음).
*   `logs/`: 서버 로그 파일 저장소 (일별 자동 생성).

## 빌드 및 실행

### 사전 요구 사항
*   Node.js (v18 이상 권장)
*   MariaDB 서버

### 설치
1.  의존성 설치:
    ```bash
    npm install
    ```
2.  환경 변수 설정 (`.env` 파일 생성, `README.md` 참조).

### 실행
*   **개발 모드:**
    ```bash
    npm run dev
    ```
    (`nodemon`을 사용하여 코드 변경 시 자동 재시작)
*   **프로덕션 모드:**
    ```bash
    npm start
    ```

## 개발 컨벤션 (`conventions.md` 참조)

*   **모듈 시스템:** ES Modules (`import`/`export`) 사용.
*   **데이터베이스 접근:**
    *   `config/database.js`의 `query` 및 `transaction` 헬퍼 함수 사용.
    *   라우트에서 직접 커넥션을 맺지 말고 헬퍼 함수를 활용할 것.
    *   **네이밍:** DB 컬럼은 `snake_case`, API JSON 속성은 `camelCase` 사용. 라우트 핸들러에서 매핑 필요.
*   **에러 처리:**
    *   비동기 라우트 로직은 `try-catch` 블록으로 감싸기.
    *   `logger.error('메시지', { error: err })`를 사용하여 에러 로깅.
    *   JSON 에러 응답 반환: `res.status(code).json({ error: 'Type', message: '사용자 친화적 메시지' })`.
*   **로깅:**
    *   `console.log`, `console.error` 사용 금지.
    *   `import { logger } from '../config/logger.js'` 후 `logger.info()`, `logger.error()` 사용.
    *   모든 로그에는 자동으로 `[ReqId: ...]`가 붙어 요청 흐름을 추적할 수 있음.
*   **인증:**
    *   보호된 라우트는 `authenticateToken` 미들웨어 사용.
    *   `req.user`를 통해 사용자 정보 접근 (예: `req.user.bizNum`).
*   **라우팅:**
    *   `routes/` 디렉토리에 도메인별로 라우트 파일 생성.
    *   새로운 라우트 파일은 `server.js` (및 `dev_server.js`)에 등록.

## 최근 변경 사항 (2026-01-18)
*   **로깅 시스템 전면 개편:** `winston` + `morgan` 도입. `logs/` 폴더에 날짜별 로그 파일 저장.
*   **Request ID (Trace ID) 도입:** `cls-rtracer`와 `nanoid`를 사용하여 모든 요청에 고유 ID 부여. 로그에서 `[ReqId: ...]`로 확인 가능하여 동시 요청 추적 용이.
*   **전체 코드 리팩토링:** `routes/`, `middleware/`, `config/` 내의 모든 `console.log/error`를 `logger`로 교체.
*   **버그 수정:** `routes/payments-admin.js`의 라우트 순서 문제(`/service-prices` vs `/:id`) 해결.

## 주요 파일
*   `config/database.js`: 데이터베이스 연결 풀 및 쿼리/트랜잭션 헬퍼 함수.
*   `config/logger.js`: 로깅 설정 (Console 출력 및 파일 저장 포맷 정의).
*   `server.js` / `dev_server.js`: 메인 애플리케이션 설정 파일.
*   `middleware/auth.js`: JWT 인증 로직.
*   `conventions.md`: 코딩 컨벤션 상세 가이드.