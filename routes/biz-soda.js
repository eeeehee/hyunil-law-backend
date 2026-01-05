import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// ============================================================
// Biz Soda 요청 관리 API
// ============================================================

// Biz Soda 요청 생성 (사용자)
router.post('/requests', authenticateToken, async (req, res) => {
    try {
        const { type, targetName, targetId } = req.body;

        if (!['BIZ', 'CEO'].includes(type)) {
            return res.status(400).json({ error: 'InvalidType', message: '유효하지 않은 타입입니다.' });
        }

        if (!targetName || !targetId) {
            return res.status(400).json({ error: 'MissingFields', message: '대상 정보를 입력해주세요.' });
        }

        const docId = uuidv4();

        await query(
            `INSERT INTO biz_soda_requests
            (docId, type, requesterUid, requesterName, targetName, targetId, status, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
            [docId, type, req.user.uid, req.user.managerName, targetName, targetId]
        );

        res.json({ message: 'Biz Soda 요청이 등록되었습니다.', docId });
    } catch (error) {
        console.error('Biz Soda 요청 생성 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: 'Biz Soda 요청 등록에 실패했습니다.' });
    }
});

// Biz Soda 요청 목록 조회 (관리자)
router.get('/requests', authenticateToken, requireRole('master', 'admin', 'lawyer'), async (req, res) => {
    try {
        const { type, status } = req.query;

        let sql = 'SELECT * FROM biz_soda_requests WHERE 1=1';
        const params = [];

        if (type) {
            sql += ' AND type = ?';
            params.push(type);
        }

        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }

        sql += ' ORDER BY createdAt DESC';

        const requests = await query(sql, params);
        res.json({ requests });
    } catch (error) {
        console.error('Biz Soda 요청 조회 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: 'Biz Soda 요청을 불러올 수 없습니다.' });
    }
});

// Biz Soda 요청 상세 조회
router.get('/requests/:docId', authenticateToken, async (req, res) => {
    try {
        const { docId } = req.params;

        const results = await query(
            'SELECT * FROM biz_soda_requests WHERE docId = ?',
            [docId]
        );

        if (results.length === 0) {
            return res.status(404).json({ error: 'NotFound', message: '요청을 찾을 수 없습니다.' });
        }

        res.json({ request: results[0] });
    } catch (error) {
        console.error('Biz Soda 요청 상세 조회 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '요청을 불러올 수 없습니다.' });
    }
});

// Biz Soda 요청 결과 등록 (관리자)
router.put('/requests/:docId/result', authenticateToken, requireRole('master', 'admin', 'lawyer'), async (req, res) => {
    try {
        const { docId } = req.params;
        const { resultUrl, adminComment } = req.body;

        await query(
            `UPDATE biz_soda_requests SET
                status = 'done',
                resultUrl = ?,
                adminComment = ?,
                completedAt = NOW()
            WHERE docId = ?`,
            [resultUrl, adminComment, docId]
        );

        res.json({ message: '결과가 등록되었습니다.' });
    } catch (error) {
        console.error('Biz Soda 결과 등록 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '결과 등록에 실패했습니다.' });
    }
});

// ============================================================
// Legal Asset 요청 관리 API
// ============================================================

// Legal Asset 요청 생성
router.post('/legal-requests', authenticateToken, async (req, res) => {
    try {
        const { targetName, targetId, fileTitleUrl, fileNoticeUrl } = req.body;

        if (!targetName || !targetId) {
            return res.status(400).json({ error: 'MissingFields', message: '대상 정보를 입력해주세요.' });
        }

        const docId = uuidv4();

        await query(
            `INSERT INTO legal_asset_requests
            (docId, requesterUid, requesterName, targetName, targetId, fileTitleUrl, fileNoticeUrl, status, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'reviewing', NOW())`,
            [docId, req.user.uid, req.user.managerName, targetName, targetId, fileTitleUrl, fileNoticeUrl]
        );

        res.json({ message: 'Legal Asset 요청이 등록되었습니다.', docId });
    } catch (error) {
        console.error('Legal Asset 요청 생성 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: 'Legal Asset 요청 등록에 실패했습니다.' });
    }
});

// Legal Asset 요청 목록 조회 (관리자)
router.get('/legal-requests', authenticateToken, requireRole('master', 'admin', 'lawyer'), async (req, res) => {
    try {
        const { status } = req.query;

        let sql = 'SELECT * FROM legal_asset_requests WHERE 1=1';
        const params = [];

        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }

        sql += ' ORDER BY createdAt DESC';

        const requests = await query(sql, params);
        res.json({ requests });
    } catch (error) {
        console.error('Legal Asset 요청 조회 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: 'Legal Asset 요청을 불러올 수 없습니다.' });
    }
});

// Legal Asset 요청 승인
router.put('/legal-requests/:docId/approve', authenticateToken, requireRole('master', 'admin', 'lawyer'), async (req, res) => {
    try {
        const { docId } = req.params;
        const { bankInfo, cardInfo, assetInfo, resultUrl } = req.body;

        await query(
            `UPDATE legal_asset_requests SET
                status = 'approved',
                bankInfo = ?,
                cardInfo = ?,
                assetInfo = ?,
                resultUrl = ?,
                completedAt = NOW()
            WHERE docId = ?`,
            [bankInfo, cardInfo, assetInfo, resultUrl, docId]
        );

        res.json({ message: '승인 및 결과가 등록되었습니다.' });
    } catch (error) {
        console.error('Legal Asset 승인 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '승인에 실패했습니다.' });
    }
});

// Legal Asset 요청 반려
router.put('/legal-requests/:docId/reject', authenticateToken, requireRole('master', 'admin', 'lawyer'), async (req, res) => {
    try {
        const { docId } = req.params;
        const { rejectReason } = req.body;

        await query(
            `UPDATE legal_asset_requests SET
                status = 'rejected',
                rejectReason = ?,
                completedAt = NOW()
            WHERE docId = ?`,
            [rejectReason, docId]
        );

        res.json({ message: '요청이 반려되었습니다.' });
    } catch (error) {
        console.error('Legal Asset 반려 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '반려에 실패했습니다.' });
    }
});

// ============================================================
// 통계 API
// ============================================================

// Biz Soda 통계
router.get('/stats', authenticateToken, requireRole('master', 'admin', 'lawyer'), async (req, res) => {
    try {
        const bizCount = await query(
            `SELECT COUNT(*) as count FROM biz_soda_requests WHERE type = 'BIZ' AND status = 'pending'`
        );

        const ceoCount = await query(
            `SELECT COUNT(*) as count FROM biz_soda_requests WHERE type = 'CEO' AND status = 'pending'`
        );

        const legalCount = await query(
            `SELECT COUNT(*) as count FROM legal_asset_requests WHERE status = 'reviewing'`
        );

        res.json({
            biz: bizCount[0].count,
            ceo: ceoCount[0].count,
            legal: legalCount[0].count
        });
    } catch (error) {
        console.error('통계 조회 에러:', error);
        res.status(500).json({ error: 'DatabaseError', message: '통계를 불러올 수 없습니다.' });
    }
});

export default router;
