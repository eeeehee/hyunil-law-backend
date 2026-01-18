import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';
import rtracer from 'cls-rtracer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 로그 저장 경로 (프로젝트 루트/logs)
const logDir = path.join(__dirname, '../logs');

// 로그 레벨 정의
const { combine, timestamp, printf, colorize, json } = winston.format;

// Request ID를 info 객체에 추가하는 커스텀 포맷
const appendRequestId = winston.format((info) => {
    const rid = rtracer.id();
    if (rid) {
        info.requestId = rid;
    }
    return info;
});

// 로그 포맷 정의 (콘솔용)
const consoleFormat = printf(({ level, message, timestamp, requestId, ...metadata }) => {
    let msg = `${timestamp} [${level}]`;
    if (requestId) {
        msg += ` [ReqId: ${requestId}]`;
    }
    msg += `: ${message}`;
    
    if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
});

// Winston 로거 생성
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: combine(
        appendRequestId(), // 모든 로그에 Request ID 주입
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        json() // 파일에는 JSON 형태로 저장 (분석 용이)
    ),
    transports: [
        // 1. 에러 로그 (매일 새로운 파일 생성)
        new winston.transports.DailyRotateFile({
            level: 'error',
            datePattern: 'YYYY-MM-DD',
            dirname: logDir,
            filename: '%DATE%-error.log',
            maxFiles: '30d', // 30일치 보관
            zippedArchive: true,
        }),
        // 2. 전체 로그 (Info 이상)
        new winston.transports.DailyRotateFile({
            level: 'info',
            datePattern: 'YYYY-MM-DD',
            dirname: logDir,
            filename: '%DATE%-combined.log',
            maxFiles: '30d',
            zippedArchive: true,
        }),
    ],
});

// 개발 환경일 경우 콘솔 출력 추가
if (process.env.NODE_ENV !== 'production') {
    logger.add(
        new winston.transports.Console({
            format: combine(
                appendRequestId(), // 콘솔에도 적용
                colorize({ all: true }), // 색상 적용
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                consoleFormat
            ),
        })
    );
}

// Morgan(HTTP 로그)과 연동하기 위한 스트림
const stream = {
    write: (message) => {
        // Morgan은 끝에 \n을 붙이므로 제거하고 info 레벨로 기록
        logger.info(message.trim());
    },
};

export { logger, stream };
