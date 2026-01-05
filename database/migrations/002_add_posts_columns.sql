-- posts 테이블에 필요한 컬럼 추가
-- corporatehyunillaw_test 데이터베이스에 실행하세요
-- 이미 컬럼이 존재하면 에러가 발생할 수 있습니다 (무시하고 진행하세요)

USE corporatehyunillaw_test;

-- 답변 관련 컬럼 추가 (기존 reply, repliedAt도 유지)
-- 각 컬럼을 개별적으로 추가 (이미 존재하면 에러 발생하지만 괜찮습니다)

-- answer 컬럼 추가
ALTER TABLE posts ADD COLUMN `answer` TEXT COMMENT '답변 내용';

-- answeredAt 컬럼 추가
ALTER TABLE posts ADD COLUMN `answeredAt` DATETIME COMMENT '답변 시간';

-- answeredBy 컬럼 추가
ALTER TABLE posts ADD COLUMN `answeredBy` VARCHAR(100) COMMENT '답변자 이름';

-- managerName 컬럼 추가
ALTER TABLE posts ADD COLUMN `managerName` VARCHAR(100) COMMENT '담당자 이름';

-- authorBizNum 컬럼 추가
ALTER TABLE posts ADD COLUMN `authorBizNum` VARCHAR(50) COMMENT '작성자 사업자번호';

-- authorDepartment 컬럼 추가
ALTER TABLE posts ADD COLUMN `authorDepartment` VARCHAR(100) COMMENT '작성자 부서';

-- authorManager 컬럼 추가
ALTER TABLE posts ADD COLUMN `authorManager` VARCHAR(100) COMMENT '작성자 담당자명';

-- 기존 reply 데이터를 answer로 복사
UPDATE posts SET answer = reply WHERE reply IS NOT NULL AND (answer IS NULL OR answer = '');
UPDATE posts SET answeredAt = repliedAt WHERE repliedAt IS NOT NULL AND answeredAt IS NULL;

-- 컬럼 확인
SHOW COLUMNS FROM posts;
