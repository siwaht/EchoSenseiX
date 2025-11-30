import type { Express } from "express";
import { createServer, type Server } from "http";
import process from "process";
import { setupAuth } from "./auth";
import { seedAdminUser } from "./seedAdmin";
import { registerRealtimeSyncRoutes } from "./routes-realtime-sync";
import { detectApiKeyChange } from "./middleware/api-key-change-detector";
import router from "./routes/index";
import { db } from "./db";
import logger from "./utils/logger";
import { config } from "./config";

export function registerRoutes(app: Express): Server {
  // Health check endpoint (no auth required for load balancers)
  // Returns basic health status for container orchestrators
  app.get('/health', async (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
    });
  });

  // Readiness check - verifies all dependencies are ready
  app.get('/health/ready', async (_req, res) => {
    const checks: Record<string, { status: string; latency?: number; error?: string }> = {};
    
    // Check database connectivity
    const dbStart = Date.now();
    try {
      await db.execute('SELECT 1');
      checks.database = { status: 'healthy', latency: Date.now() - dbStart };
    } catch (error) {
      checks.database = { 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - dbStart 
      };
    }

    // Overall status
    const isHealthy = Object.values(checks).every(c => c.status === 'healthy');
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
      checks,
    });
  });

  // Liveness check - minimal check that app is alive
  app.get('/health/live', (_req, res) => {
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
    });
  });

  // Seed admin user on startup (with delay to ensure DB is ready)
  setTimeout(() => {
    seedAdminUser().catch((error) => {
      logger.error('Failed to seed admin user', { error: error.message });
    });
  }, 1000);

  // Auth middleware
  setupAuth(app);

  // API key change detection middleware (runs after auth)
  app.use('/api', detectApiKeyChange);

  // Mount aggregated routes
  app.use('/api', router);

  // Register real-time sync routes (if not already covered by aggregated routes)
  // Assuming these are specific and not yet refactored or need to be at root level?
  // The original code had them at the end.
  registerRealtimeSyncRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
