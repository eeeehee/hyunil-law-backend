// utils/safe-json.js

/**
 * 안전한 JSON 파싱 유틸
 * - DB에 저장된 JSON 문자열이 깨져있거나 NULL/빈 문자열일 때도 API가 500으로 죽지 않도록 보호
 */
export function safeJsonParse(value, fallback = null) {
    if (value === null || value === undefined) return fallback;
    if (typeof value !== 'string') return value; // 이미 객체/배열이면 그대로 반환

    const trimmed = value.trim();
    if (!trimmed) return fallback;

    try {
        return JSON.parse(trimmed);
    } catch {
        return fallback;
    }
}
