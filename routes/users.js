// routes/users.js
import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, requireAdmin, requireAdminOrCEO } from '../middleware/auth.js';
import { logger } from '../config/logger.js';

const router = express.Router();

// departments 안전하게 파싱하는 헬퍼 함수
function parseDepartments(departmentsStr) {
    if (!departmentsStr) return null;
    try {
        return JSON.parse(departmentsStr);
    } catch (e) {
        // JSON이 아닌 경우 문자열 그대로 반환
        return departmentsStr;
    }
}

// 부서 목록 조회 (같은 회사 소속 사용자만)
router.get('/departments', authenticateToken, async (req, res) => {
    try {
        if (!req.user || !req.user.bizNum) {
            return res.status(403).json({ message: '사용자 정보가 없거나 회사에 소속되어 있지 않습니다.' });
        }

        const [owner] = await query(
            `SELECT departments FROM users WHERE biz_num = ? AND role = 'owner' LIMIT 1`,
            [req.user.bizNum]
        );

        if (!owner || !owner.departments) {
            return res.json({ departments: [] });
        }

        const departments = parseDepartments(owner.departments);

        // departments가 배열 형태인지 확인 (JSON.parse 결과)
        if (Array.isArray(departments)) {
            res.json({ departments });
        } else {
            // 호환성을 위해, 배열이 아니면 빈 배열 반환
            res.json({ departments: [] });
        }

    } catch (error) {
        logger.error('부서 목록 조회 오류:', { error });
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// 현재 사용자 정보 조회
router.get('/me', authenticateToken, async (req, res) => {
    try {
        // Explicitly select columns to avoid SELECT * issues
        const [user] = await query(
            `SELECT uid, email, company_name, representative_name, biz_num, company_phone, manager_name, phone, department, departments, role, plan, qa_used_count, phone_used_count, custom_qa_limit, custom_phone_limit, useApproval, created_at, agreed_at
             FROM users WHERE uid = ?`, 
            [req.user.uid]
        );

        if (!user) {
            return res.status(404).json({
                error: 'User not found',
                message: '사용자를 찾을 수 없습니다.'
            });
        }

        // ✅ 멀티테넌트: 직원(manager, user, staff)은 owner의 플랜과 사용량, 승인설정 정보를 사용
        let companySettings = {
            plan: user.plan,
            qaUsedCount: user.qa_used_count,
            phoneUsedCount: user.phone_used_count,
            customQaLimit: user.custom_qa_limit,
            customPhoneLimit: user.custom_phone_limit,
            useApproval: user.useApproval
        };

        if (['manager', 'user', 'staff'].includes(user.role) && user.biz_num) {
            const [owner] = await query(
                'SELECT plan, qa_used_count, phone_used_count, custom_qa_limit, custom_phone_limit, useApproval FROM users WHERE biz_num = ? AND role = "owner" LIMIT 1',
                [user.biz_num]
            );

            if (owner) {
                companySettings = {
                    plan: owner.plan,
                    qaUsedCount: owner.qa_used_count,
                    phoneUsedCount: owner.phone_used_count,
                    customQaLimit: owner.custom_qa_limit,
                    customPhoneLimit: owner.custom_phone_limit,
                    useApproval: owner.useApproval
                };
                logger.info(`👥 직원(${user.uid})에게 owner 플랜/설정 정보 제공: plan=${owner.plan}, useApproval=${owner.useApproval}`);
            }
        }

        res.json({
            uid: user.uid,
            email: user.email,
            companyName: user.company_name,
            representativeName: user.representative_name,
            bizNum: user.biz_num,
            companyPhone: user.company_phone,
            managerName: user.manager_name,
            phone: user.phone,
            department: user.department,
            departments: parseDepartments(user.departments),
            role: user.role,
            plan: companySettings.plan,
            qaUsedCount: companySettings.qaUsedCount,
            phoneUsedCount: companySettings.phoneUsedCount,
            customQaLimit: companySettings.customQaLimit,
            customPhoneLimit: companySettings.customPhoneLimit,
            useApproval: companySettings.useApproval,
            createdAt: user.created_at,
            agreedAt: user.agreed_at
        });
    } catch (error) {
        logger.error('사용자 정보 조회 오류:', { error });
        res.status(500).json({
            error: 'Failed to fetch user',
            message: '사용자 정보를 가져오는 중 오류가 발생했습니다.',
            detail: error.message, 
            sql: error.sql || null
        });
    }
});

// 모든 사용자 목록 조회
// - 관리자(admin/general_manager/lawyer): 전체 조회(필터 가능)
// - CEO: 자기 회사(biz_num) 소속 사용자만 조회
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { role, plan, search } = req.query;

        const isAdmin = ['master', 'admin', 'general_manager', 'lawyer'].includes(req.user?.role);
        const isCEO = ['owner', 'CEO'].includes(req.user?.role);

        logger.info('🔍 [GET /users] 요청자 정보:', {
            uid: req.user?.uid,
            role: req.user?.role,
            isAdmin,
            isCEO
        });

        if (!isAdmin && !isCEO) {
            logger.info('❌ [GET /users] 권한 없음:', { role: req.user?.role });
            return res.status(403).json({
                error: 'Forbidden',
                message: '권한이 없습니다.'
            });
        }

        if (isCEO && !req.user?.bizNum) {
            return res.status(400).json({
                error: 'bizNum missing in token',
                message: '사용자 사업자번호(bizNum) 정보가 없습니다.'
            });
        }
        
        let sql = 'SELECT * FROM users WHERE 1=1';
        const params = [];

        // CEO는 자기 회사 사용자만
        if (isCEO) {
            sql += ' AND biz_num = ?';
            params.push(req.user.bizNum);
        }

        if (role) {
            sql += ' AND role = ?';
            params.push(role);
        }

        if (plan) {
            sql += ' AND plan = ?';
            params.push(plan);
        }

        if (search) {
            sql += ' AND (company_name LIKE ? OR email LIKE ? OR manager_name LIKE ?)';
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        sql += ' ORDER BY created_at DESC';

        const users = await query(sql, params);

        res.json({
            users: users.map(user => ({
                uid: user.uid,
                email: user.email,
                companyName: user.company_name,
                representativeName: user.representative_name,
                bizNum: user.biz_num,
                companyPhone: user.company_phone,
                managerName: user.manager_name,
                phone: user.phone,
                department: user.department,
                departments: parseDepartments(user.departments),
                role: user.role,
                plan: user.plan,
                qaUsedCount: user.qa_used_count,
                phoneUsedCount: user.phone_used_count,
                createdAt: user.created_at
            }))
        });
    } catch (error) {
        logger.error('사용자 목록 조회 오류:', { error });
        res.status(500).json({ 
            error: 'Failed to fetch users',
            message: '사용자 목록을 가져오는 중 오류가 발생했습니다.'
        });
    }
});

// 특정 사용자 정보 조회 (관리자 전용)
router.get('/:uid', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [user] = await query('SELECT * FROM users WHERE uid = ?', [req.params.uid]);
        
        if (!user) {
            return res.status(404).json({ 
                error: 'User not found',
                message: '사용자를 찾을 수 없습니다.'
            });
        }

        res.json({
            uid: user.uid,
            email: user.email,
            companyName: user.company_name,
            representativeName: user.representative_name,
            bizNum: user.biz_num,
            companyPhone: user.company_phone,
            managerName: user.manager_name,
            phone: user.phone,
            department: user.department,
            departments: parseDepartments(user.departments),
            role: user.role,
            plan: user.plan,
            qaUsedCount: user.qa_used_count,
            phoneUsedCount: user.phone_used_count,
            createdAt: user.created_at,
            agreedAt: user.agreed_at
        });
    } catch (error) {
        logger.error('사용자 정보 조회 오류:', { error });
        res.status(500).json({ 
            error: 'Failed to fetch user',
            message: '사용자 정보를 가져오는 중 오류가 발생했습니다.'
        });
    }
});

