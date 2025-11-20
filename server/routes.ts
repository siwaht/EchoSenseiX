import type { Express } from "express";
import { createServer, type Server } from "http";
import { Buffer } from "buffer";
import process from "process";
import { storage } from "./storage";
import { setupAuth, hashPassword } from "./auth";
import { insertIntegrationSchema, insertAgentSchema, insertCallLogSchema, insertPhoneNumberSchema, insertBatchCallSchema, insertBatchCallRecipientSchema, type Integration, callLogs, agents } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";
import type { RequestHandler } from "express";
import { seedAdminUser } from "./seedAdmin";
import { checkPermission, checkRoutePermission } from "./middleware/permissions";
import { providerRegistry } from "./services/providers/registry";
import { IConversationalAIProvider, ITTSProvider } from "./services/providers/types";
import { ElevenLabsProvider } from "./services/providers/elevenlabs";
import * as unifiedPayment from "./unified-payment";
import { cacheMiddleware } from "./middleware/cache-middleware";
import Stripe from "stripe";
import SyncService from "./services/sync-service";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { registerRealtimeSyncRoutes } from "./routes-realtime-sync";
import KnowledgeBaseService from "./services/knowledge-base-service";
import DocumentProcessingService from "./services/document-processing-service";
import MultilingualService from "./services/multilingual-service";
import EmailService from "./services/email-service";
import { detectApiKeyChange } from "./middleware/api-key-change-detector";
import {
  handleConversationInitWebhook,
  handlePostCallWebhook,
  handleEventsWebhook
} from "./webhooks/elevenlabs-webhooks";
import { encryptCredentials, decryptCredentials, encryptApiKey, decryptApiKey } from "./utils/encryption";

// Authentication middleware
const isAuthenticated: RequestHandler = (req, res, next) => {
  try {
    if (!req.isAuthenticated()) {
      console.log("Authentication failed: User not authenticated");
      return res.status(401).json({ message: "Unauthorized" });
    }
    console.log("Authentication successful for user:", req.user?.email || req.user?.id);
    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);
    return res.status(500).json({ message: "Authentication error" });
  }
};





// Encryption helpers moved to server/utils/encryption.ts

