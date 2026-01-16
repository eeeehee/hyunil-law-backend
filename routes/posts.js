import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// 선택적 인증 미들웨어 (토큰이 있으면 검증, 없으면 guest로 처리)
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        // 토큰 없으면 guest 사용자로 처리
        req.user = null;
        return next();
    }

    // 토큰 있으면 기존 authenticateToken 로직 실행
    return authenticateToken(req, res, next);
}

// 대시보드 카운트 (답변대기중/답변완료)
router.get('/counts', authenticateToken, async (req, res) => {
    try {
        const isAdmin = ['master', 'admin', 'general_manager', 'lawyer'].includes(req.user.role);
        const userUid = req.user.uid;

        let sql, params;

        if (isAdmin) {
            // 관리자는 전체 조회 (가장 단순한 쿼리)
            sql = `
                SELECT
                  SUM(CASE WHEN status IN ('pending', 'waiting', 'analyzing', 'processing', 'InProgress', 'Pending') THEN 1 ELSE 0 END) AS pendingCount,
                  SUM(CASE WHEN status IN ('completed', 'done', 'answered', 'resolved', 'Completed') THEN 1 ELSE 0 END) AS doneCount,
                  COUNT(*) AS totalCount
                FROM posts
                WHERE category NOT IN ('extra_usage_quote', 'payment_request', 'plan_change', 'payment_method', 'member_req', 'member_req_internal', 'member_req_admin', 'phone_log')            `;
            params = [];
        } else {
            // 일반 사용자는 같은 회사 기준 조회
            sql = `
                SELECT
                  SUM(CASE WHEN p.status IN ('pending', 'waiting', 'analyzing', 'processing', 'InProgress', 'Pending') THEN 1 ELSE 0 END) AS pendingCount,
                  SUM(CASE WHEN p.status IN ('completed', 'done', 'answered', 'resolved', 'Completed') THEN 1 ELSE 0 END) AS doneCount,
                  COUNT(p.docId) AS totalCount
                FROM posts p
                INNER JOIN users u ON p.uid = u.uid
                WHERE u.biz_num = (SELECT biz_num FROM users WHERE uid = ? LIMIT 1)
                  AND p.category NOT IN ('extra_usage_quote', 'payment_request', 'plan_change', 'payment_method', 'member_req', 'member_req_internal', 'member_req_admin', 'phone_log')
            `;
            params = [userUid];
        }

        const rows = await query(sql, params);
        const row = rows[0] || {};

        res.json({
            pendingCount: Number(row?.pendingCount ?? 0),
            doneCount: Number(row?.doneCount ?? 0),
            totalCount: Number(row?.totalCount ?? 0)
        });
    } catch (error) {
        console.error('게시글 카운트 조회 에러:', error);
        // 상세 오류 메시지 반환
        res.status(500).json({
            message: '서버 오류가 발생했습니다.',
            error: error.message,
            sql: error.sql || null
        });
    }
});

