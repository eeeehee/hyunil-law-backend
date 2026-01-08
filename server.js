// server.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { testConnection } from './config/database.js';

// Routes
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import litigationCasesRoutes from './routes/litigation-cases.js';
import casesRoutes from './routes/cases.js';
import postsRoutes from './routes/posts.js';
import reportsRoutes from './routes/reports.js';
import paymentsRoutes from './routes/payments.js';
import paymentsAdminRoutes from './routes/payments-admin.js';
import leaveRequestsRoutes from './routes/leave-requests.js';
import expensesRoutes from './routes/expenses.js';
import creditReportsRoutes from './routes/credit-reports.js';
import adminRoutes from './routes/admin.js';
import bizSodaRoutes from './routes/biz-soda.js';
import billingRoutes from './routes/billing.js';
import uploadRoutes from './routes/upload.js';
import approvalRequestsRoutes from './routes/approval-requests.js';

// Always load .env from this backend directory regardless of where Node is started from
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// dotenv.config handled in config/database.js

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/litigation-cases', litigationCasesRoutes);
app.use('/api/cases', casesRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/payments-admin', paymentsAdminRoutes);
app.use('/api/leave-requests', leaveRequestsRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/credit-reports', creditReportsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/biz-soda', bizSodaRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/approval-requests', approvalRequestsRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Not Found',
        message: '요청한 리소스를 찾을 수 없습니다.',
        path: req.path
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('서버 오류:', err);
    res.status(err.status || 500).json({ 
        error: err.message || 'Internal Server Error',
        message: '서버 오류가 발생했습니다.'
    });
});

// Start server
async function startServer() {
    try {
        // Test database connection
        const dbConnected = await testConnection();
        
        if (!dbConnected) {
            console.error('❌ 데이터베이스 연결 실패. 서버를 시작할 수 없습니다.');
            process.exit(1);
        }

        app.listen(PORT, () => {
            console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 Corporate Hyunil Law Backend API Server         ║
║                                                       ║
║   Port: ${PORT}                                     ║
║   Environment: ${process.env.NODE_ENV || 'development'}                              ║
║   Database: corporatehyunillaw_test                  ║
║                                                       ║
║   API Documentation:                                  ║
║   - POST   /api/auth/signup                          ║
║   - POST   /api/auth/login                           ║
║   - GET    /api/users/me                             ║
║   - GET    /api/litigation-cases                     ║
║   - GET    /api/cases/debt                           ║
║   - GET    /api/cases/pasan                          ║
║   - GET    /api/cases/consultation                   ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
            `);
        });
    } catch (error) {
        console.error('서버 시작 오류:', error);
        process.exit(1);
    }
}

startServer();