// Cost calculation helper with updated ElevenLabs pricing
function calculateCallCost(durationSeconds: number, costData?: any): number {
  // ElevenLabs may return credits_consumed or credits_used where 1 credit = $0.001
  const credits = costData?.credits_consumed || costData?.credits_used;
  if (credits) {
    return Number(credits) * 0.001; // Convert credits to dollars
  }

  // Check for direct cost field (might already be in dollars)
  if (costData?.cost !== undefined && costData?.cost !== null) {
    const cost = Number(costData.cost);
    // If the value seems too high (> $100 for a call), assume it's in credits
    if (cost > 100) {
      return cost * 0.001;
    }
    return cost;
  }

  // Check for llm_cost field
  if (costData?.llm_cost !== undefined && costData?.llm_cost !== null) {
    const cost = Number(costData.llm_cost);
    // If the value seems too high (> $100 for a call), assume it's in credits
    if (cost > 100) {
      return cost * 0.001;
    }
    return cost;
  }

  // Check for silent period tracking
  const silentSeconds = costData?.silent_seconds || 0;
  const activeSeconds = Math.max(0, durationSeconds - silentSeconds);

  // Calculate cost based on ElevenLabs pricing tiers
  // Business plan: $0.08 per minute (annual), $0.096 per minute (monthly)
  // Silent periods (>10 seconds): charged at 5% of usual rate
  const RATE_PER_MINUTE = 0.08; // Business plan rate
  const SILENT_RATE_MULTIPLIER = 0.05; // 5% rate for silent periods

  const activeMinutes = activeSeconds / 60;
  const silentMinutes = silentSeconds / 60;

  const activeCost = activeMinutes * RATE_PER_MINUTE;
  const silentCost = silentMinutes * RATE_PER_MINUTE * SILENT_RATE_MULTIPLIER;

  return Math.round((activeCost + silentCost) * 100) / 100; // Round to 2 decimal places
}

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

  // Auth routes already handled by setupAuth in auth.ts

  // ==========================================
  // ElevenLabs Webhook Routes (No Auth Required)
  // ==========================================

  // Post-call webhook - receives call summary and metadata after call completion
  app.post("/api/webhooks/elevenlabs/post-call", handlePostCallWebhook);

  // Conversation initialization webhook - receives data when conversation starts
  app.post("/api/webhooks/elevenlabs/conversation-init", handleConversationInitWebhook);

  // Events webhook - receives real-time events during conversation
  app.post("/api/webhooks/elevenlabs/events", handleEventsWebhook);

  // Admin middleware
  const isAdmin = async (req: any, res: any, next: any) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = await storage.getUser(userId);
    if (!user?.isAdmin) {
      return res.status(403).json({ message: "Forbidden: Admin access required" });
    }
    next();
  };

  // Admin routes - User Management

  // User-Agent assignment routes
  app.get('/api/admin/users/:userId/agents', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get all agents in the organization
      const allAgents = await storage.getAgents(user.organizationId);

      // Get assigned agents for the user
      const assignedAgents = await storage.getAgentsForUser(userId, user.organizationId);
      const assignedAgentIds = assignedAgents.map(a => a.id);

      // Return agents with assignment status
      const agentsWithAssignment = allAgents.map(agent => ({
        ...agent,
        assigned: assignedAgentIds.includes(agent.id)
      }));

      res.json(agentsWithAssignment);
    } catch (error) {
      console.error("Error fetching user agent assignments:", error);
      res.status(500).json({ message: "Failed to fetch agent assignments" });
    }
  });

  app.post('/api/admin/users/:userId/agents/:agentId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId, agentId } = req.params;
      await storage.assignAgentToUser(userId, agentId, req.user.id);
      res.json({ message: "Agent assigned successfully" });
    } catch (error) {
      console.error("Error assigning agent to user:", error);
      res.status(500).json({ message: "Failed to assign agent" });
    }
  });

  app.delete('/api/admin/users/:userId/agents/:agentId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId, agentId } = req.params;
      await storage.unassignAgentFromUser(userId, agentId);
      res.json({ message: "Agent unassigned successfully" });
    } catch (error) {
      console.error("Error unassigning agent from user:", error);
      res.status(500).json({ message: "Failed to unassign agent" });
    }
  });

  app.get('/api/admin/users', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get('/api/admin/users/:userId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.patch('/api/admin/users/:userId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      // Hash password if provided
      const updates = { ...req.body };
      if (updates.password) {
        updates.password = await hashPassword(updates.password);
      }

      const updatedUser = await storage.updateUser(req.params.userId, updates);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete('/api/admin/users/:userId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.deleteUser(req.params.userId);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Admin routes - Agent Management
  app.get('/api/admin/agents', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const agents = await storage.getAllAgents();
      res.json(agents);
    } catch (error) {
      console.error("Error fetching all agents:", error);
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });

  app.get('/api/admin/organizations/:orgId/agents', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const agentIds = await storage.getAgentsByOrganization(req.params.orgId);
      res.json(agentIds);
    } catch (error) {
      console.error("Error fetching organization agents:", error);
      res.status(500).json({ message: "Failed to fetch organization agents" });
    }
  });

  app.post('/api/admin/agents/:agentId/reassign', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { organizationId } = req.body;
      if (!organizationId) {
        return res.status(400).json({ message: "Organization ID is required" });
      }

      const agent = await storage.reassignAgentToOrganization(req.params.agentId, organizationId);
      res.json(agent);
    } catch (error) {
      console.error("Error reassigning agent:", error);
      res.status(500).json({ message: "Failed to reassign agent" });
    }
  });

  // Admin routes - Organization Management
  app.get('/api/admin/organizations', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const organizations = await storage.getAllOrganizations();
      res.json(organizations);
    } catch (error) {
      console.error("Error fetching organizations:", error);
      res.status(500).json({ message: "Failed to fetch organizations" });
    }
  });

  app.get('/api/admin/billing', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const billingData = await storage.getAdminBillingData();
      res.json(billingData);
    } catch (error) {
      console.error("Error fetching billing data:", error);
      res.status(500).json({ message: "Failed to fetch billing data" });
    }
  });

  app.patch('/api/admin/organizations/:orgId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const updatedOrg = await storage.updateOrganization(req.params.orgId, req.body);
      res.json(updatedOrg);
    } catch (error) {
      console.error("Error updating organization:", error);
      res.status(500).json({ message: "Failed to update organization" });
    }
  });

  // Update agency permissions
  app.patch('/api/admin/organizations/:orgId/permissions', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { permissions, role } = req.body;
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ message: "Permissions must be an array" });
      }

      const updateData: any = {
        agencyPermissions: permissions
      };

      // Also save the role if provided
      if (role) {
        updateData.agencyRole = role;
      }

      const updatedOrg = await storage.updateOrganization(req.params.orgId, updateData);

      res.json({
        message: "Agency permissions updated successfully",
        permissions: updatedOrg.agencyPermissions,
        role: updatedOrg.agencyRole
      });
    } catch (error) {
      console.error("Error updating agency permissions:", error);
      res.status(500).json({ message: "Failed to update agency permissions" });
    }
  });

  // Get agency permissions
  app.get('/api/admin/organizations/:orgId/permissions', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const org = await storage.getOrganization(req.params.orgId);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      res.json({
        organizationId: org.id,
        organizationName: org.name,
        permissions: org.agencyPermissions || [],
        role: org.agencyRole || null,
        organizationType: org.organizationType,
        billingPackage: org.billingPackage
      });
    } catch (error) {
      console.error("Error fetching agency permissions:", error);
      res.status(500).json({ message: "Failed to fetch agency permissions" });
    }
  });

  app.delete('/api/admin/organizations/:orgId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.deleteOrganization(req.params.orgId);
      res.json({ message: "Organization deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting organization:", error);
      res.status(error.message.includes("existing users") ? 400 : 500).json({
        message: error.message || "Failed to delete organization"
      });
    }
  });

  app.patch('/api/admin/users/:userId/status', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { status } = req.body;
      if (!['active', 'inactive', 'pending'].includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }
      const updatedUser = await storage.toggleUserStatus(req.params.userId, status);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user status:", error);
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  app.patch('/api/admin/organizations/:orgId/status', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { isActive } = req.body;
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: "Invalid isActive value" });
      }
      const updatedOrg = await storage.toggleOrganizationStatus(req.params.orgId, isActive);
      res.json(updatedOrg);
    } catch (error) {
      console.error("Error updating organization status:", error);
      res.status(500).json({ message: "Failed to update organization status" });
    }
  });

  // Encryption Migration Route
  app.post('/api/admin/migrate-encryption', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      console.log("Starting encryption migration...");
      const integrations = await storage.getAllIntegrations();
      let migratedCount = 0;
      let errorCount = 0;

      for (const integration of integrations) {
        try {
          // Check if apiKey needs migration (doesn't have IV prefix)
          if (integration.apiKey && !integration.apiKey.includes(':')) {
            // Decrypt with legacy method (handled automatically by decryptApiKey)
            const decryptedKey = decryptApiKey(integration.apiKey);
            // Re-encrypt with new method
            const reEncryptedKey = encryptApiKey(decryptedKey);

            // Update in DB
            await storage.updateIntegration(integration.id, { apiKey: reEncryptedKey });
            migratedCount++;
            console.log(`Migrated API key for integration ${integration.id}`);
          }

          // Check credentials blob if it exists
          if (integration.credentials) {
            // This is more complex as credentials might be a JSON string or object
            // For now, we focus on API keys as that's the primary concern
          }
        } catch (err) {
          console.error(`Failed to migrate integration ${integration.id}:`, err);
          errorCount++;
        }
      }

      res.json({
        message: "Migration completed",
        migrated: migratedCount,
        errors: errorCount
      });
    } catch (error) {
      console.error("Encryption migration failed:", error);
      res.status(500).json({ message: "Migration failed" });
    }
  });

  // Enhanced Admin API Sync status endpoint
  app.get('/api/admin/sync/status', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const allIntegrations = await storage.getAllIntegrations();
      const elevenLabsIntegrations = allIntegrations.filter((i: Integration) =>
        i.provider === 'elevenlabs' && i.apiKey && i.status === 'ACTIVE'
      );

      const endpoints = [
        { name: 'agents/list', path: '/v1/convai/agents', method: 'GET', status: 'active' },
        { name: 'agents/get', path: '/v1/convai/agents/:id', method: 'GET', status: 'active' },
        { name: 'conversations/list', path: '/v1/convai/conversations', method: 'GET', status: 'active' },
        { name: 'conversations/get', path: '/v1/convai/conversations/:id', method: 'GET', status: 'active' },
        { name: 'webhook/register', path: '/v1/convai/conversation/register-webhook', method: 'POST', status: 'active' },
      ];

      const syncStatus = {
        isConfigured: elevenLabsIntegrations.length > 0,
        integrations: elevenLabsIntegrations.length,
        status: 'idle',
        totalAgents: 0,
        totalConversations: 0,
        totalOrganizations: 0,
        recentActivity: [] as any[],
        healthStatus: 'unknown',
        lastSync: new Date().toISOString(),
        apiVersion: 'v1',
        endpointsTotal: endpoints.length,
        endpointsActive: endpoints.filter(e => e.status === 'active').length,
        endpointsDeprecated: endpoints.filter(e => e.status === 'deprecated').length,
        endpointsUpdated: endpoints.filter(e => e.status === 'updated').length,
        syncInProgress: false
      };

      // Get comprehensive sync information
      if (elevenLabsIntegrations.length > 0) {
        const organizations = await storage.getAllOrganizations();
        const activeOrganizations = organizations.filter(org =>
          elevenLabsIntegrations.some(int => int.organizationId === org.id)
        );

        syncStatus.totalOrganizations = activeOrganizations.length;

        // Get last sync times
        const lastSyncTimes = activeOrganizations
          .map(org => (org as any).lastSync)
          .filter(Boolean)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

        if (lastSyncTimes.length > 0) {
          syncStatus.lastSync = lastSyncTimes[0];
        }

        // Get total agents and conversations across all organizations
        let totalAgents = 0;
        let totalConversations = 0;

        for (const org of activeOrganizations) {
          try {
            const agents = await storage.getAgents(org.id);
            const callLogs = await storage.getCallLogs(org.id, 1000, 0);
            totalAgents += agents.length;
            totalConversations += callLogs.total;
          } catch (error) {
            console.warn(`Error getting stats for organization ${org.id}:`, error);
          }
        }

        syncStatus.totalAgents = totalAgents;
        syncStatus.totalConversations = totalConversations;

        // Check API health
        try {
          const firstIntegration = elevenLabsIntegrations[0];
          const apiKey = decryptApiKey(firstIntegration.apiKey);

          const healthResponse = await fetch('https://api.elevenlabs.io/v1/user', {
            headers: {
              'xi-api-key': apiKey,
            },
          });

          if (healthResponse.ok) {
            syncStatus.healthStatus = 'healthy';
          } else {
            syncStatus.healthStatus = 'unhealthy';
          }
        } catch (error) {
          syncStatus.healthStatus = 'unreachable';
        }

        // Get recent activity
        try {
          const recentCallLogs: any[] = [];
          for (const org of activeOrganizations.slice(0, 3)) {
            try {
              const logs = await storage.getCallLogs(org.id, 10, 0);
              recentCallLogs.push(...logs.data.map(log => ({
                id: log.id,
                organizationId: org.id,
                conversationId: log.conversationId,
                agentId: log.agentId,
                status: log.status,
                duration: log.duration,
                cost: log.cost,
                createdAt: log.createdAt
              })));
            } catch (error) {
              console.warn(`Error getting recent logs for organization ${org.id}:`, error);
            }
          }

          syncStatus.recentActivity = recentCallLogs
            .filter(log => log.createdAt !== null)
            .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
            .slice(0, 10);
        } catch (error) {
          console.warn('Error getting recent activity:', error);
        }
      }

      res.json(syncStatus);
    } catch (error) {
      console.error('Error fetching sync status:', error);
      res.status(500).json({ message: 'Failed to fetch sync status' });
    }
  });

  app.get('/api/admin/sync/endpoints', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      // Define all ElevenLabs API endpoints we use
      const endpoints = [
        {
          name: 'Agents List',
          path: '/v1/convai/agents',
          method: 'GET',
          status: 'active',
          lastChecked: new Date().toISOString(),
          currentVersion: 'v1',
          description: 'List all conversational AI agents'
        },
        {
          name: 'Agent Details',
          path: '/v1/convai/agents/:id',
          method: 'GET',
          status: 'active',
          lastChecked: new Date().toISOString(),
          currentVersion: 'v1',
          description: 'Get details for a specific agent'
        },
        {
          name: 'Conversations List',
          path: '/v1/convai/conversations',
          method: 'GET',
          status: 'active',
          lastChecked: new Date().toISOString(),
          currentVersion: 'v1',
          description: 'List all conversations/calls'
        },
        {
          name: 'Conversation Details',
          path: '/v1/convai/conversations/:id',
          method: 'GET',
          status: 'active',
          lastChecked: new Date().toISOString(),
          currentVersion: 'v1',
          description: 'Get details for a specific conversation'
        },
        {
          name: 'Conversation Audio',
          path: '/v1/convai/conversations/:id/audio',
          method: 'GET',
          status: 'active',
          lastChecked: new Date().toISOString(),
          currentVersion: 'v1',
          description: 'Stream audio for a conversation'
        },
        {
          name: 'Webhook Register',
          path: '/v1/convai/conversation/register-webhook',
          method: 'POST',
          status: 'active',
          lastChecked: new Date().toISOString(),
          currentVersion: 'v1',
          description: 'Register webhook for conversation events'
        },
      ];

      res.json(endpoints);
    } catch (error) {
      console.error('Error fetching endpoints:', error);
      res.status(500).json({ message: 'Failed to fetch endpoints' });
    }
  });

  app.get('/api/admin/sync/logs', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      // In a real implementation, these would be stored in the database
      const logs = [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          action: 'API Sync Initialized',
          status: 'success',
          message: 'Successfully initialized API synchronization system',
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          action: 'Endpoint Validation',
          status: 'warning',
          message: 'API endpoints validated successfully',
          details: {
            endpoint_count: 5,
            status: 'operational'
          }
        }
      ];

      res.json(logs);
    } catch (error) {
      console.error('Error fetching sync logs:', error);
      res.status(500).json({ message: 'Failed to fetch sync logs' });
    }
  });

  app.post('/api/admin/sync/run', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      // For admin sync, try to find any organization with a configured API key
      console.log("Admin sync requested");
      const allIntegrations = await storage.getAllIntegrations();
      console.log("Found integrations:", allIntegrations.length);

      // Find ElevenLabs integration specifically
      const elevenLabsIntegration = allIntegrations.find((i: Integration) =>
        i.provider === 'elevenlabs' && i.apiKey && i.status === 'ACTIVE'
      );

      console.log("ElevenLabs integration found:", !!elevenLabsIntegration);

      if (!elevenLabsIntegration || !elevenLabsIntegration.apiKey) {
        console.log("No active ElevenLabs integration found");
        return res.status(400).json({
          message: 'No API key configured. Please configure an ElevenLabs API key in at least one organization.'
        });
      }

      const apiKey = decryptApiKey(elevenLabsIntegration.apiKey);

      // Test API connectivity with a simple call
      const testResponse = await fetch('https://api.elevenlabs.io/v1/user', {
        headers: {
          'xi-api-key': apiKey,
        },
      });

      if (!testResponse.ok) {
        return res.status(400).json({ message: 'API key validation failed' });
      }

      // Use centralized sync service for admin run
      const agents = await SyncService.syncAgents(elevenLabsIntegration.organizationId);
      const callLogs = await SyncService.syncCallLogs({
        organizationId: elevenLabsIntegration.organizationId,
        limit: 100,
        includeTranscripts: true,
      });
      res.json({
        success: agents.success && callLogs.success,
        agents,
        callLogs,
        timestamp: new Date().toISOString(),
        organizationUsed: elevenLabsIntegration.organizationId
      });
    } catch (error) {
      console.error('Error running admin sync:', error);
      res.status(500).json({ message: 'Failed to run synchronization' });
    }
  });

  app.post('/api/admin/sync/validate', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const endpoint = req.body;
      // For admin sync validation, try to find any organization with a configured API key
      const allIntegrations = await storage.getAllIntegrations();
      const elevenLabsIntegration = allIntegrations.find((i: Integration) =>
        i.provider === 'elevenlabs' && i.apiKey && i.status === 'ACTIVE'
      );

      if (!elevenLabsIntegration || !elevenLabsIntegration.apiKey) {
        return res.status(400).json({
          valid: false,
          message: 'No API key configured. Please configure an ElevenLabs API key in at least one organization.'
        });
      }

      const apiKey = decryptApiKey(elevenLabsIntegration.apiKey);

      // Validate specific endpoint
      let testUrl = 'https://api.elevenlabs.io';

      // Map endpoint paths to actual test URLs
      if (endpoint.path.includes('agents')) {
        testUrl += '/v1/convai/agents';
      } else if (endpoint.path.includes('conversations')) {
        testUrl += '/v1/convai/conversations?page_size=1';
      }

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
        },
      });

      const valid = response.status !== 404;

      res.json({
        valid,
        status: response.status,
        message: valid ? 'Endpoint is valid' : 'Endpoint not found or changed'
      });
    } catch (error) {
      console.error('Error validating endpoint:', error);
      res.status(500).json({ valid: false, message: 'Validation failed' });
    }
  });

  app.post('/api/admin/sync/update-endpoint', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const endpoint = req.body;

      // In a real implementation, this would update the endpoint configuration
      // For now, we'll just log the update
      console.log('Updating endpoint:', endpoint);

      res.json({
        success: true,
        message: `Endpoint ${endpoint.name} updated successfully`,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating endpoint:', error);
      res.status(500).json({ message: 'Failed to update endpoint' });
    }
  });

  // Admin routes - Create new user
  app.post('/api/admin/users', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const {
        email, firstName, lastName, password, companyName, isAdmin, organizationType,
        commissionRate, role, parentOrganizationId, creditBalance, billingPackage,
        perCallRate, perMinuteRate, monthlyCredits, maxAgents, maxUsers,
        subdomain, customDomain, permissions
      } = req.body;

      // Check if user exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // If company name is provided, find or create organization
      let organizationId = undefined;
      if (companyName && companyName.trim()) {
        // Try to find existing organization
        const organizations = await storage.getAllOrganizations();
        const existingOrg = organizations.find(org =>
          org.name.toLowerCase() === companyName.toLowerCase()
        );

        if (existingOrg) {
          organizationId = existingOrg.id;
        } else {
          // Create new organization with type
          const newOrg = await storage.createOrganization({
            name: companyName,
            organizationType: organizationType || 'end_customer',
            commissionRate: organizationType === 'agency' ? (commissionRate || 30) : undefined,
            creditBalance: organizationType === 'agency' ? (creditBalance || 0) : undefined,
            billingPackage: organizationType === 'agency' ? (billingPackage || 'starter') : 'starter',
            perCallRate: organizationType === 'agency' ? (perCallRate || 0.30) : 0.30,
            perMinuteRate: organizationType === 'agency' ? (perMinuteRate || 0.30) : 0.30,
            monthlyCredits: organizationType === 'agency' ? (monthlyCredits || 0) : 0,
            maxAgents: maxAgents || 5,
            maxUsers: maxUsers || 10,
            subdomain: organizationType === 'agency' ? subdomain : undefined,
            customDomain: organizationType === 'agency' ? customDomain : undefined,
            agencyPermissions: organizationType === 'agency' ? (permissions || []) : undefined,
            parentOrganizationId: parentOrganizationId
          });
          organizationId = newOrg.id;
        }
      }

      // Hash password before creating user
      const hashedPassword = await hashPassword(password);

      // Create new user with role and permissions
      const newUser = await storage.createUser({
        email,
        firstName,
        lastName,
        password: hashedPassword,
        organizationId,
        isAdmin: isAdmin || false,
        role: role || (organizationType === 'agency' ? 'agency' : 'user'),
        permissions: permissions || [],
      });

      res.json(newUser);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Admin routes - Delete user
  app.delete('/api/admin/users/:userId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;

      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Don't allow deleting yourself
      if (userId === req.user.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      // Delete the user
      await storage.deleteUser(userId);

      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Quick test agency creation endpoint
  app.post('/api/admin/create-test-agency', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      // Create a test agency organization
      const testAgency = await storage.createOrganization({
        name: 'Test Agency Co',
        organizationType: 'agency',
        commissionRate: '30',
        maxAgents: 10,
        maxUsers: 5,
        creditBalance: '100'
      });

      // Create an agency owner user
      const agencyOwner = await storage.createUser({
        email: 'agency@test.com',
        firstName: 'Agency',
        lastName: 'Owner',
        password: 'agency123',
        organizationId: testAgency.id,
        isAdmin: false,
        role: 'agency'
      });

      res.json({
        message: 'Test agency created successfully',
        agency: testAgency,
        owner: {
          email: agencyOwner.email,
          password: 'agency123',
          firstName: agencyOwner.firstName,
          lastName: agencyOwner.lastName
        }
      });
    } catch (error) {
      console.error("Error creating test agency:", error);
      res.status(500).json({ message: "Failed to create test agency" });
    }
  });

  // ==========================================
  // User Management Routes (Non-Admin)
  // ==========================================

  // In-memory storage for invitations and activity logs (should be moved to database in production)
  const userInvitations = new Map<string, any[]>();
  const activityLogs = new Map<string, any[]>();

  // Get users in the same organization (for managers)
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      const currentUser = await storage.getUser(req.user.id);

      // Only admins can view all users
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const allUsers = await storage.getAllUsers();
      const orgUsers = allUsers.filter(u => u.organizationId === organizationId);

      // Add role and status fields if not present
      const enrichedUsers = orgUsers.map(user => ({
        ...user,
        role: user.role || (user.isAdmin ? 'admin' : 'user'),
        status: user.status || 'active',
        organizationName: 'Organization',
      }));

      res.json(enrichedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Update user (for managers)
  app.patch('/api/users/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      const currentUser = await storage.getUser(req.user.id);

      // Only admins can update users
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const targetUser = await storage.getUser(req.params.userId);
      if (!targetUser || targetUser.organizationId !== organizationId) {
        return res.status(404).json({ message: "User not found" });
      }

      // Hash password if provided
      const updates = { ...req.body };
      if (updates.password) {
        updates.password = await hashPassword(updates.password);
      }

      const updatedUser = await storage.updateUser(req.params.userId, updates);

      // Log activity
      const log = {
        id: crypto.randomBytes(16).toString('hex'),
        userId: req.user.id,
        userEmail: currentUser.email,
        action: 'updated user',
        details: `Updated ${targetUser.email}`,
        timestamp: new Date().toISOString(),
      };
      const logs = activityLogs.get(organizationId) || [];
      logs.unshift(log);
      activityLogs.set(organizationId, logs.slice(0, 100)); // Keep last 100 logs

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Delete user (for managers)
  app.delete('/api/users/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      const currentUser = await storage.getUser(req.user.id);

      // Only admins can delete users
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const targetUser = await storage.getUser(req.params.userId);
      if (!targetUser || targetUser.organizationId !== organizationId) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent self-deletion
      if (targetUser.id === req.user.id) {
        return res.status(400).json({ message: "Cannot delete yourself" });
      }

      await storage.deleteUser(req.params.userId);

      // Log activity
      const log = {
        id: crypto.randomBytes(16).toString('hex'),
        userId: req.user.id,
        userEmail: currentUser.email,
        action: 'deleted user',
        details: `Deleted ${targetUser.email}`,
        timestamp: new Date().toISOString(),
      };
      const logs = activityLogs.get(organizationId) || [];
      logs.unshift(log);
      activityLogs.set(organizationId, logs);

      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Create user directly (for managers)
  app.post('/api/users/create', isAuthenticated, async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      const currentUser = await storage.getUser(req.user.id);

      // Only admins and managers can create users
      if (!currentUser?.isAdmin && !currentUser?.permissions?.includes('manage_users')) {
        return res.status(403).json({ message: "Forbidden: Insufficient permissions to create users" });
      }

      const { email, password, firstName, lastName, permissions } = req.body;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Create the user with the same organization ID
      const newUser = await storage.createUser({
        email,
        password, // In production, this should be hashed
        firstName,
        lastName,
        organizationId,
        permissions: permissions || [],
      });

      res.json(newUser);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // User invitation endpoints
  app.get('/api/users/invitations', isAuthenticated, async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      const invitations = userInvitations.get(organizationId) || [];
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  app.post('/api/users/invite', isAuthenticated, async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      const currentUser = await storage.getUser(req.user.id);

      // Only admins and managers can invite users
      if (!currentUser?.isAdmin && currentUser?.role !== 'manager') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { email, role, message } = req.body;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser && existingUser.organizationId === organizationId) {
        return res.status(400).json({ message: "User already exists in organization" });
      }

      // Create invitation
      const invitation = {
        id: crypto.randomBytes(16).toString('hex'),
        email,
        role,
        status: 'pending',
        invitedBy: currentUser.email,
        invitedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        organizationId,
        inviteCode: crypto.randomBytes(32).toString('hex'),
        message,
      };

      const invitations = userInvitations.get(organizationId) || [];
      invitations.push(invitation);
      userInvitations.set(organizationId, invitations);

      // Log activity
      const log = {
        id: crypto.randomBytes(16).toString('hex'),
        userId: req.user.id,
        userEmail: currentUser.email,
        action: 'invited user',
        details: `Invited ${email} as ${role}`,
        timestamp: new Date().toISOString(),
      };
      const logs = activityLogs.get(organizationId) || [];
      logs.unshift(log);
      activityLogs.set(organizationId, logs);

      // In production, send email with invitation link
      console.log(`Invitation link: ${process.env.APP_URL || 'http://localhost:5000'}/invite/${invitation.inviteCode}`);

      res.json(invitation);
    } catch (error) {
      console.error("Error inviting user:", error);
      res.status(500).json({ message: "Failed to invite user" });
    }
  });

  app.post('/api/users/invitations/:invitationId/resend', isAuthenticated, async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      const invitations = userInvitations.get(organizationId) || [];
      const invitation = invitations.find(i => i.id === req.params.invitationId);

      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      // Update expiration
      invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // In production, resend email
      console.log(`Resending invitation to ${invitation.email}`);

      res.json(invitation);
    } catch (error) {
      console.error("Error resending invitation:", error);
      res.status(500).json({ message: "Failed to resend invitation" });
    }
  });

  app.delete('/api/users/invitations/:invitationId', isAuthenticated, async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      const invitations = userInvitations.get(organizationId) || [];
      const index = invitations.findIndex(i => i.id === req.params.invitationId);

      if (index === -1) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      invitations.splice(index, 1);
      userInvitations.set(organizationId, invitations);

      res.json({ message: "Invitation cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling invitation:", error);
      res.status(500).json({ message: "Failed to cancel invitation" });
    }
  });

  // Activity logs endpoint
  app.get('/api/users/activity-logs', isAuthenticated, async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      const currentUser = await storage.getUser(req.user.id);

      // Only admins and managers can view activity logs
      if (!currentUser?.isAdmin && currentUser?.role !== 'manager') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const logs = activityLogs.get(organizationId) || [];
      res.json(logs);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });

  // Admin routes - Billing Package Management
  app.get('/api/admin/billing-packages', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const packages = await storage.getBillingPackages();
      res.json(packages);
    } catch (error) {
      console.error("Error fetching billing packages:", error);
      res.status(500).json({ message: "Failed to fetch billing packages" });
    }
  });

  app.post('/api/admin/billing-packages', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const newPackage = await storage.createBillingPackage(req.body);
      res.json(newPackage);
    } catch (error) {
      console.error("Error creating billing package:", error);
      res.status(500).json({ message: "Failed to create billing package" });
    }
  });

  app.patch('/api/admin/billing-packages/:pkgId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const updatedPackage = await storage.updateBillingPackage(req.params.pkgId, req.body);
      res.json(updatedPackage);
    } catch (error) {
      console.error("Error updating billing package:", error);
      res.status(500).json({ message: "Failed to update billing package" });
    }
  });

  app.delete('/api/admin/billing-packages/:pkgId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.deleteBillingPackage(req.params.pkgId);
      res.json({ message: "Billing package deleted successfully" });
    } catch (error) {
      console.error("Error deleting billing package:", error);
      res.status(500).json({ message: "Failed to delete billing package" });
    }
  });

  // System templates routes (admin only)
  app.get('/api/admin/system-templates', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const templates = await storage.getSystemTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching system templates:", error);
      res.status(500).json({ message: "Failed to fetch system templates" });
    }
  });

  app.post('/api/admin/system-templates', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const newTemplate = await storage.createSystemTemplate(req.body);
      res.json(newTemplate);
    } catch (error) {
      console.error("Error creating system template:", error);
      res.status(500).json({ message: "Failed to create system template" });
    }
  });

  app.patch('/api/admin/system-templates/:templateId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const updatedTemplate = await storage.updateSystemTemplate(req.params.templateId, req.body);
      res.json(updatedTemplate);
    } catch (error) {
      console.error("Error updating system template:", error);
      res.status(500).json({ message: "Failed to update system template" });
    }
  });

  app.delete('/api/admin/system-templates/:templateId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.deleteSystemTemplate(req.params.templateId);
      res.json({ message: "System template deleted successfully" });
    } catch (error) {
      console.error("Error deleting system template:", error);
      res.status(500).json({ message: "Failed to delete system template" });
    }
  });

  // Public route to get active system templates (for all users)
  app.get('/api/system-templates', isAuthenticated, async (req: any, res) => {
    try {
      const templates = await storage.getSystemTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching system templates:", error);
      res.status(500).json({ message: "Failed to fetch system templates" });
    }
  });

  // Quick Action Buttons routes - Admin (for system buttons)
  app.get('/api/admin/quick-action-buttons', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const buttons = await storage.getQuickActionButtons();
      res.json(buttons);
    } catch (error) {
      console.error("Error fetching quick action buttons:", error);
      res.status(500).json({ message: "Failed to fetch quick action buttons" });
    }
  });

  app.post('/api/admin/quick-action-buttons', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const buttonData = {
        ...req.body,
        isSystem: true,
        createdBy: req.user.id
      };
      const newButton = await storage.createQuickActionButton(buttonData);
      res.json(newButton);
    } catch (error) {
      console.error("Error creating quick action button:", error);
      res.status(500).json({ message: "Failed to create quick action button" });
    }
  });

  app.patch('/api/admin/quick-action-buttons/:buttonId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const button = await storage.getQuickActionButton(req.params.buttonId);
      if (!button) {
        return res.status(404).json({ message: "Quick action button not found" });
      }

      // Only allow admins to update system buttons
      if (!button.isSystem) {
        return res.status(403).json({ message: "Cannot modify user buttons through admin API" });
      }

      const updatedButton = await storage.updateQuickActionButton(req.params.buttonId, req.body);
      res.json(updatedButton);
    } catch (error) {
      console.error("Error updating quick action button:", error);
      res.status(500).json({ message: "Failed to update quick action button" });
    }
  });

  app.delete('/api/admin/quick-action-buttons/:buttonId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const button = await storage.getQuickActionButton(req.params.buttonId);
      if (!button) {
        return res.status(404).json({ message: "Quick action button not found" });
      }

      // Only allow admins to delete system buttons
      if (!button.isSystem) {
        return res.status(403).json({ message: "Cannot delete user buttons through admin API" });
      }

      await storage.deleteQuickActionButton(req.params.buttonId);
      res.json({ message: "Quick action button deleted successfully" });
    } catch (error) {
      console.error("Error deleting quick action button:", error);
      res.status(500).json({ message: "Failed to delete quick action button" });
    }
  });

  // Admin routes - Approval Tasks Management
  app.get('/api/admin/tasks', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const status = req.query.status as "pending" | "in_progress" | "completed" | "rejected" | undefined;
      const tasks = await storage.getAdminTasks(status);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching admin tasks:", error);
      res.status(500).json({ message: "Failed to fetch admin tasks" });
    }
  });

  app.get('/api/admin/tasks/:taskId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const task = await storage.getAdminTask(req.params.taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error fetching admin task:", error);
      res.status(500).json({ message: "Failed to fetch admin task" });
    }
  });

  app.patch('/api/admin/tasks/:taskId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const updates = req.body;
      const task = await storage.updateAdminTask(req.params.taskId, updates);
      res.json(task);
    } catch (error) {
      console.error("Error updating admin task:", error);
      res.status(500).json({ message: "Failed to update admin task" });
    }
  });

  app.post('/api/admin/tasks/:taskId/approve', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.id;
      const taskId = req.params.taskId;

      // Get the task to determine what needs approval
      const task = await storage.getAdminTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Handle approval based on entity type
      // Note: RAG configuration approval has been removed

      // Complete the approval task
      await storage.updateAdminTask(taskId, {
        status: "completed",
        approvedBy: adminId,
        completedAt: new Date(),
      });

      // Trigger webhooks for task approval
      await triggerApprovalWebhooks('task.approved', {
        taskId: taskId,
        taskType: task.type,
        taskTitle: task.title,
        organizationId: task.organizationId,
        approvedBy: adminId,
        approvedAt: new Date().toISOString(),
        metadata: task.metadata
      });

      res.json({ message: "Task approved successfully" });
    } catch (error) {
      console.error("Error approving task:", error);
      res.status(500).json({ message: "Failed to approve task" });
    }
  });

  app.post('/api/admin/tasks/:taskId/reject', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { reason } = req.body;
      const adminId = req.user.id;
      const taskId = req.params.taskId;

      // Get the task before updating
      const task = await storage.getAdminTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Update task status to rejected
      await storage.updateAdminTask(taskId, {
        status: "rejected",
        rejectedBy: adminId,
        completedAt: new Date(),
        metadata: { ...task.metadata, rejectionReason: reason }
      });

      // Handle rejection based on entity type
      // Note: RAG configuration rejection has been removed

      // Trigger webhooks for task rejection
      await triggerApprovalWebhooks('task.rejected', {
        taskId: taskId,
        taskType: task.type,
        taskTitle: task.title,
        organizationId: task.organizationId,
        rejectedBy: adminId,
        rejectedAt: new Date().toISOString(),
        rejectionReason: reason,
        metadata: task.metadata
      });

      res.json({ message: "Task rejected successfully" });
    } catch (error) {
      console.error("Error rejecting task:", error);
      res.status(500).json({ message: "Failed to reject task" });
    }
  });

  // User tasks - Get pending approval tasks for current user
  app.get('/api/user/pending-approvals', isAuthenticated, async (req: any, res) => {
    try {
      // Get all pending tasks
      const allTasks = await storage.getAdminTasks("pending");

      // Filter tasks created by or related to the current user
      const userTasks = allTasks.filter(task =>
        task.requestedBy === req.user.id ||
        task.metadata?.userId === req.user.id ||
        task.metadata?.requestedBy === req.user.id
      );

      res.json(userTasks);
    } catch (error) {
      console.error("Error fetching user pending approvals:", error);
      res.status(500).json({ message: "Failed to fetch pending approvals" });
    }
  });

  // Helper function to trigger approval webhooks
  async function triggerApprovalWebhooks(event: string, taskData: any) {
    try {
      // Get all active webhooks that are subscribed to this event
      const webhooks = await storage.getApprovalWebhooks();
      const activeWebhooks = webhooks.filter(w =>
        w.isActive &&
        w.events &&
        (w.events.includes(event) || w.events.includes('task.status_changed'))
      );

      // Send webhook to each endpoint
      for (const webhook of activeWebhooks) {
        try {
          const payload = {
            event,
            timestamp: new Date().toISOString(),
            data: taskData
          };

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...webhook.headers
          };

          // Add signature if secret is configured
          if (webhook.secret) {
            const crypto = require('crypto');
            const signature = crypto
              .createHmac('sha256', webhook.secret)
              .update(JSON.stringify(payload))
              .digest('hex');
            headers['X-Webhook-Signature'] = signature;
          }

          const response = await fetch(webhook.webhookUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            await storage.updateApprovalWebhook(webhook.id, {
              lastTriggered: new Date()
            });
          } else {
            await storage.updateApprovalWebhook(webhook.id, {
              failureCount: (webhook.failureCount || 0) + 1
            });
          }
        } catch (error) {
          console.error(`Failed to send webhook to ${webhook.name}:`, error);
          await storage.updateApprovalWebhook(webhook.id, {
            failureCount: (webhook.failureCount || 0) + 1
          });
        }
      }
    } catch (error) {
      console.error('Error triggering approval webhooks:', error);
    }
  }

  // Approval Webhook routes
  app.get('/api/admin/approval-webhooks', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const webhooks = await storage.getApprovalWebhooks();
      res.json(webhooks);
    } catch (error) {
      console.error("Error fetching approval webhooks:", error);
      res.status(500).json({ message: "Failed to fetch approval webhooks" });
    }
  });

  app.post('/api/admin/approval-webhooks', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const webhookData = {
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date(),
        failureCount: 0
      };

      const newWebhook = await storage.createApprovalWebhook(webhookData);
      res.json(newWebhook);
    } catch (error) {
      console.error("Error creating approval webhook:", error);
      res.status(500).json({ message: "Failed to create approval webhook" });
    }
  });

  app.patch('/api/admin/approval-webhooks/:webhookId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const webhook = await storage.getApprovalWebhook(req.params.webhookId);
      if (!webhook) {
        return res.status(404).json({ message: "Webhook not found" });
      }

      const updatedWebhook = await storage.updateApprovalWebhook(req.params.webhookId, {
        ...req.body,
        updatedAt: new Date()
      });
      res.json(updatedWebhook);
    } catch (error) {
      console.error("Error updating approval webhook:", error);
      res.status(500).json({ message: "Failed to update approval webhook" });
    }
  });

  app.delete('/api/admin/approval-webhooks/:webhookId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const webhook = await storage.getApprovalWebhook(req.params.webhookId);
      if (!webhook) {
        return res.status(404).json({ message: "Webhook not found" });
      }

      await storage.deleteApprovalWebhook(req.params.webhookId);
      res.json({ message: "Webhook deleted successfully" });
    } catch (error) {
      console.error("Error deleting approval webhook:", error);
      res.status(500).json({ message: "Failed to delete approval webhook" });
    }
  });

  // Test webhook endpoint
  app.post('/api/admin/approval-webhooks/:webhookId/test', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const webhook = await storage.getApprovalWebhook(req.params.webhookId);
      if (!webhook) {
        return res.status(404).json({ message: "Webhook not found" });
      }

      // Send test webhook
      const testPayload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test webhook from EchoSensei',
          webhookId: webhook.id,
          webhookName: webhook.name
        }
      };

      try {
        const response = await fetch(webhook.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...webhook.headers,
            ...(webhook.secret ? { 'X-Webhook-Secret': webhook.secret } : {})
          },
          body: JSON.stringify(testPayload)
        });

        if (response.ok) {
          await storage.updateApprovalWebhook(req.params.webhookId, {
            lastTriggered: new Date()
          });
          res.json({ message: "Test webhook sent successfully", status: response.status });
        } else {
          await storage.updateApprovalWebhook(req.params.webhookId, {
            failureCount: (webhook.failureCount || 0) + 1
          });
          res.status(500).json({ message: "Webhook test failed", status: response.status });
        }
      } catch (fetchError) {
        await storage.updateApprovalWebhook(req.params.webhookId, {
          failureCount: (webhook.failureCount || 0) + 1
        });
        console.error("Error sending test webhook:", fetchError);
        res.status(500).json({ message: "Failed to send test webhook" });
      }
    } catch (error) {
      console.error("Error testing webhook:", error);
      res.status(500).json({ message: "Failed to test webhook" });
    }
  });

  // ==========================================
  // Multi-tier Agency Management Routes
  // ==========================================

  // Create a new user directly for agency (with plan limit validation)
  app.post('/api/agency/users', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const org = await storage.getOrganization(user.organizationId);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Only agencies can create users for their organization
      if (org.organizationType !== 'agency') {
        return res.status(403).json({ message: "Only agencies can create users" });
      }

      // Check if user has permission to manage users
      // Agency owners and admins have implicit permission to manage users within their organization
      const isAgencyOwner = org.organizationType === 'agency' &&
        (user.role === 'admin' || user.role === 'agency' || user.role === 'owner' ||
          user.permissions?.includes('manage_agency_users'));

      if (!isAgencyOwner && !user.isAdmin) {
        return res.status(403).json({ message: "You don't have permission to manage users" });
      }

      let { email, firstName, lastName, password, role, permissions } = req.body;

      // Agency users can only create users with 'user' role
      if (user.role === 'agency' && role && role !== 'user') {
        return res.status(403).json({
          message: "Agency users can only create users with 'User - Limited access' role"
        });
      }

      // Check if email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Check plan limits - get current user count
      const orgUsers = await storage.getOrganizationUsers(user.organizationId);
      if (orgUsers.length >= (org.maxUsers || 10)) {
        return res.status(403).json({
          message: `User limit reached. Your plan allows ${org.maxUsers || 10} users. Current: ${orgUsers.length}`,
          currentUsers: orgUsers.length,
          maxUsers: org.maxUsers || 10
        });
      }

      // Hash password before creating user
      const hashedPassword = await hashPassword(password);

      // Create new user for the agency
      const newUser = await storage.createUser({
        email,
        firstName,
        lastName,
        password: hashedPassword,
        organizationId: user.organizationId,
        role: role || 'user',
        permissions: permissions || [],
        status: 'active',
        invitedBy: user.id
      });

      res.json({
        ...newUser,
        currentUsers: orgUsers.length + 1,
        maxUsers: org.maxUsers || 10
      });
    } catch (error) {
      console.error("Error creating agency user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Get agency invitations for the current organization
  app.get('/api/agency/invitations', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const org = await storage.getOrganization(user.organizationId);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Only platform owners and agencies can view invitations
      if (org.organizationType !== 'platform_owner' && org.organizationType !== 'agency') {
        return res.status(403).json({ message: "Only platform owners and agencies can view invitations" });
      }

      const invitations = await storage.getAgencyInvitations(user.organizationId);
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching agency invitations:", error);
      res.status(500).json({ message: "Failed to fetch agency invitations" });
    }
  });

  // Create a new agency invitation
  app.post('/api/agency/invitations', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const org = await storage.getOrganization(user.organizationId);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Only platform owners and agencies can create invitations
      if (org.organizationType !== 'platform_owner' && org.organizationType !== 'agency') {
        return res.status(403).json({ message: "Only platform owners and agencies can create invitations" });
      }

      const { email, name, company, commissionRate, initialCredits, customMessage } = req.body;

      const invitation = await storage.createAgencyInvitation({
        inviterOrganizationId: user.organizationId,
        inviteeEmail: email,
        inviteeName: name,
        inviteeCompany: company,
        commissionRate: commissionRate || '30',
        initialCredits: initialCredits || '0',
        customMessage,
        status: 'pending',
      });

      // Send invitation email with the invitation code
      const publicUrl = process.env.PUBLIC_URL || 'http://localhost:5000';
      const acceptUrl = `${publicUrl}/agency/invitations/accept?code=${invitation.invitationCode}`;

      await EmailService.sendAgencyInvitation(email, {
        inviteeName: name,
        inviterName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email,
        inviterCompany: org.name,
        invitationCode: invitation.invitationCode,
        invitationType: 'agency',
        customMessage,
        acceptUrl
      });

      res.json(invitation);
    } catch (error) {
      console.error("Error creating agency invitation:", error);
      res.status(500).json({ message: "Failed to create agency invitation" });
    }
  });

  // Accept an agency invitation
  app.post('/api/agency/invitations/accept', isAuthenticated, async (req: any, res) => {
    try {
      const { invitationCode } = req.body;

      if (!invitationCode) {
        return res.status(400).json({ message: "Invitation code is required" });
      }

      const agencyOrg = await storage.acceptAgencyInvitation(invitationCode, req.user.id);
      res.json({
        message: "Invitation accepted successfully",
        organization: agencyOrg
      });
    } catch (error: any) {
      console.error("Error accepting agency invitation:", error);
      res.status(400).json({ message: error.message || "Failed to accept invitation" });
    }
  });

  // Get child organizations (agencies or customers)
  app.get('/api/agency/child-organizations', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const org = await storage.getOrganization(user.organizationId);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Only platform owners and agencies can view child organizations
      if (org.organizationType === 'end_customer') {
        return res.status(403).json({ message: "End customers cannot have child organizations" });
      }

      const childOrgs = await storage.getChildOrganizations(user.organizationId);
      res.json(childOrgs);
    } catch (error) {
      console.error("Error fetching child organizations:", error);
      res.status(500).json({ message: "Failed to fetch child organizations" });
    }
  });

  // Get agency commissions
  app.get('/api/agency/commissions', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const org = await storage.getOrganization(user.organizationId);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Only agencies can view their commissions
      if (org.organizationType !== 'agency') {
        return res.status(403).json({ message: "Only agencies can view commissions" });
      }

      const commissions = await storage.getAgencyCommissions(user.organizationId);
      res.json(commissions);
    } catch (error) {
      console.error("Error fetching agency commissions:", error);
      res.status(500).json({ message: "Failed to fetch agency commissions" });
    }
  });

  // Get credit transactions
  app.get('/api/agency/credit-transactions', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const transactions = await storage.getCreditTransactions(user.organizationId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching credit transactions:", error);
      res.status(500).json({ message: "Failed to fetch credit transactions" });
    }
  });

  // Purchase credits (for agencies)
  app.post('/api/agency/purchase-credits', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const org = await storage.getOrganization(user.organizationId);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Only agencies can purchase credits
      if (org.organizationType !== 'agency') {
        return res.status(403).json({ message: "Only agencies can purchase credits" });
      }

      const { amount, paymentMethodId } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid credit amount" });
      }

      // TODO: Process payment with Stripe/PayPal
      // For now, just create the transaction

      const transaction = await storage.createCreditTransaction({
        organizationId: user.organizationId,
        type: 'purchase',
        amount: String(amount),
        creditAmount: Math.round(amount * 1000), // Convert dollars to credits
        description: `Purchased ${amount} credits`,
      });

      res.json(transaction);
    } catch (error) {
      console.error("Error purchasing credits:", error);
      res.status(500).json({ message: "Failed to purchase credits" });
    }
  });

  // Agency Payment Configuration routes
  app.get('/api/agency/payment-config', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const org = await storage.getOrganization(user.organizationId);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Only agencies can manage payment configurations
      if (org.organizationType !== 'agency' || user.role !== 'agency') {
        return res.status(403).json({ message: "Only agency owners can manage payment configurations" });
      }

      const config = await storage.getAgencyPaymentConfig(user.organizationId);
      res.json(config || null);
    } catch (error) {
      console.error("Error fetching agency payment config:", error);
      res.status(500).json({ message: "Failed to fetch payment configuration" });
    }
  });

  app.post('/api/agency/payment-config', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const org = await storage.getOrganization(user.organizationId);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Only agencies can manage payment configurations
      if (org.organizationType !== 'agency' || user.role !== 'agency') {
        return res.status(403).json({ message: "Only agency owners can manage payment configurations" });
      }

      const configData = {
        organizationId: user.organizationId,
        ...req.body
      };

      const config = await storage.createAgencyPaymentConfig(configData);
      res.json(config);
    } catch (error) {
      console.error("Error creating agency payment config:", error);
      res.status(500).json({ message: "Failed to create payment configuration" });
    }
  });

  app.patch('/api/agency/payment-config', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const org = await storage.getOrganization(user.organizationId);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Only agencies can manage payment configurations
      if (org.organizationType !== 'agency' || user.role !== 'agency') {
        return res.status(403).json({ message: "Only agency owners can manage payment configurations" });
      }

      const config = await storage.updateAgencyPaymentConfig(user.organizationId, req.body);
      res.json(config);
    } catch (error) {
      console.error("Error updating agency payment config:", error);
      res.status(500).json({ message: "Failed to update payment configuration" });
    }
  });

  // Agency Pricing Plans routes
  app.get('/api/agency/pricing-plans', async (req: any, res) => {
    try {
      // Allow public access to view pricing plans
      const { agencyDomain } = req.query;

      if (!agencyDomain) {
        return res.status(400).json({ message: "Agency domain is required" });
      }

      // Find agency by subdomain or custom domain
      const org = await storage.getOrganizationBySubdomain(agencyDomain) ||
        await storage.getOrganizationByCustomDomain(agencyDomain);

      if (!org) {
        return res.status(404).json({ message: "Agency not found" });
      }

      const plans = await storage.getAgencyPricingPlans(org.id);
      res.json(plans);
    } catch (error) {
      console.error("Error fetching agency pricing plans:", error);
      res.status(500).json({ message: "Failed to fetch pricing plans" });
    }
  });

  app.post('/api/agency/pricing-plans', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const org = await storage.getOrganization(user.organizationId);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Only agencies can manage pricing plans
      if (org.organizationType !== 'agency' || user.role !== 'agency') {
        return res.status(403).json({ message: "Only agency owners can manage pricing plans" });
      }

      const planData = {
        organizationId: user.organizationId,
        ...req.body
      };

      const plan = await storage.createAgencyPricingPlan(planData);
      res.json(plan);
    } catch (error) {
      console.error("Error creating agency pricing plan:", error);
      res.status(500).json({ message: "Failed to create pricing plan" });
    }
  });

  app.patch('/api/agency/pricing-plans/:planId', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const org = await storage.getOrganization(user.organizationId);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Only agencies can manage pricing plans
      if (org.organizationType !== 'agency' || user.role !== 'agency') {
        return res.status(403).json({ message: "Only agency owners can manage pricing plans" });
      }

      const plan = await storage.updateAgencyPricingPlan(req.params.planId, req.body);
      res.json(plan);
    } catch (error) {
      console.error("Error updating agency pricing plan:", error);
      res.status(500).json({ message: "Failed to update pricing plan" });
    }
  });

  app.delete('/api/agency/pricing-plans/:planId', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const org = await storage.getOrganization(user.organizationId);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Only agencies can manage pricing plans
      if (org.organizationType !== 'agency' || user.role !== 'agency') {
        return res.status(403).json({ message: "Only agency owners can manage pricing plans" });
      }

      await storage.deleteAgencyPricingPlan(req.params.planId);
      res.json({ message: "Pricing plan deleted successfully" });
    } catch (error) {
      console.error("Error deleting agency pricing plan:", error);
      res.status(500).json({ message: "Failed to delete pricing plan" });
    }
  });

  // Agency Subscription routes
  app.get('/api/agency/subscriptions', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const org = await storage.getOrganization(user.organizationId);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Agencies see all their client subscriptions
      // End customers see their own subscriptions
      let subscriptions: any[] = [];
      if (org.organizationType === 'agency') {
        subscriptions = await storage.getAgencySubscriptions(user.organizationId);
      } else {
        // Get user's subscription from parent agency
        if (org.parentOrganizationId) {
          const userSubscription = await storage.getUserSubscription(user.id, org.parentOrganizationId);
          subscriptions = userSubscription ? [userSubscription] : [];
        } else {
          subscriptions = [];
        }
      }

      res.json(subscriptions);
    } catch (error) {
      console.error("Error fetching agency subscriptions:", error);
      res.status(500).json({ message: "Failed to fetch subscriptions" });
    }
  });

  app.post('/api/agency/subscriptions', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const subscriptionData = {
        userId: user.id,
        agencyOrganizationId: req.body.agencyOrganizationId,
        planId: req.body.planId,
        status: 'active' as const,
        ...req.body
      };

      const subscription = await storage.createAgencySubscription(subscriptionData);
      res.json(subscription);
    } catch (error) {
      console.error("Error creating agency subscription:", error);
      res.status(500).json({ message: "Failed to create subscription" });
    }
  });

  app.patch('/api/agency/subscriptions/:subscriptionId', isAuthenticated, async (req: any, res) => {
    try {
      const subscription = await storage.updateAgencySubscription(req.params.subscriptionId, req.body);
      res.json(subscription);
    } catch (error) {
      console.error("Error updating agency subscription:", error);
      res.status(500).json({ message: "Failed to update subscription" });
    }
  });

  app.post('/api/agency/subscriptions/:subscriptionId/cancel', isAuthenticated, async (req: any, res) => {
    try {
      await storage.cancelAgencySubscription(req.params.subscriptionId);
      res.json({ message: "Subscription cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling agency subscription:", error);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  // Agency Transaction routes
  app.get('/api/agency/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const org = await storage.getOrganization(user.organizationId);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Only agencies can view their transactions
      if (org.organizationType !== 'agency') {
        return res.status(403).json({ message: "Only agencies can view transactions" });
      }

      const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
      const transactions = await storage.getAgencyTransactions(user.organizationId, limit);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching agency transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.post('/api/agency/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const transactionData = {
        agencyOrganizationId: user.organizationId,
        ...req.body
      };

      const transaction = await storage.createAgencyTransaction(transactionData);
      res.json(transaction);
    } catch (error) {
      console.error("Error creating agency transaction:", error);
      res.status(500).json({ message: "Failed to create transaction" });
    }
  });

  // Agency client payment processing routes
  app.post('/api/agency/create-payment-intent', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const org = await storage.getOrganization(user.organizationId);
      if (!org || !org.parentOrganizationId) {
        return res.status(400).json({ message: "Invalid organization structure" });
      }

      // Get agency's payment config
      const paymentConfig = await storage.getAgencyPaymentConfig(org.parentOrganizationId);
      if (!paymentConfig || !paymentConfig.isConfigured || !paymentConfig.stripeSecretKey) {
        return res.status(400).json({ message: "Stripe is not configured for this agency" });
      }

      const { planId, amount } = req.body;

      // Initialize Stripe with agency's secret key
      const stripe = new Stripe(paymentConfig.stripeSecretKey, {
        apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion,
      });

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: "usd",
        metadata: {
          userId: user.id,
          organizationId: user.organizationId,
          agencyOrganizationId: org.parentOrganizationId,
          planId: planId
        }
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ message: error.message || "Failed to create payment intent" });
    }
  });

  app.post('/api/agency/create-paypal-order', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const org = await storage.getOrganization(user.organizationId);
      if (!org || !org.parentOrganizationId) {
        return res.status(400).json({ message: "Invalid organization structure" });
      }

      // Get agency's payment config
      const paymentConfig = await storage.getAgencyPaymentConfig(org.parentOrganizationId);
      if (!paymentConfig || !paymentConfig.isConfigured || !paymentConfig.paypalClientId || !paymentConfig.paypalClientSecret) {
        return res.status(400).json({ message: "PayPal is not configured for this agency" });
      }

      const { planId, amount } = req.body;

      // Create PayPal order using the agency's credentials
      // This would use the PayPal SDK with the agency's credentials
      // For now, returning a mock order ID
      res.json({ orderId: `PAYPAL-ORDER-${Date.now()}` });
    } catch (error: any) {
      console.error("Error creating PayPal order:", error);
      res.status(500).json({ message: error.message || "Failed to create PayPal order" });
    }
  });

  app.post('/api/agency/capture-paypal-order', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const org = await storage.getOrganization(user.organizationId);
      if (!org || !org.parentOrganizationId) {
        return res.status(400).json({ message: "Invalid organization structure" });
      }

      const { orderId, planId } = req.body;

      // Get plan details
      const plan = await storage.getAgencyPricingPlan(planId);
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
      }

      // Create subscription
      const subscription = await storage.createAgencySubscription({
        organizationId: user.organizationId,
        userId: user.id,
        agencyOrganizationId: org.parentOrganizationId,
        planId: planId,
        status: 'active',
        stripeSubscriptionId: null,
        paypalSubscriptionId: orderId,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });

      // Create transaction record
      await storage.createAgencyTransaction({
        organizationId: user.organizationId,
        type: 'subscription',
        agencyOrganizationId: org.parentOrganizationId,
        userId: user.id,
        subscriptionId: subscription.id,
        amount: String(plan.price),
        currency: 'USD',
        status: 'completed',
        paymentMethod: 'paypal',
        stripePaymentIntentId: null,
        paypalOrderId: orderId,
        description: `Subscription to ${plan.name}`,
      });

      res.json({ success: true, subscriptionId: subscription.id });
    } catch (error: any) {
      console.error("Error capturing PayPal order:", error);
      res.status(500).json({ message: error.message || "Failed to capture PayPal order" });
    }
  });

  // Get organization's payment config (for clients to check)
  app.get('/api/organizations/:organizationId/payment-config', isAuthenticated, async (req: any, res) => {
    try {
      const config = await storage.getAgencyPaymentConfig(req.params.organizationId);

      if (!config) {
        return res.json(null);
      }

      // Only return public information
      res.json({
        stripeEnabled: !!config.stripeSecretKey,
        stripePublishableKey: config.stripePublishableKey,
        paypalEnabled: !!config.paypalClientId,
        paypalClientId: config.paypalClientId,
        paypalMode: config.paypalClientId?.includes('sandbox') ? 'sandbox' : 'production',
        defaultPaymentMethod: config.defaultGateway || 'stripe'
      });
    } catch (error) {
      console.error("Error fetching payment config:", error);
      res.status(500).json({ message: "Failed to fetch payment configuration" });
    }
  });

  // Get current user's subscription
  app.get('/api/agency/subscriptions/current', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const org = await storage.getOrganization(user.organizationId);
      if (!org || !org.parentOrganizationId) {
        return res.json(null);
      }

      const subscription = await storage.getUserSubscription(user.id, org.parentOrganizationId);
      res.json(subscription);
    } catch (error) {
      console.error("Error fetching current subscription:", error);
      res.status(500).json({ message: "Failed to fetch subscription" });
    }
  });

  // Quick Action Buttons routes - Users (for their own buttons)
  app.get('/api/quick-action-buttons', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get both system buttons and user's organization buttons
      const buttons = await storage.getQuickActionButtons(user.organizationId);
      res.json(buttons);
    } catch (error) {
      console.error("Error fetching quick action buttons:", error);
      res.status(500).json({ message: "Failed to fetch quick action buttons" });
    }
  });

  app.post('/api/quick-action-buttons', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const buttonData = {
        ...req.body,
        isSystem: false,
        createdBy: req.user.id,
        organizationId: user.organizationId
      };

      const newButton = await storage.createQuickActionButton(buttonData);
      res.json(newButton);
    } catch (error) {
      console.error("Error creating quick action button:", error);
      res.status(500).json({ message: "Failed to create quick action button" });
    }
  });

  app.patch('/api/quick-action-buttons/:buttonId', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const button = await storage.getQuickActionButton(req.params.buttonId);
      if (!button) {
        return res.status(404).json({ message: "Quick action button not found" });
      }

      // Users can only update their own organization's buttons (not system buttons)
      if (button.isSystem || button.organizationId !== user.organizationId) {
        return res.status(403).json({ message: "You don't have permission to modify this button" });
      }

      const updatedButton = await storage.updateQuickActionButton(req.params.buttonId, req.body);
      res.json(updatedButton);
    } catch (error) {
      console.error("Error updating quick action button:", error);
      res.status(500).json({ message: "Failed to update quick action button" });
    }
  });

  app.delete('/api/quick-action-buttons/:buttonId', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const button = await storage.getQuickActionButton(req.params.buttonId);
      if (!button) {
        return res.status(404).json({ message: "Quick action button not found" });
      }

      // Users can only delete their own organization's buttons (not system buttons)
      if (button.isSystem || button.organizationId !== user.organizationId) {
        return res.status(403).json({ message: "You don't have permission to delete this button" });
      }

      await storage.deleteQuickActionButton(req.params.buttonId);
      res.json({ message: "Quick action button deleted successfully" });
    } catch (error) {
      console.error("Error deleting quick action button:", error);
      res.status(500).json({ message: "Failed to delete quick action button" });
    }
  });

  // Integration routes
  app.post("/api/integrations", isAuthenticated, checkPermission('manage_integrations'), async (req: any, res) => {
    try {
      console.log("Integration save request received:", { body: req.body, user: req.user?.id });
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        console.log("User not found:", userId);
        return res.status(404).json({ message: "User not found" });
      }

      let { apiKey } = req.body;
      console.log("API key received:", apiKey ? "***" + apiKey.slice(-4) : "null");
      if (!apiKey) {
        return res.status(400).json({ message: "API key is required" });
      }

      // Sanitize the API key to remove non-ASCII characters
      // This handles cases where the frontend sanitization might be bypassed
      apiKey = apiKey
        .replace(/[\u2010-\u2015]/g, '-')  // Replace various Unicode dashes with ASCII hyphen
        .replace(/[\u2018-\u201B]/g, "'")  // Replace smart quotes with ASCII apostrophe
        .replace(/[\u201C-\u201F]/g, '"')  // Replace smart double quotes with ASCII quote
        .replace(/\u2026/g, '...')         // Replace ellipsis with three dots
        .replace(/\s+/g, '')               // Remove all whitespace
        .replace(/[^\x20-\x7E]/g, '')      // Remove any remaining non-ASCII characters
        .trim();

      const encryptedKey = encryptApiKey(apiKey);
      const apiKeyLast4 = apiKey.slice(-4);
      console.log("Encrypted API key length:", encryptedKey.length);

      // Check if this is a different API key - if so, clear old data
      const existingIntegration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (existingIntegration && existingIntegration.apiKeyLast4 && existingIntegration.apiKeyLast4 !== apiKeyLast4) {
        console.log(`[API KEY CHANGE] Detected new API key (old: ***${existingIntegration.apiKeyLast4}, new: ***${apiKeyLast4}). Clearing old data...`);

        // Delete all old call logs and agents from previous API key
        await db().delete(callLogs).where(eq(callLogs.organizationId, user.organizationId));
        await db().delete(agents).where(eq(agents.organizationId, user.organizationId));

        console.log(`[API KEY CHANGE] Old data cleared. Ready for fresh sync with new API key.`);
      }

      // Create integration directly as ACTIVE - no approval needed for integrations
      console.log("Saving integration for org:", user.organizationId);
      const integration = await storage.upsertIntegration({
        organizationId: user.organizationId,
        provider: "elevenlabs",
        apiKey: encryptedKey,
        apiKeyLast4: apiKeyLast4,
        status: "ACTIVE", // Direct activation - no approval needed
      });
      console.log("Integration saved successfully:", integration.id);

      res.json({
        message: "Integration saved successfully",
        id: integration.id,
        status: "ACTIVE",
        apiKeyLast4: apiKeyLast4
      });
    } catch (error) {
      console.error("Error saving integration:", error);
      res.status(500).json({ message: "Failed to save integration" });
    }
  });

  // Get all provider integrations for the organization (must come before :provider route)
  app.get("/api/integrations/all", isAuthenticated, checkPermission('manage_integrations'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get all integrations for this organization
      const allIntegrations = await storage.getAllIntegrations();
      const orgIntegrations = allIntegrations.filter(i => i.organizationId === user.organizationId);

      // Never return actual credentials, mask them
      const safeIntegrations = orgIntegrations.map(integration => ({
        id: integration.id,
        provider: integration.provider,
        providerCategory: integration.providerCategory,
        status: integration.status,
        lastTested: integration.lastTested,
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt,
        apiKeyLast4: integration.apiKeyLast4,
        // Return masked credentials (show that they exist but not the values)
        credentials: integration.credentials
          ? Object.keys(integration.credentials).reduce((acc, key) => ({
            ...acc,
            [key]: '***'
          }), {})
          : {},
      }));

      res.json(safeIntegrations);
    } catch (error) {
      console.error("Error fetching all integrations:", error);
      res.status(500).json({ message: "Failed to fetch integrations" });
    }
  });

  // Get integration by provider
  app.get("/api/integrations/:provider", isAuthenticated, checkPermission('manage_integrations'), async (req: any, res) => {
    try {
      let { provider } = req.params;

      // Map voiceai to elevenlabs internally
      if (provider === "voiceai") {
        provider = "elevenlabs";
      }

      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, provider);

      if (!integration) {
        // Return inactive status if no integration exists
        return res.json({
          status: "INACTIVE",
          provider: provider,
          message: "No integration configured"
        });
      }

      // No approval needed for integrations anymore - only for RAG, tools, webhooks, and MCP

      // Don't send the encrypted API key to the client
      const { apiKey, ...integrationWithoutKey } = integration;
      res.json(integrationWithoutKey);
    } catch (error) {
      console.error("Error fetching integration:", error);
      res.status(500).json({ message: "Failed to fetch integration" });
    }
  });

  app.post("/api/integrations/test", isAuthenticated, checkPermission('manage_integrations'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration) {
        return res.status(404).json({ message: "No integration found" });
      }

      // Use the new ElevenLabs service for better error handling and retries
      const { createElevenLabsClient } = await import("./services/elevenlabs");
      const client = createElevenLabsClient(integration.apiKey);

      const userResult = await client.getUser();

      if (userResult.success && userResult.data) {
        await storage.updateIntegrationStatus(integration.id, "ACTIVE", new Date());

        res.json({
          message: "Connection successful",
          status: "ACTIVE",
          subscription: userResult.data.subscription || null
        });
      } else {
        console.error("ElevenLabs API test failed:", userResult.error);
        await storage.updateIntegrationStatus(integration.id, "ERROR", new Date());

        // Return more specific error message based on status code
        let errorMessage = "Connection failed";
        if (userResult.statusCode === 401) {
          errorMessage = "Invalid API key. Please check your ElevenLabs API key.";
        } else if (userResult.statusCode === 403) {
          errorMessage = "Access forbidden. Your API key may not have the required permissions.";
        } else if (userResult.statusCode === 404) {
          errorMessage = "ElevenLabs API endpoint not found. Please try again later.";
        } else if (userResult.error) {
          errorMessage = userResult.error;
        }

        res.status(400).json({
          message: errorMessage,
          status: "ERROR"
        });
      }
    } catch (error: any) {
      console.error("Error testing integration:", error);
      res.status(500).json({
        message: error.message || "Failed to test integration"
      });
    }
  });

  app.get("/api/integrations", isAuthenticated, checkPermission('manage_integrations'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration) {
        return res.json({ status: "INACTIVE" });
      }

      // Never return the actual API key, but include last 4 chars for identification
      res.json({
        status: integration.status,
        lastTested: integration.lastTested,
        createdAt: integration.createdAt,
        apiKeyLast4: integration.apiKeyLast4,
      });
    } catch (error) {
      console.error("Error fetching integration:", error);
      res.status(500).json({ message: "Failed to fetch integration" });
    }
  });

  // Delete a provider integration
  app.delete("/api/integrations/:provider", isAuthenticated, checkPermission('manage_integrations'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const provider = req.params.provider;
      await storage.deleteIntegration(user.organizationId, provider);

      res.json({ message: "Integration deleted successfully" });
    } catch (error) {
      console.error("Error deleting integration:", error);
      res.status(500).json({ message: "Failed to delete integration" });
    }
  });

  // Agent routes
  app.post("/api/agents/validate", isAuthenticated, checkPermission('manage_agents'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { elevenLabsAgentId } = req.body;
      if (!elevenLabsAgentId) {
        return res.status(400).json({ message: "ElevenLabs Agent ID is required" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || integration.status !== "ACTIVE") {
      });
} catch (error: any) {
  console.error("Error initiating test call:", error);
  res.status(500).json({ error: error.message || "Failed to initiate test call" });
}
  });

