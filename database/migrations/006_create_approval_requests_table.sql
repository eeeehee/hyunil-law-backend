-- ============================================================
-- 승인 요청 테이블 생성
-- 목적: 부서변경, 권한변경 등 각종 결재 요청 관리
-- ============================================================

USE corporatehyunillaw_test;

CREATE TABLE IF NOT EXISTS approval_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid VARCHAR(36) NOT NULL,                    -- 요청자 UID
    bizNum VARCHAR(50),                           -- 회사 사업자번호
    requestType VARCHAR(50) NOT NULL,             -- 요청 유형 (부서변경, 권한변경 등)
    requestData JSON,                             -- 요청 상세 정보 (fromDepartment, toDepartment 등)
    status VARCHAR(50) DEFAULT 'Pending',         -- Pending, Approved, Rejected
    approvedBy VARCHAR(36),                       -- 승인자 UID
    approvedAt DATETIME,                          -- 승인 시각
    rejectionReason TEXT,                         -- 거절 사유
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_uid (uid),
    INDEX idx_bizNum (bizNum),
    INDEX idx_status (status),
    INDEX idx_requestType (requestType),
    INDEX idx_createdAt (createdAt),
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 테스트 데이터는 실제 사용 시 추가
-- INSERT INTO approval_requests (uid, bizNum, requestType, requestData, status, createdAt)
-- VALUES (...)

SELECT '✅ approval_requests 테이블 생성 완료!' AS 'Status';
