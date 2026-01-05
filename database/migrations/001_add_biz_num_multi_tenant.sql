-- 001_add_biz_num_multi_tenant.sql
-- 멀티테넌트(회사/사업자번호) 격리를 위해 주요 업무 테이블에 biz_num 컬럼을 추가합니다.
-- 실행 전: 백업 권장

ALTER TABLE debt_cases ADD COLUMN biz_num varchar(20) NULL AFTER doc_id;
CREATE INDEX idx_debt_cases_biz_num ON debt_cases (biz_num);

ALTER TABLE pasan_cases ADD COLUMN biz_num varchar(20) NULL AFTER doc_id;
CREATE INDEX idx_pasan_cases_biz_num ON pasan_cases (biz_num);

ALTER TABLE litigation_cases ADD COLUMN biz_num varchar(20) NULL AFTER doc_id;
CREATE INDEX idx_litigation_cases_biz_num ON litigation_cases (biz_num);

ALTER TABLE consultation_inquiries ADD COLUMN biz_num varchar(20) NULL AFTER doc_id;
CREATE INDEX idx_consultation_inquiries_biz_num ON consultation_inquiries (biz_num);

ALTER TABLE consultations ADD COLUMN biz_num varchar(20) NULL AFTER doc_id;
CREATE INDEX idx_consultations_biz_num ON consultations (biz_num);

ALTER TABLE company_expenses ADD COLUMN biz_num varchar(20) NULL AFTER doc_id;
CREATE INDEX idx_company_expenses_biz_num ON company_expenses (biz_num);

ALTER TABLE leave_requests ADD COLUMN biz_num varchar(20) NULL AFTER doc_id;
CREATE INDEX idx_leave_requests_biz_num ON leave_requests (biz_num);

-- 기존 데이터가 이미 있다면, users 테이블의 biz_num을 기준으로 채워넣을 수 있습니다.
-- 아래 UPDATE들은 각 테이블에 "작성자/담당자" 컬럼이 있을 때만 의미가 있으므로,
-- 데이터 구조에 맞게 선택적으로 실행하세요.

-- 예) leave_requests.user_id = users.uid
-- UPDATE leave_requests lr
-- JOIN users u ON lr.user_id = u.uid
-- SET lr.biz_num = u.biz_num
-- WHERE lr.biz_num IS NULL;