app.post("/api/batch-calls/:id/submit", isAuthenticated, async (req: any, res) => {
  try {
    const organizationId = req.user.organizationId;
    const batchCall = await storage.getBatchCall(req.params.id, organizationId);

    if (!batchCall) {
      return res.status(404).json({ error: "Batch call not found" });
    }

    // Get the integration
    const integration = await storage.getIntegration(organizationId, "elevenlabs");
    if (!integration || integration.status !== "ACTIVE") {
      return res.status(400).json({
        error: "ElevenLabs integration not configured or active"
      });
    }

    const apiKey = decryptApiKey(integration.apiKey);

    // Get recipients
    const recipients = await storage.getBatchCallRecipients(req.params.id);
    if (recipients.length === 0) {
      return res.status(400).json({ error: "No recipients found for this batch call" });
    }

    // Get agent details
    const agent = await storage.getAgent(batchCall.agentId, organizationId);
    if (!agent) {
      return res.status(400).json({ error: "Agent not found" });
    }

    // Prepare ElevenLabs batch call payload
    const payload = {
      name: batchCall.name,
      agent_id: agent.elevenLabsAgentId,
      phone_number_id: batchCall.phoneNumberId,
      recipients: recipients.map(r => {
        const recipientData: any = {
          phone_number: r.phoneNumber,
        };

        // Add all variables including overrides
        if (r.variables && typeof r.variables === 'object') {
          // Include all fields from the CSV, ElevenLabs will handle overrides
          Object.entries(r.variables).forEach(([key, value]) => {
            // Skip undefined or empty string values for override fields
            if (value !== undefined && value !== '') {
              recipientData[key] = value;
            }
          });
        }

        return recipientData;
      }),
    };

    // Submit to ElevenLabs
    const response = await callElevenLabsAPI(
      apiKey,
      "/v1/convai/batch-calling",
      "POST",
      payload,
      integration.id
    );

    // Update batch call with ElevenLabs ID and status
    await storage.updateBatchCall(req.params.id, organizationId, {
      elevenlabsBatchId: response.batch_id || response.id,
      status: "pending",
      startedAt: new Date(),
    });

    res.json({
      message: "Batch call submitted successfully",
      batchId: response.batch_id || response.id
    });
  } catch (error: any) {
    console.error("Error submitting batch call:", error);
    res.status(500).json({ error: error.message || "Failed to submit batch call" });
  }
});

