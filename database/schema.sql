-- ============================================================
-- 법무법인 현일 - 기업자문 시스템 데이터베이스 스키마
-- ============================================================

-- users 테이블 생성
CREATE TABLE IF NOT EXISTS users (
    uid VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    managerName VARCHAR(100),
    companyName VARCHAR(200),
    bizNum VARCHAR(50),
    phone VARCHAR(50),
    department VARCHAR(100),

    -- 권한 및 플랜
    role ENUM('owner', 'manager', 'user', 'staff', 'admin', 'master', 'general_manager', 'lawyer') DEFAULT 'user',
    plan ENUM('none', 'Basic', 'Standard', 'Pro', 'Premium', 'Enterprise') DEFAULT 'none',

    -- 상태 관리
    isActive TINYINT(1) DEFAULT 1,
    status VARCHAR(50) DEFAULT 'Active',

    -- 사용량 카운터
    qaUsedCount INT DEFAULT 0,
    phoneUsedCount INT DEFAULT 0,

    -- Enterprise 플랜 커스텀 한도
    customQaLimit INT DEFAULT 0,
    customPhoneLimit INT DEFAULT 0,
    customLimit INT DEFAULT 0,

    -- 계약 정보
    contractStartDate DATE,
    contractEndDate DATE,
    autoRenewal TINYINT(1) DEFAULT 0,

    -- 로그 (JSON 형식)
    logs JSON,

    -- 타임스탬프
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    lastLoginAt DATETIME,

    INDEX idx_bizNum (bizNum),
    INDEX idx_role (role),
    INDEX idx_plan (plan),
    INDEX idx_status (status),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- admin_logs 테이블 생성
CREATE TABLE IF NOT EXISTS admin_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    adminUid VARCHAR(36) NOT NULL,
    adminName VARCHAR(100),
    targetType VARCHAR(50),
    targetId VARCHAR(100),
    action VARCHAR(100),
    description TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_adminUid (adminUid),
    INDEX idx_targetType (targetType),
    INDEX idx_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- posts 테이블 생성 (자문 내역)
CREATE TABLE IF NOT EXISTS posts (
    docId VARCHAR(36) PRIMARY KEY,
    uid VARCHAR(36) NOT NULL,
    bizNum VARCHAR(50),
    category VARCHAR(50),
    department VARCHAR(100),
    title VARCHAR(500),
    content TEXT,
    status VARCHAR(50) DEFAULT 'Pending',
    priority VARCHAR(20),
    assignedTo VARCHAR(100),
    answer TEXT,
    answeredBy VARCHAR(100),
    answeredAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_uid (uid),
    INDEX idx_bizNum (bizNum),
    INDEX idx_category (category),
    INDEX idx_status (status),
    INDEX idx_createdAt (createdAt),
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- reports 테이블 생성
CREATE TABLE IF NOT EXISTS reports (
    docId VARCHAR(36) PRIMARY KEY,
    uid VARCHAR(36) NOT NULL,
    bizNum VARCHAR(50),
    companyName VARCHAR(200),
    reportType VARCHAR(50),
    filePath VARCHAR(500),
    sentAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_uid (uid),
    INDEX idx_bizNum (bizNum),
    INDEX idx_createdAt (createdAt),
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- billing_logs 테이블 생성 (청구서/영수증 발송 이력)
CREATE TABLE IF NOT EXISTS billing_logs (
    docId VARCHAR(36) PRIMARY KEY,
    uid VARCHAR(36) NOT NULL,
    bizNum VARCHAR(50),
    companyName VARCHAR(200),
    type ENUM('BILL', 'RECEIPT') NOT NULL,
    title VARCHAR(500),
    amount DECIMAL(15, 2),
    linkedToPayment TINYINT(1) DEFAULT 0,
    paymentId VARCHAR(36),
    status VARCHAR(50) DEFAULT 'sent',
    sentAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_uid (uid),
    INDEX idx_bizNum (bizNum),
    INDEX idx_type (type),
    INDEX idx_sentAt (sentAt),
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- payments 테이블 생성
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid VARCHAR(36) NOT NULL,
    bizNum VARCHAR(50),
    amount DECIMAL(15, 2),
    status VARCHAR(50),
    paymentDate DATE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_uid (uid),
    INDEX idx_bizNum (bizNum),
    INDEX idx_paymentDate (paymentDate),
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- litigation_cases 테이블 생성 (전자소송 사건)
CREATE TABLE IF NOT EXISTS litigation_cases (
    docId VARCHAR(36) PRIMARY KEY,
    uid VARCHAR(36),
    caseNumber VARCHAR(100),
    caseType VARCHAR(100),
    court VARCHAR(200),
    plaintiff TEXT,
    defendant TEXT,
    status VARCHAR(50),
    filingDate DATE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_uid (uid),
    INDEX idx_caseNumber (caseNumber),
    INDEX idx_status (status),
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- debt_cases 테이블 생성 (채권추심 사건)
CREATE TABLE IF NOT EXISTS debt_cases (
    docId VARCHAR(36) PRIMARY KEY,
    uid VARCHAR(36),
    clientName VARCHAR(200),
    debtorName VARCHAR(200),
    amount DECIMAL(15, 2),
    status VARCHAR(50),
    consultDate DATE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_uid (uid),
    INDEX idx_status (status),
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- pasan_cases 테이블 생성 (파산/회생 사건)
CREATE TABLE IF NOT EXISTS pasan_cases (
    docId VARCHAR(36) PRIMARY KEY,
    uid VARCHAR(36),
    clientName VARCHAR(200),
    caseType VARCHAR(50),
    status VARCHAR(50),
    consultDate DATE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_uid (uid),
    INDEX idx_status (status),
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- consultation_inquiries 테이블 생성 (상담 문의)
CREATE TABLE IF NOT EXISTS consultation_inquiries (
    docId VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    consultType VARCHAR(100),
    content TEXT,
    status VARCHAR(50) DEFAULT 'Pending',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_status (status),
    INDEX idx_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- biz_soda_requests 테이블 생성
CREATE TABLE IF NOT EXISTS biz_soda_requests (
    docId VARCHAR(36) PRIMARY KEY,
    uid VARCHAR(36) NOT NULL,
    bizNum VARCHAR(50),
    requestType VARCHAR(100),
    companyName VARCHAR(200),
    targetName VARCHAR(200),
    purpose TEXT,
    status VARCHAR(50) DEFAULT 'Pending',
    result TEXT,
    submittedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_uid (uid),
    INDEX idx_bizNum (bizNum),
    INDEX idx_status (status),
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- leave_requests 테이블 생성 (휴가 신청)
CREATE TABLE IF NOT EXISTS leave_requests (
    docId VARCHAR(36) PRIMARY KEY,
    uid VARCHAR(36) NOT NULL,
    leaveType VARCHAR(50),
    startDate DATE,
    endDate DATE,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'Pending',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_uid (uid),
    INDEX idx_status (status),
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- expenses 테이블 생성 (경비)
CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid VARCHAR(36) NOT NULL,
    category VARCHAR(100),
    amount DECIMAL(15, 2),
    description TEXT,
    expenseDate DATE,
    status VARCHAR(50) DEFAULT 'Pending',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_uid (uid),
    INDEX idx_status (status),
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- credit_reports 테이블 생성 (신용 조회)
CREATE TABLE IF NOT EXISTS credit_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid VARCHAR(36) NOT NULL,
    targetName VARCHAR(200),
    reportData TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_uid (uid),
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- service_prices 테이블 생성 (서비스 기본 단가 관리)
CREATE TABLE IF NOT EXISTS service_prices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(50) NOT NULL UNIQUE,
    price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
