import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
router.use(authenticateToken);

// ===========================
// 1. 서비스 단가 관리 API (특정 경로이므로 상단 배치)
// ===========================

// 서비스 단가 조회
router.get('/service-prices', requireAdmin, async (req, res) => {
    try {
        const prices = await query('SELECT * FROM service_prices ORDER BY id');
        res.json({ prices });

    } catch (error) {
        console.error('서비스 단가 조회 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
    }
});

// 서비스 단가 업데이트
router.put('/service-prices', requireAdmin, async (req, res) => {
    console.log('🔥🔥🔥 PUT /service-prices 핸들러 실행됨!!! 🔥🔥🔥');
    
    try {
        const { prices } = req.body;

        if (!prices || typeof prices !== 'object') {
            console.error('❌ [단가 설정] 잘못된 요청:', req.body);
            return res.status(400).json({ message: '잘못된 요청입니다.' });
        }

        console.log('💾 [단가 설정] 저장 시작:', prices);

        for (const [type, price] of Object.entries(prices)) {
            await query(
                `INSERT INTO service_prices (type, price)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE price = ?`,
                [type, price, price]
            );
        }

        const updatedPrices = await query('SELECT * FROM service_prices ORDER BY id');
        res.json({
            success: true,
            message: '단가 설정이 저장되었습니다.',
            prices: updatedPrices
        });

    } catch (error) {
        console.error('❌ [단가 설정] 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// ===========================
// 2. 매출 장부 API
// ===========================

// 매출 목록 조회
router.get('/', requireAdmin, async (req, res) => {
    try {
        const { year, month, status, search } = req.query;

        let sql = `
            SELECT * FROM payments
            WHERE type != 'expense'
        `;
        const params = [];

        // 연도 필터
        if (year && year !== 'all') {
            sql += ` AND YEAR(date) = ?`;
            params.push(parseInt(year));
        }

        // 월 필터
        if (month && month !== 'all') {
            sql += ` AND MONTH(date) = ?`;
            params.push(parseInt(month));
        }

        // 상태 필터
        if (status && status !== 'all') {
            sql += ` AND status = ?`;
            params.push(status);
        }

        // 검색
        if (search) {
            sql += ` AND companyName LIKE ?`;
            params.push(`%${search}%`);
        }

        sql += ` ORDER BY date DESC`;

        const payments = await query(sql, params);

        // ✅ 각 청구서의 올바른 결제수단 조회 및 적용
        for (const payment of payments) {
            // 회사 정보 조회
            const [user] = await query(`
                SELECT biz_num AS bizNum FROM users
                WHERE company_name = ? AND role = 'owner'
                LIMIT 1
            `, [payment.companyName]);

            if (user) {
                // posts 테이블에서 결제수단 조회 (companyName으로 검색)
                const [paymentMethodPost] = await query(`
                    SELECT title FROM posts
                    WHERE category = 'payment_method'
                      AND companyName = ?
                    ORDER BY createdAt DESC
                    LIMIT 1
                `, [payment.companyName]);

                if (paymentMethodPost && paymentMethodPost.title) {
                    // title에서 결제수단 추출
                    if (paymentMethodPost.title.includes('CMS') || paymentMethodPost.title.includes('자동이체')) {
                        payment.method = 'CMS';
                    } else if (paymentMethodPost.title.includes('카드') || paymentMethodPost.title.includes('Card')) {
                        payment.method = 'Card';
                    } else if (paymentMethodPost.title.includes('계좌이체')) {
                        payment.method = 'Transfer';
                    }
                }
            }
        }

        res.json({ payments });

    } catch (error) {
        console.error('매출 목록 조회 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
    }
});

// 매출 통계 조회
router.get('/stats', requireAdmin, async (req, res) => {
    try {
        const { year, month } = req.query;

        let sql = `
            SELECT
                SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS paidRevenue,
                SUM(CASE WHEN status = 'refund' THEN (amount - COALESCE(refundAmount, 0)) ELSE 0 END) AS refundRevenue,
                SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END) AS overdueAmount,
                COUNT(*) AS totalCount
            FROM payments
            WHERE type != 'expense'
        `;
        const params = [];

        if (year && year !== 'all') {
            sql += ` AND YEAR(date) = ?`;
            params.push(parseInt(year));
        }

        if (month && month !== 'all') {
            sql += ` AND MONTH(date) = ?`;
            params.push(parseInt(month));
        }

        const [stats] = await query(sql, params);

        // 구독 회원 수 조회
        const [contractStats] = await query(`
            SELECT COUNT(*) AS contractCount
            FROM users
            WHERE plan IS NOT NULL AND plan != 'none'
        `);

        const revenue = Number(stats?.paidRevenue || 0) + Number(stats?.refundRevenue || 0);

        res.json({
            revenue: revenue,
            contractCount: Number(contractStats?.contractCount || 0),
            overdueAmount: Number(stats?.overdueAmount || 0),
            totalCount: Number(stats?.totalCount || 0)
        });

    } catch (error) {
        console.error('통계 조회 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
    }
});

// 매출 등록
router.post('/', requireAdmin, async (req, res) => {
    try {
        const { companyName, type, plan, amount, method, status, note } = req.body;

        if (!companyName || !amount) {
            return res.status(400).json({ message: '기업명과 금액은 필수입니다.' });
        }

        const docId = uuidv4();
        const now = new Date();

        await query(
            `INSERT INTO payments (docId, companyName, type, plan, amount, method, status, note, date, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [docId, companyName, type || 'advisory', plan, amount, method, status || 'scheduled', note, now, now, now]
        );

        const [newPayment] = await query('SELECT * FROM payments WHERE docId = ?', [docId]);
        res.status(201).json(newPayment);

    } catch (error) {
        console.error('매출 등록 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
    }
});

// 매출 상태 업데이트
router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, refundAmount } = req.body;

        const updates = [];
        const params = [];

        if (status) {
            updates.push('status = ?');
            params.push(status);
        }

        if (refundAmount !== undefined) {
            updates.push('refundAmount = ?');
            params.push(refundAmount);

            if (status === 'refund') {
                updates.push('refundedAt = ?');
                params.push(new Date());
            }
        }

        updates.push('updatedAt = ?');
        params.push(new Date());
        params.push(id);

        await query(
            `UPDATE payments SET ${updates.join(', ')} WHERE docId = ?`,
            params
        );

        const [updatedPayment] = await query('SELECT * FROM payments WHERE docId = ?', [id]);
        res.json(updatedPayment);

    } catch (error) {
        console.error('매출 업데이트 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
    }
});

// ===========================
// 3. 구독 회원 관리 API
// ===========================

// 구독 회원 목록 조회
router.get('/contracts', requireAdmin, async (req, res) => {
    try {
        const { search } = req.query;

        let sql = `
            SELECT uid, company_name AS companyName, biz_num AS bizNum, manager_name AS ownerName,
                   phone, plan, custom_cost AS customCost, billing_cycle AS billingCycle,
                   contract_end_date AS contractEndDate
            FROM users
            WHERE plan IS NOT NULL AND plan != 'none'
        `;
        const params = [];

        if (search) {
            sql += ` AND company_name LIKE ?`;
            params.push(`%${search}%`);
        }

        const contracts = await query(sql, params);
        res.json({ contracts });

    } catch (error) {
        console.error('구독 회원 목록 조회 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
    }
});

// 구독 회원 정보 업데이트
router.put('/contracts/:uid', requireAdmin, async (req, res) => {
    try {
        const { uid } = req.params;
        const { plan, customCost, contractEndDate, billingCycle, bizNum } = req.body;

        const updates = [];
        const params = [];

        if (plan !== undefined) {
            updates.push('plan = ?');
            params.push(plan);
        }

        if (customCost !== undefined) {
            updates.push('custom_cost = ?');
            params.push(customCost || null);
        }

        if (contractEndDate !== undefined) {
            updates.push('contract_end_date = ?');
            params.push(contractEndDate || null);
        }

        if (billingCycle !== undefined) {
            updates.push('billing_cycle = ?');
            params.push(billingCycle);
        }

        if (bizNum !== undefined) {
            updates.push('biz_num = ?');
            params.push(bizNum);
        }

        params.push(uid);

        await query(
            `UPDATE users SET ${updates.join(', ')} WHERE uid = ?`,
            params
        );

        const [updatedUser] = await query(`
            SELECT uid, company_name AS companyName, biz_num AS bizNum, plan, custom_cost AS customCost,
                   billing_cycle AS billingCycle, contract_end_date AS contractEndDate
            FROM users WHERE uid = ?
        `, [uid]);

        res.json(updatedUser);

    } catch (error) {
        console.error('구독 회원 업데이트 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
    }
});

// 정기 청구서 일괄 생성
router.post('/generate-monthly', requireAdmin, async (req, res) => {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        // 구독 회원 목록 조회 (연납 제외)
        const contracts = await query(`
            SELECT uid, company_name AS companyName, biz_num AS bizNum, plan, custom_cost AS customCost,
                   billing_cycle AS billingCycle
            FROM users
            WHERE plan IS NOT NULL
              AND plan != 'none'
              AND (billing_cycle = 'monthly' OR billing_cycle IS NULL)
        `);

        let generatedCount = 0;

        for (const contract of contracts) {
            // 이미 이번 달 청구서가 있는지 확인
            const [existing] = await query(`
                SELECT id FROM payments
                WHERE companyName = ?
                  AND plan = ?
                  AND YEAR(date) = ?
                  AND MONTH(date) = ?
            `, [contract.companyName, contract.plan, year, month]);

            if (existing) continue;

            // 금액 결정 (customCost 우선, 없으면 기본 단가)
            let amount = contract.customCost;

            if (!amount) {
                const [price] = await query('SELECT price FROM service_prices WHERE type = ?', [contract.plan]);
                amount = price?.price || 0;
            }

            if (amount === 0 && contract.plan === 'Enterprise') continue;

            // 청구서 생성 - 회사가 설정한 결제수단 사용
            // posts 테이블에서 해당 회사의 결제수단 조회 (category='payment_method')
            const [paymentMethodPost] = await query(`
                SELECT title FROM posts
                WHERE category = 'payment_method'
                  AND companyName = ?
                ORDER BY createdAt DESC
                LIMIT 1
            `, [contract.companyName]);

            let paymentMethod = 'Card'; // 기본값
            if (paymentMethodPost && paymentMethodPost.title) {
                // title에서 결제수단 추출 (예: "CMS 자동이체", "신용카드" 등)
                if (paymentMethodPost.title.includes('CMS') || paymentMethodPost.title.includes('자동이체')) {
                    paymentMethod = 'CMS';
                } else if (paymentMethodPost.title.includes('카드') || paymentMethodPost.title.includes('Card')) {
                    paymentMethod = 'Card';
                } else if (paymentMethodPost.title.includes('계좌이체')) {
                    paymentMethod = 'Transfer';
                }
            }

            const docId = uuidv4();
            await query(
                `INSERT INTO payments (docId, companyName, type, plan, amount, method, status, note, date, createdAt, updatedAt)
                 VALUES (?, ?, 'advisory', ?, ?, ?, 'scheduled', ?, ?, ?, ?)`,
                [docId, contract.companyName, contract.plan, amount, paymentMethod, `${month}월 정기결제`, now, now, now]
            );

            generatedCount++;
        }

        res.json({
            message: `${year}년 ${month}월 정기 청구서 생성 완료`,
            generated: generatedCount
        });

    } catch (error) {
        console.error('정기 청구서 생성 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
    }
});

// ===========================
// 4. 통합 검색 API (기업회원/소송/상담 DB)
// ===========================

// 전체 고객 통합 검색
router.get('/search-clients', requireAdmin, async (req, res) => {
    try {
        const results = [];

        // 1. 기업회원
        const users = await query(`
            SELECT DISTINCT company_name AS name, 'corp' AS type, '기업회원' AS info
            FROM users
            WHERE company_name IS NOT NULL AND company_name != ''
        `);
        results.push(...users);

        // 2. 소송 고객 (litigation_cases 테이블이 있는 경우)
        try {
            const litigation = await query(`
                SELECT DISTINCT client_name AS name, 'lit' AS type, '소송고객' AS info
                FROM litigation_cases
                WHERE client_name IS NOT NULL AND client_name != ''
            `);
            results.push(...litigation);
        } catch (e) {
            // 테이블이 없으면 무시
        }

        // 3. 상담 DB (consultations 테이블이 있는 경우)
        try {
            const consultations = await query(`
                SELECT DISTINCT client_name AS name, 'cons' AS type, '상담고객' AS info
                FROM consultations
                WHERE client_name IS NOT NULL AND client_name != ''
            `);
            results.push(...consultations);
        } catch (e) {
            // 테이블이 없으면 무시
        }

        // 중복 제거
        const uniqueClients = Array.from(
            new Map(results.map(item => [item.name, item])).values()
        );

        res.json({ clients: uniqueClients });

    } catch (error) {
        console.error('통합 검색 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
    }
});

export default router;