// 사용자 정보 업데이트
router.put('/me', authenticateToken, async (req, res) => {
    try {
        logger.info('📝 [PUT /users/me] 요청 받음');
        logger.info('요청자:', { uid: req.user.uid, email: req.user.email });
        logger.info('요청 body:', { body: req.body });

        const {
            companyName,
            representativeName,
            companyPhone,
            managerName,
            phone,
            department,
            departments,
            useApproval 
        } = req.body;

        const updates = [];
        const params = [];

        if (companyName) {
            updates.push('company_name = ?');
            params.push(companyName);
        }
        if (representativeName) {
            updates.push('representative_name = ?');
            params.push(representativeName);
        }
        if (companyPhone) {
            updates.push('company_phone = ?');
            params.push(companyPhone);
        }
        if (managerName) {
            updates.push('manager_name = ?');
            params.push(managerName);
        }
        if (phone) {
            updates.push('phone = ?');
            params.push(phone);
        }
        if (department) {
            updates.push('department = ?');
            params.push(department);
        }
        if (departments !== undefined) {
            const deptValue = departments === null ? null : JSON.stringify(departments);
            logger.info('departments 필드 업데이트:', { from: departments, to: deptValue });
            updates.push('departments = ?');
            params.push(deptValue);
        }
        // "승인결재 사용" 여부 업데이트 (owner, admin만 가능)
        if (useApproval !== undefined && ['owner', 'admin'].includes(req.user.role)) {
            updates.push('useApproval = ?');
            params.push(useApproval ? 1 : 0);
        }

        if (updates.length === 0) {
            logger.info('❌ 업데이트할 필드 없음');
            return res.status(400).json({
                error: 'No fields to update',
                message: '업데이트할 필드가 없습니다.'
            });
        }

        updates.push('updated_at = NOW()');
        params.push(req.user.uid);

        const sql = `UPDATE users SET ${updates.join(', ')} WHERE uid = ?`;
        logger.info('실행할 SQL:', { sql });
        logger.info('파라미터:', { params });

        await query(sql, params);
        logger.info('✅ 업데이트 성공');

        const [updatedUser] = await query('SELECT * FROM users WHERE uid = ?', [req.user.uid]);

        res.json({
            message: '사용자 정보가 업데이트되었습니다.',
            user: {
                uid: updatedUser.uid,
                email: updatedUser.email,
                companyName: updatedUser.company_name,
                representativeName: updatedUser.representative_name,
                bizNum: updatedUser.biz_num,
                companyPhone: updatedUser.company_phone,
                managerName: updatedUser.manager_name,
                phone: updatedUser.phone,
                department: updatedUser.department,
                departments: parseDepartments(updatedUser.departments),
                role: updatedUser.role,
                plan: updatedUser.plan
            }
        });
    } catch (error) {
        logger.error('사용자 정보 업데이트 오류:', { error });
        res.status(500).json({ 
            error: 'Failed to update user',
            message: '사용자 정보 업데이트 중 오류가 발생했습니다.'
        });
    }
});

