-- 관리자 화면 기능을 위한 추가 테이블 생성 SQL
-- corporatehyunillaw_test 데이터베이스에 실행하세요

-- biz_soda_requests 테이블 (비즈소다 조회 요청)
CREATE TABLE IF NOT EXISTS `biz_soda_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `docId` VARCHAR(255) UNIQUE NOT NULL,
  `type` VARCHAR(20) NOT NULL COMMENT 'BIZ, CEO, LEGAL',
  `requesterUid` VARCHAR(255),
  `requesterName` VARCHAR(255),
  `targetName` VARCHAR(255) NOT NULL COMMENT '조회 대상 기업/개인명',
  `targetId` VARCHAR(100) COMMENT '사업자번호 또는 주민번호',
  `status` VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, done, reviewing, rejected',
  `resultUrl` VARCHAR(1000),
  `adminComment` TEXT,
  `completedAt` DATETIME,
  `createdAt` DATETIME NOT NULL,
  INDEX `idx_type` (`type`),
  INDEX `idx_status` (`status`),
  INDEX `idx_requesterUid` (`requesterUid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- legal_asset_requests 테이블 (법적 자산 조회 요청 - Legal)
CREATE TABLE IF NOT EXISTS `legal_asset_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `docId` VARCHAR(255) UNIQUE NOT NULL,
  `requesterUid` VARCHAR(255),
  `requesterName` VARCHAR(255),
  `targetName` VARCHAR(255) NOT NULL COMMENT '채무자명',
  `targetId` VARCHAR(100) COMMENT '주민번호/사업자번호',
  `fileTitleUrl` VARCHAR(1000) COMMENT '집행권원 파일 URL',
  `fileNoticeUrl` VARCHAR(1000) COMMENT '사전통보 증빙 파일 URL',
  `status` VARCHAR(50) DEFAULT 'reviewing' COMMENT 'reviewing, approved, rejected',
  `bankInfo` TEXT COMMENT '은행 계좌 정보',
  `cardInfo` TEXT COMMENT '신용카드 정보',
  `assetInfo` TEXT COMMENT '기타 자산 정보',
  `resultUrl` VARCHAR(1000),
  `rejectReason` TEXT,
  `completedAt` DATETIME,
  `createdAt` DATETIME NOT NULL,
  INDEX `idx_status` (`status`),
  INDEX `idx_requesterUid` (`requesterUid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- billing_logs 테이블 (청구서/영수증 발송 로그)
CREATE TABLE IF NOT EXISTS `billing_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `docId` VARCHAR(255) UNIQUE NOT NULL,
  `companyName` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `type` VARCHAR(20) NOT NULL COMMENT 'BILL, RECEIPT',
  `amount` DECIMAL(15, 2) NOT NULL,
  `title` VARCHAR(500),
  `note` TEXT,
  `status` VARCHAR(50) DEFAULT 'sent' COMMENT 'sent, fail',
  `linkedToPayment` BOOLEAN DEFAULT FALSE COMMENT '매출 장부 연동 여부',
  `paymentId` VARCHAR(255) COMMENT '연동된 payment ID',
  `sentAt` DATETIME NOT NULL,
  INDEX `idx_companyName` (`companyName`),
  INDEX `idx_type` (`type`),
  INDEX `idx_status` (`status`),
  INDEX `idx_sentAt` (`sentAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- admin_logs 테이블 (관리자 작업 로그)
CREATE TABLE IF NOT EXISTS `admin_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `adminUid` VARCHAR(255) NOT NULL,
  `adminName` VARCHAR(255),
  `targetType` VARCHAR(50) COMMENT 'user, company, payment 등',
  `targetId` VARCHAR(255),
  `action` VARCHAR(100) NOT NULL COMMENT '수행한 작업',
  `description` TEXT,
  `ipAddress` VARCHAR(50),
  `createdAt` DATETIME NOT NULL,
  INDEX `idx_adminUid` (`adminUid`),
  INDEX `idx_targetType` (`targetType`),
  INDEX `idx_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- users 테이블에 추가 필드가 필요한 경우 (이미 존재하는 테이블이므로 ALTER 사용)
-- 요금제 관련
ALTER TABLE `users`
ADD COLUMN IF NOT EXISTS `plan` VARCHAR(50) DEFAULT 'none' COMMENT 'Basic, Standard, Pro, Premium, Enterprise',
ADD COLUMN IF NOT EXISTS `qaUsedCount` INT DEFAULT 0 COMMENT '서면 자문 사용 횟수',
ADD COLUMN IF NOT EXISTS `phoneUsedCount` INT DEFAULT 0 COMMENT '전화 상담 사용 횟수',
ADD COLUMN IF NOT EXISTS `customQaLimit` INT DEFAULT 0 COMMENT 'Enterprise용 커스텀 서면 한도',
ADD COLUMN IF NOT EXISTS `customPhoneLimit` INT DEFAULT 0 COMMENT 'Enterprise용 커스텀 전화 한도',
ADD COLUMN IF NOT EXISTS `customLimit` INT DEFAULT 0 COMMENT '커스텀 직원 수 한도',
ADD COLUMN IF NOT EXISTS `isActive` BOOLEAN DEFAULT TRUE COMMENT '활성화 상태',
ADD COLUMN IF NOT EXISTS `contractStartDate` DATE COMMENT '계약 시작일',
ADD COLUMN IF NOT EXISTS `contractEndDate` DATE COMMENT '계약 종료일',
ADD COLUMN IF NOT EXISTS `autoRenewal` BOOLEAN DEFAULT FALSE COMMENT '자동 갱신 여부',
ADD COLUMN IF NOT EXISTS `lastLoginAt` DATETIME COMMENT '마지막 로그인 시각',
ADD COLUMN IF NOT EXISTS `isFirstLogin` BOOLEAN DEFAULT TRUE COMMENT '첫 로그인 여부';

-- users 테이블에 logs JSON 필드 추가 (변경 이력 저장)
ALTER TABLE `users`
ADD COLUMN IF NOT EXISTS `logs` JSON COMMENT '변경 이력 로그 (JSON 배열)';

-- posts 테이블에 추가 필드
ALTER TABLE `posts`
ADD COLUMN IF NOT EXISTS `authorBizNum` VARCHAR(50) COMMENT '작성자 사업자번호',
ADD COLUMN IF NOT EXISTS `authorDepartment` VARCHAR(100) COMMENT '작성자 부서',
ADD COLUMN IF NOT EXISTS `authorManager` VARCHAR(100) COMMENT '작성자 담당자명',
ADD COLUMN IF NOT EXISTS `answer` TEXT COMMENT '관리자 답변',
ADD COLUMN IF NOT EXISTS `answeredAt` DATETIME COMMENT '답변 완료 시각',
ADD COLUMN IF NOT EXISTS `managerName` VARCHAR(100) COMMENT '작성자명';

-- posts 테이블에 인덱스 추가
ALTER TABLE `posts`
ADD INDEX IF NOT EXISTS `idx_authorBizNum` (`authorBizNum`);

-- 테이블 생성 확인
SELECT
    TABLE_NAME as '테이블명',
    TABLE_ROWS as '행수',
    ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) as '크기(MB)',
    CREATE_TIME as '생성일'
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'corporatehyunillaw_test'
    AND TABLE_NAME IN (
        'biz_soda_requests',
        'legal_asset_requests',
        'billing_logs',
        'admin_logs',
        'users',
        'posts'
    )
ORDER BY TABLE_NAME;
