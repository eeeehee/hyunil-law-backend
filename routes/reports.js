import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, requireManager } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
router.use(authenticateToken);

/**
 * reports (DDL 기준)
 * - doc_id, target_biz_num
 * - type (month|quarter|year), period (YYYY-MM)
 * - title, content, file_url
 * - status (draft|sent|confirmed), created_at, sent_at, updated_at
 */

// 보고서 목록 조회
router.get('/', async (req, res) => {
    try {
        const { search, type, period, status, limit = 50, offset = 0 } = req.query;

        const isAdmin = ['master', 'admin', 'general_manager', 'lawyer'].includes(req.user?.role);
        if (!isAdmin && !req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }

        let sql = 'SELECT * FROM reports WHERE 1=1';
        const params = [];

        // 일반 권한은 자기 회사(사업자번호) 보고서만
        if (!isAdmin) {
            sql += ' AND target_biz_num = ?';
            params.push(req.user.bizNum);
        } else if (req.user?.bizNum) {
            // 관리자도 기본은 회사 단위로 격리
            sql += ' AND target_biz_num = ?';
            params.push(req.user.bizNum);
        }

        if (type) {
            sql += ' AND type = ?';
            params.push(type);
        }

        if (period) {
            sql += ' AND period = ?';
            params.push(period);
        }

        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }

        if (search) {
            sql += ' AND (title LIKE ? OR content LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const reports = await query(sql, params);
        res.json({ reports, total: reports.length, limit: parseInt(limit), offset: parseInt(offset) });
    } catch (error) {
        console.error('보고서 목록 조회 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
    }
});

// 보고서 상세 조회
router.get('/:docId', async (req, res) => {
    try {
        const isAdmin = ['master', 'admin', 'general_manager', 'lawyer'].includes(req.user?.role);
        if (!isAdmin && !req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }

        const params = [req.params.docId];
        let sql = 'SELECT * FROM reports WHERE doc_id = ?';

        // 관리자는 모든 리포트 조회 가능, 일반 사용자는 자기 회사 리포트만
        if (!isAdmin) {
            sql += ' AND target_biz_num = ?';
            params.push(req.user.bizNum);
        }

        const [report] = await query(sql, params);
        if (!report) {
            return res.status(404).json({ message: '보고서를 찾을 수 없습니다.' });
        }

        res.json(report);
    } catch (error) {
        console.error('보고서 조회 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
    }
});

// 보고서 생성 (매니저 이상)
router.post('/', requireManager, async (req, res) => {
    try {
        if (!req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }

        // 프론트/레거시 호환
        const title = req.body.title;
        const content = req.body.content ?? '';
        const type = req.body.type ?? req.body.reportType ?? 'month';
        const period = req.body.period ?? new Date().toISOString().slice(0, 7); // YYYY-MM
        const fileUrl = req.body.fileUrl ?? req.body.file_url ?? null;
        const status = req.body.status ?? 'draft';
        const targetBizNum = req.body.targetBizNum ?? req.body.target_biz_num ?? req.user.bizNum;

        if (!title) {
            return res.status(400).json({ message: '제목은 필수입니다.' });
        }

        const docId = uuidv4();

        await query(
            `INSERT INTO reports (doc_id, target_biz_num, type, period, title, content, file_url, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [docId, targetBizNum, type, period, title, content, fileUrl, status]
        );

        const [newReport] = await query('SELECT * FROM reports WHERE doc_id = ?', [docId]);
        res.status(201).json(newReport);
    } catch (error) {
        console.error('보고서 생성 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
    }
});

// 보고서 수정 (매니저 이상)
router.put('/:docId', requireManager, async (req, res) => {
    try {
        if (!req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }

        const updates = [];
        const params = [];

        const mapping = {
            title: 'title',
            content: 'content',
            type: 'type',
            period: 'period',
            status: 'status',
            fileUrl: 'file_url',
            file_url: 'file_url'
        };

        for (const [key, dbKey] of Object.entries(mapping)) {
            if (req.body[key] !== undefined) {
                updates.push(`${dbKey} = ?`);
                params.push(req.body[key]);
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: '수정할 내용이 없습니다.' });
        }

        updates.push('updated_at = NOW()');
        params.push(req.params.docId, req.user.bizNum);

        await query(`UPDATE reports SET ${updates.join(', ')} WHERE doc_id = ? AND target_biz_num = ?`, params);

        const [updated] = await query('SELECT * FROM reports WHERE doc_id = ? AND target_biz_num = ?', [req.params.docId, req.user.bizNum]);
        if (!updated) {
            return res.status(404).json({ message: '보고서를 찾을 수 없습니다.' });
        }

        res.json(updated);
    } catch (error) {
        console.error('보고서 수정 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
    }
});

// 보고서 삭제 (매니저 이상)
router.delete('/:docId', requireManager, async (req, res) => {
    try {
        if (!req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }
        await query('DELETE FROM reports WHERE doc_id = ? AND target_biz_num = ?', [req.params.docId, req.user.bizNum]);
        res.json({ message: '보고서가 삭제되었습니다.' });
    } catch (error) {
        console.error('보고서 삭제 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
    }
});

export default router;
