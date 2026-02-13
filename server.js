require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const connectDB = require('./src/config/db');
const errorHandler = require('./src/middleware/error');
const { performanceMonitor, metricsCollector, getMetrics, resetMetrics } = require('./src/middleware/performance');

// Route imports
const authRoutes = require('./src/routes/auth');
const onboardingRoutes = require('./src/routes/onboarding');
const bookingRoutes = require('./src/routes/bookings');
const leadRoutes = require('./src/routes/leads');
const dashboardRoutes = require('./src/routes/dashboard');
const publicRoutes = require('./src/routes/public');
const formRoutes = require('./src/routes/forms');
const inventoryRoutes = require('./src/routes/inventory');
const staffRoutes = require('./src/routes/staff');
const inboxRoutes = require('./src/routes/inbox');
const automationRoutes = require('./src/routes/automations');
const integrationRoutes = require('./src/routes/integrations');
const aiRoutes = require('./src/routes/ai');
const notificationRoutes = require('./src/routes/notifications');
const testNotificationRoutes = require('./src/routes/test-notifications');

const app = express();
const server = http.createServer(app);

// Trust proxy - Required for Render and other reverse proxies
app.set('trust proxy', 1);

// Connect to MongoDB
connectDB();

// Start scheduler service for automated tasks
const { startScheduler } = require('./src/services/scheduler.service');
startScheduler();

// Middleware - Define allowedOrigins first
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    process.env.CLIENT_URL
].filter(Boolean);

// Socket.io setup
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true,
    },
});

// Socket.io authentication and connection handling
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    // Join business room
    socket.on('join_business', (businessId) => {
        socket.join(`business_${businessId}`);
        console.log(`📍 Socket ${socket.id} joined business_${businessId}`);
    });

    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });
});

// Make io available to routes
app.use((req, res, next) => {
    req.io = io;
    next();
});

// CORS Middleware

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            return callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'), false);
        }
        return callback(null, true);
    },
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Performance monitoring
app.use(performanceMonitor);
app.use(metricsCollector);

// Request logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev')); // Detailed logging in development
} else {
    app.use(morgan('combined')); // Standard Apache combined log format in production
}

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Limit each IP to 500 requests per windowMs (increased for development)
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiting to all API routes
app.use('/api/', limiter);

// Stricter rate limiting for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: 'Too many authentication attempts, please try again later.',
    skipSuccessfulRequests: true, // Don't count successful requests
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// Health check with system info
app.get('/api/health', (req, res) => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    res.status(200).json({
        success: true,
        message: 'Veltro API is running 🚀',
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor(uptime / 60)} minutes`,
        environment: process.env.NODE_ENV || 'development',
        memory: {
            used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
            total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        },
        node: process.version,
    });
});

// Performance metrics endpoint
app.get('/api/metrics', (req, res) => {
    const metrics = getMetrics();
    res.status(200).json({
        success: true,
        data: metrics,
    });
});

// Reset metrics endpoint (admin only in production)
app.post('/api/metrics/reset', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
            success: false,
            message: 'Metrics reset is not allowed in production',
        });
    }
    
    resetMetrics();
    res.status(200).json({
        success: true,
        message: 'Metrics reset successfully',
    });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/test-notifications', testNotificationRoutes);

// Error handler (must be after routes)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`\n🚀 Thierobbs API running on port ${PORT}`);
    console.log(`📍 Health: http://localhost:${PORT}/api/health`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔌 Socket.io ready for real-time updates\n`);
});
 
