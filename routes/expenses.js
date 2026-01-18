import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, requireManager } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger.js';

const router = express.Router();
router.use(authenticateToken);

/**
 * company_expenses (DDL 기준)
 * - doc_id, category, date, description, amount, registered_by, created_at, updated_at
 * + (추가) biz_num: 멀티테넌트 격리용
 */

// 경비 목록
router.get('/', async (req, res) => {
    try {
        if (!req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }

        const { category, from, to, limit = 100, offset = 0 } = req.query;

        let sql = 'SELECT * FROM company_expenses WHERE biz_num = ?';
        const params = [req.user.bizNum];

        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }

        if (from) {
            sql += ' AND date >= ?';
            params.push(from);
        }

        if (to) {
            sql += ' AND date <= ?';
            params.push(to);
        }

        sql += ' ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const expenses = await query(sql, params);
        res.json({ expenses, total: expenses.length, limit: parseInt(limit), offset: parseInt(offset) });
    } catch (error) {
        logger.error('경비 목록 조회 에러:', { error });
        res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
    }
});

// 경비 등록
router.post('/', requireManager, async (req, res) => {
    try {
        if (!req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }

        const { category, date, description, amount } = req.body;
        if (!category || !date || !description || amount === undefined || amount === null) {
            return res.status(400).json({ message: '필수 항목을 입력해주세요.' });
        }

        const docId = uuidv4();

        await query(
            `INSERT INTO company_expenses (doc_id, biz_num, category, date, description, amount, registered_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [docId, req.user.bizNum, category, date, description, amount, req.user.uid]
        );

        const [expense] = await query('SELECT * FROM company_expenses WHERE doc_id = ? AND biz_num = ?', [docId, req.user.bizNum]);
        res.status(201).json(expense);
    } catch (error) {
        logger.error('경비 등록 에러:', { error });
        res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
    }
});

export default router;
