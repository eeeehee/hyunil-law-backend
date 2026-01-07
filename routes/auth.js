// routes/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import { generateToken } from '../middleware/auth.js';
import { validateBizNumWithAPI } from '../utils/bizNumAPI.js'; // 외부 API 헬퍼 임포트

const router = express.Router();

/**
 * bizNum 형식 검증 (사업자등록번호: 000-00-00000)
 */
function isValidBizNum(bizNum) {
  return typeof bizNum === 'string' && /^\d{3}-\d{2}-\d{5}$/.test(bizNum);
}

/**
 * companies 테이블에 회사가 없으면 생성,
 * 있으면 is_active 상태 확인
 */
async function ensureCompanyActive({ bizNum, companyName }) {
  if (!bizNum) return { ok: false, reason: 'bizNum missing' };

  const companies = await query(
    'SELECT * FROM companies WHERE biz_num = ? LIMIT 1',
    [bizNum]
  );

  // 회사 없으면 자동 생성
  if (companies.length === 0) {
    await query(
      'INSERT INTO companies (biz_num, name, is_active) VALUES (?, ?, 1)',
      [bizNum, companyName || null]
    );
    return { ok: true, created: true };
  }

  const company = companies[0];

  if (company.is_active === 0) {
    return { ok: false, reason: 'inactive' };
  }

  // name이 비어있고 companyName이 있으면 채워줌 (옵션)
  if ((!company.name || company.name === '') && companyName) {
    try {
      await query(
        'UPDATE companies SET name = ? WHERE biz_num = ?',
        [companyName, bizNum]
      );
    } catch (e) {
      // ignore
    }
  }

  return { ok: true, created: false };
}

/**
 * 회원가입
 */
router.post('/signup', async (req, res) => {
  try {
    const {
      email,
      password,
      companyName,
      representativeName,
      bizNum,
      companyPhone,
      managerName,
      phone,
      department = '전사'
    } = req.body;

    // bizNum 필수/형식 검증
    if (!bizNum || !isValidBizNum(bizNum)) {
      return res.status(400).json({
        error: 'Invalid bizNum',
        message: '사업자등록번호(bizNum) 형식이 올바르지 않습니다. 예: 123-45-67890'
      });
    }

    // 회사 활성 여부 체크 + 없으면 자동 생성 (1회만!)
    const companyCheck = await ensureCompanyActive({ bizNum, companyName });
    if (!companyCheck.ok) {
      return res.status(403).json({
        error: 'Company inactive',
        message:
          companyCheck.reason === 'inactive'
            ? '비활성화된 회사입니다. 관리자에게 문의해주세요.'
            : '회사 정보가 올바르지 않습니다.'
      });
    }

    // 필수 필드 확인
    if (
      !email ||
      !password ||
      !companyName ||
      !representativeName ||
      !managerName
    ) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: '필수 입력 항목이 누락되었습니다.'
      });
    }

    // 이메일 중복 확인
    const existingUser = await query(
      'SELECT uid FROM users WHERE email = ?',
      [email]
    );
    if (existingUser.length > 0) {
      return res.status(409).json({
        error: 'Email already exists',
        message: '이미 사용 중인 이메일입니다.'
      });
    }

    // ✅ 외부 API를 통한 사업자등록번호 유효성 검사
    const isBizNumValid = await validateBizNumWithAPI(bizNum);
    if (!isBizNumValid) {
        console.warn(`❌ [회원가입] 유효하지 않은 사업자등록번호: ${bizNum}`);
        return res.status(400).json({
            error: 'InvalidBizNum',
            message: '유효하지 않거나 폐업된 사업자등록번호입니다. 정확한 정보를 입력해주세요.'
        });
    }
    console.log(`✅ [회원가입] 사업자등록번호 외부 API 검증 완료: ${bizNum}`);

    // 사업자번호 중복 확인
    const existingBizNum = await query(
      'SELECT uid FROM users WHERE biz_num = ?',
      [bizNum]
    );
    if (existingBizNum.length > 0) {
      return res.status(409).json({
        error: 'Business number already exists',
        message: '이미 등록된 사업자번호입니다.'
      });
    }

    // 비밀번호 해싱
    const passwordHash = await bcrypt.hash(password, 10);

    // UID 생성
    const uid = uuidv4();

    // 사용자 생성
    await query(
      `INSERT INTO users
       (uid, email, password_hash, company_name, representative_name, biz_num,
        company_phone, manager_name, phone, department,
        role, plan, created_at, agreed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'user', 'none', NOW(), NOW())`,
      [
        uid,
        email,
        passwordHash,
        companyName,
        representativeName,
        bizNum,
        companyPhone,
        managerName,
        phone,
        department
      ]
    );

    // 생성된 사용자 조회
    const users = await query(
      'SELECT * FROM users WHERE uid = ?',
      [uid]
    );
    const user = users[0];

    // JWT 생성
    const token = generateToken(user);

    res.status(201).json({
      message: '회원가입이 완료되었습니다.',
      token,
      user: {
        uid: user.uid,
        email: user.email,
        companyName: user.company_name,
        representativeName: user.representative_name,
        bizNum: user.biz_num,
        managerName: user.manager_name,
        phone: user.phone,
        department: user.department,
        role: user.role,
        plan: user.plan
      }
    });
  } catch (error) {
    console.error('회원가입 오류:', error);
    res.status(500).json({
      error: 'Signup failed',
      message: '회원가입 중 오류가 발생했습니다.'
    });
  }
});

