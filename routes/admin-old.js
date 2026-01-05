const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// 관리자 전용 API 라우터
// ============================================================

// 전체 회사(owner) 목록 조회 (멀티테넌트 데이터 포함)
router.get('/companies', authenticateToken, requireRole(['master', 'admin', 'general_manager']), async (req, res) => {
    try {
        const { status, search } = req.query;

        let sql = `
            SELECT
                uid, email, companyName, managerName, bizNum, phone,
                role, plan, isActive, status,
                qaUsedCount, phoneUsedCount, customQaLimit, customPhoneLimit, customLimit,
                contractStartDate, contractEndDate, autoRenewal,
                createdAt, lastLoginAt, logs
            FROM users
            WHERE role = 'owner'
        `;
        const params = [];

        if (status) {
            sql += ` AND status = ?`;
            params.push(status);
        }

        if (search) {
            sql += ` AND (companyName LIKE ? OR managerName LIKE ? OR bizNum LIKE ?)`;
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        sql += ` ORDER BY createdAt DESC`;

        const companies = await query(sql, params);
        res.json({ companies });
    } catch (error) {
        console.error('회사 목록 조회 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '회사 목록을 불러올 수 없습니다.' });
    }
});

// 특정 회사의 소속 직원 목록 조회
router.get('/companies/:bizNum/employees', authenticateToken, requireRole(['master', 'admin', 'general_manager']), async (req, res) => {
    try {
        const { bizNum } = req.params;

        const employees = await query(
            `SELECT uid, email, managerName, department, role, phone, status, createdAt
             FROM users
             WHERE bizNum = ? AND role IN ('owner', 'manager', 'user', 'staff')
             ORDER BY createdAt DESC`,
            [bizNum]
        );

        res.json({ employees });
    } catch (error) {
        console.error('직원 목록 조회 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '직원 목록을 불러올 수 없습니다.' });
    }
});

// 회사 플랜 변경
router.put('/companies/:uid/plan', authenticateToken, requireRole(['master', 'admin']), async (req, res) => {
    try {
        const { uid } = req.params;
        const { plan } = req.body;

        const validPlans = ['none', 'Basic', 'Standard', 'Pro', 'Premium', 'Enterprise'];
        if (!validPlans.includes(plan)) {
            return res.status(400).json({ error: 'InvalidPlan', message: '유효하지 않은 플랜입니다.' });
        }

        await query(
            `UPDATE users SET plan = ?, updatedAt = NOW() WHERE uid = ?`,
            [plan, uid]
        );

        // 로그 추가
        await addAdminLog(req.user.uid, req.user.managerName, 'user', uid, 'PLAN_CHANGE', `플랜을 ${plan}으로 변경`);

        res.json({ message: '플랜이 변경되었습니다.', plan });
    } catch (error) {
        console.error('플랜 변경 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '플랜 변경에 실패했습니다.' });
    }
});

// 회사 활성화 상태 변경
router.put('/companies/:uid/status', authenticateToken, requireRole(['master', 'admin']), async (req, res) => {
    try {
        const { uid } = req.params;
        const { isActive, status } = req.body;

        const updates = [];
        const params = [];

        if (typeof isActive !== 'undefined') {
            updates.push('isActive = ?');
            params.push(isActive ? 1 : 0);
        }

        if (status) {
            updates.push('status = ?');
            params.push(status);
        }

        updates.push('updatedAt = NOW()');
        params.push(uid);

        await query(
            `UPDATE users SET ${updates.join(', ')} WHERE uid = ?`,
            params
        );

        const action = isActive ? '활성화' : '비활성화';
        await addAdminLog(req.user.uid, req.user.managerName, 'user', uid, 'STATUS_CHANGE', `회사 계정 ${action}`);

        res.json({ message: '상태가 변경되었습니다.' });
    } catch (error) {
        console.error('상태 변경 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '상태 변경에 실패했습니다.' });
    }
});

// 회사 정보 수정
router.put('/companies/:uid', authenticateToken, requireRole(['master', 'admin']), async (req, res) => {
    try {
        const { uid } = req.params;
        const {
            managerName,
            phone,
            bizNum,
            contractStartDate,
            contractEndDate,
            autoRenewal,
            customLimit
        } = req.body;

        await query(
            `UPDATE users SET
                managerName = ?,
                phone = ?,
                bizNum = ?,
                contractStartDate = ?,
                contractEndDate = ?,
                autoRenewal = ?,
                customLimit = ?,
                updatedAt = NOW()
            WHERE uid = ?`,
            [managerName, phone, bizNum, contractStartDate, contractEndDate, autoRenewal ? 1 : 0, customLimit || 0, uid]
        );

        await addAdminLog(req.user.uid, req.user.managerName, 'user', uid, 'INFO_UPDATE', '회사 정보 수정');

        res.json({ message: '회사 정보가 수정되었습니다.' });
    } catch (error) {
        console.error('회사 정보 수정 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '회사 정보 수정에 실패했습니다.' });
    }
});

// 사용량 카운터 증가 (서면 자문, 전화 상담)
router.post('/companies/:uid/increment-usage', authenticateToken, requireRole(['master', 'admin', 'lawyer']), async (req, res) => {
    try {
        const { uid } = req.params;
        const { type } = req.body; // 'qa' 또는 'phone'

        if (!['qa', 'phone'].includes(type)) {
            return res.status(400).json({ error: 'InvalidType', message: '유효하지 않은 타입입니다.' });
        }

        const field = type === 'qa' ? 'qaUsedCount' : 'phoneUsedCount';

        await query(
            `UPDATE users SET ${field} = ${field} + 1, updatedAt = NOW() WHERE uid = ?`,
            [uid]
        );

        const action = type === 'qa' ? '서면 자문 횟수 차감' : '전화 상담 횟수 차감';
        await addAdminLog(req.user.uid, req.user.managerName, 'user', uid, 'USAGE_INCREMENT', action);

        res.json({ message: '사용량이 증가되었습니다.' });
    } catch (error) {
        console.error('사용량 증가 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '사용량 증가에 실패했습니다.' });
    }
});

// Enterprise 플랜 한도 수정
router.put('/companies/:uid/limits', authenticateToken, requireRole(['master', 'admin']), async (req, res) => {
    try {
        const { uid } = req.params;
        const { customQaLimit, customPhoneLimit } = req.body;

        await query(
            `UPDATE users SET customQaLimit = ?, customPhoneLimit = ?, updatedAt = NOW() WHERE uid = ?`,
            [customQaLimit || 0, customPhoneLimit || 0, uid]
        );

        await addAdminLog(req.user.uid, req.user.managerName, 'user', uid, 'LIMIT_UPDATE', `Enterprise 한도 수정: 서면 ${customQaLimit}, 전화 ${customPhoneLimit}`);

        res.json({ message: '한도가 수정되었습니다.' });
    } catch (error) {
        console.error('한도 수정 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '한도 수정에 실패했습니다.' });
    }
});

// 직원 권한 중지/복구
router.put('/employees/:uid/suspend', authenticateToken, requireRole(['master', 'admin']), async (req, res) => {
    try {
        const { uid } = req.params;
        const { suspend } = req.body; // true: 중지, false: 복구

        const status = suspend ? 'Suspended' : 'Active';

        await query(
            `UPDATE users SET status = ?, updatedAt = NOW() WHERE uid = ?`,
            [status, uid]
        );

        const action = suspend ? '권한 중지' : '권한 복구';
        await addAdminLog(req.user.uid, req.user.managerName, 'user', uid, 'EMPLOYEE_SUSPEND', action);

        res.json({ message: `직원 ${action}이 완료되었습니다.` });
    } catch (error) {
        console.error('직원 상태 변경 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '직원 상태 변경에 실패했습니다.' });
    }
});

// 직원 정보 수정
router.put('/employees/:uid', authenticateToken, requireRole(['master', 'admin', 'owner']), async (req, res) => {
    try {
        const { uid } = req.params;
        const { managerName, department, role, email } = req.body;

        await query(
            `UPDATE users SET managerName = ?, department = ?, role = ?, email = ?, updatedAt = NOW() WHERE uid = ?`,
            [managerName, department, role, email, uid]
        );

        await addAdminLog(req.user.uid, req.user.managerName, 'user', uid, 'EMPLOYEE_UPDATE', '직원 정보 수정');

        res.json({ message: '직원 정보가 수정되었습니다.' });
    } catch (error) {
        console.error('직원 정보 수정 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '직원 정보 수정에 실패했습니다.' });
    }
});

// 회사 로그 추가 (관리자용)
router.post('/companies/:uid/logs', authenticateToken, requireRole(['master', 'admin']), async (req, res) => {
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
                logs = JSON_ARRAY_APPEND(COALESCE(logs, JSON_ARRAY()), '$', JSON_OBJECT('date', ?, 'msg', ?)),
                updatedAt = NOW()
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
router.get('/logs', authenticateToken, requireRole(['master', 'admin']), async (req, res) => {
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

module.exports = router;
