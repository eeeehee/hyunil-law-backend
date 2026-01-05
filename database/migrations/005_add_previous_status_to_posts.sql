-- 005_add_previous_status_to_posts.sql
-- posts 테이블에 previousStatus 컬럼 추가 (숨기기 전 상태 저장용)

ALTER TABLE posts
ADD COLUMN previousStatus VARCHAR(50) DEFAULT NULL COMMENT '숨기기 전 원래 상태값';

ALTER TABLE posts
ADD INDEX idx_previousStatus (previousStatus);
