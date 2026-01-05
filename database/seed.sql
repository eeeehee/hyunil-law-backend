-- ============================================================
-- 테스트 데이터 (관리자 계정 및 샘플 데이터)
-- ============================================================

-- 테스트 관리자 계정 생성 (비밀번호: admin123)
-- bcrypt 해시: $2b$10$6vZ8KVZqX7y5bH5QZy5QZeT7rZ9Y7fZ7fZ7fZ7fZ7fZ7fZ7fZ7fZ7
INSERT INTO users (uid, email, password, managerName, role, plan, isActive, status, createdAt)
VALUES
('admin-uid-001', 'admin@hyunillaw.com', '$2b$10$XG9hEqQbH0h9LKj7T0wKx.N6xK8BvKJvF8xQPk5C9L7pJ6zJ8N0Zy', '관리자', 'master', 'Enterprise', 1, 'Active', NOW())
ON DUPLICATE KEY UPDATE email = email;

-- 테스트 기업 계정 생성 (비밀번호: test123)
INSERT INTO users (uid, email, password, managerName, companyName, bizNum, phone, role, plan, isActive, status, qaUsedCount, phoneUsedCount, contractStartDate, contractEndDate, autoRenewal, createdAt)
VALUES
('company-uid-001', 'test@company1.com', '$2b$10$XG9hEqQbH0h9LKj7T0wKx.N6xK8BvKJvF8xQPk5C9L7pJ6zJ8N0Zy', '김대표', '테스트 기업 A', '123-45-67890', '02-1234-5678', 'owner', 'Standard', 1, 'Active', 5, 3, '2024-01-01', '2025-12-31', 1, NOW()),
('company-uid-002', 'test@company2.com', '$2b$10$XG9hEqQbH0h9LKj7T0wKx.N6xK8BvKJvF8xQPk5C9L7pJ6zJ8N0Zy', '이대표', '테스트 기업 B', '234-56-78901', '02-2345-6789', 'owner', 'Pro', 1, 'Active', 10, 7, '2024-03-01', '2025-12-31', 0, NOW()),
('company-uid-003', 'test@company3.com', '$2b$10$XG9hEqQbH0h9LKj7T0wKx.N6xK8BvKJvF8xQPk5C9L7pJ6zJ8N0Zy', '박대표', '테스트 기업 C', '345-67-89012', '02-3456-7890', 'owner', 'Basic', 1, 'Active', 2, 1, '2024-06-01', '2025-12-31', 1, NOW())
ON DUPLICATE KEY UPDATE email = email;

-- 테스트 직원 계정 생성
INSERT INTO users (uid, email, password, managerName, companyName, bizNum, department, role, plan, isActive, status, createdAt)
VALUES
('employee-uid-001', 'employee1@company1.com', '$2b$10$XG9hEqQbH0h9LKj7T0wKx.N6xK8BvKJvF8xQPk5C9L7pJ6zJ8N0Zy', '김직원', '테스트 기업 A', '123-45-67890', '법무팀', 'manager', 'Standard', 1, 'Active', NOW()),
('employee-uid-002', 'employee2@company1.com', '$2b$10$XG9hEqQbH0h9LKj7T0wKx.N6xK8BvKJvF8xQPk5C9L7pJ6zJ8N0Zy', '이직원', '테스트 기업 A', '123-45-67890', '총무팀', 'user', 'Standard', 1, 'Active', NOW()),
('employee-uid-003', 'employee3@company2.com', '$2b$10$XG9hEqQbH0h9LKj7T0wKx.N6xK8BvKJvF8xQPk5C9L7pJ6zJ8N0Zy', '박직원', '테스트 기업 B', '234-56-78901', '인사팀', 'user', 'Pro', 1, 'Active', NOW())
ON DUPLICATE KEY UPDATE email = email;

-- 테스트 자문 게시글 생성
INSERT INTO posts (docId, uid, bizNum, category, department, title, content, status, priority, createdAt)
VALUES
('post-uid-001', 'company-uid-001', '123-45-67890', '근로계약', '법무팀', '계약서 검토 요청', '신규 직원 계약서를 검토해주세요.', 'Pending', 'high', NOW()),
('post-uid-002', 'company-uid-001', '123-45-67890', '노무이슈', '인사팀', '퇴직금 관련 문의', '퇴직금 산정 방법에 대해 문의드립니다.', 'InProgress', 'medium', NOW()),
('post-uid-003', 'company-uid-002', '234-56-78901', '법인세무', '회계팀', '법인세 신고 관련', '법인세 신고 시 주의사항을 알려주세요.', 'Completed', 'low', NOW())
ON DUPLICATE KEY UPDATE docId = docId;

SELECT '✅ 테스트 데이터가 성공적으로 생성되었습니다!' AS message;
SELECT '' AS '';
SELECT '📧 테스트 계정 정보:' AS '';
SELECT '  - 관리자: admin@hyunillaw.com / admin123' AS '';
SELECT '  - 기업 1: test@company1.com / test123' AS '';
SELECT '  - 기업 2: test@company2.com / test123' AS '';
SELECT '  - 직원 1: employee1@company1.com / test123' AS '';
