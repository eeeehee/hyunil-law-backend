import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';

const router = express.Router();

// ============================================================
// 관리자 전용 API 라우터
// ============================================================

// 전체 회사(owner) 목록 조회 (멀티테넌트 데이터 포함)
router.get('/companies', authenticateToken, requireRole('master', 'admin', 'general_manager', 'lawyer'), async (req, res) => {
    try {
        const { status, search } = req.query;

        // ✅ N+1 쿼리 제거: LEFT JOIN으로 한 번에 직원 수 조회
        let sql = `
            SELECT
                u1.uid, u1.email, u1.company_name, u1.manager_name, u1.biz_num, u1.phone,
                u1.role, u1.plan, u1.qa_used_count, u1.phone_used_count,
                u1.custom_qa_limit, u1.custom_phone_limit, u1.customLimit,
                u1.contractStartDate, u1.contract_end_date, u1.autoRenewal,
                u1.created_at, u1.lastLoginAt, u1.logs,
                COUNT(u2.uid) as employeeCount
            FROM users u1
            LEFT JOIN users u2 ON u1.biz_num = u2.biz_num
                AND u2.role IN ('owner', 'manager', 'user', 'staff')
            WHERE u1.role IN ('owner', 'master')
        `;
        const params = [];

        if (search) {
            sql += ` AND (u1.company_name LIKE ? OR u1.manager_name LIKE ? OR u1.biz_num LIKE ?)`;
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        sql += ` GROUP BY u1.uid ORDER BY u1.created_at DESC`;

        const rows = await query(sql, params);

        // ✅ 단순 매핑만 수행 (추가 쿼리 없음)
        const companies = rows.map(row => ({
            uid: row.uid,
            email: row.email,
            companyName: row.company_name,
            managerName: row.manager_name,
            bizNum: row.biz_num,
            phone: row.phone,
            role: row.role,
            plan: row.plan,
            qaUsedCount: row.qa_used_count,
            phoneUsedCount: row.phone_used_count,
            customQaLimit: row.custom_qa_limit,
            customPhoneLimit: row.custom_phone_limit,
            customLimit: row.customLimit,
            contractStartDate: row.contractStartDate,
            contractEndDate: row.contract_end_date,
            autoRenewal: row.autoRenewal,
            createdAt: row.created_at,
            lastLoginAt: row.lastLoginAt,
            logs: row.logs,
            employeeCount: Number(row.employeeCount) || 0
        }));

        res.json({ companies });
    } catch (error) {
        console.error('회사 목록 조회 에러:', error);
        res.status(500).json({
            error: 'DatabaseError',
            message: '회사 목록을 불러올 수 없습니다.',
            detail: error.message,
            sql: error.sql || null
        });
    }
});

// 특정 회사의 소속 직원 목록 조회
router.get('/companies/:bizNum/employees', authenticateToken, requireRole('master', 'admin', 'general_manager', 'lawyer'), async (req, res) => {
    try {
        const { bizNum } = req.params;

        // 1. Get the owner's plan for this bizNum
        const [owner] = await query(
            `SELECT plan FROM users WHERE biz_num = ? AND role = 'owner' LIMIT 1`,
            [bizNum]
        );
        const companyPlan = owner ? owner.plan : 'none';

        // 2. Get the employees (and their individual plans)
        const rows = await query(
            `SELECT uid, email, manager_name, department, role, phone, created_at, plan
             FROM users
             WHERE biz_num = ? AND role IN ('owner', 'manager', 'user', 'staff')
             ORDER BY created_at DESC`,
            [bizNum]
        );

        const employees = rows.map(row => ({
            uid: row.uid,
            email: row.email,
            managerName: row.manager_name,
            department: row.department,
            role: row.role,
            phone: row.phone,
            createdAt: row.created_at,
            plan: row.plan // individual employee's plan
        }));
        
        // 3. Return both employees and the company's plan
        res.json({ employees, companyPlan });
    } catch (error) {
        console.error('직원 목록 조회 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '직원 목록을 불러올 수 없습니다.' });
    }
});

// ✅ 여러 회사의 직원 목록 일괄 조회 (성능 최적화)
router.post('/employees/batch', authenticateToken, requireRole('master', 'admin', 'general_manager', 'lawyer'), async (req, res) => {
    try {
        const { bizNums } = req.body;

        if (!Array.isArray(bizNums) || bizNums.length === 0) {
            return res.status(400).json({ error: 'InvalidInput', message: 'bizNums 배열이 필요합니다.' });
        }

        // IN 절로 한 번에 모든 직원 조회
        const placeholders = bizNums.map(() => '?').join(', ');
        const rows = await query(
            `SELECT uid, email, manager_name, department, role, phone, created_at, plan, biz_num
             FROM users
             WHERE biz_num IN (${placeholders}) AND role IN ('owner', 'manager', 'user', 'staff')
             ORDER BY biz_num, created_at DESC`,
            bizNums
        );

        // 사업자번호별로 오너 플랜 맵 생성
        const ownerPlans = {};
        rows.forEach(row => {
            if (row.role === 'owner') {
                ownerPlans[row.biz_num] = row.plan;
            }
        });

        // 사업자번호별로 직원 목록 그룹핑
        const employeesByBizNum = {};
        rows.forEach(row => {
            if (!employeesByBizNum[row.biz_num]) {
                employeesByBizNum[row.biz_num] = [];
            }
            employeesByBizNum[row.biz_num].push({
                uid: row.uid,
                email: row.email,
                managerName: row.manager_name,
                department: row.department,
                role: row.role,
                phone: row.phone,
                createdAt: row.created_at,
                plan: row.plan
            });
        });

        res.json({ employeesByBizNum, ownerPlans });
    } catch (error) {
        console.error('일괄 직원 목록 조회 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '직원 목록을 불러올 수 없습니다.' });
    }
});

// 회사 플랜 변경
router.put('/companies/:uid/plan', authenticateToken, requireRole('master', 'admin'), async (req, res) => {
    try {
        const { uid } = req.params;
        const { plan } = req.body;

        const validPlans = ['none', 'Basic', 'Standard', 'Pro', 'Premium', 'Enterprise'];
        if (!validPlans.includes(plan)) {
            return res.status(400).json({ error: 'InvalidPlan', message: '유효하지 않은 플랜입니다.' });
        }

        await query(
            `UPDATE users SET plan = ? WHERE uid = ?`,
            [plan, uid]
        );

        // 로그 추가
        await addAdminLog(req.user.uid, req.user.managerName || req.user.manager_name, 'user', uid, 'PLAN_CHANGE', `플랜을 ${plan}으로 변경`);

        res.json({ message: '플랜이 변경되었습니다.', plan });
    } catch (error) {
        console.error('플랜 변경 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '플랜 변경에 실패했습니다.' });
    }
});

// 회사 활성화 상태 변경
router.put('/companies/:uid/status', authenticateToken, requireRole('master', 'admin'), async (req, res) => {
    try {
        const { uid } = req.params;
        const { isActive } = req.body;

        const updates = [];
        const params = [];

        if (typeof isActive !== 'undefined') {
            updates.push('status = ?');
            params.push(isActive ? 'Active' : 'Inactive');
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'NoUpdates', message: '변경할 내용이 없습니다.' });
        }

        params.push(uid);

        await query(
            `UPDATE users SET ${updates.join(', ')} WHERE uid = ?`,
            params
        );

        const action = isActive ? '활성화' : '비활성화';
        await addAdminLog(req.user.uid, req.user.managerName || req.user.manager_name, 'user', uid, 'STATUS_CHANGE', `회사 계정 ${action}`);

        res.json({ message: '상태가 변경되었습니다.' });
    } catch (error) {
        console.error('상태 변경 에러:', error);
        res.status(500).json({
            error: 'DatabaseError',
            message: '상태 변경에 실패했습니다.',
            detail: error.message,
            sql: error.sql || null
        });
    }
});

// 회사 정보 수정
router.put('/companies/:uid', authenticateToken, requireRole('master', 'admin'), async (req, res) => {
    try {
        const { uid } = req.params;
        const {
            managerName,
            phone,
            email,
            bizNum,
            contractStartDate,
            contractEndDate,
            autoRenewal,
            customLimit,
            status,
            isActive
        } = req.body;

        const updates = [];
        const values = [];

        if (managerName !== undefined) { updates.push('manager_name = ?'); values.push(managerName); }
        if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
        if (email !== undefined) { updates.push('email = ?'); values.push(email); }
        if (bizNum !== undefined) { updates.push('biz_num = ?'); values.push(bizNum); }
        if (contractStartDate !== undefined) { updates.push('contractStartDate = ?'); values.push(contractStartDate); }
        if (contractEndDate !== undefined) { updates.push('contractEndDate = ?'); values.push(contractEndDate); }
        if (autoRenewal !== undefined) { updates.push('autoRenewal = ?'); values.push(autoRenewal ? 1 : 0); }
        if (customLimit !== undefined) { updates.push('customLimit = ?'); values.push(customLimit || 0); }
        if (status !== undefined) { updates.push('status = ?'); values.push(status); }
        if (isActive !== undefined) { updates.push('isActive = ?'); values.push(isActive ? 1 : 0); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'NoUpdate', message: '수정할 내용이 없습니다.' });
        }

        values.push(uid);

        await query(
            `UPDATE users SET ${updates.join(', ')} WHERE uid = ?`,
            values
        );

        await addAdminLog(req.user.uid, req.user.managerName || req.user.manager_name, 'user', uid, 'INFO_UPDATE', '회사 정보 수정');

        res.json({ message: '회사 정보가 수정되었습니다.' });
    } catch (error) {
        console.error('회사 정보 수정 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '회사 정보 수정에 실패했습니다.', detail: error.message, sql: error.sql || null });
    }
});

// 사용량 카운터 증가 (서면 자문, 전화 상담)
router.post('/companies/:uid/increment-usage', authenticateToken, requireRole('master', 'admin', 'lawyer'), async (req, res) => {
    try {
        const { uid } = req.params;
        const { type } = req.body; // 'qa' 또는 'phone'

        if (!['qa', 'phone'].includes(type)) {
            return res.status(400).json({ error: 'InvalidType', message: '유효하지 않은 타입입니다.' });
        }

        const field = type === 'qa' ? 'qaUsedCount' : 'phoneUsedCount';

        await query(
            `UPDATE users SET ${field} = ${field} + 1 WHERE uid = ?`,
            [uid]
        );

        const action = type === 'qa' ? '서면 자문 횟수 차감' : '전화 상담 횟수 차감';
        await addAdminLog(req.user.uid, req.user.managerName || req.user.manager_name, 'user', uid, 'USAGE_INCREMENT', action);

        res.json({ message: '사용량이 증가되었습니다.' });
    } catch (error) {
        console.error('사용량 증가 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '사용량 증가에 실패했습니다.' });
    }
});

// Enterprise 플랜 한도 수정
router.put('/companies/:uid/limits', authenticateToken, requireRole('master', 'admin'), async (req, res) => {
    try {
        const { uid } = req.params;
        const { customQaLimit, customPhoneLimit } = req.body;

        await query(
            `UPDATE users SET customQaLimit = ?, customPhoneLimit = ? WHERE uid = ?`,
            [customQaLimit || 0, customPhoneLimit || 0, uid]
        );

        await addAdminLog(req.user.uid, req.user.managerName || req.user.manager_name, 'user', uid, 'LIMIT_UPDATE', `Enterprise 한도 수정: 서면 ${customQaLimit}, 전화 ${customPhoneLimit}`);

        res.json({ message: '한도가 수정되었습니다.' });
    } catch (error) {
        console.error('한도 수정 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '한도 수정에 실패했습니다.' });
    }
});

// 직원 권한 중지/복구


// 직원 개별 등록 (관리자 전용)
router.post('/employees', authenticateToken, requireRole('master', 'admin', 'general_manager'), async (req, res) => {
    try {
        const {
            email,
            password,
            managerName,
            department,
            phone,
            role = 'user',
            bizNum
        } = req.body;

        // 필수값 체크
        if (!email || !password || !managerName || !bizNum) {
            return res.status(400).json({
                error: 'MissingFields',
                message: '필수 항목이 누락되었습니다.'
            });
        }

        // 이메일 중복 체크
        const exists = await query(
            'SELECT uid FROM users WHERE email = ? LIMIT 1',
            [email]
        );
        if (exists.length > 0) {
            return res.status(409).json({
                error: 'EmailExists',
                message: '이미 등록된 이메일입니다.'
            });
        }

        // 비밀번호 해싱
        const passwordHash = await bcrypt.hash(password, 10);

        // UID 생성
        const uid = uuidv4();

        // 회사명 조회 (대표(owner) 계정에서 가져오기)
        const companyRows = await query(
            `SELECT company_name, representative_name, company_phone
             FROM users
             WHERE biz_num = ? AND role = 'owner'
             LIMIT 1`,
            [bizNum]
        );

        const companyName = companyRows?.[0]?.company_name || null;
        const representativeName = companyRows?.[0]?.representative_name || null;
        const companyPhone = companyRows?.[0]?.company_phone || null;
        if (!companyName) {
            return res.status(400).json({
                error: 'CompanyNotFound',
                message: '해당 사업자번호의 회사(대표) 정보가 없습니다. 먼저 회사 계정을 생성하세요.'
            });
        }

        if (!representativeName) {
            return res.status(400).json({
                error: 'RepresentativeNotFound',
                message: '회사 대표자 정보(representative_name)가 없어 직원 등록을 진행할 수 없습니다. 대표(회사) 계정 정보를 확인하세요.'
            });
        }


        // 직원 생성
        await query(
            `INSERT INTO users
             (uid, email, password_hash, company_name, representative_name, company_phone, manager_name, department, phone, role, biz_num, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                uid,
                email,
                passwordHash,
                companyName,
                representativeName,
                companyPhone,
                managerName,
                department || '전사',
                phone || null,
                role,
                bizNum
            ]
        );
// 관리자 로그
        await addAdminLog(
            req.user.uid,
            req.user.managerName || req.user.manager_name,
            'user',
            uid,
            'EMPLOYEE_CREATE',
            `직원 생성 (${email})`
        );

        res.status(201).json({
            message: '직원이 성공적으로 등록되었습니다.',
            employee: {
                uid,
                email,
                managerName,
                department: department || '전사',
                phone: phone || '',
                role,
                bizNum
            }
        });
    } catch (error) {
        console.error('직원 생성 에러:', error);
        res.status(500).json({
            error: 'EmployeeCreateFailed',
            message: '직원 생성 중 오류가 발생했습니다.'
        });
    }
});


router.put('/employees/:uid/suspend', authenticateToken, requireRole('master', 'admin', 'general_manager'), async (req, res) => {
    try {
        const { uid } = req.params;
        const { suspend } = req.body; // true: 중지, false: 복구

        console.log('[권한중지 요청]', { uid, suspend, isActive: suspend ? 0 : 1 });

        const newStatus = suspend ? 'Suspended' : 'Active';

        const result = await query(
            `UPDATE users SET status = ? WHERE uid = ?`,
            [newStatus, uid]
        );

        console.log('[권한중지 쿼리 결과]', result);

        const action = suspend ? '권한 중지' : '권한 복구';

        // 로그 추가 실패해도 계속 진행
        try {
            await addAdminLog(req.user.uid, req.user.managerName || req.user.manager_name || 'admin', 'user', uid, 'EMPLOYEE_SUSPEND', action);
        } catch (logError) {
            console.error('관리자 로그 추가 실패 (무시):', logError);
        }

        res.json({ message: `직원 ${action}이 완료되었습니다.` });
    } catch (error) {
        console.error('직원 상태 변경 에러:', error);
        console.error('에러 상세:', error.message, error.code, error.sqlMessage);
        res.status(500).json({
            error: 'DatabaseError',
            message: '직원 상태 변경에 실패했습니다.',
            detail: error.message
        });
    }
});

// 직원 정보 수정
router.put('/employees/:uid', authenticateToken, requireRole('master', 'admin', 'general_manager', 'owner'), async (req, res) => {
    try {
        const { uid } = req.params;
        const { managerName, department, role, email } = req.body;

        const updates = [];
        const values = [];

        if (managerName !== undefined) {
            updates.push('manager_name = ?');
            values.push(managerName);
        }
        if (department !== undefined) {
            updates.push('department = ?');
            values.push(department);
        }
        if (role !== undefined) {
            updates.push('role = ?');
            values.push(role);
        }
        if (email !== undefined) {
            updates.push('email = ?');
            values.push(email);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'NoUpdates', message: '수정할 내용이 없습니다.' });
        }

        values.push(uid);

        await query(
            `UPDATE users SET ${updates.join(', ')} WHERE uid = ?`,
            values
        );

        await addAdminLog(req.user.uid, req.user.managerName || req.user.manager_name, 'user', uid, 'EMPLOYEE_UPDATE', '직원 정보 수정');

        res.json({ message: '직원 정보가 수정되었습니다.' });
    } catch (error) {
        console.error('직원 정보 수정 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '직원 정보 수정에 실패했습니다.' });
    }
});

// 회사 로그 추가 (관리자용)
router.post('/companies/:uid/logs', authenticateToken, requireRole('master', 'admin'), async (req, res) => {
    try {
        const { uid } = req.params;
        const { message } = req.body;

        // users 테이블의 logs JSON 필드에 추가
        const logEntry = {
            date: new Date().toISOString(),
            msg: `${message} - by ${req.user.managerName || 'Admin'}`
        };

        await query(
            `UPDATE users SET
                logs = JSON_ARRAY_APPEND(COALESCE(logs, JSON_ARRAY()), '$', JSON_OBJECT('date', ?, 'msg', ?))
            WHERE uid = ?`,
            [logEntry.date, logEntry.msg, uid]
        );

        res.json({ message: '로그가 추가되었습니다.' });
    } catch (error) {
        console.error('로그 추가 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '로그 추가에 실패했습니다.' });
    }
});

// 관리자 작업 로그 조회
router.get('/logs', authenticateToken, requireRole('master', 'admin'), async (req, res) => {
    try {
        const { limit = 100, targetType, adminUid } = req.query;

        let sql = 'SELECT * FROM admin_logs WHERE 1=1';
        const params = [];

        if (targetType) {
            sql += ' AND targetType = ?';
            params.push(targetType);
        }

        if (adminUid) {
            sql += ' AND adminUid = ?';
            params.push(adminUid);
        }

        sql += ' ORDER BY createdAt DESC LIMIT ?';
        params.push(parseInt(limit));

        const logs = await query(sql, params);
        res.json({ logs });
    } catch (error) {
        console.error('로그 조회 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '로그를 불러올 수 없습니다.' });
    }
});

// ============================================================
// 헬퍼 함수
// ============================================================

async function addAdminLog(adminUid, adminName, targetType, targetId, action, description) {
    try {
        await query(
            `INSERT INTO admin_logs (adminUid, adminName, targetType, targetId, action, description, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [adminUid, adminName, targetType, targetId, action, description]
        );
    } catch (error) {
        console.error('관리자 로그 추가 에러:', error);
    }
}

export default router;
