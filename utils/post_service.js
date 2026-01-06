// backend/utils/post_service.js
import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

export async function createPost(postData, user) {
    // ✅ 기본 필드
    const { category, title, content, fileUrls, status } = postData;

    // ✅ (관리자 전용) 특정 사업자 카드에 귀속시키기 위한 옵션 필드
    const targetAuthorUid = postData.authorUid || postData.targetOwnerUid || null;
    const targetCompanyName = postData.companyName || postData.targetCompanyName || null;
    const targetBizNum = postData.bizNum || postData.authorBizNum || null;

    if (!category || !title || !content) {
        throw new Error('필수 항목을 입력해주세요.');
    }

    const docId = uuidv4();
    const now = new Date();

    const fileUrlsJson = fileUrls ? JSON.stringify(fileUrls) : null;

    let authorUidToSave = user.uid;
    let companyNameToSave = user.companyName;

    const isAdmin = ['master', 'admin', 'general_manager', 'lawyer'].includes(user.role);

    if (isAdmin && category === 'phone_log') {
        if (targetBizNum) {
            const [targetUser] = await query('SELECT uid, company_name FROM users WHERE biz_num = ? LIMIT 1', [targetBizNum]);
            if (!targetUser) throw new Error('대상 사업자(biz_num)를 users에서 찾을 수 없습니다.');
            authorUidToSave = targetUser.uid;
            companyNameToSave = targetUser.company_name;
        } else if (targetAuthorUid) {
            const [targetUser] = await query('SELECT uid, company_name FROM users WHERE uid = ? LIMIT 1', [targetAuthorUid]);
            if (!targetUser) throw new Error('대상 authorUid를 users에서 찾을 수 없습니다.');
            authorUidToSave = targetUser.uid;
            companyNameToSave = targetCompanyName || targetUser.company_name;
        } else if (targetCompanyName) {
            const [targetUser] = await query('SELECT uid, company_name FROM users WHERE company_name = ? LIMIT 1', [targetCompanyName]);
            if (!targetUser) throw new Error('대상 companyName을 users에서 찾을 수 없습니다.');
            authorUidToSave = targetUser.uid;
            companyNameToSave = targetUser.company_name;
        }
    }

    let statusToSave = status || 'pending';
    let answeredByToSave = null;
    let answeredAtToSave = null;

    if (category === 'phone_log') {
        statusToSave = 'done';
        const [writerUser] = await query('SELECT manager_name FROM users WHERE uid = ? LIMIT 1', [user.uid]);
        answeredByToSave = writerUser?.manager_name || user.email || '관리자';
        answeredAtToSave = now;
    }

    const excludeCategories = ['phone_log', 'payment_request', 'plan_change', 'payment_method', 'member_req', 'extra_usage_quote'];
    const shouldIncrementQa = !excludeCategories.includes(category) && category !== 'phone_request';
    const shouldIncrementPhone = category === 'phone_request';

    if (shouldIncrementQa || shouldIncrementPhone) {
        const [authorInfo] = await query('SELECT uid, role, biz_num FROM users WHERE uid = ? LIMIT 1', [authorUidToSave]);
        let targetUidForUsage = authorUidToSave;

        if (authorInfo && ['manager', 'user', 'staff'].includes(authorInfo.role)) {
            const [ownerInfo] = await query('SELECT uid FROM users WHERE biz_num = ? AND role = "owner" LIMIT 1', [authorInfo.biz_num]);
            if (ownerInfo) {
                targetUidForUsage = ownerInfo.uid;
            }
        }

        if (shouldIncrementQa) {
            await query(`UPDATE users SET qa_used_count = qa_used_count + 1 WHERE uid = ?`, [targetUidForUsage]);
        } else if (shouldIncrementPhone) {
            await query(`UPDATE users SET phone_used_count = phone_used_count + 1 WHERE uid = ?`, [targetUidForUsage]);
        }
    }

    await query(
        `INSERT INTO posts (docId, category, title, content, fileUrls, authorUid, companyName, status, answeredBy, answeredAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [docId, category, title, content, fileUrlsJson, authorUidToSave, companyNameToSave, statusToSave, answeredByToSave, answeredAtToSave, now, now]
    );

    const [newPost] = await query('SELECT * FROM posts WHERE docId = ?', [docId]);
    return newPost;
}