app.delete("/api/batch-calls/:id", isAuthenticated, checkPermission('manage_agents'), async (req: any, res) => {
  try {
    const organizationId = req.user.organizationId;
    await storage.deleteBatchCall(req.params.id, organizationId);
    res.json({ message: "Batch call deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting batch call:", error);
    res.status(500).json({ error: error.message || "Failed to delete batch call" });
  }
});

// Admin: Get all payments
app.get("/api/admin/payments", isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const allPayments = await storage.getAllPayments();
    res.json(allPayments);
  } catch (error) {
    console.error("Error fetching all payments:", error);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// Agency User Management Routes

// Get organization users
app.get("/api/agency/users", isAuthenticated, async (req: any, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: "No organization found" });
    }

    const users = await storage.getOrganizationUsers(organizationId);

    // Format user data for frontend
    const formattedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      role: user.role || "user",
      status: user.status || "active",
      createdAt: user.createdAt?.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString(),
      permissions: user.permissions || [],
      assignedAgentIds: [] as string[]  // Will be populated later
    }));

    // Get assigned agents for all users in a single query (prevents N+1)
    const userIds = formattedUsers.map(u => u.id);
    const userAgentsMap = await storage.getUsersWithAssignedAgents(userIds, organizationId);

    // Assign agents to each user
    for (const user of formattedUsers) {
      const assignedAgents = userAgentsMap.get(user.id) || [];
      user.assignedAgentIds = assignedAgents.map(a => a.id);
    }

    res.json(formattedUsers);
  } catch (error) {
    console.error("Error fetching organization users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Update user (permissions, role, status)
app.patch("/api/agency/users/:userId", isAuthenticated, async (req: any, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: "No organization found" });
    }

    const { userId } = req.params;
    let { role, status, permissions } = req.body;

    // Get current user to check their role
    const currentUser = await storage.getUser(req.user.id);

    // Agency users can only set role to 'user'
    if (currentUser?.role === 'agency' && role && role !== 'user') {
      return res.status(403).json({
        error: "Agency users can only assign 'User - Limited access' role"
      });
    }

    let updatedUser;

    if (role) {
      updatedUser = await storage.updateUserRole(userId, organizationId, role);
    }

    if (permissions) {
      updatedUser = await storage.updateUserPermissions(userId, organizationId, permissions);
    }

    if (status) {
      updatedUser = await storage.toggleUserStatus(userId, status);
    }

    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// Remove user from organization
app.delete("/api/agency/users/:userId", isAuthenticated, async (req: any, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: "No organization found" });
    }

    const { userId } = req.params;
    await storage.removeUserFromOrganization(userId, organizationId);

    res.json({ success: true });
  } catch (error) {
    console.error("Error removing user:", error);
    res.status(500).json({ error: "Failed to remove user" });
  }
});

