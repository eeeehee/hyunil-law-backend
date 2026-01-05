// routes/litigation-cases.js
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../config/database.js';
import { authenticateToken, requireManager } from '../middleware/auth.js';
import { safeJsonParse } from '../utils/safe-json.js';

const router = express.Router();

// 소송 사건 목록 조회
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { caseType, status, search, limit = 50, offset = 0 } = req.query;
        
        if (!req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }

        let sql = 'SELECT * FROM litigation_cases WHERE biz_num = ?';
        const params = [req.user.bizNum];

        if (caseType) {
            sql += ' AND case_type = ?';
            params.push(caseType);
        }

        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }

        if (search) {
            sql += ' AND (client_name LIKE ? OR case_name LIKE ? OR case_number LIKE ?)';
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const cases = await query(sql, params);

        res.json({
            cases: cases.map(c => ({
                id: c.id,
                docId: c.doc_id,
                clientName: c.client_name,
                phone: c.phone,
                emails: safeJsonParse(c.emails, []),
                caseName: c.case_name,
                caseNumber: c.case_number,
                court: c.court,
                caseType: c.case_type,
                status: c.status,
                amount: parseFloat(c.amount),
                debtorName: c.debtor_name,
                debtorAddress: c.debtor_address,
                creditorName: c.creditor_name,
                address: c.address,
                debtAmount: c.debt_amount ? parseFloat(c.debt_amount) : null,
                creditorCount: c.creditor_count,
                dbSent: c.db_sent === 'TRUE',
                createdAt: c.created_at,
                updatedAt: c.updated_at
            })),
            total: cases.length
        });
    } catch (error) {
        console.error('소송 사건 목록 조회 오류:', error);
        res.status(500).json({ 
            error: 'Failed to fetch litigation cases',
            message: '소송 사건 목록을 가져오는 중 오류가 발생했습니다.'
        });
    }
});

// 특정 소송 사건 조회
router.get('/:docId', authenticateToken, async (req, res) => {
    try {
        if (!req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }

        const [litigationCase] = await query(
            'SELECT * FROM litigation_cases WHERE doc_id = ? AND biz_num = ?',
            [req.params.docId, req.user.bizNum]
        );
        
        if (!litigationCase) {
            return res.status(404).json({ 
                error: 'Case not found',
                message: '소송 사건을 찾을 수 없습니다.'
            });
        }

        res.json({
            id: litigationCase.id,
            docId: litigationCase.doc_id,
            clientName: litigationCase.client_name,
            phone: litigationCase.phone,
            emails: safeJsonParse(litigationCase.emails, []),
            caseName: litigationCase.case_name,
            caseNumber: litigationCase.case_number,
            court: litigationCase.court,
            caseType: litigationCase.case_type,
            status: litigationCase.status,
            amount: parseFloat(litigationCase.amount),
            debtorName: litigationCase.debtor_name,
            debtorAddress: litigationCase.debtor_address,
            creditorName: litigationCase.creditor_name,
            address: litigationCase.address,
            debtAmount: litigationCase.debt_amount ? parseFloat(litigationCase.debt_amount) : null,
            creditorCount: litigationCase.creditor_count,
            dbSent: litigationCase.db_sent === 'TRUE',
            createdAt: litigationCase.created_at,
            updatedAt: litigationCase.updated_at
        });
    } catch (error) {
        console.error('소송 사건 조회 오류:', error);
        res.status(500).json({ 
            error: 'Failed to fetch litigation case',
            message: '소송 사건을 가져오는 중 오류가 발생했습니다.'
        });
    }
});

