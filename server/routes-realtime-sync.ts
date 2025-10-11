/**
 * Real-Time Sync API Routes
 * 
 * These routes provide comprehensive real-time synchronization endpoints
 * for all ElevenLabs data including credits, dashboard, calls, and analytics.
 */

import { Express, Request, Response } from "express";
import { storage } from "./storage";
import ElevenLabsRealtimeSync from "./services/elevenlabs-realtime-sync";
import { createElevenLabsClient } from "./services/elevenlabs";

// Helper function to get user from request
async function getUserFromRequest(req: any) {
  const userId = req.user?.id;
  if (!userId) {
    throw new Error("User not authenticated");
  }
  
  const user = await storage.getUser(userId);
  if (!user) {
    throw new Error("User not found");
  }
  
  return user;
}

// Helper function to get ElevenLabs integration
async function getElevenLabsIntegration(organizationId: string) {
  const integration = await storage.getIntegration(organizationId, "elevenlabs");
  if (!integration || !integration.apiKey) {
    throw new Error("ElevenLabs integration not configured");
  }
  return integration;
}

export function registerRealtimeSyncRoutes(app: Express) {
  
  /**
   * POST /api/realtime-sync/all
   * Comprehensive real-time sync of all ElevenLabs data
   */
  app.post("/api/realtime-sync/all", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromRequest(req);
      const integration = await getElevenLabsIntegration(user.organizationId);
      
      console.log(`[API] User ${user.email} initiated comprehensive real-time sync`);
      
      // Create real-time sync instance
      const syncService = new ElevenLabsRealtimeSync(user.organizationId, integration.apiKey);
      
      // Perform comprehensive sync
      const result = await syncService.syncAllData();
      
      // Update organization sync timestamp
      await storage.updateOrganization(user.organizationId, {
        lastSync: new Date()
      });
      
      res.json({
        success: result.success,
        message: "Real-time sync completed",
        data: result.data,
        errors: result.errors,
        duration: result.duration,
        timestamp: result.timestamp
      });
      
    } catch (error: any) {
      console.error("[API] Real-time sync error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to perform real-time sync",
        data: {},
        errors: [error.message],
        duration: 0,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * POST /api/realtime-sync/credits
   * Sync credits and billing data
   */
  app.post("/api/realtime-sync/credits", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromRequest(req);
      const integration = await getElevenLabsIntegration(user.organizationId);
      
      const syncService = new ElevenLabsRealtimeSync(user.organizationId, integration.apiKey);
      const result = await syncService.syncCreditsData();
      
      res.json({
        success: true,
        message: "Credits data synced successfully",
        data: result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error("[API] Credits sync error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to sync credits data",
        data: null,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * POST /api/realtime-sync/dashboard
   * Sync dashboard data (agents, recent calls, overview)
   */
  app.post("/api/realtime-sync/dashboard", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromRequest(req);
      const integration = await getElevenLabsIntegration(user.organizationId);
      
      const syncService = new ElevenLabsRealtimeSync(user.organizationId, integration.apiKey);
      const result = await syncService.syncDashboardData();
      
      res.json({
        success: true,
        message: "Dashboard data synced successfully",
        data: result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error("[API] Dashboard sync error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to sync dashboard data",
        data: null,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * POST /api/realtime-sync/calls
   * Sync comprehensive calls data (transcripts, recordings, summaries, logs)
   */
  app.post("/api/realtime-sync/calls", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromRequest(req);
      const integration = await getElevenLabsIntegration(user.organizationId);
      
      const { includeTranscripts = true, includeRecordings = true, limit = 100 } = req.body;
      
      const syncService = new ElevenLabsRealtimeSync(user.organizationId, integration.apiKey);
      const result = await syncService.syncCallsData();
      
      res.json({
        success: true,
        message: "Calls data synced successfully",
        data: result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error("[API] Calls sync error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to sync calls data",
        data: null,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * POST /api/realtime-sync/analytics
   * Sync analytics and usage data
   */
  app.post("/api/realtime-sync/analytics", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromRequest(req);
      const integration = await getElevenLabsIntegration(user.organizationId);
      
      const syncService = new ElevenLabsRealtimeSync(user.organizationId, integration.apiKey);
      const result = await syncService.syncAnalyticsData();
      
      res.json({
        success: true,
        message: "Analytics data synced successfully",
        data: result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error("[API] Analytics sync error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to sync analytics data",
        data: null,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * GET /api/realtime-sync/status
   * Get real-time sync status and health
   */
  app.get("/api/realtime-sync/status", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromRequest(req);
      const integration = await getElevenLabsIntegration(user.organizationId);
      
      // Test API connectivity
      const client = createElevenLabsClient(integration.apiKey);
      const testResult = await client.getUser();
      
      const status = {
        isConfigured: true,
        apiKeyValid: testResult.success,
        lastSync: integration.lastSync,
        status: integration.status,
        organizationId: user.organizationId,
        timestamp: new Date().toISOString()
      };
      
      if (!testResult.success) {
        status.apiKeyValid = false;
        status.error = testResult.error;
      }
      
      res.json({
        success: true,
        data: status
      });
      
    } catch (error: any) {
      console.error("[API] Status check error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to check sync status",
        data: {
          isConfigured: false,
          apiKeyValid: false,
          error: error.message
        }
      });
    }
  });

  /**
   * POST /api/realtime-sync/force-sync
   * Force immediate sync of all data (admin endpoint)
   */
  app.post("/api/realtime-sync/force-sync", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromRequest(req);
      
      // Check if user has admin permissions
      if (user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: "Admin permissions required"
        });
      }
      
      const integration = await getElevenLabsIntegration(user.organizationId);
      
      console.log(`[API] Admin ${user.email} initiated force sync`);
      
      const syncService = new ElevenLabsRealtimeSync(user.organizationId, integration.apiKey);
      const result = await syncService.syncAllData();
      
      // Update all organizations if admin
      if (user.role === 'admin') {
        const organizations = await storage.getOrganizations();
        for (const org of organizations) {
          await storage.updateOrganization(org.id, {
            lastSync: new Date()
          });
        }
      }
      
      res.json({
        success: result.success,
        message: "Force sync completed",
        data: result.data,
        errors: result.errors,
        duration: result.duration,
        timestamp: result.timestamp
      });
      
    } catch (error: any) {
      console.error("[API] Force sync error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to perform force sync",
        data: {},
        errors: [error.message],
        duration: 0,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * GET /api/realtime-sync/test-api
   * Test API connectivity and return sample data
   */
  app.get("/api/realtime-sync/test-api", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromRequest(req);
      const integration = await getElevenLabsIntegration(user.organizationId);
      
      const client = createElevenLabsClient(integration.apiKey);
      
      // Test multiple endpoints
      const [userResult, agentsResult, conversationsResult] = await Promise.allSettled([
        client.getUser(),
        client.getAgents(),
        client.getConversations({ page_size: 5 })
      ]);
      
      const testResults = {
        user: userResult.status === 'fulfilled' ? {
          success: userResult.value.success,
          data: userResult.value.data ? {
            first_name: userResult.value.data.first_name,
            subscription: userResult.value.data.subscription
          } : null,
          error: userResult.value.error
        } : { success: false, error: userResult.reason },
        
        agents: agentsResult.status === 'fulfilled' ? {
          success: agentsResult.value.success,
          count: agentsResult.value.data ? (agentsResult.value.data.agents || agentsResult.value.data || []).length : 0,
          error: agentsResult.value.error
        } : { success: false, error: agentsResult.reason },
        
        conversations: conversationsResult.status === 'fulfilled' ? {
          success: conversationsResult.value.success,
          count: conversationsResult.value.data ? (conversationsResult.value.data.conversations || conversationsResult.value.data || []).length : 0,
          error: conversationsResult.value.error
        } : { success: false, error: conversationsResult.reason }
      };
      
      const allSuccessful = Object.values(testResults).every((result: any) => result.success);
      
      res.json({
        success: allSuccessful,
        message: allSuccessful ? "API connectivity test successful" : "API connectivity test failed",
        results: testResults,
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error("[API] API test error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to test API connectivity",
        results: null,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * POST /api/realtime-sync/setup
   * Setup real-time sync with provided API key
   */
  app.post("/api/realtime-sync/setup", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromRequest(req);
      const { apiKey } = req.body;
      
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          message: "API key is required"
        });
      }
      
      // Test the API key
      const testClient = new (await import("./services/elevenlabs")).default({ apiKey });
      const testResult = await testClient.getUser();
      
      if (!testResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid API key: " + testResult.error
        });
      }
      
      // Create or update integration
      let integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      
      if (integration) {
        // Update existing integration
        await storage.updateIntegration(integration.id, {
          apiKey: apiKey,
          status: "ACTIVE",
          lastSync: new Date()
        });
      } else {
        // Create new integration
        await storage.createIntegration({
          organizationId: user.organizationId,
          type: "elevenlabs",
          apiKey: apiKey,
          status: "ACTIVE",
          lastSync: new Date()
        });
      }
      
      res.json({
        success: true,
        message: "ElevenLabs integration setup successfully",
        data: {
          user: testResult.data ? {
            first_name: testResult.data.first_name,
            subscription: testResult.data.subscription
          } : null
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error("[API] Setup error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to setup integration",
        timestamp: new Date().toISOString()
      });
    }
  });
}
