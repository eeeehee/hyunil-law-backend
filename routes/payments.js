import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
router.use(authenticateToken);

// 결제 내역 조회
router.get('/', async (req, res) => {
    try {
        let sql = 'SELECT * FROM payment_history WHERE 1=1';
        const params = [];

        if (!['admin', 'general_manager'].includes(req.user.role)) {
            if (!req.user?.bizNum) {
                return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
            }
            sql += ' AND biz_num = ?';
            params.push(req.user.bizNum);
        }

        sql += ' ORDER BY paid_at DESC LIMIT 100';

        const payments = await query(sql, params);
        res.json({ payments });

    } catch (error) {
        console.error('결제 내역 조회 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// 결제 생성
router.post('/', async (req, res) => {
    try {
        const { amount, description, paymentMethod } = req.body;
        const docId = uuidv4();

        await query(
            `INSERT INTO payment_history (doc_id, biz_num, company_name, amount, description, method, paid_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [docId, req.user.bizNum || '', req.user.companyName, amount, description, paymentMethod, new Date()]
        );

        const [payment] = await query('SELECT * FROM payment_history WHERE doc_id = ?', [docId]);
        res.status(201).json(payment);

    } catch (error) {
        console.error('결제 생성 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

export default router;
