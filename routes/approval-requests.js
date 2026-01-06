// routes/approval-requests.js
// 승인 요청 관리 API (부서변경, 권한변경 등)

import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, requireAdmin, requireAdminOrCEO } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/approval-requests
 * @desc    승인 요청 목록 조회
 * @access  Private (인증 필요)
 * @query   {string} status - 필터링할 상태 (Pending, Approved, Rejected)
 * @query   {string} bizNum - 특정 회사의 요청만 조회
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { status, bizNum } = req.query;
        const user = req.user;

        let sql = `
            SELECT
                ar.*,
                u.managerName as requesterName,
                u.email as requesterEmail,
                u.department as requesterDepartment,
                approver.managerName as approverName
            FROM approval_requests ar
            LEFT JOIN users u ON ar.uid = u.uid
            LEFT JOIN users approver ON ar.approvedBy = approver.uid
            WHERE 1=1
        `;
        const params = [];

        // 권한에 따른 필터링
        if (['manager', 'user', 'staff'].includes(user.role)) {
            // 일반 직원은 자신의 요청만 조회
            sql += ' AND ar.uid = ?';
            params.push(user.uid);
        } else if (user.role === 'owner') {
            // CEO는 자기 회사의 요청만 조회
            sql += ' AND ar.bizNum = ?';
            params.push(user.bizNum);
        }
        // admin, master, general_manager는 모든 요청 조회 가능

        // 상태 필터
        if (status) {
            sql += ' AND ar.status = ?';
            params.push(status);
        }

        // 회사 필터
        if (bizNum) {
            sql += ' AND ar.bizNum = ?';
            params.push(bizNum);
        }

        sql += ' ORDER BY ar.createdAt DESC';

        const requests = await query(sql, params);

        // requestData JSON 파싱
        const parsedRequests = requests.map(req => ({
            ...req,
            requestData: typeof req.requestData === 'string'
                ? JSON.parse(req.requestData)
                : req.requestData
        }));

        res.json({
            success: true,
            requests: parsedRequests,
            count: parsedRequests.length
        });
    } catch (error) {
        console.error('승인 요청 목록 조회 에러:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: '승인 요청 목록을 불러오는 중 오류가 발생했습니다.'
        });
    }
});

/**
 * @route   GET /api/approval-requests/:id
 * @desc    특정 승인 요청 상세 조회
 * @access  Private
 */
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const [request] = await query(`
            SELECT
                ar.*,
                u.managerName as requesterName,
                u.email as requesterEmail,
                u.department as requesterDepartment,
                approver.managerName as approverName
            FROM approval_requests ar
            LEFT JOIN users u ON ar.uid = u.uid
            LEFT JOIN users approver ON ar.approvedBy = approver.uid
            WHERE ar.id = ?
        `, [id]);

        if (!request) {
            return res.status(404).json({
                error: 'Not found',
                message: '승인 요청을 찾을 수 없습니다.'
            });
        }

        // requestData JSON 파싱
        if (typeof request.requestData === 'string') {
            request.requestData = JSON.parse(request.requestData);
        }

        res.json({
            success: true,
            request
        });
    } catch (error) {
        console.error('승인 요청 조회 에러:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: '승인 요청을 불러오는 중 오류가 발생했습니다.'
        });
    }
});

/**
 * @route   POST /api/approval-requests
 * @desc    새로운 승인 요청 생성
 * @access  Private
 * @body    {string} requestType - 요청 유형 (부서변경, 권한변경 등)
 * @body    {object} requestData - 요청 상세 정보
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { requestType, requestData } = req.body;
        const user = req.user;

        if (!requestType || !requestData) {
            return res.status(400).json({
                error: 'Bad request',
                message: '요청 유형과 상세 정보는 필수입니다.'
            });
        }

        // 승인 요청 생성
        const result = await query(`
            INSERT INTO approval_requests (uid, bizNum, requestType, requestData, status, createdAt)
            VALUES (?, ?, ?, ?, 'Pending', NOW())
        `, [
            user.uid,
            user.bizNum,
            requestType,
            JSON.stringify(requestData)
        ]);

        res.status(201).json({
            success: true,
            message: '승인 요청이 생성되었습니다.',
            requestId: result.insertId
        });
    } catch (error) {
        console.error('승인 요청 생성 에러:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: '승인 요청 생성 중 오류가 발생했습니다.'
        });
    }
});

/**
 * @route   PUT /api/approval-requests/:id/approve
 * @desc    승인 요청 승인
 * @access  Private (CEO, Admin만 가능)
 */
