/**
 * Performance monitoring middleware
 * Tracks request duration and logs slow requests
 */

const performanceMonitor = (req, res, next) => {
    const startTime = Date.now();
    
    // Store original end function
    const originalEnd = res.end;
    
    // Override end function to calculate duration
    res.end = function(...args) {
        const duration = Date.now() - startTime;
        
        // Log request details
        const logData = {
            method: req.method,
            url: req.originalUrl || req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent'),
        };
        
        // Log slow requests (> 1 second)
        if (duration > 1000) {
            console.warn('⚠️  Slow request detected:', logData);
        }
        
        // Log errors
        if (res.statusCode >= 400) {
            console.error('❌ Error response:', logData);
        }
        
        // Add performance header
        res.setHeader('X-Response-Time', `${duration}ms`);
        
        // Call original end function
        originalEnd.apply(res, args);
    };
    
    next();
};

/**
 * API metrics collector
 * Tracks API usage statistics
 */
const metrics = {
    requests: 0,
    errors: 0,
    totalDuration: 0,
    slowRequests: 0,
    endpoints: {},
};

const metricsCollector = (req, res, next) => {
    const startTime = Date.now();
    
    // Increment request counter
    metrics.requests++;
    
    // Track endpoint usage
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    if (!metrics.endpoints[endpoint]) {
        metrics.endpoints[endpoint] = {
            count: 0,
            totalDuration: 0,
            errors: 0,
        };
    }
    metrics.endpoints[endpoint].count++;
    
    // Store original end function
    const originalEnd = res.end;
    
    // Override end function
    res.end = function(...args) {
        const duration = Date.now() - startTime;
        
        // Update metrics
        metrics.totalDuration += duration;
        metrics.endpoints[endpoint].totalDuration += duration;
        
        if (duration > 1000) {
            metrics.slowRequests++;
        }
        
        if (res.statusCode >= 400) {
            metrics.errors++;
            metrics.endpoints[endpoint].errors++;
        }
        
        // Call original end function
        originalEnd.apply(res, args);
    };
    
    next();
};

/**
 * Get current metrics
 */
const getMetrics = () => {
    const avgDuration = metrics.requests > 0 
        ? Math.round(metrics.totalDuration / metrics.requests) 
        : 0;
    
    // Calculate endpoint averages
    const endpointStats = Object.entries(metrics.endpoints).map(([endpoint, data]) => ({
        endpoint,
        count: data.count,
        avgDuration: Math.round(data.totalDuration / data.count),
        errors: data.errors,
        errorRate: `${((data.errors / data.count) * 100).toFixed(2)}%`,
    }));
    
    // Sort by count (most used endpoints first)
    endpointStats.sort((a, b) => b.count - a.count);
    
    return {
        totalRequests: metrics.requests,
        totalErrors: metrics.errors,
        errorRate: `${((metrics.errors / metrics.requests) * 100).toFixed(2)}%`,
        avgResponseTime: `${avgDuration}ms`,
        slowRequests: metrics.slowRequests,
        slowRequestRate: `${((metrics.slowRequests / metrics.requests) * 100).toFixed(2)}%`,
        topEndpoints: endpointStats.slice(0, 10),
    };
};

/**
 * Reset metrics
 */
const resetMetrics = () => {
    metrics.requests = 0;
    metrics.errors = 0;
    metrics.totalDuration = 0;
    metrics.slowRequests = 0;
    metrics.endpoints = {};
};

module.exports = {
    performanceMonitor,
    metricsCollector,
    getMetrics,
    resetMetrics,
};
