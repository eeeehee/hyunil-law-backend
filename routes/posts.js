import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
router.use(authenticateToken);

// 대시보드 카운트 (답변대기중/답변완료)
router.get('/counts', async (req, res) => {
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
            `;
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
router.get('/', async (req, res) => {
    try {
        const { category, status, search, limit = 50, offset = 0 } = req.query;
        const isAdmin = ['master', 'admin', 'general_manager', 'lawyer'].includes(req.user.role);

        let sql, params;

        if (isAdmin) {
            // 관리자: 전체 조회
            sql = `
                SELECT p.docId, p.uid, p.authorName, p.contact, p.bizNum, p.category, p.department, p.title, p.content, p.status, p.priority, p.assignedTo, p.answer, p.answeredBy, p.answeredAt, p.createdAt, p.updatedAt,
                       u.company_name AS companyName,
                       u.manager_name AS userManagerName,
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
                SELECT p.docId, p.uid, p.authorName, p.contact, p.bizNum, p.category, p.department, p.title, p.content, p.status, p.priority, p.assignedTo, p.answer, p.answeredBy, p.answeredAt, p.createdAt, p.updatedAt,
                       u.company_name AS companyName,
                       u.manager_name AS userManagerName,
                       u.biz_num AS authorBizNum,
                       u.plan AS userPlan
                FROM posts p
                INNER JOIN users u ON p.uid = u.uid
                WHERE u.biz_num = (SELECT biz_num FROM users WHERE uid = ? LIMIT 1)
            `;
            params = [req.user.uid];
        }

        if (category) {
            // 콤마로 구분된 여러 카테고리 지원
            const categories = category.split(',').map(c => c.trim()).filter(c => c);
            if (categories.length > 0) {
                const placeholders = categories.map(() => '?').join(', ');
                sql += ` AND p.category IN (${placeholders})`;
                params.push(...categories);
            }
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
router.get('/:docId', async (req, res) => {
    try {
        const [post] = await query(
            `SELECT p.*,
                    u.company_name AS companyName,
                    u.manager_name AS userManagerName,
                    u.email AS userEmail,
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

// 게시글 생성
router.post('/', async (req, res) => {
    try {
        const newPost = await createPost(req.body, req.user);
        res.status(201).json(newPost);
    } catch (error) {
        console.error('게시글 생성 에러:', error);
        res.status(500).json({ message: error.message || '서버 오류가 발생했습니다.' });
    }
});

// 게시글 수정
router.put('/:docId', async (req, res) => {
    try {
        const { title, content, status, answer, answeredAt } = req.body;
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
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// 게시글 삭제
router.delete('/:docId', async (req, res) => {
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

export default router;
