-- 마이그레이션: posts 테이블에 견적 관련 필드 추가
-- 작성일: 2025-01-01
-- 설명: 추가이용문의 견적 발송 기능을 위한 필드 추가

-- quotedPrice: 견적 금액
-- quotedAt: 견적 발송 일시
-- rejectReason: 견적 거절 사유

USE corporatehyunillaw_test;

-- 컬럼이 이미 존재하면 오류가 발생하지만 무시하고 진행합니다
ALTER TABLE posts
ADD COLUMN quotedPrice DECIMAL(15, 2) DEFAULT NULL COMMENT '견적 금액';

ALTER TABLE posts
ADD COLUMN quotedAt DATETIME DEFAULT NULL COMMENT '견적 발송 일시';

ALTER TABLE posts
ADD COLUMN rejectReason TEXT DEFAULT NULL COMMENT '견적 거절 사유';

-- 인덱스 추가 (이미 존재하면 오류 발생)
ALTER TABLE posts
ADD INDEX idx_quotedPrice (quotedPrice);

ALTER TABLE posts
ADD INDEX idx_quotedAt (quotedAt);
