import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import { safeJsonParse } from '../utils/safe-json.js';

const router = express.Router();
router.use(authenticateToken);

/**
 * credit_reports (DDL 기준)
 * - doc_id
 * - requester_uid, requester_name, requester_biz_num
 * - target_name, target_biz_num, target_phone
 * - status, allowed_viewers(JSON), report_data(JSON)
 * - created_at, completed_at, updated_at
 */

// 신용조회 목록
router.get('/', async (req, res) => {
    try {
        const isAdmin = ['master', 'admin', 'general_manager', 'lawyer'].includes(req.user?.role);
        if (!isAdmin && !req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }

        let sql = 'SELECT * FROM credit_reports WHERE 1=1';
        const params = [];

        // 일반 권한은 자기 회사(사업자번호) 요청 건만
        if (!isAdmin) {
            sql += ' AND requester_biz_num = ?';
            params.push(req.user.bizNum);
        }

        sql += ' ORDER BY created_at DESC LIMIT 200';
        const rows = await query(sql, params);

        const reports = rows.map(r => ({
            id: r.id,
            docId: r.doc_id,
            requesterUid: r.requester_uid,
            requesterName: r.requester_name,
            requesterBizNum: r.requester_biz_num,
            targetName: r.target_name,
            targetBizNum: r.target_biz_num,
            targetPhone: r.target_phone,
            status: r.status,
            allowedViewers: safeJsonParse(r.allowed_viewers, []),
            reportData: safeJsonParse(r.report_data, null),
            createdAt: r.created_at,
            completedAt: r.completed_at,
            updatedAt: r.updated_at
        }));

        res.json({ reports });
    } catch (error) {
        console.error('신용조회 목록 조회 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
    }
});

// 신용조회 생성
router.post('/', async (req, res) => {
    try {
        if (!req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }

        const { targetName, targetBizNum, targetPhone } = req.body;
        if (!targetName || !targetBizNum || !targetPhone) {
            return res.status(400).json({ message: '필수 항목을 입력해주세요.' });
        }

        const docId = uuidv4();

        await query(
            `INSERT INTO credit_reports (
                doc_id, requester_uid, requester_name, requester_biz_num,
                target_name, target_biz_num, target_phone,
                status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
            [docId, req.user.uid, req.user.managerName || req.user.email, req.user.bizNum, targetName, targetBizNum, targetPhone]
        );

        const [report] = await query('SELECT * FROM credit_reports WHERE doc_id = ?', [docId]);

        res.status(201).json({
            id: report.id,
            docId: report.doc_id,
            requesterUid: report.requester_uid,
            requesterName: report.requester_name,
            requesterBizNum: report.requester_biz_num,
            targetName: report.target_name,
            targetBizNum: report.target_biz_num,
            targetPhone: report.target_phone,
            status: report.status,
            createdAt: report.created_at
        });
    } catch (error) {
        console.error('신용조회 생성 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
    }
});

export default router;