// Assign agents to user
app.post("/api/agency/users/:userId/agents", isAuthenticated, async (req: any, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: "No organization found" });
    }

    const { userId } = req.params;
    const { agentIds } = req.body;

    await storage.assignAgentsToUser(userId, organizationId, agentIds);

    res.json({ success: true });
  } catch (error) {
    console.error("Error assigning agents:", error);
    res.status(500).json({ error: "Failed to assign agents" });
  }
});

// Get organization invitations
app.get("/api/agency/invitations", isAuthenticated, async (req: any, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: "No organization found" });
    }

    const invitations = await storage.getOrganizationInvitations(organizationId);

    const formattedInvitations = invitations.map(inv => ({
      id: inv.id,
      email: inv.email,
      role: inv.role || "user",
      status: inv.status || "pending",
      invitedAt: inv.createdAt?.toISOString(),
      expiresAt: inv.expiresAt?.toISOString(),
      permissions: inv.permissions || []
    }));

    res.json(formattedInvitations);
  } catch (error) {
    console.error("Error fetching invitations:", error);
    res.status(500).json({ error: "Failed to fetch invitations" });
  }
});

// Send user invitation
app.post("/api/agency/users/invite", isAuthenticated, async (req: any, res) => {
  try {
    const organizationId = req.user?.organizationId;
    const invitedBy = req.user?.id;

    if (!organizationId || !invitedBy) {
      return res.status(400).json({ error: "No organization or user found" });
    }

    let { email, role, permissions } = req.body;

    // Get current user to check their role
    const currentUser = await storage.getUser(req.user.id);

    // Agency users can only invite users with 'user' role
    if (currentUser?.role === 'agency' && role && role !== 'user') {
      return res.status(403).json({
        error: "Agency users can only invite users with 'User - Limited access' role"
      });
    }

    // Check if user already exists in organization
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser && existingUser.organizationId === organizationId) {
      return res.status(400).json({ error: "User already exists in organization" });
    }

    // Create invitation with expiry date (7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await storage.createInvitation({
      organizationId,
      email,
      role: role || "user",
      permissions: permissions || [],
      invitedBy,
      status: "pending",
      expiresAt
    });

    // Send invitation email
    const org = await storage.getOrganization(organizationId);
    const publicUrl = process.env.PUBLIC_URL || 'http://localhost:5000';
    const acceptUrl = `${publicUrl}/invitations/accept?code=${invitation.code}`;

    await EmailService.sendUserInvitation(email, {
      inviteeName: email.split('@')[0],
      inviterName: currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : currentUser?.email || 'Team',
      inviterCompany: org?.name,
      invitationCode: invitation.code,
      invitationType: 'user',
      acceptUrl
    });

    console.log(`Invitation created for ${email} with code: ${invitation.code}`);

    res.json(invitation);
  } catch (error) {
    console.error("Error creating invitation:", error);
    res.status(500).json({ error: "Failed to create invitation" });
  }
});