/**
 * 로그인
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: '이메일과 비밀번호를 입력해주세요.'
      });
    }

    const users = await query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: '이메일 또는 비밀번호가 올바르지 않습니다.'
      });
    }

    const user = users[0];

    if (!user.password_hash) {
      return res.status(409).json({
        error: 'Password not set',
        message:
          '이 계정은 비밀번호가 설정되어 있지 않습니다. 비밀번호 재설정을 진행해주세요.'
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: '이메일 또는 비밀번호가 올바르지 않습니다.'
      });
    }

    // 회사 활성 여부 체크 (로그인 시)
    const companyCheck = await ensureCompanyActive({
      bizNum: user.biz_num,
      companyName: user.company_name
    });
    if (!companyCheck.ok) {
      return res.status(403).json({
        error: 'Company inactive',
        message:
          companyCheck.reason === 'inactive'
            ? '비활성화된 회사입니다. 관리자에게 문의해주세요.'
            : '회사 정보가 올바르지 않습니다.'
      });
    }

    console.log('🔐 [로그인] 사용자 정보:', {
      uid: user.uid,
      email: user.email,
      role: user.role,
      bizNum: user.biz_num
    });

    const token = generateToken(user);

    let departments = null;
    if (user.departments) {
      try {
        departments = JSON.parse(user.departments);
      } catch (e) {
        departments = null;
      }
    }

    res.json({
      message: '로그인 성공',
      token,
      user: {
        uid: user.uid,
        email: user.email,
        companyName: user.company_name,
        representativeName: user.representative_name,
        bizNum: user.biz_num,
        managerName: user.manager_name,
        phone: user.phone,
        department: user.department,
        departments,
        role: user.role,
        plan: user.plan,
        qaUsedCount: user.qa_used_count,
        phoneUsedCount: user.phone_used_count
      }
    });
  } catch (error) {
    console.error('로그인 오류:', error);
    const isDev =
      (process.env.NODE_ENV || 'development') === 'development';
    res.status(500).json({
      error: 'Login failed',
      message: '로그인 중 오류가 발생했습니다.',
      ...(isDev ? { detail: error?.message, code: error?.code } : {})
    });
  }
});

/**
 * 비밀번호 재설정
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: '이메일과 새 비밀번호를 입력해주세요.'
      });
    }

    const users = await query(
      'SELECT uid FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: '해당 이메일로 등록된 사용자가 없습니다.'
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await query(
      'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE email = ?',
      [passwordHash, email]
    );

    res.json({
      message: '비밀번호가 성공적으로 변경되었습니다.'
    });
  } catch (error) {
    console.error('비밀번호 재설정 오류:', error);
    res.status(500).json({
      error: 'Password reset failed',
      message: '비밀번호 재설정 중 오류가 발생했습니다.'
    });
  }
});

export default router;
