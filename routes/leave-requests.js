import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, requireManager } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
router.use(authenticateToken);

/**
 * leave_requests (DDL 기준)
 * - doc_id, user_id, user_name
 * - type, start_date, end_date, days, reason
 * - status, created_at, processed_at
 * + (추가) biz_num: 멀티테넌트 격리용
 */

// 휴가 신청 목록
router.get('/', async (req, res) => {
    try {
        const isAdmin = ['admin', 'general_manager'].includes(req.user?.role);
        if (!isAdmin && !req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }

        let sql = 'SELECT * FROM leave_requests WHERE 1=1';
        const params = [];

        if (isAdmin) {
            // 관리자도 회사 단위로 격리
            if (req.user?.bizNum) {
                sql += ' AND biz_num = ?';
                params.push(req.user.bizNum);
            }
        } else {
            sql += ' AND biz_num = ? AND user_id = ?';
            params.push(req.user.bizNum, req.user.uid);
        }

        sql += ' ORDER BY created_at DESC';
        const leaves = await query(sql, params);
        res.json({ leaves });
    } catch (error) {
        console.error('휴가 목록 조회 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
    }
});

// 휴가 신청
router.post('/', async (req, res) => {
    try {
        if (!req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }

        const { type, startDate, endDate, days, reason } = req.body;
        if (!type || !startDate || !endDate || days === undefined || days === null || !reason) {
            return res.status(400).json({ message: '필수 항목을 입력해주세요.' });
        }

        const docId = uuidv4();

        await query(
            `INSERT INTO leave_requests (doc_id, biz_num, user_id, user_name, type, start_date, end_date, days, reason, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
            [docId, req.user.bizNum, req.user.uid, req.user.managerName || req.user.email, type, startDate, endDate, days, reason]
        );

        const [leave] = await query('SELECT * FROM leave_requests WHERE doc_id = ? AND biz_num = ?', [docId, req.user.bizNum]);
        res.status(201).json(leave);
    } catch (error) {
        console.error('휴가 신청 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
    }
});

// 휴가 승인/거부 (매니저 이상)
router.put('/:docId', requireManager, async (req, res) => {
    try {
        if (!req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }

        const { status } = req.body;
        if (!['approved', 'rejected', 'pending'].includes(status)) {
            return res.status(400).json({ message: '유효하지 않은 status 입니다.' });
        }

        await query(
            'UPDATE leave_requests SET status = ?, processed_at = NOW() WHERE doc_id = ? AND biz_num = ?',
            [status, req.params.docId, req.user.bizNum]
        );

        const [leave] = await query('SELECT * FROM leave_requests WHERE doc_id = ? AND biz_num = ?', [req.params.docId, req.user.bizNum]);
        if (!leave) {
            return res.status(404).json({ message: '휴가 신청을 찾을 수 없습니다.' });
        }

        res.json(leave);
    } catch (error) {
        console.error('휴가 업데이트 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
    }
});

export default router;