// Resend invitation
app.post("/api/agency/invitations/:invitationId/resend", isAuthenticated, async (req: any, res) => {
  try {
    const { invitationId } = req.params;

    // Update expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await storage.updateInvitation(invitationId, { expiresAt });

    // Resend invitation email
    const currentUser = await storage.getUser(req.user.id);
    const org = await storage.getOrganization(invitation.organizationId);
    const publicUrl = process.env.PUBLIC_URL || 'http://localhost:5000';
    const acceptUrl = `${publicUrl}/invitations/accept?code=${invitation.code}`;

    await EmailService.sendUserInvitation(invitation.email, {
      inviteeName: invitation.email.split('@')[0],
      inviterName: currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : currentUser?.email || 'Team',
      inviterCompany: org?.name,
      invitationCode: invitation.code,
      invitationType: 'user',
      acceptUrl
    });

    console.log(`Invitation resent for ${invitation.email} with code: ${invitation.code}`);

    res.json(invitation);
  } catch (error) {
    console.error("Error resending invitation:", error);
    res.status(500).json({ error: "Failed to resend invitation" });
  }
});

// Cancel invitation
app.delete("/api/agency/invitations/:invitationId", isAuthenticated, async (req: any, res) => {
  try {
    const { invitationId } = req.params;

    await storage.deleteInvitation(invitationId);

    res.json({ success: true });
  } catch (error) {
    console.error("Error canceling invitation:", error);
    res.status(500).json({ error: "Failed to cancel invitation" });
  }
});

