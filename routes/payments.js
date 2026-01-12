import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
router.use(authenticateToken);

// 결제 내역 조회
router.get('/', async (req, res) => {
    try {
        const isAdmin = ['master', 'admin', 'general_manager', 'lawyer'].includes(req.user.role);

        let sql, params;

        if (isAdmin) {
            // 관리자는 전체 조회
            sql = `
                SELECT p.*, u.company_name, u.manager_name
                FROM payments p
                LEFT JOIN users u ON p.uid = u.uid
                ORDER BY p.createdAt DESC
                LIMIT 100
            `;
            params = [];
        } else {
            // 일반 사용자는 같은 회사 기준 조회
            sql = `
                SELECT p.*, u.company_name, u.manager_name
                FROM payments p
                INNER JOIN users u ON p.uid = u.uid
                INNER JOIN users me ON u.biz_num = me.biz_num
                WHERE me.uid = ?
                ORDER BY p.createdAt DESC
                LIMIT 100
            `;
            params = [req.user.uid];
        }

        const payments = await query(sql, params);
        res.json({ payments });

    } catch (error) {
        console.error('결제 내역 조회 에러:', error);
        res.status(500).json({
            message: '서버 오류가 발생했습니다.',
            error: error.message,
            sql: error.sql || null
        });
    }
});

// 결제 생성
router.post('/', async (req, res) => {
    try {
        const { amount, status, paymentDate } = req.body;

        await query(
            `INSERT INTO payments (uid, bizNum, amount, status, paymentDate, createdAt)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [req.user.uid, req.user.bizNum || null, amount, status || 'pending', paymentDate || new Date(), new Date()]
        );

        const [payment] = await query('SELECT * FROM payments WHERE uid = ? ORDER BY id DESC LIMIT 1', [req.user.uid]);
        res.status(201).json(payment);

    } catch (error) {
        console.error('결제 생성 에러:', error);
        res.status(500).json({
            message: '서버 오류가 발생했습니다.',
            error: error.message
        });
    }
});

export default router;
