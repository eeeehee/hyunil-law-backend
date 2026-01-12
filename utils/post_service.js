// backend/utils/post_service.js
import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

export async function createPost(postData, user, connection = null) {
    // connection이 없으면 { query } 객체로 감싸서 db.query() 형태로 호출 가능하게 함
    const db = connection || { query };

    // ✅ 필드 분해 및 기본값 설정
    const { category, title, content, status } = postData;
    const department = postData.department || user.department || '전사';

    if (!category || !title || !content) {
        throw new Error('필수 항목(category, title, content)을 입력해주세요.');
    }

    const docId = uuidv4();
    const now = new Date();

    let uidToSave = user?.uid || null;
    let bizNumToSave = user?.bizNum || postData.bizNum || null;

    const isAdmin = ['master', 'admin', 'general_manager', 'lawyer'].includes(user?.role);

    // 관리자가 전화상담 기록 시 대상자 정보로 저자/회사를 덮어씀
    if (isAdmin && category === 'phone_log') {
        const targetBizNum = postData.bizNum || postData.authorBizNum || null;
        if (targetBizNum) {
            const [targetUser] = await db.query('SELECT uid, biz_num FROM users WHERE biz_num = ? LIMIT 1', [targetBizNum]);
            if (targetUser) {
                uidToSave = targetUser.uid;
                bizNumToSave = targetUser.biz_num;
            }
        }
    }

    let statusToSave = status || 'pending';
    let answeredByToSave = null;
    let answeredAtToSave = null;

    // 전화상담 기록은 바로 'done' 처리
    if (category === 'phone_log') {
        statusToSave = 'done';
        answeredByToSave = user?.manager_name || user?.email || '관리자';
        answeredAtToSave = now;
    }

    // 자문 횟수 차감 로직
    const excludeCategories = ['phone_log', 'payment_request', 'plan_change', 'payment_method', 'member_req', 'extra_usage_quote', 'member_req_internal', 'member_req_admin'];
    const shouldIncrementQa = !excludeCategories.includes(category) && category !== 'phone_request';
    const shouldIncrementPhone = category === 'phone_request';

    if ((shouldIncrementQa || shouldIncrementPhone) && uidToSave) {
        const [authorInfo] = await db.query('SELECT uid, role, biz_num FROM users WHERE uid = ? LIMIT 1', [uidToSave]);

        if (!authorInfo) {
            throw new Error(`자문 요청자(uid: ${uidToSave})가 사용자 테이블에 존재하지 않습니다.`);
        }

        let targetUidForUsage = uidToSave;

        if (authorInfo && ['manager', 'user', 'staff'].includes(authorInfo.role)) {
            const [ownerInfo] = await db.query('SELECT uid FROM users WHERE biz_num = ? AND role = "owner" LIMIT 1', [authorInfo.biz_num]);
            if (ownerInfo) {
                targetUidForUsage = ownerInfo.uid;
            }
        }

        if (shouldIncrementQa) {
            await db.query(`UPDATE users SET qa_used_count = qa_used_count + 1 WHERE uid = ?`, [targetUidForUsage]);
        } else if (shouldIncrementPhone) {
            await db.query(`UPDATE users SET phone_used_count = phone_used_count + 1 WHERE uid = ?`, [targetUidForUsage]);
        }
    }

    // 기존 DB 스키마에 맞는 INSERT (uid, bizNum, department 사용)
    await db.query(
        `INSERT INTO posts (docId, uid, bizNum, category, department, title, content, status, answeredBy, answeredAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [docId, uidToSave, bizNumToSave, category, department, title, content, statusToSave, answeredByToSave, answeredAtToSave, now, now]
    );

    const [newPost] = await db.query('SELECT * FROM posts WHERE docId = ?', [docId]);
    return newPost;
}
