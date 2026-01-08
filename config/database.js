// config/database.js
import mariadb from 'mariadb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Always load .env from the backend directory regardless of where Node is started from
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 개발 환경 확인 (NODE_ENV가 development인 경우)
const isDev = process.env.NODE_ENV === 'development';

if (isDev) {

    console.log('🔧 개발 환경 설정(.env.dev)을 로드합니다.');
    dotenv.config({ path: path.join(__dirname, '..', '.env.dev') });
} else {
    console.log('🔧 기타 환경 설정(.env)을 로드합니다.');
    dotenv.config({ path: path.join(__dirname, '..', '.env') });
}

// Connection pool 생성
const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 10,
    connectTimeout: 10000,
    acquireTimeout: 10000,
    charset: 'utf8mb4'
});

// 연결 테스트 함수
export async function testConnection() {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT 1 as test');
        console.log('✅ MariaDB 연결 성공');
        return true;
    } catch (err) {
        console.error('❌ MariaDB 연결 실패:', err);
        return false;
    } finally {
        if (conn) conn.release();
    }
}

// 쿼리 실행 헬퍼 함수
export async function query(sql, params = []) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(sql, params);
        return rows;
    } catch (err) {
        console.error('쿼리 실행 오류:', err);
        throw err;
    } finally {
        if (conn) conn.release();
    }
}

// 트랜잭션 실행 헬퍼 함수
export async function transaction(callback) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();
        
        const result = await callback(conn);
        
        await conn.commit();
        return result;
    } catch (err) {
        if (conn) await conn.rollback();
        console.error('트랜잭션 오류:', err);
        throw err;
    } finally {
        if (conn) conn.release();
    }
}

export default pool;