// Accept invitation (public route for invited users)
app.post("/api/invitations/accept", async (req: any, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Invitation code required" });
    }

    const invitation = await storage.getInvitationByCode(code);
    if (!invitation) {
      return res.status(404).json({ error: "Invalid invitation code" });
    }

    if (invitation.status !== "pending") {
      return res.status(400).json({ error: "Invitation already used or expired" });
    }

    if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
      return res.status(400).json({ error: "Invitation has expired" });
    }

    // If user is authenticated, accept the invitation
    if (req.isAuthenticated()) {
      await storage.acceptInvitation(invitation.id, req.user.id);
      return res.json({ success: true, message: "Invitation accepted" });
    }

    // Otherwise, return invitation details for signup
    res.json({
      email: invitation.email,
      organizationId: invitation.organizationId,
      role: invitation.role,
      permissions: invitation.permissions
    });
  } catch (error) {
    console.error("Error accepting invitation:", error);
    res.status(500).json({ error: "Failed to accept invitation" });
  }
});

// ========================================
// Agency Payment Processor Management Routes
// ========================================

// Configure payment processor (Stripe or PayPal)
app.post("/api/agency/payment-processors", isAuthenticated, async (req: any, res) => {
  try {
    const { provider, credentials, metadata } = req.body;
    const organizationId = req.user.organizationId;

    // Validate input
    if (!provider || !credentials) {
      return res.status(400).json({ error: "Provider and credentials are required" });
    }

    if (!['stripe', 'paypal'].includes(provider)) {
      return res.status(400).json({ error: "Invalid provider. Must be 'stripe' or 'paypal'" });
    }

    // Validate credentials based on provider
    let validationResult = { valid: false, error: "" };

    if (provider === 'stripe') {
      if (!credentials.secretKey || !credentials.publishableKey) {
        return res.status(400).json({ error: "Stripe requires secretKey and publishableKey" });
      }
      // Basic validation - try to initialize Stripe
      try {
        // Stripe is already imported at the top
        const stripe = new Stripe(credentials.secretKey, {
          apiVersion: '2025-08-27.basil' as Stripe.LatestApiVersion,
        });
        // Test the credentials by fetching account info
        const account = await stripe.accounts.retrieve();
        validationResult = {
          valid: true,
          error: '',
          accountInfo: {
            id: account.id,
            email: account.email || '',
            charges_enabled: account.charges_enabled || false,
          } as any
        } as any;
      } catch (error: any) {
        validationResult = {
          valid: false,
          error: error.message || 'Invalid Stripe credentials'
        };
      }
    } else if (provider === 'paypal') {
      if (!credentials.clientId || !credentials.clientSecret) {
        return res.status(400).json({ error: "PayPal requires clientId and clientSecret" });
      }
      // Basic PayPal validation
      try {
        const baseUrl = (credentials.mode || 'sandbox') === 'sandbox'
          ? 'https://api-m.sandbox.paypal.com'
          : 'https://api-m.paypal.com';

        const auth = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64');
        const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=client_credentials',
        });

        if (response.ok) {
          validationResult = { valid: true, error: '' };
        } else {
          validationResult = {
            valid: false,
            error: 'Invalid PayPal credentials'
          };
        }
      } catch (error: any) {
        validationResult = {
          valid: false,
          error: error.message || 'Failed to validate PayPal credentials'
        };
      }
    }

    if (!validationResult?.valid) {
      return res.status(400).json({
        error: "Invalid credentials",
        details: validationResult?.error
      });
    }

    // Encrypt credentials
    const encryptedCredentials = encryptCredentials(credentials);

    // Save to database
    const processor = await storage.createAgencyPaymentProcessor({
      organizationId,
      provider,
      encryptedCredentials,
      status: 'active',
      metadata: {
        ...metadata,
        publicKey: provider === 'stripe' ? credentials.publishableKey : undefined,
        mode: provider === 'paypal' ? (credentials.mode || 'sandbox') : undefined,
      },
    });

    res.json({
      id: processor.id,
      provider: processor.provider,
      status: processor.status,
      metadata: processor.metadata,
      createdAt: processor.createdAt,
    });
  } catch (error) {
    console.error("Error configuring payment processor:", error);
    res.status(500).json({ error: "Failed to configure payment processor" });
  }
});

