import express from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { setupWebSocketRoutes, setupWebSocketEndpoints } from "./routes-websocket";
import { setupVite, serveStatic, log } from "./vite";
import { rateLimiters } from "./middleware/rate-limiter";
import { securityHeaders, sanitizeRequest, apiVersionHeader } from "./middleware/security";
import { errorHandler, notFoundHandler, handleUnhandledRejection, handleUncaughtException } from "./middleware/error-handler";
import { config } from "./config";
import { initializeProviders } from "./services/providers";
import logger from "./utils/logger";

// Setup global error handlers early
// Force restart: Agents router added
handleUnhandledRejection();
handleUncaughtException();

const app = express();

// Trust proxy in production (for load balancers, reverse proxies)
if (config.security.trustProxy) {
  app.set('trust proxy', 1);
  console.log('[SERVER] Trust proxy enabled');
}

// Enable gzip compression for all responses
app.use(compression({
  filter: (req, res) => {
    // Compress everything except Server-Sent Events
    if (req.headers.accept?.includes('text/event-stream')) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // Balanced compression level
  threshold: 1024 // Only compress responses larger than 1KB
}));

// Increase body size limit to 10MB for image uploads
// Also increase timeout for large uploads
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    // Store raw body for debugging if needed
    (req as any).rawBody = buf.toString('utf8');
  }
}));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Security middleware - add security headers and sanitize requests
app.use(securityHeaders);
app.use(sanitizeRequest);
app.use(apiVersionHeader);

// Apply rate limiting to API routes
app.use('/api/auth/login', rateLimiters.auth);
app.use('/api/auth/register', rateLimiters.auth);
app.use('/api/auth/logout', rateLimiters.auth);

// General API rate limiting
app.use('/api/', rateLimiters.api);

// Stricter limits for specific endpoints
app.post('/api/agents', rateLimiters.write);
app.patch('/api/agents/*', rateLimiters.write);
app.delete('/api/agents/*', rateLimiters.write);
app.post('/api/upload', rateLimiters.upload);
app.post('/api/whitelabel/*', rateLimiters.upload);

// Set longer timeout for upload endpoints
app.use((req, res, next) => {
  if (req.path.includes('/upload') || req.path.includes('/whitelabel')) {
    // 30 second timeout for uploads
    req.setTimeout(30000);
    res.setTimeout(30000);
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Only capture response body in development for debugging
  if (config.isDevelopment) {
    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      // Limit response capture to prevent memory issues
      const responseStr = JSON.stringify(bodyJson);
      if (responseStr.length < 500) { // Only capture small responses
        capturedJsonResponse = bodyJson;
      } else {
        capturedJsonResponse = { message: "[Response too large to log]", size: responseStr.length };
      }
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      // Only add response details in development
      if (config.isDevelopment && capturedJsonResponse) {
        const responseStr = JSON.stringify(capturedJsonResponse);
        if (responseStr.length > 80) {
          logLine += ` :: ${responseStr.slice(0, 79)}…`;
        } else {
          logLine += ` :: ${responseStr}`;
        }
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await initializeProviders();
  const server = await registerRoutes(app);

  // Setup WebSocket routes for real-time sync
  const wss = setupWebSocketRoutes(app, server);
  setupWebSocketEndpoints(app);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (config.isDevelopment) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // 404 handler - must be after all routes
  app.use('/api/*', notFoundHandler);

  // Global error handler - must be last
  app.use(errorHandler);

  // Start the server with configured host and port
  server.listen({
    port: config.port,
    host: config.host,
    reusePort: false,
  }, () => {
    logger.info('Server started', {
      host: config.host,
      port: config.port,
      publicUrl: config.publicUrl,
      environment: config.nodeEnv,
    });
    log(`serving on ${config.host}:${config.port}`);
    log(`public URL: ${config.publicUrl}`);
    log(`environment: ${config.nodeEnv}`);
  });

  // Graceful shutdown handling
  const gracefulShutdown = (signal: string) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close((err) => {
      if (err) {
        logger.error('Error during server close', { error: err.message });
        process.exit(1);
      }

      logger.info('HTTP server closed');

      // Close WebSocket connections
      if (wss) {
        wss.clients.forEach((client) => {
          client.close(1001, 'Server shutting down');
        });
        wss.close(() => {
          logger.info('WebSocket server closed');
        });
      }

      // Give ongoing requests time to complete (30 seconds max)
      const forceShutdownTimeout = setTimeout(() => {
        logger.warn('Forcing shutdown after timeout');
        process.exit(1);
      }, 30000);

      // Clear the timeout if shutdown completes
      forceShutdownTimeout.unref();

      logger.info('Graceful shutdown complete');
      process.exit(0);
    });

    // Stop accepting new requests immediately
    setTimeout(() => {
      logger.warn('Server did not close in time, forcing shutdown');
      process.exit(1);
    }, 35000).unref();
  };

  // Listen for shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
})();
