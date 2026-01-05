-- service_prices 테이블 생성 (서비스 기본 단가 관리)
CREATE TABLE IF NOT EXISTS service_prices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(50) NOT NULL UNIQUE,
    price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 기본 데이터 삽입
INSERT INTO service_prices (type, price) VALUES
    ('oneTime', 110000),
    ('Basic', 110000),
    ('Standard', 330000),
    ('Pro', 550000),
    ('Premium', 990000)
ON DUPLICATE KEY UPDATE type=type;
