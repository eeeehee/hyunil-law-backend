import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
router.use(authenticateToken);

// 대시보드 카운트 (답변대기중/답변완료)
// - admin/general_manager/lawyer 는 전체
// - 그 외(CEO 포함)는 회사 단위로 집계
router.get('/counts', async (req, res) => {
    try {
        const isAdmin = ['master', 'admin', 'general_manager', 'lawyer'].includes(req.user.role);
        const companyName = req.user.companyName;

        if (!isAdmin && !companyName) {
            return res.status(400).json({
                error: 'companyName missing in token',
                message: '사용자 회사명(companyName) 정보가 없습니다.'
            });
        }

        // ❌ 대시보드 집계에서 제외할 카테고리(자문이 아닌 요청들)
        const EXCLUDED_CATEGORIES = [
            'extra_usage_quote', // 추가 이용/견적 요청
            'payment_request',
            'plan_change',
            'payment_method',
            'member_req',
            'member_req_internal', // 부서변경 요청 (CEO 승인)
            'member_req_admin', // 회원 정보 변경 요청 (관리자 승인)
            'phone_log'
        ];

        let sql = `
            SELECT
              SUM(status IN ('pending', 'waiting', 'analyzing', 'processing', 'InProgress')) AS pendingCount,
              SUM(status IN ('completed', 'done', 'answered', 'resolved', 'Completed')) AS doneCount,
              COUNT(*) AS totalCount
            FROM posts
            WHERE category NOT IN (${EXCLUDED_CATEGORIES.map(() => '?').join(', ')})
        `;
        const params = [...EXCLUDED_CATEGORIES];

        if (!isAdmin) {
            sql += ' AND companyName = ?';
            params.push(companyName);
        }
const [row] = await query(sql, params);
        res.json({
            pendingCount: Number(row?.pendingCount ?? 0),
            doneCount: Number(row?.doneCount ?? 0),
            totalCount: Number(row?.totalCount ?? 0)
        });
    } catch (error) {
        console.error('게시글 카운트 조회 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
    }
});

// 게시글 목록 조회
router.get('/', async (req, res) => {
    try {
        const { category, status, search, department, limit = 50, offset = 0 } = req.query;

        let sql = `
            SELECT p.id, p.docId, p.authorUid, p.companyName, p.category, p.title, p.content,
                   p.fileUrls, p.status, p.createdAt, p.updatedAt,
                   COALESCE(p.answer, p.reply) AS answer,
                   COALESCE(p.answeredAt, p.repliedAt) AS answeredAt,
                   p.answeredBy,
                   p.quotedPrice, p.quotedAt, p.rejectReason,
                   p.previousStatus,
                   u.company_name AS userCompanyName,
                   u.manager_name AS userManagerName,
                   u.department AS userDepartment,
                   u.biz_num AS authorBizNum,
                   u.plan AS userPlan
            FROM posts p
            LEFT JOIN users u ON p.authorUid = u.uid
            WHERE 1=1
        `;
        const params = [];

        // 멀티테넌트 분리: master/admin/general_manager/lawyer 를 제외한 모든 계정은 자기 회사 것만
        const isAdmin = ['master', 'admin', 'general_manager', 'lawyer'].includes(req.user.role);
        if (!isAdmin) {
            if (!req.user.companyName) {
                return res.status(400).json({
                    error: 'companyName missing in token',
                    message: '사용자 회사명(companyName) 정보가 없습니다.'
                });
            }
            sql += ` AND (p.companyName = ? OR u.company_name = ?)`;
            params.push(req.user.companyName, req.user.companyName);
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

        if (department) {
            sql += ` AND u.department = ?`;
            params.push(department);
        }

        sql += ` ORDER BY p.createdAt DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const posts = await query(sql, params);

        // 디버깅: 첫 번째 게시글 데이터 확인
        if (posts.length > 0) {
            console.log('📋 [게시글 목록 샘플]', {
                docId: posts[0].docId,
                title: posts[0].title,
                status: posts[0].status,
                answer: posts[0].answer ? '있음' : '없음',
                담당자: posts[0].userManagerName || 'null',
                답변자: posts[0].answeredBy || 'null'
            });
        }

        res.json({ posts, total: posts.length, limit: parseInt(limit), offset: parseInt(offset) });

    } catch (error) {
        console.error('게시글 목록 조회 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
    }
});

// 게시글 상세 조회
router.get('/:docId', async (req, res) => {
    try {
        const [post] = await query(
            `SELECT p.id, p.docId, p.authorUid, p.companyName, p.category, p.title, p.content,
                    p.fileUrls, p.status, p.createdAt, p.updatedAt,
                    COALESCE(p.answer, p.reply) AS answer,
                    COALESCE(p.answeredAt, p.repliedAt) AS answeredAt,
                    p.answeredBy,
                    p.quotedPrice, p.quotedAt, p.rejectReason,
                    p.previousStatus,
                    u.company_name AS userCompanyName,
                    u.manager_name AS userManagerName,
                    u.department AS userDepartment,
                    u.email AS userEmail,
                    u.biz_num AS authorBizNum,
                    u.plan AS userPlan
             FROM posts p
             LEFT JOIN users u ON p.authorUid = u.uid
             WHERE p.docId = ?`,
            [req.params.docId]
        );

        if (!post) {
            return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
        }

        // 디버깅: 게시글 상세 데이터 확인
        console.log('📄 [게시글 상세]', {
            docId: post.docId,
            title: post.title,
            status: post.status,
            answer: post.answer ? '있음 (' + post.answer.substring(0, 20) + '...)' : '없음',
            담당자: post.userManagerName || 'null',
            답변자: post.answeredBy || 'null',
            answeredAt: post.answeredAt || 'null',
            authorUid: post.authorUid,
            companyName: post.companyName,
            userCompanyName: post.userCompanyName
        });

        const isAdmin = ['master', 'admin', 'general_manager', 'lawyer'].includes(req.user.role);
        const isOwner = post.authorUid === req.user.uid;
        const isCEO = req.user.role === 'owner'; // CEO는 자기 회사 모든 글 조회 가능
        const isSameCompany = (post.companyName === req.user.companyName) ||
                              (post.userCompanyName === req.user.companyName);

        console.log('🔐 [권한 체크]', {
            userRole: req.user.role,
            isAdmin,
            isOwner,
            isCEO,
            isSameCompany,
            userCompanyName: req.user.companyName
        });

        if (!isAdmin && !isOwner && !isCEO && !isSameCompany) {
            return res.status(403).json({ message: '접근 권한이 없습니다.' });
        }

        res.json(post);
    } catch (error) {
        console.error('게시글 상세 조회 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

import { createPost } from '../utils/post_service.js';

// ... (keep the rest of the file as is until the POST / endpoint)

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

// ... (the rest of the file)


// 게시글 수정
router.put('/:docId', async (req, res) => {
    try {
        const { title, content, status, answer, answeredAt, quotedPrice, quotedAt, rejectReason, previousStatus } = req.body;
        const { docId } = req.params;

        const [post] = await query('SELECT * FROM posts WHERE docId = ?', [docId]);

        if (!post) {
            return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
        }

        const isAdmin = ['master', 'admin', 'general_manager', 'lawyer'].includes(req.user.role);
        const isOwner = post.authorUid === req.user.uid;

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

        // 견적 금액 (관리자만)
        if (quotedPrice !== undefined && isAdmin) {
            updates.push('quotedPrice = ?');
            params.push(quotedPrice);
        }

        // 견적 발송 일시 (관리자만)
        if (quotedAt !== undefined && isAdmin) {
            updates.push('quotedAt = ?');
            params.push(new Date(quotedAt));
        }

        // 견적 거절 사유 (사용자도 가능)
        if (rejectReason !== undefined) {
            updates.push('rejectReason = ?');
            params.push(rejectReason);
        }

        // 이전 상태 저장 (관리자만)
        if (previousStatus !== undefined && isAdmin) {
            updates.push('previousStatus = ?');
            params.push(previousStatus);
        }

        // 관리자가 답변을 작성할 때
        if (answer !== undefined && isAdmin) {
            // answer와 reply 둘 다 저장 (하위 호환성)
            updates.push('answer = ?');
            params.push(answer);
            updates.push('reply = ?');
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
                updates.push('repliedAt = ?');
                params.push(new Date(answeredAt));
            } else {
                updates.push('answeredAt = NOW()');
                updates.push('repliedAt = NOW()');
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
        const isOwner = post.authorUid === req.user.uid;

        if (!isAdmin && !isOwner) {
            return res.status(403).json({ message: '삭제 권한이 없습니다.' });
        }

        // 자문 횟수 복구 로직
        const excludeCategories = ['phone_log', 'payment_request', 'plan_change', 'payment_method', 'member_req', 'extra_usage_quote', 'member_req_internal', 'member_req_admin'];
        const shouldDecrementQa = !excludeCategories.includes(post.category) && post.category !== 'phone_request';
        const shouldDecrementPhone = post.category === 'phone_request';

        if (shouldDecrementQa || shouldDecrementPhone) {
            // 게시글 작성자 정보 조회
            const [authorInfo] = await query('SELECT uid, role, biz_num FROM users WHERE uid = ? LIMIT 1', [post.authorUid]);
            let targetUidForUsage = post.authorUid;

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
