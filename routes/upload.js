import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Multer 설정
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../uploads'));
    },
    filename: function (req, file, cb) {
        // 파일명: 타임스탬프_원본파일명
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const basename = path.basename(file.originalname, ext);
        cb(null, basename + '-' + uniqueSuffix + ext);
    }
});

// 파일 필터 (허용된 확장자만)
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/zip',
        'application/x-zip-compressed',
        'text/plain'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('허용되지 않은 파일 형식입니다. (허용: 이미지, PDF, Office 문서, 압축파일, 텍스트)'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB 제한
    }
});

// 파일 업로드 API (인증 필요)
router.post('/', authenticateToken, (req, res) => {
    upload.single('file')(req, res, (err) => {
        // Multer 에러 처리
        if (err) {
            console.error('파일 업로드 에러:', err);

            if (err.message.includes('허용되지 않은 파일 형식')) {
                return res.status(400).json({
                    success: false,
                    message: '허용되지 않은 파일 형식입니다.\n\n허용 형식: 이미지(JPG, PNG, GIF), PDF, Office 문서(Word, Excel, PPT), 압축파일(ZIP), 텍스트'
                });
            }

            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    success: false,
                    message: '파일 크기가 너무 큽니다. 10MB 이하의 파일만 업로드 가능합니다.'
                });
            }

            return res.status(500).json({
                success: false,
                message: '파일 업로드 중 오류가 발생했습니다: ' + err.message
            });
        }

        // 파일이 없는 경우
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '파일이 선택되지 않았습니다.'
            });
        }

        // 업로드 성공
        const fileUrl = `/uploads/${req.file.filename}`;
        res.json({
            success: true,
            fileUrl: fileUrl,
            fileName: req.file.originalname,
            fileSize: req.file.size
        });
    });
});

// 다중 파일 업로드 API (최대 5개)
router.post('/multiple', authenticateToken, upload.array('files', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: '파일이 업로드되지 않았습니다.' });
        }

        const fileUrls = req.files.map(file => ({
            fileUrl: `/uploads/${file.filename}`,
            fileName: file.originalname,
            fileSize: file.size
        }));

        res.json({
            success: true,
            files: fileUrls
        });

    } catch (error) {
        console.error('다중 파일 업로드 에러:', error);
        res.status(500).json({ message: '파일 업로드 중 오류가 발생했습니다.', error: error.message });
    }
});

export default router;