// Get configured payment processors (without exposing keys)
app.get("/api/agency/payment-processors", isAuthenticated, async (req: any, res) => {
  try {
    const organizationId = req.user.organizationId;
    const processors = await storage.getAgencyPaymentProcessors(organizationId);

    // Remove encrypted credentials from response
    const safeProcessors = processors.map(p => ({
      id: p.id,
      provider: p.provider,
      status: p.status,
      lastValidatedAt: p.lastValidatedAt,
      metadata: p.metadata,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    res.json(safeProcessors);
  } catch (error) {
    console.error("Error fetching payment processors:", error);
    res.status(500).json({ error: "Failed to fetch payment processors" });
  }
});

// Test payment processor credentials
app.post("/api/agency/test-payment-processor", isAuthenticated, async (req: any, res) => {
  try {
    const { provider } = req.body;
    const organizationId = req.user.organizationId;

    if (!provider) {
      return res.status(400).json({ error: "Provider is required" });
    }

    const processor = await storage.getAgencyPaymentProcessor(organizationId, provider);
    if (!processor) {
      return res.status(404).json({ error: "Payment processor not configured" });
    }

    const credentials = decryptCredentials(processor.encryptedCredentials);

    let validationResult = { valid: false, error: "" };
    if (provider === 'stripe') {
      try {
        // Stripe is already imported at the top
        const stripe = new Stripe(credentials.secretKey, {
          apiVersion: '2025-08-27.basil' as Stripe.LatestApiVersion,
        });
        const account = await stripe.accounts.retrieve();
        validationResult = {
          valid: true,
          error: '',
          accountInfo: {
            id: account.id,
            email: account.email || '',
            charges_enabled: account.charges_enabled || false,
          } as any
        } as any;
      } catch (error: any) {
        validationResult = {
          valid: false,
          error: error.message || 'Invalid Stripe credentials'
        };
      }
    } else if (provider === 'paypal') {
      try {
        const baseUrl = (processor.metadata?.mode || 'sandbox') === 'sandbox'
          ? 'https://api-m.sandbox.paypal.com'
          : 'https://api-m.paypal.com';

        const auth = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64');
        const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=client_credentials',
        });

        if (response.ok) {
          validationResult = { valid: true, error: '' };
        } else {
          validationResult = {
            valid: false,
            error: 'Invalid PayPal credentials'
          };
        }
      } catch (error: any) {
        validationResult = {
          valid: false,
          error: error.message || 'Failed to validate PayPal credentials'
        };
      }
    }

    if (validationResult?.valid) {
      // Update last validated timestamp
      await storage.updateAgencyPaymentProcessor(processor.id, {
        lastValidatedAt: new Date(),
        status: 'active',
      });

      res.json({
        valid: true,
        message: "Payment processor credentials are valid",
        ...('accountInfo' in validationResult && validationResult.accountInfo ? { accountInfo: validationResult.accountInfo } : {}),
      });
    } else {
      // Update status to invalid
      await storage.updateAgencyPaymentProcessor(processor.id, {
        status: 'invalid',
        validationError: validationResult?.error,
      });

      res.status(400).json({
        valid: false,
        error: validationResult?.error || "Invalid credentials"
      });
    }
  } catch (error) {
    console.error("Error testing payment processor:", error);
    res.status(500).json({ error: "Failed to test payment processor" });
  }
});

// Delete payment processor
app.delete("/api/agency/payment-processors/:provider", isAuthenticated, async (req: any, res) => {
  try {
    const { provider } = req.params;
    const organizationId = req.user.organizationId;

    await storage.deleteAgencyPaymentProcessor(organizationId, provider);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting payment processor:", error);
    res.status(500).json({ error: "Failed to delete payment processor" });
  }
});

// ========================================
// Agency Billing Plans Management Routes
// ========================================

// Get agency billing plans
app.get("/api/agency/billing-plans", isAuthenticated, async (req: any, res) => {
  try {
    const organizationId = req.user.organizationId;
    const includeInactive = req.query.includeInactive === 'true';

    const plans = await storage.getAgencyBillingPlans(organizationId, includeInactive);
    res.json(plans);
  } catch (error) {
    console.error("Error fetching billing plans:", error);
    res.status(500).json({ error: "Failed to fetch billing plans" });
  }
});

// Create billing plan
app.post("/api/agency/billing-plans", isAuthenticated, async (req: any, res) => {
  try {
    const organizationId = req.user.organizationId;
    const planData = req.body;

    // Validate required fields
    if (!planData.name || !planData.price || !planData.billingCycle) {
      return res.status(400).json({
        error: "Name, price, and billing cycle are required"
      });
    }

    // Create plan in database
    const plan = await storage.createAgencyBillingPlan({
      ...planData,
      organizationId,
    });

    // Try to create Stripe product if configured
    const stripeProcessor = await storage.getAgencyPaymentProcessor(organizationId, 'stripe');
    if (stripeProcessor && stripeProcessor.status === 'active') {
      try {
        const credentials = decryptCredentials(stripeProcessor.encryptedCredentials);
        // Stripe is already imported at the top
        const stripe = new Stripe(credentials.secretKey, {
          apiVersion: '2025-08-27.basil' as Stripe.LatestApiVersion,
        });

        // Create product
        const product = await stripe.products.create({
          name: plan.name,
          description: plan.description || undefined,
        });

        // Create price
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: Math.round(Number(plan.price) * 100), // Convert to cents
          currency: 'usd',
          recurring: (plan.billingCycle === 'monthly' || plan.billingCycle === 'annual') ? {
            interval: plan.billingCycle === 'annual' ? 'year' : 'month',
          } : undefined,
        });

        await storage.updateAgencyBillingPlan(plan.id, {
          stripeProductId: product.id,
          stripePriceId: price.id,
        });
      } catch (error) {
        console.error('Failed to create Stripe product:', error);
        // Continue without Stripe product - not a critical failure
      }
    }

    // TODO: Create PayPal plan if configured

    res.json(plan);
  } catch (error) {
    console.error("Error creating billing plan:", error);
    res.status(500).json({ error: "Failed to create billing plan" });
  }
});

// Update billing plan
app.patch("/api/agency/billing-plans/:id", isAuthenticated, async (req: any, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const organizationId = req.user.organizationId;

    // Get existing plan to verify ownership
    const existingPlan = await storage.getAgencyBillingPlan(id);
    if (!existingPlan || existingPlan.organizationId !== organizationId) {
      return res.status(404).json({ error: "Billing plan not found" });
    }

    // Update plan
    const updatedPlan = await storage.updateAgencyBillingPlan(id, updates);

    // Update Stripe product if needed
    if (existingPlan.stripeProductId && (updates.name || updates.description)) {
      const stripeProcessor = await storage.getAgencyPaymentProcessor(organizationId, 'stripe');
      if (stripeProcessor && stripeProcessor.status === 'active') {
        try {
          const credentials = decryptCredentials(stripeProcessor.encryptedCredentials);
          const { Stripe } = await import('stripe');
          const stripe = new Stripe(credentials.secretKey, {
            apiVersion: '2025-08-27.basil',
          });

          await stripe.products.update(existingPlan.stripeProductId, {
            ...(updates.name ? { name: updates.name } : {}),
            ...(updates.description ? { description: updates.description } : {}),
          });
        } catch (error) {
          console.error('Failed to update Stripe product:', error);
        }
      }
    }

    res.json(updatedPlan);
  } catch (error) {
    console.error("Error updating billing plan:", error);
    res.status(500).json({ error: "Failed to update billing plan" });
  }
});

// Delete billing plan
app.delete("/api/agency/billing-plans/:id", isAuthenticated, async (req: any, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    // Get existing plan to verify ownership
    const existingPlan = await storage.getAgencyBillingPlan(id);
    if (!existingPlan || existingPlan.organizationId !== organizationId) {
      return res.status(404).json({ error: "Billing plan not found" });
    }

    // Check if plan has active subscriptions
    const subscriptions = await storage.getCustomerSubscriptions(organizationId);
    const hasActiveSubscriptions = subscriptions.some(s =>
      s.planId === id && s.status === 'active'
    );

    if (hasActiveSubscriptions) {
      return res.status(400).json({
        error: "Cannot delete plan with active subscriptions"
      });
    }

    // Archive Stripe product if exists
    if (existingPlan.stripeProductId) {
      const stripeProcessor = await storage.getAgencyPaymentProcessor(organizationId, 'stripe');
      if (stripeProcessor && stripeProcessor.status === 'active') {
        try {
          const credentials = decryptCredentials(stripeProcessor.encryptedCredentials);
          const { Stripe } = await import('stripe');
          const stripe = new Stripe(credentials.secretKey, {
            apiVersion: '2025-08-27.basil',
          });

          await stripe.products.update(existingPlan.stripeProductId, {
            active: false,
          });
        } catch (error) {
          console.error('Failed to archive Stripe product:', error);
        }
      }
    }

    // Soft delete by marking as inactive
    await storage.updateAgencyBillingPlan(id, { isActive: false });

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting billing plan:", error);
    res.status(500).json({ error: "Failed to delete billing plan" });
  }
});

// Get agency subscriptions
app.get("/api/agency/subscriptions", isAuthenticated, async (req: any, res) => {
  try {
    const organizationId = req.user.organizationId;
    const subscriptions = await storage.getCustomerSubscriptions(organizationId);

    res.json(subscriptions);
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

// Testing endpoints (simplified implementation)
// Store test scenarios in memory for now (can be moved to database later)
const testScenarios = new Map<string, any[]>();
const testResults = new Map<string, any[]>();

// Get test scenarios for an agent
app.get("/api/testing/scenarios", isAuthenticated, async (req: any, res) => {
  try {
    const { agentId } = req.query;
    if (!agentId) {
      return res.status(400).json({ error: "Agent ID is required" });
    }

    const scenarios = testScenarios.get(agentId) || [];
    res.json(scenarios);
  } catch (error) {
    console.error("Error fetching test scenarios:", error);
    res.status(500).json({ error: "Failed to fetch test scenarios" });
  }
});

// Create a test scenario
app.post("/api/testing/scenarios", isAuthenticated, async (req: any, res) => {
  try {
    const { agentId, name, description, expectedBehavior, testMessages, tags } = req.body;

    if (!agentId || !name || !testMessages) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const scenario = {
      id: crypto.randomBytes(16).toString("hex"),
      agentId,
      name,
      description: description || "",
      expectedBehavior: expectedBehavior || "",
      testMessages,
      tags: tags || [],
      status: "not_run",
      createdAt: new Date().toISOString(),
    };

    const scenarios = testScenarios.get(agentId) || [];
    scenarios.push(scenario);
    testScenarios.set(agentId, scenarios);

    res.json(scenario);
  } catch (error) {
    console.error("Error creating test scenario:", error);
    res.status(500).json({ error: "Failed to create test scenario" });
  }
});

// Delete a test scenario
app.delete("/api/testing/scenarios/:id", isAuthenticated, async (req: any, res) => {
  try {
    const { id } = req.params;

    // Find and remove the scenario
    for (const [agentId, scenarios] of Array.from(testScenarios.entries())) {
      const index = scenarios.findIndex((s: any) => s.id === id);
      if (index !== -1) {
        scenarios.splice(index, 1);
        testScenarios.set(agentId, scenarios);
        return res.json({ success: true });
      }
    }

    return res.status(404).json({ error: "Test scenario not found" });
  } catch (error) {
    console.error("Error deleting test scenario:", error);
    res.status(500).json({ error: "Failed to delete test scenario" });
  }
});

// Run a test scenario
app.post("/api/testing/run", isAuthenticated, async (req: any, res) => {
  try {
    const { agentId, scenarioId } = req.body;

    if (!agentId || !scenarioId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const scenarios = testScenarios.get(agentId) || [];
    const scenario = scenarios.find(s => s.id === scenarioId);

    if (!scenario) {
      return res.status(404).json({ error: "Test scenario not found" });
    }

    // Update scenario status
    scenario.status = "running";
    scenario.lastRun = new Date().toISOString();

    // Simulate test execution
    const startTime = Date.now();

    // Create simulated transcript
    const transcript = scenario.testMessages.map((msg: string, idx: number) => ({
      role: idx % 2 === 0 ? "user" : "agent",
      message: msg,
      timestamp: new Date().toISOString(),
    }));

    // Simulate evaluation
    const evaluation = {
      score: Math.floor(Math.random() * 30) + 70, // Random score between 70-100
      criteria: {
        "Responded appropriately": Math.random() > 0.3,
        "Maintained context": Math.random() > 0.3,
        "Professional tone": Math.random() > 0.2,
        "Resolved issue": Math.random() > 0.4,
      },
      feedback: "Test completed successfully with simulated results",
    };

    const duration = Date.now() - startTime;
    const status = evaluation.score >= 80 ? "passed" : "failed";

    // Update scenario status
    scenario.status = status;

    // Save test result
    const result = {
      id: crypto.randomBytes(16).toString("hex"),
      scenarioId,
      agentId,
      runAt: new Date().toISOString(),
      duration,
      status,
      transcript,
      evaluation,
      createdAt: new Date().toISOString(),
    };

    const results = testResults.get(agentId) || [];
    results.push(result);
    testResults.set(agentId, results);

    res.json(result);
  } catch (error) {
    console.error("Error running test:", error);
    res.status(500).json({ error: "Failed to run test" });
  }
});

// Get test results
app.get("/api/testing/results", isAuthenticated, async (req: any, res) => {
  try {
    const { agentId } = req.query;
    if (!agentId) {
      return res.status(400).json({ error: "Agent ID is required" });
    }

    const results = testResults.get(agentId as string) || [];
    res.json(results);
  } catch (error) {
    console.error("Error fetching test results:", error);
    res.status(500).json({ error: "Failed to fetch test results" });
  }
});

// Register real-time sync routes
registerRealtimeSyncRoutes(app);

const httpServer = createServer(app);
return httpServer;
}
