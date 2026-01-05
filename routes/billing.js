import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// ============================================================
// 청구서/영수증 관리 API
// ============================================================

// 청구서/영수증 발송 로그 생성
router.post('/logs', authenticateToken, requireRole('master', 'admin'), async (req, res) => {
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
router.get('/logs', authenticateToken, requireRole('master', 'admin'), async (req, res) => {
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


// ============================================================
// (유저) 결제/청구 내역 조회 - 해당 회사 것만
// ✅ billing_logs + payments 테이블 통합 조회
// ============================================================
router.get('/my-logs', authenticateToken, async (req, res) => {
    try {
        const role = String(req.user?.role || '').toLowerCase();

        // 토큰에 들어있는 회사 식별자
        const tokenCompanyName =
            req.user?.companyName ||
            req.user?.company_name ||
            req.user?.company ||
            null;

        // master/admin은 특정 회사 조회를 위해 query.companyName 허용
        const qCompanyName = req.query?.companyName;
        const companyName = (role === 'master' || role === 'admin') ? (qCompanyName || tokenCompanyName) : tokenCompanyName;

        console.log('📊 [결제내역 조회 요청]', {
            companyName,
            role,
            tokenCompanyName
        });

        if (!companyName) {
            return res.status(400).json({ error: 'MissingCompany', message: '회사 정보가 없습니다.' });
        }

        // ✅ 1. billing_logs 테이블에서 청구서/영수증 발송 이력 조회
        const billingLogs = await query(
            `SELECT
                docId,
                companyName,
                email,
                type,
                amount,
                title,
                note,
                status,
                sentAt as date,
                linkedToPayment,
                paymentId,
                0 as refundAmount,
                NULL as refundedAt,
                'billing_log' as source
             FROM billing_logs
             WHERE companyName = ?`,
            [companyName]
        );

        // ✅ 2. payments 테이블에서 매출 장부 조회 (관리자가 등록한 결제 내역)
        const payments = await query(
            `SELECT
                docId,
                companyName,
                '' as email,
                type,
                amount,
                note as title,
                note,
                status,
                date,
                refundAmount,
                refundedAt,
                0 as linkedToPayment,
                NULL as paymentId,
                'payment' as source
             FROM payments
             WHERE companyName = ?
             AND type != 'expense'`,
            [companyName]
        );

        // ✅ 3. 두 테이블의 데이터 통합 및 중복 제거
        const allLogs = [...billingLogs, ...payments];

        // paymentId로 연결된 중복 제거 (billing_log와 payment가 연결된 경우)
        const uniqueLogs = [];
        const seenPaymentIds = new Set();

        for (const log of allLogs) {
            // billing_log이고 paymentId가 있으면
            if (log.source === 'billing_log' && log.paymentId) {
                seenPaymentIds.add(log.paymentId);
                uniqueLogs.push(log);
            }
            // payment이고 이미 billing_log에서 연결되지 않았으면
            else if (log.source === 'payment' && !seenPaymentIds.has(log.docId)) {
                uniqueLogs.push(log);
            }
            // billing_log이지만 paymentId가 없으면 (독립적인 청구서)
            else if (log.source === 'billing_log' && !log.paymentId) {
                uniqueLogs.push(log);
            }
        }

        // 날짜순 정렬
        uniqueLogs.sort((a, b) => {
            const dateA = new Date(a.date || a.sentAt || 0).getTime();
            const dateB = new Date(b.date || b.sentAt || 0).getTime();
            return dateB - dateA;
        });

        console.log(`✅ [결제내역 조회 결과] billing_logs: ${billingLogs.length}건, payments: ${payments.length}건, 통합: ${uniqueLogs.length}건`);
        if (uniqueLogs.length > 0) {
            console.log('📌 [최근 내역 샘플]', {
                docId: uniqueLogs[0].docId,
                companyName: uniqueLogs[0].companyName,
                type: uniqueLogs[0].type,
                amount: uniqueLogs[0].amount,
                date: uniqueLogs[0].date,
                source: uniqueLogs[0].source
            });
        }

        res.json({ logs: uniqueLogs });
    } catch (error) {
        console.error('❌ 유저 청구/결제 내역 조회 에러:', error);
        console.error('에러 스택:', error.stack);
        res.status(500).json({ error: 'DatabaseError', message: '결제/청구 내역을 불러올 수 없습니다.' });
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
router.put('/logs/:docId/link-payment', authenticateToken, requireRole('master', 'admin'), async (req, res) => {
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
router.post('/send-and-register', authenticateToken, requireRole('master', 'admin'), async (req, res) => {
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
router.get('/stats', authenticateToken, requireRole('master', 'admin'), async (req, res) => {
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

export default router;
