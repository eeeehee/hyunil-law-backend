-- posts 테이블 컬럼 추가 (간단 버전)
-- corporatehyunillaw_test 데이터베이스에서 실행하세요
-- 각 명령을 하나씩 실행하세요

USE corporatehyunillaw_test;

-- 1. 현재 posts 테이블 구조 확인
SHOW COLUMNS FROM posts;

-- 2. answer 컬럼 추가 (이미 있으면 에러 발생 - 무시하세요)
ALTER TABLE posts ADD COLUMN answer TEXT;

-- 3. answeredAt 컬럼 추가
ALTER TABLE posts ADD COLUMN answeredAt DATETIME;

-- 4. answeredBy 컬럼 추가
ALTER TABLE posts ADD COLUMN answeredBy VARCHAR(100);

-- 5. managerName 컬럼 추가
ALTER TABLE posts ADD COLUMN managerName VARCHAR(100);

-- 6. authorBizNum 컬럼 추가
ALTER TABLE posts ADD COLUMN authorBizNum VARCHAR(50);

-- 7. authorDepartment 컬럼 추가
ALTER TABLE posts ADD COLUMN authorDepartment VARCHAR(100);

-- 8. authorManager 컬럼 추가
ALTER TABLE posts ADD COLUMN authorManager VARCHAR(100);

-- 9. 기존 reply 데이터를 answer로 복사
UPDATE posts SET answer = reply WHERE reply IS NOT NULL AND (answer IS NULL OR answer = '');

-- 10. 기존 repliedAt 데이터를 answeredAt로 복사
UPDATE posts SET answeredAt = repliedAt WHERE repliedAt IS NOT NULL AND answeredAt IS NULL;

-- 11. 최종 확인
SHOW COLUMNS FROM posts;
SELECT docId, title, status,
       CASE WHEN answer IS NOT NULL THEN 'O' ELSE 'X' END as has_answer,
       CASE WHEN reply IS NOT NULL THEN 'O' ELSE 'X' END as has_reply,
       managerName, answeredBy
FROM posts
LIMIT 5;