// 게시글 목록 조회
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { category, status, search, bizNum, limit = 50, offset = 0, startDate, endDate } = req.query; // startDate, endDate 추가
        const isAdmin = ['master', 'admin', 'general_manager', 'lawyer'].includes(req.user.role);

        let sql, params;

        if (isAdmin) {
            // 관리자: 전체 조회
            sql = `
                SELECT p.docId, p.uid, p.authorName, p.contact, p.bizNum, p.category, p.department, p.title, p.content, p.status, p.priority, p.assignedTo, p.answer, p.answeredBy, p.answeredAt, p.createdAt, p.updatedAt, p.rejectReason, p.quotedAt AS quotedAt,
                       u.company_name AS companyName,
                       u.manager_name AS userManagerName,
                       u.department AS userDepartment,
                       p.quoted_price AS quotedPrice,
                       u.biz_num AS authorBizNum,
                       u.plan AS userPlan
                FROM posts p
                LEFT JOIN users u ON p.uid = u.uid
                WHERE 1=1
            `;
            params = [];
        } else {
            // 일반 사용자: 같은 회사만
            sql = `
                SELECT p.docId, p.uid, p.authorName, p.contact, p.bizNum, p.category, p.department, p.title, p.content, p.status, p.priority, p.assignedTo, p.answer, p.answeredBy, p.answeredAt, p.createdAt, p.updatedAt, p.rejectReason, p.quotedAt,
                       u.company_name AS companyName,
                       u.manager_name AS userManagerName,
                       u.department AS userDepartment,
                       p.quoted_price AS quotedPrice,
                       u.biz_num AS authorBizNum,
                       u.plan AS userPlan
                FROM posts p
                INNER JOIN users u ON p.uid = u.uid
                WHERE u.biz_num = (SELECT biz_num FROM users WHERE uid = ? LIMIT 1)
            `;
            params = [req.user.uid];
        }

        // --- 날짜 필터링 추가 ---
        if (startDate) {
            sql += ` AND p.createdAt >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            sql += ` AND p.createdAt < ?`; // endDate는 다음 달 1일이므로 < 로 비교
            params.push(endDate);
        }
        // --- 날짜 필터링 끝 ---

        if (category) {
            // 콤마로 구분된 여러 카테고리 지원
            const categories = category.split(',').map(c => c.trim()).filter(c => c);
            if (categories.length > 0) {
                const placeholders = categories.map(() => '?').join(', ');
                sql += ` AND p.category IN (${placeholders})`;
                params.push(...categories);
            }
        }
        
        // ✅ bizNum 필터 추가
        if (bizNum) {
            // posts 테이블의 bizNum 또는 users 테이블의 biz_num으로 검색
            sql += ` AND (p.bizNum = ? OR u.biz_num = ?)`;
            params.push(bizNum, bizNum);
        }

        if (status) {
            // 상태 필터 매핑
            if (status === 'waiting') {
                // 답변 대기중: pending, waiting, analyzing, processing 등
                sql += ` AND p.status IN ('pending', 'waiting', 'analyzing', 'processing', 'InProgress')`;
            } else if (status === 'done') {
                // 답변 완료: done, completed 등
                sql += ` AND p.status IN ('done', 'completed', 'answered', 'resolved', 'Completed')`;
            } else {
                // 그 외는 정확한 매칭
                sql += ` AND p.status = ?`;
                params.push(status);
            }
        }

        if (search) {
            sql += ` AND (p.title LIKE ? OR p.content LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        sql += ` ORDER BY p.createdAt DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const posts = await query(sql, params);
        res.json({ posts, total: posts.length, limit: parseInt(limit), offset: parseInt(offset) });

    } catch (error) {
        console.error('게시글 목록 조회 에러:', error);
        res.status(500).json({
            message: '서버 오류가 발생했습니다.',
            error: error.message,
            sql: error.sql || null
        });
    }
});

// 게시글 상세 조회
router.get('/:docId', authenticateToken, async (req, res) => {
    try {
        const [post] = await query(
            `SELECT p.docId, p.uid, p.authorName, p.contact, p.bizNum, p.category, p.department, p.title, p.content, p.status, p.priority, p.assignedTo, p.answer, p.answeredBy, p.answeredAt, p.createdAt, p.updatedAt, p.rejectReason, p.quotedAt,
                    u.company_name AS companyName,
                    u.manager_name AS userManagerName,
                    u.email AS userEmail,
                    p.quoted_price AS quotedPrice,
                    u.biz_num AS authorBizNum,
                    u.plan AS userPlan
             FROM posts p
             LEFT JOIN users u ON p.uid = u.uid
             WHERE p.docId = ?`,
            [req.params.docId]
        );

        if (!post) {
            return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
        }

        const isAdmin = ['master', 'admin', 'general_manager', 'lawyer'].includes(req.user.role);
        const isOwner = post.uid === req.user.uid;
        const isCEO = req.user.role === 'owner';
        const isSameCompany = post.authorBizNum === req.user.bizNum;

        if (!isAdmin && !isOwner && !isCEO && !isSameCompany) {
            return res.status(403).json({ message: '접근 권한이 없습니다.' });
        }

        // 프론트 호환성을 위해 authorUid 추가
        post.authorUid = post.uid;

        res.json(post);
    } catch (error) {
        console.error('게시글 상세 조회 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

import { createPost } from '../utils/post_service.js';

// 게시글 생성 (비회원 허용 - optionalAuth 사용)
router.post('/', optionalAuth, async (req, res) => {
    try {
        const newPost = await createPost(req.body, req.user);
        res.status(201).json(newPost);
    } catch (error) {
        console.error('게시글 생성 에러:', error);
        res.status(500).json({ message: error.message || '서버 오류가 발생했습니다.' });
    }
});

// 게시글 수정
router.put('/:docId', authenticateToken, async (req, res) => {
    try {
        const { title, content, status, answer, answeredAt, quotedPrice, rejectReason, quotedAt } = req.body;
        const { docId } = req.params;

        const [post] = await query('SELECT * FROM posts WHERE docId = ?', [docId]);

        if (!post) {
            return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
        }

        const isAdmin = ['master', 'admin', 'general_manager', 'lawyer'].includes(req.user.role);
        const isOwner = post.uid === req.user.uid;

        if (!isAdmin && !isOwner) {
            return res.status(403).json({ message: '수정 권한이 없습니다.' });
        }

        const updates = [];
        const params = [];

        if (title !== undefined) {
            updates.push('title = ?');
            params.push(title);
        }

        if (content !== undefined) {
            updates.push('content = ?');
            params.push(content);
        }

        if (status !== undefined) {
            updates.push('status = ?');
            params.push(status);
        }
        
        if (quotedPrice !== undefined && isAdmin) {
            updates.push('quoted_price = ?');
            params.push(quotedPrice);
        }
        
        // 거절 사유 저장 로직 추가
        if (rejectReason !== undefined) {
            updates.push('rejectReason = ?');
            params.push(rejectReason);
        }

        // 견적 발송 일시 저장 로직 추가
        if (quotedAt !== undefined && isAdmin) {
            updates.push('quotedAt = ?');
            // ISO 8601 문자열을 MariaDB DATETIME 형식으로 변환
            const formattedQuotedAt = new Date(quotedAt).toISOString().slice(0, 19).replace('T', ' ');
            params.push(formattedQuotedAt);
        }

        // 관리자가 답변을 작성할 때
        if (answer !== undefined && isAdmin) {
            updates.push('answer = ?');
            params.push(answer);

            // answeredBy에 관리자의 manager_name 저장 (답변자 정보)
            const [adminUser] = await query('SELECT manager_name FROM users WHERE uid = ?', [req.user.uid]);
            const answeredByName = adminUser?.manager_name || req.user.email || '관리자';

            updates.push('answeredBy = ?');
            params.push(answeredByName);

            // answeredAt 설정
            if (answeredAt) {
                updates.push('answeredAt = ?');
                params.push(new Date(answeredAt));
            } else {
                updates.push('answeredAt = NOW()');
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: '수정할 내용이 없습니다.' });
        }

        updates.push('updatedAt = ?');
        params.push(new Date());
        params.push(docId);

        await query(
            `UPDATE posts SET ${updates.join(', ')} WHERE docId = ?`,
            params
        );

        const [updatedPost] = await query('SELECT * FROM posts WHERE docId = ?', [docId]);
        res.json(updatedPost);

    } catch (error) {
        console.error('게시글 수정 에러:', error);
        res.status(500).json({ 
            message: '서버 오류가 발생했습니다.',
            detail: error.message,
            sql: error.sql || null
        });
    }
});

// 게시글 삭제
router.delete('/:docId', authenticateToken, async (req, res) => {
    try {
        const { docId } = req.params;

        const [post] = await query('SELECT * FROM posts WHERE docId = ?', [docId]);

        if (!post) {
            return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
        }

        const isAdmin = ['master', 'admin', 'general_manager', 'lawyer'].includes(req.user.role);
        const isOwner = post.uid === req.user.uid;

        if (!isAdmin && !isOwner) {
            return res.status(403).json({ message: '삭제 권한이 없습니다.' });
        }

        // 자문 횟수 복구 로직
        const excludeCategories = ['phone_log', 'payment_request', 'plan_change', 'payment_method', 'member_req', 'extra_usage_quote', 'member_req_internal', 'member_req_admin'];
        const shouldDecrementQa = !excludeCategories.includes(post.category) && post.category !== 'phone_request';
        const shouldDecrementPhone = post.category === 'phone_request';

        if (shouldDecrementQa || shouldDecrementPhone) {
            // 게시글 작성자 정보 조회
            const [authorInfo] = await query('SELECT uid, role, biz_num FROM users WHERE uid = ? LIMIT 1', [post.uid]);
            let targetUidForUsage = post.uid;

            // 일반 직원(manager, user, staff)이 작성한 경우 CEO의 횟수를 복구
            if (authorInfo && ['manager', 'user', 'staff'].includes(authorInfo.role)) {
                const [ownerInfo] = await query('SELECT uid FROM users WHERE biz_num = ? AND role = "owner" LIMIT 1', [authorInfo.biz_num]);
                if (ownerInfo) {
                    targetUidForUsage = ownerInfo.uid;
                }
            }

            // 횟수 복구 (차감된 횟수를 되돌림)
            if (shouldDecrementQa) {
                await query(`UPDATE users SET qa_used_count = GREATEST(0, qa_used_count - 1) WHERE uid = ?`, [targetUidForUsage]);
                console.log(`✅ 서면 자문 횟수 복구: uid=${targetUidForUsage}, docId=${docId}`);
            } else if (shouldDecrementPhone) {
                await query(`UPDATE users SET phone_used_count = GREATEST(0, phone_used_count - 1) WHERE uid = ?`, [targetUidForUsage]);
                console.log(`✅ 전화 상담 횟수 복구: uid=${targetUidForUsage}, docId=${docId}`);
            }
        }

        await query('DELETE FROM posts WHERE docId = ?', [docId]);

        res.json({ message: '게시글이 삭제되었습니다.' });

    } catch (error) {
        console.error('게시글 삭제 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// ✅ [NEW] 부서 변경 요청 승인
router.put('/:docId/approve-department-change', authenticateToken, async (req, res) => {
    try {
        const { docId } = req.params;
        const approver = req.user; // 승인자 정보 (from authenticateToken)

        // 1. 원본 요청(post) 조회
        const [post] = await query('SELECT * FROM posts WHERE docId = ?', [docId]);
        if (!post) {
            return res.status(404).json({ message: '해당 요청을 찾을 수 없습니다.' });
        }
        // ✅ member_req_internal (일반 부서변경) 또는 member_req_admin (파일첨부 부서변경) 허용
        if (post.category !== 'member_req_internal' && post.category !== 'member_req_admin') {
            return res.status(400).json({ message: '부서 변경 요청이 아닙니다.' });
        }

        // 2. 요청자(user) 정보 조회
        const [requester] = await query('SELECT * FROM users WHERE uid = ?', [post.uid]);
        if (!requester) {
            return res.status(404).json({ message: '요청한 사용자를 찾을 수 없습니다.' });
        }

        // 3. 권한 확인 (관리자 또는 같은 회사의 owner)
        const isOwnerOfCompany = approver.role === 'owner' && approver.bizNum === requester.biz_num;
        const isAdmin = ['master', 'admin', 'general_manager'].includes(approver.role);

        if (!isAdmin && !isOwnerOfCompany) {
            return res.status(403).json({ message: '이 요청을 승인할 권한이 없습니다.' });
        }

        // 4. content에서 변경할 정보 파싱
        let requestData;
        try {
            requestData = JSON.parse(post.content);
        } catch (e) {
            return res.status(400).json({ message: '요청 데이터 형식이 잘못되었습니다.' });
        }

        // 5. 요청 타입에 따라 처리 (부서 변경 또는 직급 변경)
        const { type, newDepartment, newRank } = requestData;

        if (type === 'rank') {
            // 직급 변경 처리
            if (!newRank) {
                return res.status(400).json({ message: '변경할 직급이 요청에 포함되지 않았습니다.' });
            }
            await query('UPDATE users SET role = ? WHERE uid = ?', [newRank, requester.uid]);
        } else {
            // 부서 변경 처리 (기본)
            if (!newDepartment) {
                return res.status(400).json({ message: '변경할 부서명이 요청에 포함되지 않았습니다.' });
            }
            await query('UPDATE users SET department = ? WHERE uid = ?', [newDepartment, requester.uid]);
        }

        // 6. 요청(post)의 상태를 'completed'로 업데이트 및 승인자 정보 기록
        const approverName = approver.manager_name || approver.email;
        await query(
            "UPDATE posts SET status = 'completed', answeredBy = ?, answeredAt = NOW() WHERE docId = ?",
            [approverName, docId]
        );

        const changeType = type === 'rank' ? '직급' : '부서';
        res.json({ message: `${changeType} 변경이 승인되었고, 사용자의 정보가 업데이트되었습니다.` });

    } catch (error) {
        console.error('부서 변경 승인 에러:', error);
        res.status(500).json({ message: '서버 처리 중 오류가 발생했습니다.' });
    }
});

// ✅ [NEW] 부서 변경 요청 거절
router.put('/:docId/reject-department-change', authenticateToken, async (req, res) => {
    try {
        const { docId } = req.params;
        const { reason } = req.body;
        const rejecter = req.user;

        // 1. 원본 요청(post) 조회
        const [post] = await query('SELECT * FROM posts WHERE docId = ?', [docId]);
        if (!post) {
            return res.status(404).json({ message: '해당 요청을 찾을 수 없습니다.' });
        }
        // ✅ member_req_internal (일반 부서변경) 또는 member_req_admin (파일첨부 부서변경) 허용
        if (post.category !== 'member_req_internal' && post.category !== 'member_req_admin') {
            return res.status(400).json({ message: '부서 변경 요청이 아닙니다.' });
        }

        // 2. 요청자(user) 정보 조회
        const [requester] = await query('SELECT * FROM users WHERE uid = ?', [post.uid]);
        if (!requester) {
            return res.status(404).json({ message: '요청한 사용자를 찾을 수 없습니다.' });
        }

        // 3. 권한 확인 (관리자 또는 같은 회사의 owner)
        const isOwnerOfCompany = rejecter.role === 'owner' && rejecter.bizNum === requester.biz_num;
        const isAdmin = ['master', 'admin', 'general_manager'].includes(rejecter.role);

        if (!isAdmin && !isOwnerOfCompany) {
            return res.status(403).json({ message: '이 요청을 거절할 권한이 없습니다.' });
        }

        // 4. 요청(post)의 상태를 'rejected'로 업데이트 및 거절자/사유 기록
        const rejecterName = rejecter.manager_name || rejecter.email;
        await query(
            "UPDATE posts SET status = 'rejected', answeredBy = ?, answeredAt = NOW(), rejectReason = ? WHERE docId = ?",
            [rejecterName, reason || '사유 없음', docId]
        );

        res.json({ message: '부서 변경 요청이 거절되었습니다.' });

    } catch (error) {
        console.error('부서 변경 거절 에러:', error);
        res.status(500).json({ message: '서버 처리 중 오류가 발생했습니다.' });
    }
});

export default router;
