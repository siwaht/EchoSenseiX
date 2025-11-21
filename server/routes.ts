import type { Express } from "express";
import { createServer, type Server } from "http";
import process from "process";
import { setupAuth } from "./auth";
import { seedAdminUser } from "./seedAdmin";
import { registerRealtimeSyncRoutes } from "./routes-realtime-sync";
import { detectApiKeyChange } from "./middleware/api-key-change-detector";
import router from "./routes/index";

export function registerRoutes(app: Express): Server {
  // Health check endpoint (no auth required for load balancers)
  app.get('/health', async (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    });
  });

  // Seed admin user on startup (with delay to ensure DB is ready)
  setTimeout(() => {
    seedAdminUser().catch(console.error);
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
