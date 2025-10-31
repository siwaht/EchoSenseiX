import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { setupWebSocketRoutes, setupWebSocketEndpoints } from "./routes-websocket";
import { setupVite, serveStatic, log } from "./vite";
import { rateLimiters } from "./middleware/rate-limiter";
import { config } from "./config";

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
  verify: (req, res, buf) => {
    // Store raw body for debugging if needed
    (req as any).rawBody = buf.toString('utf8');
  }
}));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));


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

import { seedAdminUser } from "./seedAdmin";

(async () => {
  const server = registerRoutes(app);
  if (config.isTest) {
    try {
      await seedAdminUser();
    } catch (error) {
      console.warn('Test user already exists, skipping seed.');
    }
  }
  // Setup WebSocket routes for real-time sync
  const wss = setupWebSocketRoutes(app, server);
  setupWebSocketEndpoints(app);
  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (config.isDevelopment) {
    await setupVite(app, server);
  } else if (!config.isTest) {
    serveStatic(app);
  }
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error(`Error ${status}: ${message}`, err);
    res.status(status).json({ message });
  });
  // Start the server with configured host and port
  server.listen({
    port: config.port,
    host: config.host,
    reusePort: false,
  }, () => {
    log(`serving on ${config.host}:${config.port}`);
    log(`public URL: ${config.publicUrl}`);
    log(`environment: ${config.nodeEnv}`);
  });
})();
