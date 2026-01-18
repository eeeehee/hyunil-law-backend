// backend/middleware/auth.js
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { logger } from '../config/logger.js';

dotenv.config();

// JWT 토큰 생성
export function generateToken(user) {
    return jwt.sign(
        {
            uid: user.uid,
            email: user.email,
            role: user.role,
            bizNum: user.biz_num,
            companyName: user.company_name,
            managerName: user.manager_name,
            department: user.department,
            plan: user.plan
        },
        process.env.JWT_SECRET || 'default-secret-key',
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
}

// JWT 토큰 검증 미들웨어
export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ 
            error: 'Access token required',
            message: '인증 토큰이 필요합니다.'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                error: 'Invalid or expired token',
                message: '유효하지 않거나 만료된 토큰입니다.'
            });
        }

        logger.debug('✅ [JWT 검증] 토큰에서 파싱된 사용자:', {
            uid: user.uid,
            email: user.email,
            role: user.role,
            bizNum: user.bizNum
        });

        req.user = user;
        next();
    });
}

// 역할 기반 권한 체크 미들웨어 (기본 엔진)
export function checkRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                error: 'Unauthorized',
                message: '인증이 필요합니다.'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                error: 'Forbidden',
                message: '권한이 없습니다.'
            });
        }

        next();
    };
}

/**
 * ✅ routes에서 사용하던 requireRole 호환용 export
 * 예:
 * router.get('/list',
 *   authenticateToken,
 *   requireRole('admin', 'master'),
 *   controller
 * )
 */
export const requireRole = (...roles) => checkRole(...roles);

// 관리자 권한 체크 (master는 최상위 권한)
export const requireAdmin = checkRole(
    'master',
    'admin',
    'general_manager',
    'lawyer'
);

// 관리자 또는 CEO 권한 체크
export const requireAdminOrCEO = checkRole(
    'master',
    'admin',
    'general_manager',
    'lawyer',
    'CEO',
    'owner'
);

// 매니저 이상 권한 체크
export const requireManager = checkRole(
    'master',
    'manager',
    'owner',
    'admin',
    'general_manager',
    'lawyer'
);
