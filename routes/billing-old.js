const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// 청구서/영수증 관리 API
// ============================================================

// 청구서/영수증 발송 로그 생성
router.post('/logs', authenticateToken, requireRole(['master', 'admin']), async (req, res) => {
    try {
        const { companyName, email, type, amount, title, note } = req.body;

        if (!['BILL', 'RECEIPT'].includes(type)) {
            return res.status(400).json({ error: 'InvalidType', message: '유효하지 않은 타입입니다.' });
        }

        if (!companyName || !email || !amount || !title) {
            return res.status(400).json({ error: 'MissingFields', message: '필수 정보를 입력해주세요.' });
        }

        const docId = uuidv4();

        // TODO: 실제 메일 발송 로직 추가
        // await sendBillingEmail(email, type, {...});

        await query(
            `INSERT INTO billing_logs
            (docId, companyName, email, type, amount, title, note, status, sentAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', NOW())`,
            [docId, companyName, email, type, amount, title, note]
        );

        res.json({ message: '청구서/영수증이 발송되었습니다.', docId });
    } catch (error) {
        console.error('청구서 발송 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '청구서 발송에 실패했습니다.' });
    }
});

// 청구서/영수증 발송 이력 조회
router.get('/logs', authenticateToken, requireRole(['master', 'admin']), async (req, res) => {
    try {
        const { startDate, endDate, companyName, type } = req.query;

        let sql = 'SELECT * FROM billing_logs WHERE 1=1';
        const params = [];

        if (startDate) {
            sql += ' AND sentAt >= ?';
            params.push(startDate);
        }

        if (endDate) {
            sql += ' AND sentAt <= ?';
            params.push(endDate + ' 23:59:59');
        }

        if (companyName) {
            sql += ' AND companyName LIKE ?';
            params.push(`%${companyName}%`);
        }

        if (type) {
            sql += ' AND type = ?';
            params.push(type);
        }

        sql += ' ORDER BY sentAt DESC';

        const logs = await query(sql, params);
        res.json({ logs });
    } catch (error) {
        console.error('청구서 이력 조회 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '청구서 이력을 불러올 수 없습니다.' });
    }
});

// 청구서 상세 조회
router.get('/logs/:docId', authenticateToken, async (req, res) => {
    try {
        const { docId } = req.params;

        const results = await query(
            'SELECT * FROM billing_logs WHERE docId = ?',
            [docId]
        );

        if (results.length === 0) {
            return res.status(404).json({ error: 'NotFound', message: '청구서를 찾을 수 없습니다.' });
        }

        res.json({ log: results[0] });
    } catch (error) {
        console.error('청구서 조회 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '청구서를 불러올 수 없습니다.' });
    }
});

// 청구서와 매출 장부 연동
router.put('/logs/:docId/link-payment', authenticateToken, requireRole(['master', 'admin']), async (req, res) => {
    try {
        const { docId } = req.params;
        const { paymentId } = req.body;

        await query(
            `UPDATE billing_logs SET linkedToPayment = TRUE, paymentId = ? WHERE docId = ?`,
            [paymentId, docId]
        );

        res.json({ message: '매출 장부에 연동되었습니다.' });
    } catch (error) {
        console.error('매출 연동 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '매출 연동에 실패했습니다.' });
    }
});

// 청구서 발송 및 매출 자동 등록
router.post('/send-and-register', authenticateToken, requireRole(['master', 'admin']), async (req, res) => {
    try {
        const { companyName, email, type, amount, title, note, registerToPayment } = req.body;

        if (!['BILL', 'RECEIPT'].includes(type)) {
            return res.status(400).json({ error: 'InvalidType', message: '유효하지 않은 타입입니다.' });
        }

        if (!companyName || !email || !amount || !title) {
            return res.status(400).json({ error: 'MissingFields', message: '필수 정보를 입력해주세요.' });
        }

        const billingDocId = uuidv4();

        // 1. 청구서 발송 로그 생성
        await query(
            `INSERT INTO billing_logs
            (docId, companyName, email, type, amount, title, note, status, sentAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', NOW())`,
            [billingDocId, companyName, email, type, amount, title, note]
        );

        let paymentDocId = null;

        // 2. 매출 장부에 자동 등록 (옵션)
        if (registerToPayment) {
            paymentDocId = uuidv4();

            const paymentStatus = type === 'BILL' ? 'scheduled' : 'paid';

            await query(
                `INSERT INTO payment_history
                (docId, companyName, type, plan, amount, status, method, date, note, createdAt)
                VALUES (?, ?, 'advisory', 'Manual', ?, ?, ?, NOW(), ?, NOW())`,
                [paymentDocId, companyName, amount, paymentStatus, type === 'RECEIPT' ? 'Transfer' : 'Unknown', `[${type === 'BILL' ? '수동청구' : '수동영수증'}] ${title}`]
            );

            // 청구서와 매출 연동 표시
            await query(
                `UPDATE billing_logs SET linkedToPayment = TRUE, paymentId = ? WHERE docId = ?`,
                [paymentDocId, billingDocId]
            );
        }

        res.json({
            message: '청구서가 발송되었습니다.',
            billingDocId,
            paymentDocId: paymentDocId || null
        });
    } catch (error) {
        console.error('청구서 발송 및 등록 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '청구서 발송에 실패했습니다.' });
    }
});

// 청구서 통계 (월별)
router.get('/stats', authenticateToken, requireRole(['master', 'admin']), async (req, res) => {
    try {
        const { month } = req.query; // YYYY-MM 형식

        let dateFilter = '';
        const params = [];

        if (month) {
            dateFilter = 'AND DATE_FORMAT(sentAt, "%Y-%m") = ?';
            params.push(month);
        } else {
            // 이번 달
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            dateFilter = 'AND DATE_FORMAT(sentAt, "%Y-%m") = ?';
            params.push(currentMonth);
        }

        const billCount = await query(
            `SELECT COUNT(*) as count FROM billing_logs WHERE type = 'BILL' ${dateFilter}`,
            params
        );

        const receiptCount = await query(
            `SELECT COUNT(*) as count FROM billing_logs WHERE type = 'RECEIPT' ${dateFilter}`,
            params
        );

        const failCount = await query(
            `SELECT COUNT(*) as count FROM billing_logs WHERE status = 'fail' ${dateFilter}`,
            params
        );

        const pendingCount = await query(
            `SELECT COUNT(*) as count FROM billing_logs WHERE status = 'sent' AND linkedToPayment = FALSE ${dateFilter}`,
            params
        );

        res.json({
            billCount: billCount[0].count,
            receiptCount: receiptCount[0].count,
            failCount: failCount[0].count,
            pendingCount: pendingCount[0].count
        });
    } catch (error) {
        console.error('청구서 통계 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '통계를 불러올 수 없습니다.' });
    }
});

module.exports = router;
