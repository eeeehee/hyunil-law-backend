# 코딩 컨벤션

이 문서는 Node.js Express 기반 백엔드 프로젝트의 코딩 컨벤션을 정의합니다.

## 1. 일반 원칙

*   **가독성**: 코드는 명확하고 이해하기 쉬워야 합니다.
*   **일관성**: 프로젝트 전반에 걸쳐 일관된 스타일과 패턴을 유지합니다.
*   **재사용성**: 가능한 한 코드 재사용을 고려하여 중복을 줄입니다.

## 2. 파일 및 디렉토리 구조

*   **`routes/`**: Express 라우터 정의 파일을 저장합니다. 각 파일은 특정 리소스 또는 기능 영역을 담당합니다 (예: `routes/users.js`, `routes/posts.js`).
*   **`middleware/`**: Express 미들웨어 함수를 저장합니다 (예: `middleware/auth.js`).
*   **`config/`**: 환경 설정 및 데이터베이스 연결과 같은 구성 관련 파일을 저장합니다 (예: `config/database.js`).
*   **`utils/`**: 프로젝트 전반에 걸쳐 사용되는 유틸리티 함수나 헬퍼를 저장합니다 (예: `utils/helpers.js`).
*   **`database/`**: SQL 마이그레이션 스크립트, 스키마 정의 등을 저장합니다 (예: `database/migrations/`).

## 3. 명명 규칙

*   **변수 및 함수**: `camelCase`를 사용합니다 (예: `getUserById`, `companyName`).
*   **상수**: `UPPER_SNAKE_CASE`를 사용합니다 (예: `JWT_SECRET`, `DEFAULT_PAGE_SIZE`).
*   **클래스 및 생성자**: `PascalCase`를 사용합니다 (해당하는 경우).
*   **파일 이름**: `kebab-case`를 사용합니다 (예: `user-routes.js`, `auth-middleware.js`). 라우터 파일의 경우 `users.js`, `posts.js`와 같이 복수형을 사용하는 것이 일반적입니다.
*   **데이터베이스 테이블 및 컬럼**: `snake_case`를 사용합니다 (예: `user_id`, `created_at`).

## 4. JavaScript/Node.js 컨벤션

*   **모듈 시스템**: `package.json`에 `type: "module"`이 설정되어 있으므로 ES 모듈 (`import`/`export`)을 사용합니다.
*   **세미콜론**: 항상 세미콜론을 사용합니다.
*   **들여쓰기**: 4칸 공백 들여쓰기를 사용합니다.
*   **화살표 함수**: 콜백 함수에 `function` 키워드 대신 화살표 함수를 선호합니다.
*   **비동기 처리**: `async/await`를 사용하여 비동기 코드를 처리합니다. `Promise` 기반 API를 사용하고, `try-catch` 블록으로 오류를 적절히 처리합니다.
*   **오류 처리**: Express 미들웨어에서 `next(error)`를 사용하여 중앙 집중식 오류 처리기로 에러를 전달합니다.
*   **API 응답**: 일관된 JSON 응답 형식을 유지합니다. 성공 시에는 `status: 'success'` 또는 데이터만, 실패 시에는 `status: 'error'`, `message`, `statusCode` 등을 포함합니다.
*   **로깅**: `console.log` 대신 `winston` 또는 유사한 로깅 라이브러리를 사용하여 일관된 로깅 전략을 구현합니다. (현재는 `console.log`가 사용되지만, 규모가 커지면 로깅 라이브러리 도입을 고려합니다.)

## 5. 주석

*   **코드 설명**: 복잡하거나 중요한 로직에는 설명을 위한 주석을 추가합니다.
*   **TODO 주석**: 앞으로 해야 할 작업에 대해서는 `TODO:` 키워드를 사용한 주석을 남깁니다.

## 6. 보안

*   **환경 변수**: 민감한 정보(DB 비밀번호, JWT 시크릿 등)는 `.env` 파일을 통해 환경 변수로 관리하고, `.gitignore`에 추가하여 버전 관리에서 제외합니다.
*   **입력 유효성 검사**: 사용자 입력을 항상 유효성 검사합니다 (예: `express-validator`).
*   **SQL 인젝션 방지**: 데이터베이스 쿼리 시 항상 준비된 문(Prepared Statements) 또는 ORM을 사용하여 SQL 인젝션을 방지합니다. (현재 `mariadb` 또는 `mysql2` 라이브러리의 `?` 플레이스홀더를 사용)
*   **인증 및 인가**: JWT를 사용하여 사용자 인증을 처리하고, 역할 기반 접근 제어(RBAC) 미들웨어를 사용하여 인가를 구현합니다.
