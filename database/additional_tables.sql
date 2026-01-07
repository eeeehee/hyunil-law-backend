-- 추가 테이블 생성 SQL
-- corporatehyunillaw_test 데이터베이스에 실행하세요

-- posts 테이블 (게시글/자문 내역)
CREATE TABLE IF NOT EXISTS `posts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `docId` VARCHAR(255) UNIQUE NOT NULL,
  `authorUid` VARCHAR(255) NOT NULL,
  `companyName` VARCHAR(255),
  `category` VARCHAR(50),
  `title` VARCHAR(500) NOT NULL,
  `content` TEXT,
  `fileUrls` JSON,
  `status` VARCHAR(50) DEFAULT 'waiting',
  `reply` TEXT,
  `repliedAt` DATETIME,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME,
  INDEX `idx_authorUid` (`authorUid`),
  INDEX `idx_companyName` (`companyName`),
  INDEX `idx_status` (`status`),
  INDEX `idx_category` (`category`),
  INDEX `idx_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- reports 테이블 (보고서)
CREATE TABLE IF NOT EXISTS `reports` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `docId` VARCHAR(255) UNIQUE NOT NULL,
  `companyName` VARCHAR(255),
  `title` VARCHAR(500) NOT NULL,
  `clientName` VARCHAR(255),
  `reportType` VARCHAR(50),
  `content` TEXT,
  `fileUrl` VARCHAR(1000),
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME,
  INDEX `idx_companyName` (`companyName`),
  INDEX `idx_reportType` (`reportType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- credit_reports 테이블 (신용 조회)
CREATE TABLE IF NOT EXISTS `credit_reports` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `docId` VARCHAR(255) UNIQUE NOT NULL,
  `companyName` VARCHAR(255),
  `clientName` VARCHAR(255) NOT NULL,
  `bizNum` VARCHAR(50),
  `reportType` VARCHAR(50),
  `status` VARCHAR(50) DEFAULT 'processing',
  `fileUrl` VARCHAR(1000),
  `createdAt` DATETIME NOT NULL,
  INDEX `idx_companyName` (`companyName`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- leave_requests 테이블 (휴가 신청) - 이미 존재한다면 건너뜀
CREATE TABLE IF NOT EXISTS `leave_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `docId` VARCHAR(255) UNIQUE NOT NULL,
  `requesterId` VARCHAR(255) NOT NULL,
  `requesterName` VARCHAR(255),
  `leaveType` VARCHAR(50),
  `startDate` DATE,
  `endDate` DATE,
  `reason` TEXT,
  `status` VARCHAR(50) DEFAULT 'pending',
  `approvedAt` DATETIME,
  `createdAt` DATETIME NOT NULL,
  INDEX `idx_requesterId` (`requesterId`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- company_expenses 테이블 (회사 경비) - 이미 존재한다면 건너뜀
CREATE TABLE IF NOT EXISTS `company_expenses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `docId` VARCHAR(255) UNIQUE NOT NULL,
  `companyName` VARCHAR(255),
  `category` VARCHAR(100),
  `amount` DECIMAL(15, 2),
  `description` TEXT,
  `expenseDate` DATE,
  `createdAt` DATETIME NOT NULL,
  INDEX `idx_companyName` (`companyName`),
  INDEX `idx_expenseDate` (`expenseDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- settings 테이블 (시스템 설정)
CREATE TABLE IF NOT EXISTS `settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `settingKey` VARCHAR(255) UNIQUE NOT NULL,
  `settingValue` TEXT,
  `description` VARCHAR(500),
  `updatedAt` DATETIME,
  INDEX `idx_settingKey` (`settingKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 테이블 생성 확인
SELECT 
    TABLE_NAME as '테이블명',
    TABLE_ROWS as '행수',
    ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) as '크기(MB)'
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'corporatehyunillaw_test'
    AND TABLE_NAME IN ('posts', 'reports', 'credit_reports', 'leave_requests', 'company_expenses', 'settings')
ORDER BY TABLE_NAME;
