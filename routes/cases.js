// routes/cases.js
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import { authenticateToken, requireManager } from '../middleware/auth.js';

const router = express.Router();

// ========== 채무 사건 (Debt Cases) ==========

// 채무 사건 목록 조회
router.get('/debt', authenticateToken, async (req, res) => {
    try {
        const { status, search } = req.query;

        if (!req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }
        
        let sql = 'SELECT * FROM debt_cases WHERE biz_num = ?';
        const params = [req.user.bizNum];

        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }

        if (search) {
            sql += ' AND (debtor_name LIKE ? OR creditor_name LIKE ?)';
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam);
        }

        sql += ' ORDER BY created_at DESC';

        const cases = await query(sql, params);

        res.json({
            cases: cases.map(c => ({
                id: c.id,
                docId: c.doc_id,
                debtorName: c.debtor_name,
                creditorName: c.creditor_name,
                debtAmount: parseFloat(c.debt_amount),
                phone: c.phone,
                address: c.address,
                status: c.status,
                description: c.description,
                createdAt: c.created_at,
                updatedAt: c.updated_at
            }))
        });
    } catch (error) {
        console.error('채무 사건 목록 조회 오류:', error);
        res.status(500).json({ error: 'Failed to fetch debt cases' });
    }
});

// 채무 사건 생성
router.post('/debt', authenticateToken, requireManager, async (req, res) => {
    try {
        const { debtorName, creditorName, debtAmount, phone, address, status, description } = req.body;

        if (!req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }

        if (!debtorName || !creditorName || !debtAmount || !phone || !status) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const docId = uuidv4();

        await query(
            `INSERT INTO debt_cases (doc_id, biz_num, debtor_name, creditor_name, debt_amount, phone, address, status, description, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [docId, req.user.bizNum, debtorName, creditorName, debtAmount, phone, address, status, description]
        );

        res.status(201).json({ message: '채무 사건이 생성되었습니다.', docId });
    } catch (error) {
        console.error('채무 사건 생성 오류:', error);
        res.status(500).json({ error: 'Failed to create debt case' });
    }
});

// 채무 사건 업데이트
router.put('/debt/:docId', authenticateToken, requireManager, async (req, res) => {
    try {
        if (!req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }
        const updates = [];
        const params = [];

        const fields = ['debtorName', 'creditorName', 'debtAmount', 'phone', 'address', 'status', 'description'];
        const mapping = {
            debtorName: 'debtor_name',
            creditorName: 'creditor_name',
            debtAmount: 'debt_amount',
            phone: 'phone',
            address: 'address',
            status: 'status',
            description: 'description'
        };

        for (const field of fields) {
            if (req.body[field] !== undefined) {
                updates.push(`${mapping[field]} = ?`);
                params.push(req.body[field]);
            }
        }

        if (updates.length > 0) {
            updates.push('updated_at = NOW()');
            params.push(req.params.docId, req.user.bizNum);
            await query(`UPDATE debt_cases SET ${updates.join(', ')} WHERE doc_id = ? AND biz_num = ?`, params);
        }

        res.json({ message: '채무 사건이 업데이트되었습니다.' });
    } catch (error) {
        console.error('채무 사건 업데이트 오류:', error);
        res.status(500).json({ error: 'Failed to update debt case' });
    }
});

// ========== 파산 사건 (Pasan Cases) ==========

// 파산 사건 목록 조회
router.get('/pasan', authenticateToken, async (req, res) => {
    try {
        const { status, search } = req.query;

        if (!req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }
        
        let sql = 'SELECT * FROM pasan_cases WHERE biz_num = ?';
        const params = [req.user.bizNum];

        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }

        if (search) {
            sql += ' AND client_name LIKE ?';
            params.push(`%${search}%`);
        }

        sql += ' ORDER BY created_at DESC';

        const cases = await query(sql, params);

        res.json({
            cases: cases.map(c => ({
                id: c.id,
                docId: c.doc_id,
                clientName: c.client_name,
                phone: c.phone,
                email: c.email,
                address: c.address,
                debtAmount: parseFloat(c.debt_amount),
                creditorCount: c.creditor_count,
                status: c.status,
                description: c.description,
                createdAt: c.created_at,
                updatedAt: c.updated_at
            }))
        });
    } catch (error) {
        console.error('파산 사건 목록 조회 오류:', error);
        res.status(500).json({ error: 'Failed to fetch pasan cases' });
    }
});

// 파산 사건 생성
router.post('/pasan', authenticateToken, requireManager, async (req, res) => {
    try {
        const { clientName, phone, email, address, debtAmount, creditorCount, status, description } = req.body;

        if (!req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }

        if (!clientName || !phone || !address || !debtAmount || !creditorCount || !status) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const docId = uuidv4();

        await query(
            `INSERT INTO pasan_cases (doc_id, biz_num, client_name, phone, email, address, debt_amount, creditor_count, status, description, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [docId, req.user.bizNum, clientName, phone, email, address, debtAmount, creditorCount, status, description]
        );

        res.status(201).json({ message: '파산 사건이 생성되었습니다.', docId });
    } catch (error) {
        console.error('파산 사건 생성 오류:', error);
        res.status(500).json({ error: 'Failed to create pasan case' });
    }
});

// 파산 사건 업데이트
router.put('/pasan/:docId', authenticateToken, requireManager, async (req, res) => {
    try {
        if (!req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }
        const updates = [];
        const params = [];

        const fields = ['clientName', 'phone', 'email', 'address', 'debtAmount', 'creditorCount', 'status', 'description'];
        const mapping = {
            clientName: 'client_name',
            phone: 'phone',
            email: 'email',
            address: 'address',
            debtAmount: 'debt_amount',
            creditorCount: 'creditor_count',
            status: 'status',
            description: 'description'
        };

        for (const field of fields) {
            if (req.body[field] !== undefined) {
                updates.push(`${mapping[field]} = ?`);
                params.push(req.body[field]);
            }
        }

        if (updates.length > 0) {
            updates.push('updated_at = NOW()');
            params.push(req.params.docId, req.user.bizNum);
            await query(`UPDATE pasan_cases SET ${updates.join(', ')} WHERE doc_id = ? AND biz_num = ?`, params);
        }

        res.json({ message: '파산 사건이 업데이트되었습니다.' });
    } catch (error) {
        console.error('파산 사건 업데이트 오류:', error);
        res.status(500).json({ error: 'Failed to update pasan case' });
    }
});

// ========== 상담 문의 (Consultation Inquiries) ==========

// 상담 문의 대시보드 카운트 (답변대기/답변완료)
// - status 값은 데이터에 따라 다양할 수 있어 IN(...) 으로 폭넓게 매핑
// - 회사(테넌트) 분리: biz_num 기준
router.get('/consultation/counts', authenticateToken, async (req, res) => {
    try {
        const isAdmin = ['master', 'admin', 'general_manager', 'lawyer'].includes(req.user?.role);
        const isCEO = req.user?.role === 'CEO';

        // 대시보드는 최소 CEO 이상만
        if (!isAdmin && !isCEO) {
            return res.status(403).json({
                error: 'Forbidden',
                message: '권한이 없습니다.'
            });
        }

        if (!req.user?.bizNum) {
            return res.status(400).json({
                error: 'bizNum missing in token',
                message: '사용자 사업자번호(bizNum) 정보가 없습니다.'
            });
        }

        // 답변대기/답변완료 상태 매핑
        const pendingStatuses = ['pending', 'waiting', 'unanswered'];
        const doneStatuses = ['completed', 'contacted', 'answered', 'done', 'resolved'];

        const placeholdersPending = pendingStatuses.map(() => '?').join(',');
        const placeholdersDone = doneStatuses.map(() => '?').join(',');

        const sql = `
            SELECT
              SUM(status IN (${placeholdersPending})) AS pendingCount,
              SUM(status IN (${placeholdersDone})) AS doneCount,
              COUNT(*) AS totalCount
            FROM consultation_inquiries
            WHERE biz_num = ?
        `;

        const params = [...pendingStatuses, ...doneStatuses, req.user.bizNum];
        const [row] = await query(sql, params);

        res.json({
            pendingCount: Number(row?.pendingCount ?? 0),
            doneCount: Number(row?.doneCount ?? 0),
            totalCount: Number(row?.totalCount ?? 0)
        });
    } catch (error) {
        console.error('상담 문의 카운트 조회 오류:', error);
        res.status(500).json({
            error: 'Failed to fetch consultation counts',
            message: '상담 문의 카운트를 가져오는 중 오류가 발생했습니다.'
        });
    }
});

// 상담 문의 목록 조회
router.get('/consultation', authenticateToken, async (req, res) => {
    try {
        const { category, status } = req.query;

        const isAdmin = ['master', 'admin', 'general_manager', 'lawyer'].includes(req.user?.role);
        if (!isAdmin && !req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }
        
        let sql = 'SELECT * FROM consultation_inquiries WHERE 1=1';
        const params = [];

        // 일반 권한은 자기 회사 데이터만
        if (!isAdmin) {
            sql += ' AND biz_num = ?';
            params.push(req.user.bizNum);
        }

        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }

        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }

        sql += ' ORDER BY created_at DESC';

        const inquiries = await query(sql, params);

        res.json({
            inquiries: inquiries.map(i => ({
                id: i.id,
                docId: i.doc_id,
                category: i.category,
                clientName: i.client_name,
                phone: i.phone,
                email: i.email,
                content: i.content,
                status: i.status,
                assignedTo: i.assigned_to,
                createdAt: i.created_at,
                processedAt: i.processed_at
            }))
        });
    } catch (error) {
        console.error('상담 문의 목록 조회 오류:', error);
        res.status(500).json({ error: 'Failed to fetch consultation inquiries' });
    }
});