// 소송 사건 생성
router.post('/', authenticateToken, requireManager, async (req, res) => {
    try {
        if (!req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }
        const {
            clientName,
            phone,
            emails,
            caseName,
            caseNumber,
            court,
            caseType,
            status,
            amount,
            debtorName,
            debtorAddress,
            creditorName,
            address,
            debtAmount,
            creditorCount
        } = req.body;

        if (!clientName || !phone || !caseName || !caseNumber || !court) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                message: '필수 입력 항목이 누락되었습니다.'
            });
        }

        const docId = uuidv4();

        await query(
            `INSERT INTO litigation_cases 
            (doc_id, biz_num, client_name, phone, emails, case_name, case_number, court, case_type, status, 
             amount, debtor_name, debtor_address, creditor_name, address, debt_amount, creditor_count, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [docId, req.user.bizNum, clientName, phone, emails ? JSON.stringify(emails) : null, caseName, caseNumber, 
             court, caseType, status, amount, debtorName, debtorAddress, creditorName, address, 
             debtAmount, creditorCount]
        );

        const [newCase] = await query('SELECT * FROM litigation_cases WHERE doc_id = ? AND biz_num = ?', [docId, req.user.bizNum]);

        res.status(201).json({
            message: '소송 사건이 생성되었습니다.',
            case: {
                id: newCase.id,
                docId: newCase.doc_id,
                clientName: newCase.client_name,
                phone: newCase.phone,
                emails: safeJsonParse(newCase.emails, []),
                caseName: newCase.case_name,
                caseNumber: newCase.case_number,
                court: newCase.court,
                caseType: newCase.case_type,
                status: newCase.status,
                amount: parseFloat(newCase.amount),
                createdAt: newCase.created_at
            }
        });
    } catch (error) {
        console.error('소송 사건 생성 오류:', error);
        res.status(500).json({ 
            error: 'Failed to create litigation case',
            message: '소송 사건 생성 중 오류가 발생했습니다.'
        });
    }
});

// 소송 사건 업데이트
router.put('/:docId', authenticateToken, requireManager, async (req, res) => {
    try {
        if (!req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }
        const updates = [];
        const params = [];

        const allowedFields = [
            'clientName', 'phone', 'emails', 'caseName', 'caseNumber', 'court', 
            'caseType', 'status', 'amount', 'debtorName', 'debtorAddress', 
            'creditorName', 'address', 'debtAmount', 'creditorCount', 'dbSent'
        ];

        const fieldMapping = {
            clientName: 'client_name',
            phone: 'phone',
            emails: 'emails',
            caseName: 'case_name',
            caseNumber: 'case_number',
            court: 'court',
            caseType: 'case_type',
            status: 'status',
            amount: 'amount',
            debtorName: 'debtor_name',
            debtorAddress: 'debtor_address',
            creditorName: 'creditor_name',
            address: 'address',
            debtAmount: 'debt_amount',
            creditorCount: 'creditor_count',
            dbSent: 'db_sent'
        };

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                const dbField = fieldMapping[field];
                updates.push(`${dbField} = ?`);
                
                if (field === 'emails' && req.body[field]) {
                    params.push(JSON.stringify(req.body[field]));
                } else if (field === 'dbSent') {
                    params.push(req.body[field] ? 'TRUE' : 'FALSE');
                } else {
                    params.push(req.body[field]);
                }
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ 
                error: 'No fields to update',
                message: '업데이트할 필드가 없습니다.'
            });
        }

        updates.push('updated_at = NOW()');
        params.push(req.params.docId, req.user.bizNum);

        await query(
            `UPDATE litigation_cases SET ${updates.join(', ')} WHERE doc_id = ? AND biz_num = ?`,
            params
        );

        res.json({
            message: '소송 사건이 업데이트되었습니다.'
        });
    } catch (error) {
        console.error('소송 사건 업데이트 오류:', error);
        res.status(500).json({ 
            error: 'Failed to update litigation case',
            message: '소송 사건 업데이트 중 오류가 발생했습니다.'
        });
    }
});

// 소송 사건 삭제
router.delete('/:docId', authenticateToken, requireManager, async (req, res) => {
    try {
        if (!req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }

        // 본인 회사 데이터만 삭제 (billing_history도 함께 정리)
        await transaction(async (conn) => {
            await conn.query(
                'DELETE bh FROM litigation_case_billing_history bh JOIN litigation_cases lc ON bh.case_doc_id = lc.doc_id WHERE lc.doc_id = ? AND lc.biz_num = ?',
                [req.params.docId, req.user.bizNum]
            );
            await conn.query(
                'DELETE FROM litigation_cases WHERE doc_id = ? AND biz_num = ?',
                [req.params.docId, req.user.bizNum]
            );
        });
        
        res.json({
            message: '소송 사건이 삭제되었습니다.'
        });
    } catch (error) {
        console.error('소송 사건 삭제 오류:', error);
        res.status(500).json({ 
            error: 'Failed to delete litigation case',
            message: '소송 사건 삭제 중 오류가 발생했습니다.'
        });
    }
});

// 소송 사건 청구 내역 조회
router.get('/:docId/billing-history', authenticateToken, async (req, res) => {
    try {
        if (!req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }

        const billingHistory = await query(
            `SELECT bh.*
             FROM litigation_case_billing_history bh
             JOIN litigation_cases lc ON bh.case_doc_id = lc.doc_id
             WHERE bh.case_doc_id = ? AND lc.biz_num = ?
             ORDER BY bh.sent_at DESC`,
            [req.params.docId, req.user.bizNum]
        );

        res.json({
            billingHistory: billingHistory.map(b => ({
                id: b.id,
                caseDocId: b.case_doc_id,
                amount: parseFloat(b.amount),
                description: b.description,
                sentAt: b.sent_at,
                status: b.status,
                createdAt: b.created_at
            }))
        });
    } catch (error) {
        console.error('청구 내역 조회 오류:', error);
        res.status(500).json({ 
            error: 'Failed to fetch billing history',
            message: '청구 내역을 가져오는 중 오류가 발생했습니다.'
        });
    }
});

// 소송 사건 청구 내역 추가
router.post('/:docId/billing-history', authenticateToken, requireManager, async (req, res) => {
    try {
        if (!req.user?.bizNum) {
            return res.status(400).json({ error: 'bizNum missing in token', message: '사용자 사업자번호(bizNum) 정보가 없습니다.' });
        }
        const { amount, description, status } = req.body;

        if (!amount || !description) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                message: '필수 입력 항목이 누락되었습니다.'
            });
        }

        // 본인 회사 사건에만 청구 내역 추가
        const [ownerCase] = await query('SELECT doc_id FROM litigation_cases WHERE doc_id = ? AND biz_num = ?', [req.params.docId, req.user.bizNum]);
        if (!ownerCase) {
            return res.status(404).json({ error: 'Case not found', message: '소송 사건을 찾을 수 없습니다.' });
        }

        await query(
            `INSERT INTO litigation_case_billing_history 
            (case_doc_id, amount, description, sent_at, status, created_at) 
            VALUES (?, ?, ?, NOW(), ?, NOW())`,
            [req.params.docId, amount, description, status || 'pending']
        );

        res.status(201).json({
            message: '청구 내역이 추가되었습니다.'
        });
    } catch (error) {
        console.error('청구 내역 추가 오류:', error);
        res.status(500).json({ 
            error: 'Failed to add billing history',
            message: '청구 내역 추가 중 오류가 발생했습니다.'
        });
    }
});

export default router;