router.put('/:id/approve', authenticateToken, requireAdminOrCEO, async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        // 승인 요청 조회
        const [request] = await query('SELECT * FROM approval_requests WHERE id = ?', [id]);

        if (!request) {
            return res.status(404).json({
                error: 'Not found',
                message: '승인 요청을 찾을 수 없습니다.'
            });
        }

        if (request.status !== 'Pending') {
            return res.status(400).json({
                error: 'Bad request',
                message: '이미 처리된 요청입니다.'
            });
        }

        // CEO는 자기 회사의 요청만 승인 가능
        if (user.role === 'owner' && request.bizNum !== user.bizNum) {
            return res.status(403).json({
                error: 'Forbidden',
                message: '해당 요청을 승인할 권한이 없습니다.'
            });
        }

        // 승인 처리
        await query(`
            UPDATE approval_requests
            SET status = 'Approved', approvedBy = ?, approvedAt = NOW()
            WHERE id = ?
        `, [user.uid, id]);

        // 요청 유형에 따라 실제 변경 적용
        const requestData = typeof request.requestData === 'string'
            ? JSON.parse(request.requestData)
            : request.requestData;

        if (request.requestType === '부서변경') {
            // 부서 변경 적용
            await query(`
                UPDATE users
                SET department = ?
                WHERE uid = ?
            `, [requestData.toDepartment, request.uid]);
        }
        // 향후 다른 요청 유형 추가 가능

        res.json({
            success: true,
            message: '승인이 완료되었습니다.'
        });
    } catch (error) {
        console.error('승인 처리 에러:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: '승인 처리 중 오류가 발생했습니다.'
        });
    }
});

/**
 * @route   PUT /api/approval-requests/:id/reject
 * @desc    승인 요청 거절
 * @access  Private (CEO, Admin만 가능)
 */
router.put('/:id/reject', authenticateToken, requireAdminOrCEO, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const user = req.user;

        // 승인 요청 조회
        const [request] = await query('SELECT * FROM approval_requests WHERE id = ?', [id]);

        if (!request) {
            return res.status(404).json({
                error: 'Not found',
                message: '승인 요청을 찾을 수 없습니다.'
            });
        }

        if (request.status !== 'Pending') {
            return res.status(400).json({
                error: 'Bad request',
                message: '이미 처리된 요청입니다.'
            });
        }

        // CEO는 자기 회사의 요청만 거절 가능
        if (user.role === 'owner' && request.bizNum !== user.bizNum) {
            return res.status(403).json({
                error: 'Forbidden',
                message: '해당 요청을 거절할 권한이 없습니다.'
            });
        }

        // 거절 처리
        await query(`
            UPDATE approval_requests
            SET status = 'Rejected', approvedBy = ?, approvedAt = NOW(), rejectionReason = ?
            WHERE id = ?
        `, [user.uid, reason || '사유 없음', id]);

        res.json({
            success: true,
            message: '요청이 거절되었습니다.'
        });
    } catch (error) {
        console.error('거절 처리 에러:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: '거절 처리 중 오류가 발생했습니다.'
        });
    }
});

/**
 * @route   DELETE /api/approval-requests/:id
 * @desc    승인 요청 삭제 (본인 또는 관리자만 가능)
 * @access  Private
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        const [request] = await query('SELECT * FROM approval_requests WHERE id = ?', [id]);

        if (!request) {
            return res.status(404).json({
                error: 'Not found',
                message: '승인 요청을 찾을 수 없습니다.'
            });
        }

        // 본인의 요청이거나 관리자만 삭제 가능
        if (request.uid !== user.uid && !['admin', 'master', 'general_manager'].includes(user.role)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: '삭제 권한이 없습니다.'
            });
        }

        await query('DELETE FROM approval_requests WHERE id = ?', [id]);

        res.json({
            success: true,
            message: '승인 요청이 삭제되었습니다.'
        });
    } catch (error) {
        console.error('승인 요청 삭제 에러:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: '승인 요청 삭제 중 오류가 발생했습니다.'
        });
    }
});

export default router;