// 상담 문의 생성
router.post('/consultation', async (req, res) => {
    try {
        const { category, clientName, phone, email, content } = req.body;

        if (!category || !clientName || !phone || !content) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const docId = uuidv4();

        await query(
            `INSERT INTO consultation_inquiries (doc_id, category, client_name, phone, email, content, status, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
            [docId, category, clientName, phone, email, content]
        );

        res.status(201).json({ message: '상담 문의가 등록되었습니다.', docId });
    } catch (error) {
        console.error('상담 문의 생성 오류:', error);
        res.status(500).json({ error: 'Failed to create consultation inquiry' });
    }
});

// 상담 문의 상태 업데이트
router.put('/consultation/:docId', authenticateToken, requireManager, async (req, res) => {
    try {
        const { status, assignedTo } = req.body;

        const isAdmin = ['master', 'admin', 'general_manager', 'lawyer'].includes(req.user?.role);
        if (!isAdmin && !req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }

        const updates = [];
        const params = [];

        if (status) {
            updates.push('status = ?');
            params.push(status);
        }

        if (assignedTo !== undefined) {
            updates.push('assigned_to = ?');
            params.push(assignedTo);
        }

        if (status === 'completed' || status === 'contacted') {
            updates.push('processed_at = NOW()');
        }

        if (updates.length > 0) {
            params.push(req.params.docId);

            // 일반 권한은 자기 회사 것만 업데이트
            const where = isAdmin ? 'doc_id = ?' : 'doc_id = ? AND biz_num = ?';
            if (!isAdmin) params.push(req.user.bizNum);

            await query(`UPDATE consultation_inquiries SET ${updates.join(', ')} WHERE ${where}`, params);
        }

        res.json({ message: '상담 문의가 업데이트되었습니다.' });
    } catch (error) {
        console.error('상담 문의 업데이트 오류:', error);
        res.status(500).json({ error: 'Failed to update consultation inquiry' });
    }
});

export default router;
