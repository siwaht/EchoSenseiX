import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { setupWebSocketRoutes, setupWebSocketEndpoints } from "./routes-websocket";
import { setupVite, serveStatic, log } from "./vite";
import { rateLimiters } from "./middleware/rate-limiter";

const app = express();

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
  if (process.env.NODE_ENV === "development") {
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
      if (process.env.NODE_ENV === "development" && capturedJsonResponse) {
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
  const server = await registerRoutes(app);

  // Setup WebSocket routes for real-time sync
  const wss = setupWebSocketRoutes(app, server);
  setupWebSocketEndpoints(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    console.error(`Error ${status}: ${message}`, err);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: false,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
