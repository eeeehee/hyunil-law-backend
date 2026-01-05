USE corporatehyunillaw_test;

-- 매출/CMS 관리를 위한 payments 테이블
CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    docId VARCHAR(100) UNIQUE NOT NULL,
    companyName VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'advisory',
    plan VARCHAR(50),
    amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    method VARCHAR(50),
    status VARCHAR(50) DEFAULT 'scheduled',
    refundAmount DECIMAL(15, 2) DEFAULT 0,
    note TEXT,
    date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    refundedAt DATETIME,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_companyName (companyName),
    INDEX idx_status (status),
    INDEX idx_date (date),
    INDEX idx_plan (plan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- users 테이블에 구독 관련 컬럼 추가
ALTER TABLE users ADD COLUMN plan VARCHAR(50) DEFAULT 'none';
ALTER TABLE users ADD COLUMN custom_cost DECIMAL(15, 2);
ALTER TABLE users ADD COLUMN contract_end_date DATE;
ALTER TABLE users ADD COLUMN billing_cycle VARCHAR(20) DEFAULT 'monthly';
ALTER TABLE users ADD COLUMN custom_qa_limit INT DEFAULT 0;
ALTER TABLE users ADD COLUMN custom_phone_limit INT DEFAULT 0;
ALTER TABLE users ADD COLUMN qa_used_count INT DEFAULT 0;
ALTER TABLE users ADD COLUMN phone_used_count INT DEFAULT 0;

-- 기본 서비스 단가 설정을 위한 테이블
CREATE TABLE IF NOT EXISTS service_prices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(50) UNIQUE NOT NULL,
    price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    description VARCHAR(255),
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 기본 단가 초기 데이터
INSERT INTO service_prices (type, price, description) VALUES
('oneTime', 110000, '단기 자문 (1회)'),
('Basic', 110000, 'Basic 플랜'),
('Standard', 330000, 'Standard 플랜'),
('Pro', 550000, 'Pro 플랜'),
('Premium', 990000, 'Premium 플랜')
ON DUPLICATE KEY UPDATE price=VALUES(price);
