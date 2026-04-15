require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
let aiServiceProcess = null;

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

function createAuthLimiter() {
    return rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many authentication attempts. Try again later.' },
    });
}

const loginLimiter = createAuthLimiter();
const signupLimiter = createAuthLimiter();

app.use(helmet());
app.use(express.json({ limit: '100kb' }));
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
}));
app.locals.prisma = prisma;

app.use('/api/users/login', loginLimiter);
app.use('/api/users', (req, res, next) => {
    if (req.method === 'POST' && req.path === '/') return signupLimiter(req, res, next);
    return next();
});

async function ensureDefaultAdmin() {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@ecommerce.local';
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@12345';
    const forceReset = (process.env.FORCE_ADMIN_RESET_ON_STARTUP || 'true').toLowerCase() === 'true';

    if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
        console.warn('[security] DATABASE_URL is not set; skipping default admin bootstrap.');
        return;
    }

    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    try {
        const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

        if (!existingAdmin) {
            await prisma.user.create({
                data: {
                    name: 'System Admin',
                    email: adminEmail,
                    password: hashedPassword,
                    role: 'ADMIN',
                },
            });
            console.log(`[security] Created default admin user: ${adminEmail}`);
            return;
        }

        if (forceReset) {
            await prisma.user.update({
                where: { email: adminEmail },
                data: {
                    password: hashedPassword,
                    role: 'ADMIN',
                },
            });
            console.log(`[security] Reset default admin password for: ${adminEmail}`);
        }
    } catch (err) {
        console.warn(`[security] Skipping default admin bootstrap: ${err.message}`);
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function canConnect(host, port, timeoutMs = 700) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let settled = false;

        const finish = (result) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve(result);
        };

        socket.setTimeout(timeoutMs);
        socket.once('connect', () => finish(true));
        socket.once('timeout', () => finish(false));
        socket.once('error', () => finish(false));
        socket.connect(port, host);
    });
}

function resolveAiPythonPath() {
    if (process.env.AI_SERVICE_PYTHON && process.env.AI_SERVICE_PYTHON.trim()) {
        return process.env.AI_SERVICE_PYTHON.trim();
    }

    const aiServiceDir = path.resolve(__dirname, '..', 'ai_service');
    if (process.platform === 'win32') {
        return path.join(aiServiceDir, 'venv', 'Scripts', 'python.exe');
    }
    return path.join(aiServiceDir, 'venv', 'bin', 'python');
}

async function ensureAiServiceReady() {
    const autostartEnabled = (process.env.AI_AUTOSTART_ENABLED || 'true').toLowerCase() === 'true';
    if (!autostartEnabled) {
        console.log('[ai] Auto-start disabled (AI_AUTOSTART_ENABLED=false).');
        return;
    }

    const aiUrl = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000/predict';
    const strictMode = (process.env.AI_AUTOSTART_STRICT || 'false').toLowerCase() === 'true';
    const startupTimeoutMs = Number.parseInt(process.env.AI_AUTOSTART_TIMEOUT_MS || '12000', 10);
    const timeoutMs = Number.isNaN(startupTimeoutMs) ? 30000 : Math.max(startupTimeoutMs, 30000);

    let parsed;
    try {
        parsed = new URL(aiUrl);
    } catch (err) {
        const message = `[ai] Invalid AI_SERVICE_URL: ${aiUrl}`;
        if (strictMode) throw new Error(message);
        console.warn(message);
        return;
    }

    const host = parsed.hostname || '127.0.0.1';
    const port = Number.parseInt(parsed.port || '80', 10);
    if (Number.isNaN(port) || port <= 0) {
        const message = `[ai] Invalid AI service port in URL: ${aiUrl}`;
        if (strictMode) throw new Error(message);
        console.warn(message);
        return;
    }

    const alreadyRunning = await canConnect(host, port);
    if (alreadyRunning) {
        console.log(`[ai] Existing AI service detected on ${host}:${port}.`);
        return;
    }

    const aiServiceDir = process.env.AI_SERVICE_DIR
        ? path.resolve(process.env.AI_SERVICE_DIR)
        : path.resolve(__dirname, '..', 'ai_service');
    const pythonPath = resolveAiPythonPath();

    if (!fs.existsSync(aiServiceDir)) {
        const message = `[ai] AI service directory not found: ${aiServiceDir}`;
        if (strictMode) throw new Error(message);
        console.warn(message);
        return;
    }

    if (pythonPath.includes(path.sep) && !fs.existsSync(pythonPath)) {
        const message = `[ai] Python executable not found: ${pythonPath}`;
        if (strictMode) throw new Error(message);
        console.warn(message);
        return;
    }

    console.log(`[ai] Starting AI service via ${pythonPath} ...`);
    aiServiceProcess = spawn(pythonPath, ['-m', 'uvicorn', 'main:app', '--host', host, '--port', String(port)], {
        cwd: aiServiceDir,
        env: {
            ...process.env,
            AI_SERVICE_API_KEY: process.env.AI_SERVICE_API_KEY || '',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
    });

    aiServiceProcess.stdout.on('data', (chunk) => {
        process.stdout.write(`[ai] ${chunk.toString()}`);
    });
    aiServiceProcess.stderr.on('data', (chunk) => {
        process.stderr.write(`[ai] ${chunk.toString()}`);
    });

    let exitedEarly = false;
    aiServiceProcess.once('exit', (code) => {
        if (!aiServiceProcess) return;
        exitedEarly = true;
        console.warn(`[ai] AI service process exited with code ${code}.`);
        aiServiceProcess = null;
    });

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        if (exitedEarly) break;
        // eslint-disable-next-line no-await-in-loop
        const up = await canConnect(host, port);
        if (up) {
            console.log(`[ai] AI service is ready on ${host}:${port}.`);
            return;
        }
        // eslint-disable-next-line no-await-in-loop
        await sleep(500);
    }

    const message = `[ai] Auto-start did not become ready within ${timeoutMs}ms. Start manually if needed.`;
    if (strictMode) {
        throw new Error(message);
    }
    console.warn(message);
}

function setupShutdownHooks(serverRef) {
    const shutdown = async () => {
        try {
            if (serverRef && typeof serverRef.close === 'function') {
                await new Promise((resolve) => serverRef.close(resolve));
            }
            if (aiServiceProcess) {
                aiServiceProcess.kill();
                aiServiceProcess = null;
            }
            await prisma.$disconnect();
        } finally {
            process.exit(0);
        }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

// Health/root route
app.get('/', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'E-Commerce Inventory Optimizer API is running.' });
});

// Routes
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const promotionRoutes = require('./routes/promotionRoutes');
const userRoutes = require('./routes/userRoutes');
const forecastRoutes = require('./routes/forecastRoutes');
const categoryRoutes = require('./routes/categoryRoutes');

app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/forecasts', forecastRoutes);

app.use((err, req, res, next) => {
    void next;
    if (err && err.message === 'Not allowed by CORS') {
        return res.status(403).json({ error: 'CORS policy blocked this origin' });
    }
    console.error('[server] Unhandled error:', err);
    return res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
setupShutdownHooks(server);

Promise.allSettled([ensureDefaultAdmin(), ensureAiServiceReady()]).then((results) => {
    results.forEach((result) => {
        if (result.status === 'rejected') {
            console.warn('[startup] Non-fatal startup task failed:', result.reason);
        }
    });
});