// 사용자 역할/플랜 업데이트 (관리자 또는 CEO/owner)
router.put('/:uid', authenticateToken, requireAdminOrCEO, async (req, res) => {
    try {
        const { role, plan, qaUsedCount, phoneUsedCount, departments, managerName, department, phone } = req.body;

        // owner인 경우 자기 회사 직원만 수정 가능
        const isOwner = ['owner', 'CEO'].includes(req.user?.role);
        const isAdmin = ['master', 'admin', 'general_manager', 'lawyer'].includes(req.user?.role);

        if (isOwner) {
            // 수정하려는 사용자의 정보 조회
            const [targetUser] = await query('SELECT biz_num FROM users WHERE uid = ?', [req.params.uid]);

            if (!targetUser) {
                return res.status(404).json({
                    error: 'User not found',
                    message: '사용자를 찾을 수 없습니다.'
                });
            }

            // owner는 자기 회사 직원만 수정 가능
            if (targetUser.biz_num !== req.user.bizNum) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: '자기 회사 직원만 수정할 수 있습니다.'
                });
            }
        }

        const updates = [];
        const params = [];

        if (role) {
            updates.push('role = ?');
            params.push(role);
        }
        if (plan) {
            updates.push('plan = ?');
            params.push(plan);
        }
        if (qaUsedCount !== undefined) {
            updates.push('qa_used_count = ?');
            params.push(qaUsedCount);
        }
        if (phoneUsedCount !== undefined) {
            updates.push('phone_used_count = ?');
            params.push(phoneUsedCount);
        }
        if (departments !== undefined) {
            updates.push('departments = ?');
            params.push(departments === null ? null : JSON.stringify(departments));
        }
        if (managerName !== undefined) {
            updates.push('manager_name = ?');
            params.push(managerName);
        }
        if (department !== undefined) {
            updates.push('department = ?');
            params.push(department);
        }
        if (phone !== undefined) {
            updates.push('phone = ?');
            params.push(phone);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                error: 'No fields to update',
                message: '업데이트할 필드가 없습니다.'
            });
        }

        updates.push('updated_at = NOW()');
        params.push(req.params.uid);

        await query(
            `UPDATE users SET ${updates.join(', ')} WHERE uid = ?`,
            params
        );

        res.json({
            message: '사용자 정보가 업데이트되었습니다.'
        });
    } catch (error) {
        logger.error('사용자 정보 업데이트 오류:', { error });
        res.status(500).json({
            error: 'Failed to update user',
            message: '사용자 정보 업데이트 중 오류가 발생했습니다.'
        });
    }
});

// 사용자 삭제 (관리자 또는 CEO/owner)
router.delete('/:uid', authenticateToken, requireAdminOrCEO, async (req, res) => {
    try {
        // owner인 경우 자기 회사 직원만 삭제 가능
        const isOwner = ['owner', 'CEO'].includes(req.user?.role);

        if (isOwner) {
            // 삭제하려는 사용자의 정보 조회
            const [targetUser] = await query('SELECT biz_num FROM users WHERE uid = ?', [req.params.uid]);

            if (!targetUser) {
                return res.status(404).json({
                    error: 'User not found',
                    message: '사용자를 찾을 수 없습니다.'
                });
            }

            // owner는 자기 회사 직원만 삭제 가능
            if (targetUser.biz_num !== req.user.bizNum) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: '자기 회사 직원만 삭제할 수 있습니다.'
                });
            }
        }

        await query('DELETE FROM users WHERE uid = ?', [req.params.uid]);

        res.json({
            message: '사용자가 삭제되었습니다.'
        });
    } catch (error) {
        logger.error('사용자 삭제 오류:', { error });
        res.status(500).json({
            error: 'Failed to delete user',
            message: '사용자 삭제 중 오류가 발생했습니다.'
        });
    }
});

export default router;
