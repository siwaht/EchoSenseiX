import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword } from "./auth";
import { insertIntegrationSchema, insertAgentSchema, insertCallLogSchema, insertPhoneNumberSchema, insertBatchCallSchema, insertBatchCallRecipientSchema, type Integration, callLogs, agents } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";
import type { RequestHandler } from "express";
import { seedAdminUser } from "./seedAdmin";
import { checkPermission, checkRoutePermission } from "./middleware/permissions";
import ElevenLabsService from "./services/elevenlabs";
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

// ElevenLabs API helper
async function callElevenLabsAPI(apiKey: string, endpoint: string, method = "GET", body?: any, integrationId?: string) {
  const headers: any = {
    "xi-api-key": apiKey,
    "Content-Type": "application/json",
  };

  const url = `https://api.elevenlabs.io${endpoint}`;
  // Removed verbose logging to prevent console spill over

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const responseText = await response.text();
  
  if (!response.ok) {
    // Check for authentication errors and mark integration as disconnected
    if ((response.status === 401 || response.status === 403) && integrationId) {
      try {
        await storage.updateIntegrationStatus(integrationId, "ERROR", new Date());
      } catch (updateError) {
        // Silent fail - integration status update
      }
    }
    
    // Try to parse error message from response
    let errorMessage = `ElevenLabs API error: ${response.status}`;
    try {
      const errorData = JSON.parse(responseText);
      if (errorData.detail?.message) {
        errorMessage = errorData.detail.message;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch (e) {
      // If response is not JSON, use the status text
      errorMessage = responseText || response.statusText;
    }
    
    // Add authentication-specific error messages
    if (response.status === 401) {
      errorMessage = "Authentication failed: Invalid API key. Please update your API key in Integrations.";
    } else if (response.status === 403) {
      errorMessage = "Access forbidden: Your API key may not have the required permissions.";
    }
    
    throw new Error(errorMessage);
  }

  // Return parsed JSON if response has content
  if (responseText) {
    try {
      return JSON.parse(responseText);
    } catch (e) {
      return {};
    }
  }
  return {};
}

// Helper function to manage ElevenLabs tools
async function manageElevenLabsTools(apiKey: string, tools: any[], integrationId?: string) {
  const toolIds: string[] = [];
  const builtInTools: any = {}; // Changed to object format for ElevenLabs API
  
  if (!tools || tools.length === 0) {
    return { toolIds, builtInTools };
  }
  
  for (const tool of tools) {
    // Handle system/built-in tools
    if (tool.type === 'system' || tool.name === 'end_call' || tool.name === 'language_detection' || 
        tool.name === 'skip_turn' || tool.name === 'transfer_to_agent' || tool.name === 'transfer_to_number' ||
        tool.name === 'play_dtmf' || tool.name === 'voicemail_detection') {
      // Map our system tool names to ElevenLabs built-in tool names
      let builtInToolName = tool.name;
      if (tool.name === 'play_dtmf') {
        builtInToolName = 'play_keypad_tone';
      }
      // Add tool to object format with proper configuration
      builtInTools[builtInToolName] = {
        enabled: true
      };
    }
    // Handle client and server tools (webhooks)
    else if (tool.type === 'webhook' || tool.type === 'client') {
      try {
        // First, try to get existing tools to check if this tool already exists
        const existingToolsResponse = await callElevenLabsAPI(apiKey, '/v1/convai/tools', 'GET', null, integrationId);
        const existingTools = existingToolsResponse?.tools || [];
        
        // Check if a tool with the same name already exists
        const existingTool = existingTools.find((t: any) => t.name === tool.name);
        
        let toolId;
        if (existingTool) {
          // Update existing tool
          console.log(`Updating existing tool: ${tool.name} (ID: ${existingTool.tool_id})`);
          const updatePayload = {
            type: tool.type === 'webhook' ? 'webhook' : 'client',
            name: tool.name,
            description: tool.description,
            ...(tool.type === 'webhook' ? {
              url: tool.url,
              method: tool.method,
              headers: tool.headers || {},
              query_parameters: tool.query_parameters || [],
              body_parameters: tool.body_parameters || [],
              path_parameters: tool.path_parameters || []
            } : {
              parameters: tool.parameters || {}
            })
          };
          
          await callElevenLabsAPI(
            apiKey, 
            `/v1/convai/tools/${existingTool.tool_id}`, 
            'PATCH', 
            updatePayload, 
            integrationId
          );
          toolId = existingTool.tool_id;
        } else {
          // Create new tool
          const createPayload = {
            type: tool.type === 'webhook' ? 'webhook' : 'client',
            name: tool.name,
            description: tool.description,
            ...(tool.type === 'webhook' ? {
              url: tool.url,
              method: tool.method,
              headers: tool.headers || {},
              query_parameters: tool.query_parameters || [],
              body_parameters: tool.body_parameters || [],
              path_parameters: tool.path_parameters || []
            } : {
              parameters: tool.parameters || {}
            })
          };
          
          const response = await callElevenLabsAPI(
            apiKey, 
            '/v1/convai/tools', 
            'POST', 
            createPayload, 
            integrationId
          );
          
          toolId = response?.tool_id;
        }
        
        if (toolId) {
          toolIds.push(toolId);
        }
      } catch (error) {
        console.error(`Error managing tool ${tool.name}:`, error);
        // Continue with other tools even if one fails
      }
    }
  }
  
  return { toolIds, builtInTools };
}

// Encryption helpers
// Generic encryption function for credentials
function encryptCredentials(data: any): string {
  const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
  const algorithm = "aes-256-cbc";
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || "default-key", "salt", 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(dataStr, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  return `${iv.toString("hex")}:${encrypted}`;
}

// Generic decryption function for credentials
function decryptCredentials(encryptedData: string): any {
  try {
    const algorithm = "aes-256-cbc";
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || "default-key", "salt", 32);
    
    // Handle both old and new encryption formats
    if (!encryptedData.includes(":")) {
      // Old format - try legacy decryption
      const decipher = crypto.createDecipher("aes-256-cbc", process.env.ENCRYPTION_KEY || "default-key");
      let decrypted = decipher.update(encryptedData, "hex", "utf8");
      decrypted += decipher.final("utf8");
      try {
        return JSON.parse(decrypted);
      } catch {
        return decrypted;
      }
    }
    
    // New format
    const [ivHex, encrypted] = encryptedData.split(":");
    const iv = Buffer.from(ivHex, "hex");
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Failed to decrypt credentials. Please re-enter your credentials.");
  }
}

function encryptApiKey(apiKey: string): string {
  const algorithm = "aes-256-cbc";
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || "default-key", "salt", 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(apiKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  return `${iv.toString("hex")}:${encrypted}`;
}

function decryptApiKey(encryptedApiKey: string): string {
  try {
    const algorithm = "aes-256-cbc";
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || "default-key", "salt", 32);
    
    // Handle both old and new encryption formats
    if (!encryptedApiKey.includes(":")) {
      // Old format - try legacy decryption
      const decipher = crypto.createDecipher("aes-256-cbc", process.env.ENCRYPTION_KEY || "default-key");
      let decrypted = decipher.update(encryptedApiKey, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    }
    
    // New format
    const [ivHex, encrypted] = encryptedApiKey.split(":");
    const iv = Buffer.from(ivHex, "hex");
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Failed to decrypt API key. Please re-enter your API key.");
  }
}

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
  // Seed admin user on startup
  seedAdminUser().catch(console.error);
  
  // Auth middleware
  setupAuth(app);

  // Auth routes already handled by setupAuth in auth.ts
  

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
        lastSync: null,
        status: 'idle',
        totalAgents: 0,
        totalConversations: 0,
        totalOrganizations: 0,
        recentActivity: [],
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
          .map(org => org.lastSync)
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
          const recentCallLogs = [];
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
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
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
        includeTranscripts: false,
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
      // TODO: Uncomment when database is updated
      // const task = await storage.updateAdminTask(req.params.taskId, updates);
      // res.json(task);
      res.json({ message: "Task updated successfully" }); // Temporary response
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
          message: 'This is a test webhook from VoiceAI Dashboard',
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
      
      // TODO: Send invitation email with the invitation code
      
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
        return res.status(400).json({ message: "Active ElevenLabs integration required" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      
      try {
        const agentData = await callElevenLabsAPI(apiKey, `/v1/convai/agents/${elevenLabsAgentId}`, "GET", undefined, integration.id);
        res.json({ 
          message: "Agent validated successfully", 
          agentData: {
            id: agentData.id,
            name: agentData.name,
            description: agentData.description,
          }
        });
      } catch (error: any) {
        console.error("Agent validation failed:", error?.message || error);
        res.status(400).json({ message: `Invalid agent ID or API error: ${error?.message || 'Unknown error'}` });
      }
    } catch (error) {
      console.error("Error validating agent:", error);
      res.status(500).json({ message: "Failed to validate agent" });
    }
  });

  // Generate AI-powered system prompt from description
  app.post("/api/agents/generate-prompt", isAuthenticated, checkPermission('manage_agents'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { description } = req.body;
      if (!description || description.trim().length < 10) {
        return res.status(400).json({ message: "Please provide a more detailed description (at least 10 characters)" });
      }

      // Check if OpenAI API key is available
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ message: "OpenAI API key not configured" });
      }

      // Generate system prompt using OpenAI
      const promptGenerationPrompt = `You are an expert AI prompt engineer. Generate a structured system prompt following the EXACT ElevenLabs format for: "${description}"

You MUST follow this EXACT format with markdown headers and structure:

# Personality
[Define agent identity, role, character traits. Use 2-4 sentences describing who the agent is, their background, and core personality traits]

# Environment  
[Describe where/how the agent operates. Mention communication medium, user context, and relevant situational factors. 2-3 sentences]

# Tone
[Specify conversational style. Include: natural speech patterns with brief affirmations like "Got it," "I see"; filler words like "actually," "essentially"; TTS optimization with strategic pauses (...); response length guidance; technical language adaptation. 4-6 sentences]

# Goal
[Define primary objectives and structured approach. Include numbered steps for handling interactions. Be specific about what success looks like. 3-5 sentences]

# Guardrails
[List boundaries and safety measures. Include: content limits, error handling, persona maintenance, professional standards. Use bullet points with - prefix]

# Tools
[List available capabilities. MUST include this exact text: "NEVER verbalize tool codes or function names to the user. NEVER say things like 'tool_code transfer_to_agent' or 'let me use the webhook tool'. When using tools, speak naturally without mentioning the technical process." Use bullet points with - prefix]

CRITICAL REQUIREMENTS:
1. Use EXACTLY these 6 section headers with # markdown formatting
2. Follow the structure shown above
3. Generate content that's specific to the agent description
4. Include the exact tool usage instruction shown above
5. Output ONLY the formatted prompt, no additional text

Example structure:
# Personality
You are [Name], a [role/identity with traits]. [Background/expertise]. [Key characteristics].

# Environment
[Context and medium]. [User situation]. [Available resources].

Generate the complete prompt now:`;

      console.log("Generating prompt for description:", description);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: promptGenerationPrompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("OpenAI API error:", errorData);
        return res.status(500).json({ message: "Failed to generate prompt" });
      }

      const data = await response.json();
      const generatedPrompt = data.choices[0]?.message?.content?.trim();

      if (!generatedPrompt) {
        return res.status(500).json({ message: "Failed to generate prompt" });
      }


      res.json({ 
        systemPrompt: generatedPrompt,
        description: description 
      });

    } catch (error) {
      console.error("Error generating prompt:", error);
      res.status(500).json({ message: "Failed to generate prompt" });
    }
  });

  // Create a new agent on ElevenLabs
  app.post("/api/agents/create", isAuthenticated, checkPermission('manage_agents'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || integration.status !== "ACTIVE") {
        return res.status(400).json({ message: "Active ElevenLabs integration required" });
      }

      const { name, firstMessage, systemPrompt, language, voiceId } = req.body;
      
      if (!name || !firstMessage || !systemPrompt) {
        return res.status(400).json({ message: "Name, first message, and system prompt are required" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      
      // Create agent on ElevenLabs with complete configuration override
      const agentPayload: any = {
        name,
        conversation_config: {
          agent: {
            prompt: {
              prompt: systemPrompt,
              first_message: firstMessage,
              language: language || "en"
            },
            first_message: firstMessage,
            language: language || "en",
            // Add default system tools - all enabled by default
            tools: [
              {
                type: 'system',
                name: 'end_call',
                description: 'Allows agent to end the call'
              },
              {
                type: 'system',
                name: 'language_detection',
                description: 'Automatically detect and switch languages',
                config: {
                  supported_languages: []
                }
              },
              {
                type: 'system',
                name: 'skip_turn',
                description: 'Skip agent turn when user needs a moment'
              },
              {
                type: 'system',
                name: 'transfer_to_agent',
                description: 'Transfer to another AI agent',
                config: {
                  target_agent_id: ""
                }
              },
              {
                type: 'system',
                name: 'transfer_to_number',
                description: 'Transfer to human operator',
                config: {
                  phone_numbers: []
                }
              },
              {
                type: 'system',
                name: 'play_dtmf',
                description: 'Play keypad touch tones'
              },
              {
                type: 'system',
                name: 'voicemail_detection',
                description: 'Detect voicemail systems',
                config: {
                  leave_message: false,
                  message_content: ""
                }
              }
            ]
          },
          tts: {
            voice_id: voiceId || "21m00Tcm4TlvDq8ikWAM", // Default to Rachel voice if not specified
            agent_output_audio_format: "pcm_16000",
            optimize_streaming_latency: 3,
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0,
            use_speaker_boost: true
          },
          turn: {
            mode: "turn",
            threshold: 0.5
          },
          asr: {
            quality: "high",
            provider: "elevenlabs"
          }
        },
        platform_settings: {
          auth: {
            mode: "open" // Allow all calls without authentication
          },
          conversation_initiation_client_data_webhook: {
            enabled: false,
            url: ""
          },
          post_call_webhook: {
            enabled: false,
            url: ""
          }
        },
        client_config_override: {
          agent: {
            language: {},
            prompt: {
              prompt: {},
              first_message: {}
            },
            first_message: {},
            tools: {}
          },
          tts: {
            voice_id: {},
            stability: {},
            similarity_boost: {},
            style: {},
            use_speaker_boost: {},
            optimize_streaming_latency: {},
            agent_output_audio_format: {}
          },
          conversation: {
            text_only: {}
          },
          turn: {
            mode: {},
            threshold: {}
          },
          asr: {
            quality: {},
            provider: {}
          },
          llm: {
            model: {},
            temperature: {},
            max_tokens: {}
          },
          platform_settings: {
            conversation_initiation_client_data_webhook: {},
            post_call_webhook: {}
          }
        }
      };

      
      const elevenLabsResponse = await callElevenLabsAPI(
        apiKey,
        "/v1/convai/agents/create",
        "POST",
        agentPayload,
        integration.id
      );


      // Save agent to our database with default tools configuration
      const agentData = insertAgentSchema.parse({
        organizationId: user.organizationId,
        elevenLabsAgentId: elevenLabsResponse.agent_id,
        name: name,
        description: `Created via VoiceAI Dashboard`,
        firstMessage: firstMessage,
        systemPrompt: systemPrompt,
        language: language || "en",
        voiceId: voiceId,
        isActive: true,
        // Save default tools configuration
        tools: {
          webhooks: [],
          integrations: [],
          customTools: [],
          toolIds: []
        }
      });

      const newAgent = await storage.createAgent(agentData);
      
      // Update integration status to active
      await storage.updateIntegrationStatus(integration.id, "ACTIVE", new Date());

      res.json({
        ...newAgent,
        message: "Agent created successfully"
      });
    } catch (error) {
      console.error("Error creating agent:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to create agent" 
      });
    }
  });

  app.post("/api/agents", isAuthenticated, checkPermission('manage_agents'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const agentData = insertAgentSchema.parse({
        ...req.body,
        organizationId: user.organizationId,
      });

      // Check if agent already exists
      const existingAgent = await storage.getAgentByElevenLabsId(
        agentData.elevenLabsAgentId,
        user.organizationId
      );
      if (existingAgent) {
        return res.status(400).json({ message: "Agent already registered" });
      }

      // Get integration to sync with ElevenLabs
      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (integration && integration.apiKey && agentData.elevenLabsAgentId) {
        const decryptedKey = decryptApiKey(integration.apiKey);
        
        try {
          // Fetch agent details from ElevenLabs to sync initial settings
          const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentData.elevenLabsAgentId}`, {
            headers: {
              "xi-api-key": decryptedKey,
              "Content-Type": "application/json",
            },
          });
          
          if (response.ok) {
            const elevenLabsAgent = await response.json();
            
            // Extract settings from ElevenLabs agent
            const conversationConfig = elevenLabsAgent.conversation_config || {};
            const agentConfig = conversationConfig.agent || {};
            const ttsConfig = conversationConfig.tts || {};
            const llmConfig = conversationConfig.llm || {};
            
            // Update agent data with ElevenLabs settings
            agentData.firstMessage = agentConfig.first_message || agentData.firstMessage;
            agentData.systemPrompt = agentConfig.prompt || agentData.systemPrompt;
            agentData.language = agentConfig.language || agentData.language || 'en';
            agentData.voiceId = ttsConfig.voice_id || agentData.voiceId;
            
            if (ttsConfig.stability !== undefined || ttsConfig.similarity_boost !== undefined) {
              agentData.voiceSettings = {
                stability: ttsConfig.stability || 0.5,
                similarityBoost: ttsConfig.similarity_boost || 0.75,
                style: ttsConfig.style || 0,
                useSpeakerBoost: ttsConfig.use_speaker_boost ?? true,
              };
            }
            
            if (llmConfig.model || llmConfig.temperature !== undefined || llmConfig.max_tokens !== undefined) {
              agentData.llmSettings = {
                model: llmConfig.model || 'gpt-4',
                temperature: llmConfig.temperature || 0.7,
                maxTokens: llmConfig.max_tokens || 150,
              };
            }
            
            
            // Set up default tools configuration
            agentData.tools = {
              webhooks: [],
              integrations: [],
              customTools: [
                // Add any existing tool IDs from ElevenLabs
                ...(agentConfig.tool_ids ? agentConfig.tool_ids.map((id: string) => ({
                  id,
                  name: id,
                  type: 'integration',
                  enabled: true
                })) : [])
              ],
              toolIds: []
            };
            
            if (agentConfig.dynamic_variables) {
              agentData.dynamicVariables = agentConfig.dynamic_variables;
            }
          }
        } catch (elevenLabsError) {
          console.error("Error fetching agent from ElevenLabs:", elevenLabsError);
          // Continue with agent creation even if sync fails
        }
      }

      const agent = await storage.createAgent(agentData);
      res.json(agent);
    } catch (error) {
      console.error("Error creating agent:", error);
      res.status(500).json({ message: "Failed to create agent" });
    }
  });

  app.get("/api/agents", isAuthenticated, cacheMiddleware.agents, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }


          // Get agents filtered by user permissions using the new access control
      const userAgents = await storage.getAgentsForUser(userId, user.organizationId);
      
      // Only sync with ElevenLabs if user has access to agents AND is an admin
      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (integration && integration.apiKey && userAgents.length > 0 && user.isAdmin) {
        const decryptedKey = decryptApiKey(integration.apiKey);
        
        try {
          // Fetch all agents from ElevenLabs using centralized sync service
          const syncAgentsResult = await SyncService.syncAgents(user.organizationId);
          const elevenLabsAgents = [] as any[]; // no direct list from service; keep existing flow below as display only
          
          // Get local agents
          const localAgents = await storage.getAgents(user.organizationId);
          const localAgentsByElevenLabsId = new Map(
            localAgents.map(a => [a.elevenLabsAgentId, a])
          );
          
          // Sync agents from ElevenLabs (admin only)
          const syncedAgents = [];
          
          for (const elevenLabsAgent of elevenLabsAgents) {
            const agentId = elevenLabsAgent.agent_id || elevenLabsAgent.id;
            const existingAgent = localAgentsByElevenLabsId.get(agentId);
            
            // Parse agent configuration from ElevenLabs
            const conversationConfig = elevenLabsAgent.conversation_config || {};
            const agentConfig = conversationConfig.agent || {};
            const promptConfig = agentConfig.prompt || {};
            const ttsConfig = conversationConfig.tts || {};
            const llmConfig = conversationConfig.llm || {};
            
            // Initialize tools configuration
            const tools: any = {
              webhooks: [],
              integrations: [],
              customTools: [],
              toolIds: []
            };
            
            if (agentConfig.tools && Array.isArray(agentConfig.tools)) {
              for (const tool of agentConfig.tools) {
                if (tool.type === 'system') {
                  // Skip system tools - not syncing with ElevenLabs anymore
                  continue;
                } else if (tool.type === 'custom') {
                  tools.customTools.push({
                    id: tool.tool_id,
                    name: tool.name,
                    type: 'custom',
                    enabled: true,
                    description: tool.description
                  });
                  tools.toolIds.push(tool.tool_id);
                }
              }
            }
            
            const agentData = {
              organizationId: user.organizationId,
              elevenLabsAgentId: agentId,
              name: elevenLabsAgent.name || "Unnamed Agent",
              description: elevenLabsAgent.description || "Synced from ElevenLabs",
              firstMessage: promptConfig.first_message || agentConfig.first_message || "Hello! How can I help you today?",
              systemPrompt: promptConfig.prompt || "You are a helpful AI assistant",
              language: promptConfig.language || agentConfig.language || "en",
              voiceId: ttsConfig.voice_id || "21m00Tcm4TlvDq8ikWAM",
              voiceSettings: {
                stability: ttsConfig.stability ?? 0.5,
                similarityBoost: ttsConfig.similarity_boost ?? 0.75,
                style: ttsConfig.style ?? 0,
                useSpeakerBoost: ttsConfig.use_speaker_boost ?? true
              },
              llmSettings: llmConfig.model ? {
                model: llmConfig.model,
                temperature: llmConfig.temperature ?? 0.7,
                maxTokens: llmConfig.max_tokens ?? 150
              } : undefined,
              tools: tools,
              dynamicVariables: agentConfig.dynamic_variables || {},
              isActive: true,
              lastSynced: new Date()
            };
            
            if (existingAgent) {
              // Don't overwrite existing agent data - keep local data as source of truth
              // Just add the existing agent to the synced list without updating
              syncedAgents.push(existingAgent);
            } else if (user.isAdmin) {
              // Only admins can create new agents from ElevenLabs sync
              const created = await storage.createAgent(agentData);
              syncedAgents.push(created);
            }
          }
          
          // Remove agents that no longer exist in ElevenLabs
          const elevenLabsAgentIds = new Set(elevenLabsAgents.map((a: any) => a.agent_id || a.id));
          for (const localAgent of localAgents) {
            if (localAgent.elevenLabsAgentId && !elevenLabsAgentIds.has(localAgent.elevenLabsAgentId)) {
              // Agent exists locally but not in ElevenLabs, mark as inactive or delete
              await storage.updateAgent(localAgent.id, user.organizationId, { isActive: false });
            }
          }
          
          // Return only agents the user has access to
          const allAgents = await storage.getAgentsForUser(userId, user.organizationId);
          res.json(allAgents);
          
        } catch (syncError) {
          console.error("Error syncing with ElevenLabs:", syncError);
          // Fall back to local data if sync fails
          const agents = await storage.getAgentsForUser(userId, user.organizationId);
          res.json(agents);
        }
      } else {
        // No integration, just return local agents
        const agents = await storage.getAgentsForUser(userId, user.organizationId);
        res.json(agents);
      }
    } catch (error) {
      console.error("Error fetching agents:", error);
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });

  // Get a single agent with ElevenLabs sync
  app.get("/api/agents/:id", isAuthenticated, cacheMiddleware.standard, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const agentId = req.params.id;
      
      // Check if user has access to this agent
      const userAgents = await storage.getAgentsForUser(userId, user.organizationId);
      const agent = userAgents.find(a => a.id === agentId);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found or access denied" });
      }

      // Don't sync from ElevenLabs - keep local data as source of truth
      // Just return the local agent data
      res.json(agent);
    } catch (error) {
      console.error("Error fetching agent:", error);
      res.status(500).json({ message: "Failed to fetch agent" });
    }
  });

  // Update agent and sync with ElevenLabs
  app.patch("/api/agents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const agentId = req.params.id;
      
      // Check if user has access to this agent
      const userAgents = await storage.getAgentsForUser(userId, user.organizationId);
      const hasAccess = userAgents.some(a => a.id === agentId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this agent" });
      }
      const updates = req.body;
      
      // Check if agent exists
      const agent = await storage.getAgent(agentId, user.organizationId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      // If agent has ElevenLabs ID and we're updating more than just isActive, sync with ElevenLabs
      if (agent.elevenLabsAgentId && Object.keys(updates).some(key => key !== 'isActive')) {
        const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
        if (integration && integration.apiKey) {
          try {
            const decryptedKey = decryptApiKey(integration.apiKey);
            
            // Convert updates to ElevenLabs format
            const elevenLabsPayload: any = {};
            
            if (updates.name !== undefined) {
              elevenLabsPayload.name = updates.name;
            }
            
            if (updates.firstMessage || updates.systemPrompt || updates.language || updates.voiceId || updates.voiceSettings || updates.llmSettings || updates.tools) {
              elevenLabsPayload.conversation_config = {};
              
              // Agent configuration
              if (updates.firstMessage || updates.systemPrompt || updates.language || updates.tools) {
                elevenLabsPayload.conversation_config.agent = {};
                
                // First message goes directly in agent, not in prompt
                if (updates.firstMessage) {
                  elevenLabsPayload.conversation_config.agent.first_message = updates.firstMessage;
                }
                
                // Check if RAG tool is enabled and enhance system prompt
                let enhancedSystemPrompt = updates.systemPrompt || agent.systemPrompt;
                
                // Add general tool usage instructions to prevent verbalizing tool codes
                const toolInstructions = '\n\n**CRITICAL TOOL USAGE INSTRUCTIONS:**\n' +
                  '- NEVER verbalize tool codes or function names to the user\n' +
                  '- NEVER say things like "tool_code transfer_to_agent" or "let me use the webhook tool"\n' +
                  '- When using tools, speak naturally without mentioning the technical process\n' +
                  '- For transfers: Simply say "I\'ll transfer you now" or "Let me connect you with..."\n' +
                  '- For searches: Say "Let me find that information for you" instead of mentioning tools\n' +
                  '- Tools are invoked automatically based on context - just speak naturally\n';
                
                if (enhancedSystemPrompt && !enhancedSystemPrompt.includes('CRITICAL TOOL USAGE INSTRUCTIONS')) {
                  enhancedSystemPrompt = enhancedSystemPrompt + toolInstructions;
                }
                
                
                // System prompt and language go in the prompt object
                if (enhancedSystemPrompt || updates.language) {
                  elevenLabsPayload.conversation_config.agent.prompt = {
                    prompt: enhancedSystemPrompt,
                    language: updates.language || agent.language
                  };
                }
                
                // Convert tools to ElevenLabs format
                if (updates.tools) {
                  const elevenLabsTools: any[] = [];
                  const systemTools = updates.tools.systemTools || {};
                  
                  // IMPORTANT: Only add tools that are explicitly enabled
                  // ElevenLabs interprets the presence of a tool in the array as enabling it
                  
                  if (systemTools.endCall?.enabled === true) {
                    const tool: any = {
                      type: "system",
                      name: "end_call",
                      description: systemTools.endCall.description || "Allows agent to end the call",
                      pre_tool_speech: systemTools.endCall.preToolSpeech || "Thank you for calling. Goodbye!"
                    };
                    if (systemTools.endCall.disableInterruptions) {
                      tool.disable_interruptions = true;
                    }
                    elevenLabsTools.push(tool);
                  }
                  
                  if (systemTools.detectLanguage?.enabled === true) {
                    const tool: any = {
                      type: "system",
                      name: "language_detection",
                      description: systemTools.detectLanguage.description || "Automatically detect and switch languages",
                      pre_tool_speech: systemTools.detectLanguage.preToolSpeech || "I'll continue in your preferred language.",
                      config: {
                        supported_languages: systemTools.detectLanguage.supportedLanguages || []
                      }
                    };
                    if (systemTools.detectLanguage.disableInterruptions) {
                      tool.disable_interruptions = true;
                    }
                    elevenLabsTools.push(tool);
                  }
                  
                  if (systemTools.skipTurn?.enabled === true) {
                    const tool: any = {
                      type: "system",
                      name: "skip_turn",
                      description: systemTools.skipTurn.description || "Skip agent turn when user needs a moment",
                      pre_tool_speech: systemTools.skipTurn.preToolSpeech || ""
                    };
                    if (systemTools.skipTurn.disableInterruptions) {
                      tool.disable_interruptions = true;
                    }
                    elevenLabsTools.push(tool);
                  }
                  
                  if (systemTools.transferToAgent?.enabled === true) {
                    const tool: any = {
                      type: "system",
                      name: "transfer_to_agent",
                      description: systemTools.transferToAgent.description || "Transfer to another AI agent",
                      pre_tool_speech: systemTools.transferToAgent.preToolSpeech || "I'll transfer you to the right agent now."
                    };
                    
                    // Handle transfer rules for transfer_to_agent
                    if (systemTools.transferToAgent.transferRules && systemTools.transferToAgent.transferRules.length > 0) {
                      tool.transfer_rules = systemTools.transferToAgent.transferRules.map((rule: any) => ({
                        agent_id: rule.agentId,
                        condition: rule.condition,
                        delay_ms: rule.delayMs || 0,
                        transfer_message: rule.transferMessage || "",
                        enable_first_message: rule.enableFirstMessage !== false
                      }));
                    }
                    
                    if (systemTools.transferToAgent.disableInterruptions) {
                      tool.disable_interruptions = true;
                    }
                    elevenLabsTools.push(tool);
                  }
                  
                  if (systemTools.transferToNumber?.enabled === true) {
                    const tool: any = {
                      type: "system",
                      name: "transfer_to_number",
                      description: systemTools.transferToNumber.description || "Transfer to human operator",
                      pre_tool_speech: systemTools.transferToNumber.preToolSpeech || "I'll connect you with a human agent right away.",
                      config: {
                        phone_numbers: (systemTools.transferToNumber.phoneNumbers || []).map((phone: any) => ({
                          number: phone.number,
                          label: phone.label,
                          condition: phone.condition || ""
                        }))
                      }
                    };
                    if (systemTools.transferToNumber.disableInterruptions) {
                      tool.disable_interruptions = true;
                    }
                    elevenLabsTools.push(tool);
                  }
                  
                  if (systemTools.playKeypadTone?.enabled === true) {
                    const tool: any = {
                      type: "system",
                      name: "play_dtmf",
                      description: systemTools.playKeypadTone.description || "Play keypad touch tones",
                      pre_tool_speech: systemTools.playKeypadTone.preToolSpeech || ""
                    };
                    if (systemTools.playKeypadTone.disableInterruptions) {
                      tool.disable_interruptions = true;
                    }
                    elevenLabsTools.push(tool);
                  }
                  
                  if (systemTools.voicemailDetection?.enabled === true) {
                    const tool: any = {
                      type: "system",
                      name: "voicemail_detection",
                      description: systemTools.voicemailDetection.description || "Detect voicemail systems",
                      pre_tool_speech: systemTools.voicemailDetection.preToolSpeech || "",
                      config: {
                        leave_message: systemTools.voicemailDetection.leaveMessage || false,
                        message_content: systemTools.voicemailDetection.messageContent || ""
                      }
                    };
                    if (systemTools.voicemailDetection.disableInterruptions) {
                      tool.disable_interruptions = true;
                    }
                    elevenLabsTools.push(tool);
                  }
                  
                  // Add MCP servers as webhooks
                  if (updates.tools.mcpServers && Array.isArray(updates.tools.mcpServers)) {
                    for (const mcpServer of updates.tools.mcpServers) {
                      if (mcpServer.enabled && mcpServer.url) {
                        const mcpTool: any = {
                          type: "webhook",
                          name: mcpServer.name || "mcp_server",
                          description: mcpServer.description || "MCP Server integration",
                          url: mcpServer.url,
                          method: "POST",
                          headers: mcpServer.headers || {},
                          query_parameters: [],
                          body_parameters: mcpServer.capabilities?.map((cap: any) => ({
                            identifier: cap.name,
                            data_type: "String",
                            required: cap.required || false,
                            value_type: "LLM Prompt",
                            description: cap.description || ""
                          })) || []
                        };
                        
                        // Add pre-tool speech if configured
                        if (mcpServer.preToolSpeech) {
                          mcpTool.pre_tool_speech = mcpServer.preToolSpeech;
                        }
                        
                        console.log('Adding MCP server as webhook:', mcpServer.name);
                        elevenLabsTools.push(mcpTool);
                      }
                    }
                  }
                  
                  // Add custom tools (webhooks, RAG, etc.)
                  if (updates.tools.customTools && Array.isArray(updates.tools.customTools)) {
                    console.log('Processing custom tools:', updates.tools.customTools.map((t: any) => ({
                      name: t.name,
                      type: t.type,
                      enabled: t.enabled
                    })));
                    for (const customTool of updates.tools.customTools) {
                      if (customTool.enabled) {
                        if (customTool.type === 'webhook' && customTool.url) {
                          // Add regular webhooks with proper ElevenLabs format
                          const webhookTool: any = {
                            type: "webhook",
                            name: customTool.name,
                            description: customTool.description || "",
                            url: customTool.url,
                            method: customTool.method || "POST",
                            headers: customTool.headers || {},
                            query_parameters: customTool.queryParameters?.map((param: any) => ({
                              identifier: param.name,
                              data_type: param.type || "String",
                              required: param.required || false,
                              value_type: param.valueType || "LLM Prompt",
                              description: param.description || ""
                            })) || [],
                            body_parameters: customTool.bodyParameters?.map((param: any) => ({
                              identifier: param.name,
                              data_type: param.type || "String",
                              required: param.required || false,
                              value_type: param.valueType || "LLM Prompt",
                              description: param.description || ""
                            })) || [],
                            path_parameters: customTool.pathParameters?.map((param: any) => ({
                              identifier: param.name,
                              data_type: param.type || "String",
                              required: param.required || false,
                              value_type: param.valueType || "LLM Prompt",
                              description: param.description || ""
                            })) || []
                          };
                          elevenLabsTools.push(webhookTool);
                        }
                      }
                    }
                  }
                  
                  // Add configured webhooks with proper ElevenLabs format
                  if (updates.tools.webhooks && Array.isArray(updates.tools.webhooks)) {
                    console.log('Processing webhooks from tools.webhooks:', updates.tools.webhooks.map((w: any) => ({
                      name: w.name,
                      url: w.url,
                      method: w.method,
                      enabled: w.enabled,
                      hasConfig: !!w.webhookConfig
                    })));
                    
                    for (const webhook of updates.tools.webhooks) {
                      // Check if webhook is enabled (default to true if not specified)
                      if (webhook.enabled !== false && webhook.url) {
                        // Ensure webhook has a valid name (required by ElevenLabs)
                        const webhookName = webhook.name && webhook.name.trim() 
                          ? webhook.name.replace(/\s+/g, '_').toLowerCase()
                          : `webhook_${Date.now()}`;
                        
                        const webhookTool: any = {
                          type: "webhook",
                          name: webhookName,
                          description: webhook.description || `Webhook tool ${webhookName}`,
                          url: webhook.url,
                          method: webhook.method || "POST",
                          headers: webhook.webhookConfig?.headers?.reduce((acc: any, header: any) => {
                            if (header.enabled && header.key) {
                              acc[header.key] = header.value || "";
                            }
                            return acc;
                          }, {}) || {},
                          // Query parameters that will be appended to URL
                          query_parameters: webhook.webhookConfig?.queryParameters?.filter((param: any) => param.key || param.identifier).map((param: any) => ({
                            identifier: param.key || param.identifier,
                            data_type: param.dataType || "String",
                            required: param.required || false,
                            value_type: param.valueType || "LLM Prompt",
                            description: param.description || ""
                          })) || [],
                          // Body parameters for POST/PUT/PATCH requests
                          body_parameters: webhook.webhookConfig?.bodyParameters?.filter((param: any) => param.identifier).map((param: any) => ({
                            identifier: param.identifier,
                            data_type: param.dataType || "String",
                            required: param.required || false,
                            value_type: param.valueType || "LLM Prompt",
                            description: param.description || ""
                          })) || [],
                          // Path parameters for URL variables like /api/users/{id}
                          path_parameters: webhook.webhookConfig?.pathParameters?.filter((param: any) => param.key || param.identifier).map((param: any) => ({
                            identifier: param.key || param.identifier,
                            data_type: param.dataType || "String",
                            required: param.required || false,
                            value_type: param.valueType || "LLM Prompt",
                            description: param.description || ""
                          })) || []
                        };
                        elevenLabsTools.push(webhookTool);
                      }
                    }
                  }
                  
                  
                  // Use the new tools API format
                  // First, manage tools via the dedicated tools endpoint
                  const { toolIds, builtInTools } = await manageElevenLabsTools(
                    decryptedKey,
                    elevenLabsTools,
                    integration.id
                  );
                  
                  console.log('Tool IDs created/updated:', toolIds);
                  console.log('Built-in tools to enable:', builtInTools);
                  
                  // Update the agent's prompt with the new format
                  if (!elevenLabsPayload.conversation_config.agent.prompt) {
                    elevenLabsPayload.conversation_config.agent.prompt = {};
                  }
                  
                  // Set tool_ids for client/server tools
                  if (toolIds.length > 0) {
                    elevenLabsPayload.conversation_config.agent.prompt.tool_ids = toolIds;
                  } else {
                    // Clear tool_ids if no tools
                    elevenLabsPayload.conversation_config.agent.prompt.tool_ids = [];
                  }
                  
                  // Set built_in_tools for system tools
                  if (Object.keys(builtInTools).length > 0) {
                    elevenLabsPayload.conversation_config.agent.prompt.built_in_tools = builtInTools;
                  } else {
                    // Clear built_in_tools if no system tools
                    elevenLabsPayload.conversation_config.agent.prompt.built_in_tools = {};
                  }
                }
              }
              
              // TTS configuration
              if (updates.voiceId || updates.voiceSettings) {
                elevenLabsPayload.conversation_config.tts = {
                  voice_id: updates.voiceId || agent.voiceId,
                  ...(updates.voiceSettings ? {
                    stability: updates.voiceSettings.stability,
                    similarity_boost: updates.voiceSettings.similarityBoost,
                    style: updates.voiceSettings.style,
                    use_speaker_boost: updates.voiceSettings.useSpeakerBoost
                  } : {})
                };
              }
              
              // LLM configuration
              if (updates.llmSettings) {
                elevenLabsPayload.conversation_config.llm = {
                  model: updates.llmSettings.model,
                  temperature: updates.llmSettings.temperature,
                  max_tokens: updates.llmSettings.maxTokens
                };
              }
            }
            
            // Always add client_config_override to enable ALL overrides by default
            elevenLabsPayload.client_config_override = {
              agent: {
                language: {},
                prompt: {
                  prompt: {},
                  first_message: {}
                },
                first_message: {},
                tools: {}
              },
              tts: {
                voice_id: {},
                stability: {},
                similarity_boost: {},
                style: {},
                use_speaker_boost: {},
                optimize_streaming_latency: {},
                agent_output_audio_format: {}
              },
              conversation: {
                text_only: {}
              },
              turn: {
                mode: {},
                threshold: {}
              },
              asr: {
                quality: {},
                provider: {}
              },
              llm: {
                model: {},
                temperature: {},
                max_tokens: {}
              },
              platform_settings: {
                conversation_initiation_client_data_webhook: {},
                post_call_webhook: {}
              }
            };
            
            // Update in ElevenLabs if we have any changes
            if (Object.keys(elevenLabsPayload).length > 0) {
              const response = await callElevenLabsAPI(
                decryptedKey,
                `/v1/convai/agents/${agent.elevenLabsAgentId}`,
                "PATCH",
                elevenLabsPayload,
                integration.id
              );
            }
          } catch (elevenLabsError) {
            console.error("Error updating agent in ElevenLabs:", elevenLabsError);
            // Continue with local update even if ElevenLabs sync fails
          }
        }
      }

      // Update local agent
      const updatedAgent = await storage.updateAgent(agentId, user.organizationId, {
        ...updates,
        lastSynced: new Date()
      });
      
      res.json(updatedAgent);
    } catch (error) {
      console.error("Error updating agent:", error);
      res.status(500).json({ message: "Failed to update agent" });
    }
  });

  app.delete("/api/agents/:id", isAuthenticated, checkPermission('manage_agents'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const agentId = req.params.id;
      
      // Check if agent exists and belongs to the organization
      const agent = await storage.getAgent(agentId, user.organizationId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      // Delete from ElevenLabs first if the agent is synced
      if (agent.elevenLabsAgentId) {
        const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
        if (integration && integration.apiKey) {
          try {
            const decryptedKey = decryptApiKey(integration.apiKey);
            
            
            // Call ElevenLabs API to delete the agent
            const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agent.elevenLabsAgentId}`, {
              method: "DELETE",
              headers: {
                "xi-api-key": decryptedKey,
              }
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`Failed to delete agent from ElevenLabs: ${response.status} - ${errorText}`);
              // Don't fail the entire operation if ElevenLabs deletion fails
              // The user may want to remove it from their dashboard anyway
            } else {
            }
          } catch (elevenLabsError) {
            console.error("Error deleting agent from ElevenLabs:", elevenLabsError);
            // Continue with local deletion even if ElevenLabs deletion fails
          }
        }
      }

      // Delete the agent from local database
      await storage.deleteAgent(user.organizationId, agentId);
      
      res.json({ message: "Agent deleted successfully" });
    } catch (error) {
      console.error("Error deleting agent:", error);
      res.status(500).json({ message: "Failed to delete agent" });
    }
  });

  // Sync call logs from ElevenLabs using centralized sync service
  app.post("/api/sync-calls", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ 
          success: false,
          message: "User not found" 
        });
      }

      console.log(`[SYNC] User ${user.email} initiated call log sync`);

      // Use centralized sync service
      const result = await SyncService.syncCallLogs({
        organizationId: user.organizationId,
        agentId: req.body.agentId, // Optional agent filter
        limit: 100,
        includeTranscripts: true
      });

      if (result.success) {
        console.log(`[SYNC] Sync completed: ${result.syncedCount} new, ${result.updatedCount} updated`);
      } else {
        console.error(`[SYNC] Sync failed with ${result.errorCount} errors`);
      }

      res.json(result);
    } catch (error: any) {
      console.error("[SYNC] Sync call logs error:", error);
      res.status(500).json({ 
        success: false,
        message: error.message || "Failed to sync call logs",
        syncedCount: 0,
        updatedCount: 0,
        errorCount: 1,
        errors: [error.message],
        duration: 0
      });
    }
  });

  // Comprehensive dashboard sync using centralized sync service
  app.post("/api/dashboard/sync", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ 
          success: false,
          message: "User not found" 
        });
      }

      console.log(`[SYNC] User ${user.email} initiated dashboard sync`);

      // Use centralized sync service for dashboard
      const result = await SyncService.syncDashboard(
        user.organizationId,
        req.body.agentId // Optional agent filter
      );

      if (result.success) {
        console.log(`[SYNC] Dashboard sync completed in ${result.totalDuration}ms`);
        console.log(`[SYNC] Agents: ${result.agents.syncedCount} new, ${result.agents.updatedCount} updated`);
        console.log(`[SYNC] Calls: ${result.callLogs.syncedCount} new, ${result.callLogs.updatedCount} updated`);
      }

      res.json(result);
    } catch (error: any) {
      console.error("[SYNC] Dashboard sync error:", error);
      res.status(500).json({ 
        success: false,
        message: error.message || "Failed to sync dashboard",
        agents: {
          success: false,
          syncedCount: 0,
          updatedCount: 0,
          errorCount: 1,
          errors: [error.message],
          duration: 0
        },
        callLogs: {
          success: false,
          syncedCount: 0,
          updatedCount: 0,
          errorCount: 1,
          errors: [error.message],
          duration: 0
        },
        totalDuration: 0
      });
    }
  });

  // Test endpoint for debugging sync issues (no auth required)
  app.post("/api/dashboard/sync-test", async (req: any, res) => {
    try {
      console.log("[SYNC-TEST] Dashboard sync test endpoint called");
      
      // Get a test organization ID from the request or use default
      const testOrgId = req.body.organizationId || "test-org";
      
      console.log(`[SYNC-TEST] Testing sync for organization: ${testOrgId}`);
      
      // Test the sync service directly
      const result = await SyncService.syncDashboard(testOrgId);
      
      console.log("[SYNC-TEST] Test completed:", result);
      
      res.json({
        success: true,
        message: "Sync test completed",
        result,
        timestamp: new Date().toISOString(),
        auth: !!req.user,
        userId: req.user?.id || null
      });
    } catch (error) {
      console.error("[SYNC-TEST] Error in test endpoint:", error);
      res.status(500).json({ 
        success: false,
        message: "Sync test failed",
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Health check endpoint for sync service
  app.get("/api/sync/health", async (req: any, res) => {
    try {
      const health = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        services: {
          syncService: "available",
          elevenLabsClient: "available"
        }
      };
      
      res.json(health);
    } catch (error: any) {
      res.status(500).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });

  // Knowledge Base API endpoints

  // Search knowledge base
  app.post("/api/knowledge-base/search", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { query, category, tags, maxResults } = req.body;

      if (!query) {
        return res.status(400).json({ message: "Query is required" });
      }

      const result = await KnowledgeBaseService.searchKnowledgeBase(user.organizationId, {
        query,
        category,
        tags,
        maxResults
      });

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error("[KNOWLEDGE-BASE] Search error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Add knowledge base entry
  app.post("/api/knowledge-base/entries", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { title, content, category, tags } = req.body;

      if (!title || !content) {
        return res.status(400).json({ message: "Title and content are required" });
      }

      const entry = await KnowledgeBaseService.addKnowledgeEntry(user.organizationId, {
        title,
        content,
        category: category || "General",
        tags: tags || []
      });

      res.json({
        success: true,
        data: entry,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error("[KNOWLEDGE-BASE] Add entry error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Enhance agent with knowledge base
  app.post("/api/agents/:id/enhance-knowledge", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const agentId = req.params.id;
      const { knowledgeBaseId } = req.body;

      // Check if user has access to this agent
      const userAgents = await storage.getAgentsForUser(user.id, user.organizationId);
      const hasAccess = userAgents.some(a => a.id === agentId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this agent" });
      }

      await KnowledgeBaseService.enhanceAgentWithKnowledgeBase(
        user.organizationId,
        agentId,
        knowledgeBaseId
      );

      res.json({
        success: true,
        message: "Agent enhanced with knowledge base capabilities",
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error("[KNOWLEDGE-BASE] Enhance agent error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Document upload endpoints
  app.post("/api/documents/upload", isAuthenticated, DocumentProcessingService.getUploadMiddleware().single('document'), async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      console.log(`[DOCUMENT-UPLOAD] Processing file: ${req.file.originalname}`);

      // Process the uploaded document
      const document = await DocumentProcessingService.processDocument(
        user.organizationId,
        user.id,
        req.file.path,
        req.file.originalname
      );

      // Attempt to integrate with ElevenLabs (if supported)
      const elevenLabsUploaded = await DocumentProcessingService.uploadToElevenLabs(
        user.organizationId,
        document
      );

      res.json({
        success: true,
        message: "Document processed and added to knowledge base",
        data: {
          documentId: document.id,
          filename: document.originalName,
          status: document.status,
          knowledgeEntries: document.knowledgeEntries?.length || 0,
          elevenLabsIntegrated: elevenLabsUploaded
        },
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error("[DOCUMENT-UPLOAD] Upload error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Get document processing status
  app.get("/api/documents/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const documentId = req.params.id;

      const status = await DocumentProcessingService.getProcessingStatus(documentId);

      if (!status) {
        return res.status(404).json({ message: "Document not found" });
      }

      res.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error("[DOCUMENT-STATUS] Status check error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Multilingual API endpoints
  app.get("/api/multilingual/languages", isAuthenticated, async (req: any, res) => {
    try {
      const languages = MultilingualService.getSupportedLanguages();
      res.json({
        success: true,
        data: languages,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("[MULTILINGUAL] Get languages error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get("/api/agents/:id/multilingual", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const agentId = req.params.id;

      // Check if user has access to this agent
      const userAgents = await storage.getAgentsForUser(user.id, user.organizationId);
      const hasAccess = userAgents.some(a => a.id === agentId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this agent" });
      }

      const config = await MultilingualService.getAgentMultilingualConfig(user.organizationId, agentId);
      
      res.json({
        success: true,
        data: config,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("[MULTILINGUAL] Get agent config error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/agents/:id/languages", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const agentId = req.params.id;
      const { languageCode, firstMessage, systemPrompt } = req.body;

      if (!languageCode) {
        return res.status(400).json({ message: "Language code is required" });
      }

      // Check if user has access to this agent
      const userAgents = await storage.getAgentsForUser(user.id, user.organizationId);
      const hasAccess = userAgents.some(a => a.id === agentId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this agent" });
      }

      await MultilingualService.addLanguageToAgent(user.organizationId, agentId, languageCode, {
        firstMessage,
        systemPrompt
      });

      res.json({
        success: true,
        message: "Language added to agent",
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("[MULTILINGUAL] Add language error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.delete("/api/agents/:id/languages/:languageCode", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const agentId = req.params.id;
      const languageCode = req.params.languageCode;

      // Check if user has access to this agent
      const userAgents = await storage.getAgentsForUser(user.id, user.organizationId);
      const hasAccess = userAgents.some(a => a.id === agentId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this agent" });
      }

      await MultilingualService.removeLanguageFromAgent(user.organizationId, agentId, languageCode);

      res.json({
        success: true,
        message: "Language removed from agent",
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("[MULTILINGUAL] Remove language error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.patch("/api/agents/:id/languages/:languageCode", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const agentId = req.params.id;
      const languageCode = req.params.languageCode;
      const { firstMessage, systemPrompt } = req.body;

      // Check if user has access to this agent
      const userAgents = await storage.getAgentsForUser(user.id, user.organizationId);
      const hasAccess = userAgents.some(a => a.id === agentId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this agent" });
      }

      await MultilingualService.updateLanguageConfig(user.organizationId, agentId, languageCode, {
        firstMessage,
        systemPrompt
      });

      res.json({
        success: true,
        message: "Language configuration updated",
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("[MULTILINGUAL] Update language config error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/multilingual/translate", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { text, targetLanguages } = req.body;

      if (!text || !targetLanguages || !Array.isArray(targetLanguages)) {
        return res.status(400).json({ message: "Text and target languages are required" });
      }

      const translations = await MultilingualService.translateToAllLanguages(
        user.organizationId,
        text,
        targetLanguages
      );

      res.json({
        success: true,
        data: translations,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("[MULTILINGUAL] Translation error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Manual sync agents with ElevenLabs using centralized sync service
  app.post("/api/agents/sync", isAuthenticated, checkPermission('manage_agents'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs integration not configured" });
      }

      const result = await SyncService.syncAgents(user.organizationId);
      return res.json(result);
    } catch (error: any) {
      console.error("Error syncing agents:", error);
      return res.status(500).json({ 
        success: false,
        message: error.message || "Failed to sync agents",
        syncedCount: 0,
        updatedCount: 0,
        errorCount: 1,
        errors: [error.message],
        duration: 0
      });
    }
  });

  // Update agent settings endpoint - syncs with ElevenLabs
  app.patch("/api/agents/:id/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const agentId = req.params.id;
      const updates = req.body;
      
      // Check if agent exists
      const agent = await storage.getAgent(agentId, user.organizationId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      // Must have ElevenLabs integration to update settings
      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs integration not configured" });
      }

      const decryptedKey = decryptApiKey(integration.apiKey);
      
      // Build ElevenLabs update payload
      const elevenLabsPayload: any = {
        conversation_config: {
          agent: {},
          tts: {},
          llm: {}
        }
      };
      
      // Update name if provided
      if (updates.name !== undefined) {
        elevenLabsPayload.name = updates.name;
      }
      
      // Update first message
      if (updates.firstMessage !== undefined) {
        elevenLabsPayload.conversation_config.agent.first_message = updates.firstMessage;
      }
      
      // Update system prompt and language
      if (updates.systemPrompt !== undefined || updates.language !== undefined) {
        elevenLabsPayload.conversation_config.agent.prompt = {
          prompt: updates.systemPrompt || agent.systemPrompt,
          language: updates.language || agent.language || "en"
        };
      }
      
      // Update voice settings
      if (updates.voiceId !== undefined || updates.voiceSettings) {
        elevenLabsPayload.conversation_config.tts = {
          voice_id: updates.voiceId || agent.voiceId,
          ...(updates.voiceSettings || {})
        };
      }
      
      // Update LLM settings
      if (updates.llmSettings) {
        elevenLabsPayload.conversation_config.llm = {
          model: updates.llmSettings.model || agent.llmSettings?.model || "gpt-4",
          temperature: updates.llmSettings.temperature || agent.llmSettings?.temperature || 0.7,
          max_tokens: updates.llmSettings.maxTokens || agent.llmSettings?.maxTokens || 150
        };
      }
      
      // Update in ElevenLabs
      try {
        const elevenLabsAgentId = agent.elevenLabsAgentId;
        if (!elevenLabsAgentId) {
          return res.status(400).json({ message: "Agent not synced with ElevenLabs" });
        }
        
        
        const response = await callElevenLabsAPI(
          decryptedKey,
          `/v1/convai/agents/${elevenLabsAgentId}`,
          "PATCH",
          elevenLabsPayload,
          integration.id
        );
        
        console.log("ElevenLabs update response:", response);
        
        // Update local database
        await storage.updateAgent(user.organizationId, agentId, updates);
        
        // Return updated agent
        const updatedAgent = await storage.getAgent(agentId, user.organizationId);
        res.json(updatedAgent);
        
      } catch (elevenLabsError: any) {
        console.error("Error updating agent in ElevenLabs:", elevenLabsError);
        return res.status(500).json({ 
          message: "Failed to update agent in ElevenLabs",
          error: elevenLabsError.message || "Unknown error"
        });
      }
      
    } catch (error) {
      console.error("Error updating agent settings:", error);
      res.status(500).json({ error: "Failed to update agent settings" });
    }
  });


  // Get available VoiceAI voices - Updated with latest ElevenLabs API
  app.get("/api/voiceai/voices", isAuthenticated, checkPermission('manage_voices'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const decryptedKey = decryptApiKey(integration.apiKey);
      
      // Fetch voices from ElevenLabs API v1
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: {
          "xi-api-key": decryptedKey,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data.voices || []);
    } catch (error) {
      console.error("Error fetching voices:", error);
      res.status(500).json({ message: "Failed to fetch voices" });
    }
  });

  // Create voice clone - Latest ElevenLabs API endpoint
  app.post("/api/voiceai/voices/clone", isAuthenticated, checkPermission('manage_voices'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const decryptedKey = decryptApiKey(integration.apiKey);
      const { name, description, files, remove_background_noise } = req.body;

      // Note: For actual implementation, files would need to be handled as multipart/form-data
      // This is a placeholder that shows the endpoint structure
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description || '');
      formData.append('remove_background_noise', String(remove_background_noise || false));
      
      // In a real implementation, files would be appended here
      // files.forEach((file: any) => formData.append('files', file));

      const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
        method: "POST",
        headers: {
          "xi-api-key": decryptedKey,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error cloning voice:", error);
      res.status(500).json({ message: "Failed to clone voice" });
    }
  });

  // Get single voice details - Latest ElevenLabs API endpoint
  app.get("/api/voiceai/voices/:voiceId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const decryptedKey = decryptApiKey(integration.apiKey);
      const { voiceId } = req.params;
      
      const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
        headers: {
          "xi-api-key": decryptedKey,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching voice details:", error);
      res.status(500).json({ message: "Failed to fetch voice details" });
    }
  });

  // Delete voice - Latest ElevenLabs API endpoint
  app.delete("/api/voiceai/voices/:voiceId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const decryptedKey = decryptApiKey(integration.apiKey);
      const { voiceId } = req.params;
      
      const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
        method: "DELETE",
        headers: {
          "xi-api-key": decryptedKey,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      res.json({ success: true, message: "Voice deleted successfully" });
    } catch (error) {
      console.error("Error deleting voice:", error);
      res.status(500).json({ message: "Failed to delete voice" });
    }
  });
  
  // Legacy endpoint for backwards compatibility
  app.get("/api/elevenlabs/voices", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "API key not configured" });
      }

      const decryptedKey = decryptApiKey(integration.apiKey);
      
      // Fetch voices from ElevenLabs API
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: {
          "xi-api-key": decryptedKey,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data.voices || []);
    } catch (error) {
      console.error("Error fetching voices:", error);
      res.status(500).json({ message: "Failed to fetch voices" });
    }
  });

  // Preview voice endpoint for testing voices
  app.post("/api/elevenlabs/preview-voice", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { voiceId, text } = req.body;
      if (!voiceId) {
        return res.status(400).json({ message: "Voice ID is required" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "API key not configured" });
      }

      const decryptedKey = decryptApiKey(integration.apiKey);
      const previewText = text || "Hello! This is a preview of how I sound. I'm excited to help you with your voice AI needs.";
      
      // Use ElevenLabs text-to-speech API for preview
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": decryptedKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: previewText,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("ElevenLabs preview error:", errorText);
        throw new Error(`Failed to generate preview: ${response.statusText}`);
      }

      // Get the audio data as a buffer
      const audioBuffer = await response.arrayBuffer();
      const base64Audio = Buffer.from(audioBuffer).toString('base64');
      const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;
      
      res.json({ audioUrl });
    } catch (error: any) {
      console.error("Error generating voice preview:", error);
      res.status(500).json({ message: error.message || "Failed to generate voice preview" });
    }
  });

  // Phone number routes
  app.get("/api/phone-numbers", isAuthenticated, checkPermission('manage_phone_numbers'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const phoneNumbers = await storage.getPhoneNumbers(user.organizationId);
      res.json(phoneNumbers);
    } catch (error) {
      console.error("Error fetching phone numbers:", error);
      res.status(500).json({ message: "Failed to fetch phone numbers" });
    }
  });

  app.post("/api/phone-numbers", isAuthenticated, checkPermission('manage_phone_numbers'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const validation = insertPhoneNumberSchema.safeParse({
        ...req.body,
        organizationId: user.organizationId,
      });

      if (!validation.success) {
        return res.status(400).json({ message: "Invalid phone number data", errors: validation.error.errors });
      }

      // Encrypt sensitive data if provided
      const phoneNumberData = { ...validation.data };
      if (phoneNumberData.twilioAuthToken) {
        phoneNumberData.twilioAuthToken = encryptApiKey(phoneNumberData.twilioAuthToken);
      }
      if (phoneNumberData.sipPassword) {
        phoneNumberData.sipPassword = encryptApiKey(phoneNumberData.sipPassword);
      }

      // Create phone number first (following Vapi/Synthflow pattern)
      // Set initial status to pending for validation
      phoneNumberData.status = "pending";
      let phoneNumber = await storage.createPhoneNumber(phoneNumberData);
      
      // Then attempt to sync with ElevenLabs if integration exists
      // This is a non-blocking validation step
      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (integration && integration.apiKey) {
        try {
          const decryptedKey = decryptApiKey(integration.apiKey);
          
          // Format phone number for ElevenLabs in E.164 format
          // Remove any non-digit characters from the phone number
          const cleanPhoneNumber = phoneNumberData.phoneNumber.replace(/\D/g, '');
          // Get the country code without the + sign
          const rawCountryCode = (phoneNumberData.countryCode || '+1').replace('+', '');
          
          // Check if the phone number already starts with the country code
          // If it does, don't add it again
          let formattedPhoneNumber;
          if (cleanPhoneNumber.startsWith(rawCountryCode)) {
            // Phone number already includes country code
            formattedPhoneNumber = '+' + cleanPhoneNumber;
          } else {
            // Add country code to phone number
            formattedPhoneNumber = '+' + rawCountryCode + cleanPhoneNumber;
          }
          
          // Create phone number in ElevenLabs
          const elevenLabsPayload: any = {
            label: phoneNumberData.label,
            phone_number: formattedPhoneNumber,
            // Don't send country_code as a separate field
          };

          if (phoneNumberData.provider === "twilio" && phoneNumberData.twilioAccountSid) {
            elevenLabsPayload.provider = "twilio";
            elevenLabsPayload.sid = phoneNumberData.twilioAccountSid;
            // Add the auth token if provided (required by ElevenLabs)
            if (phoneNumberData.twilioAuthToken) {
              const decryptedToken = decryptApiKey(phoneNumberData.twilioAuthToken);
              elevenLabsPayload.token = decryptedToken;
            }
          } else if (phoneNumberData.provider === "sip_trunk") {
            elevenLabsPayload.provider = "sip";
            if (phoneNumberData.sipTrunkUri) {
              elevenLabsPayload.sip_uri = phoneNumberData.sipTrunkUri;
            }
          }

          const response = await callElevenLabsAPI(
            decryptedKey,
            "/v1/convai/phone-numbers",
            "POST",
            elevenLabsPayload,
            integration.id
          );

          console.log("ElevenLabs phone creation response:", JSON.stringify(response, null, 2));

          // ElevenLabs returns phone_number_id in the response
          // Let's check multiple possible field names to be sure
          const phoneId = response.phone_number_id || response.phone_id || response.id;
          
          if (phoneId) {
            // Update the phone number status to active after successful sync
            const updateResult = await storage.updatePhoneNumber(phoneNumber.id, user.organizationId, {
              elevenLabsPhoneId: phoneId,
              status: "active",
              lastSynced: new Date()
            });
            console.log("Updated phone number with ElevenLabs ID:", {
              localPhoneId: phoneNumber.id,
              elevenLabsPhoneId: phoneId,
              updateSuccess: !!updateResult
            });
            
            // Update the returned phone number object
            phoneNumber.elevenLabsPhoneId = phoneId;
            phoneNumber.status = "active";
            phoneNumber.lastSynced = new Date();
          } else {
            console.warn("ElevenLabs response did not include phone ID. Full response:", JSON.stringify(response, null, 2));
            // Still mark as active since it was created successfully
            await storage.updatePhoneNumber(phoneNumber.id, user.organizationId, {
              status: "active",
              lastSynced: new Date()
            });
            phoneNumber.status = "active";
            phoneNumber.lastSynced = new Date();
          }
        } catch (elevenLabsError: any) {
          console.error("Warning: Could not validate with ElevenLabs:", elevenLabsError.message);
          // Phone number remains in pending status - user can fix credentials later
          // This follows the Vapi/Synthflow pattern of allowing import without immediate validation
        }
      }
      res.json(phoneNumber);
    } catch (error) {
      console.error("Error creating phone number:", error);
      res.status(500).json({ message: "Failed to create phone number" });
    }
  });

  app.patch("/api/phone-numbers/:id", isAuthenticated, checkPermission('manage_phone_numbers'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { id } = req.params;
      const updates = req.body;

      // Encrypt sensitive data if provided
      if (updates.twilioAuthToken) {
        updates.twilioAuthToken = encryptApiKey(updates.twilioAuthToken);
      }
      if (updates.sipPassword) {
        updates.sipPassword = encryptApiKey(updates.sipPassword);
      }

      const phoneNumber = await storage.updatePhoneNumber(id, user.organizationId, updates);
      res.json(phoneNumber);
    } catch (error) {
      console.error("Error updating phone number:", error);
      res.status(500).json({ message: "Failed to update phone number" });
    }
  });
  
  // Verify phone number with ElevenLabs
  app.post("/api/phone-numbers/:id/verify", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { id } = req.params;
      const phoneNumber = await storage.getPhoneNumber(id, user.organizationId);
      
      if (!phoneNumber) {
        return res.status(404).json({ message: "Phone number not found" });
      }
      
      // Try to sync with ElevenLabs
      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ 
          message: "ElevenLabs integration not configured. Please add your ElevenLabs API key in the integrations section.",
          status: "pending" 
        });
      }
      
      try {
        const decryptedKey = decryptApiKey(integration.apiKey);
        
        // Format phone number for ElevenLabs in E.164 format
        const cleanPhoneNumber = phoneNumber.phoneNumber.replace(/\D/g, '');
        // Get the country code without the + sign
        const rawCountryCode = (phoneNumber.countryCode || '+1').replace('+', '');
        
        // Check if the phone number already starts with the country code
        // If it does, don't add it again
        let formattedPhoneNumber;
        if (cleanPhoneNumber.startsWith(rawCountryCode)) {
          // Phone number already includes country code
          formattedPhoneNumber = '+' + cleanPhoneNumber;
        } else {
          // Add country code to phone number
          formattedPhoneNumber = '+' + rawCountryCode + cleanPhoneNumber;
        }
        
        // Create phone number in ElevenLabs
        const elevenLabsPayload: any = {
          label: phoneNumber.label,
          phone_number: formattedPhoneNumber,
        };

        if (phoneNumber.provider === "twilio") {
          if (!phoneNumber.twilioAccountSid || !phoneNumber.twilioAuthToken) {
            return res.status(400).json({ 
              message: "Twilio credentials are missing. Please edit the phone number to add your Twilio Account SID and Auth Token.",
              status: "pending" 
            });
          }
          
          elevenLabsPayload.provider = "twilio";
          elevenLabsPayload.sid = phoneNumber.twilioAccountSid;
          const decryptedToken = decryptApiKey(phoneNumber.twilioAuthToken);
          elevenLabsPayload.token = decryptedToken;
        } else if (phoneNumber.provider === "sip_trunk") {
          elevenLabsPayload.provider = "sip";
          if (phoneNumber.sipTrunkUri) {
            elevenLabsPayload.sip_uri = phoneNumber.sipTrunkUri;
          }
        }

        const response = await callElevenLabsAPI(
          decryptedKey,
          "/v1/convai/phone-numbers",
          "POST",
          elevenLabsPayload,
          integration.id
        );

        if (response.phone_id) {
          // Update the phone number status to active after successful sync
          await storage.updatePhoneNumber(phoneNumber.id, user.organizationId, {
            elevenLabsPhoneId: response.phone_id,
            status: "active",
            lastSynced: new Date()
          });
          
          res.json({ 
            status: "active",
            message: "Phone number successfully verified and activated",
            elevenLabsPhoneId: response.phone_id 
          });
        } else {
          res.json({ 
            status: "pending",
            message: "Verification completed but phone number not activated. Please check your credentials." 
          });
        }
      } catch (elevenLabsError: any) {
        console.error("ElevenLabs verification error:", elevenLabsError.message);
        
        // Parse error message for specific issues
        let errorMessage = "Unable to verify phone number with ElevenLabs.";
        if (elevenLabsError.message?.includes("Twilio") || elevenLabsError.message?.includes("Authenticate")) {
          errorMessage = "Invalid Twilio credentials. Please verify your Account SID and Auth Token are correct.";
        } else if (elevenLabsError.message?.includes("already exists")) {
          errorMessage = "This phone number is already registered with ElevenLabs.";
        }
        
        res.json({ 
          status: "pending",
          message: errorMessage,
          error: elevenLabsError.message 
        });
      }
    } catch (error: any) {
      console.error("Error verifying phone number:", error);
      res.status(500).json({ 
        message: error.message || "Failed to verify phone number",
        status: "pending" 
      });
    }
  });

  // Assign agent to phone number
  app.patch("/api/phone-numbers/:id/assign-agent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { id } = req.params;
      const { agentId } = req.body;

      // Get phone number to check it exists
      const phoneNumber = await storage.getPhoneNumber(id, user.organizationId);
      if (!phoneNumber) {
        return res.status(404).json({ message: "Phone number not found" });
      }

      // If agentId is provided, verify the agent exists
      let elevenLabsAgentId = null;
      if (agentId) {
        const agent = await storage.getAgent(agentId, user.organizationId);
        if (!agent) {
          return res.status(404).json({ message: "Agent not found" });
        }
        elevenLabsAgentId = agent.elevenLabsAgentId;
      }

      // Update phone number with agent assignment
      const updatedPhoneNumber = await storage.updatePhoneNumber(id, user.organizationId, {
        agentId: agentId,
        elevenLabsAgentId: elevenLabsAgentId
      });

      // If phone number is synced with ElevenLabs (has elevenLabsPhoneId), update the assignment there
      // We check for elevenLabsPhoneId regardless of status to ensure sync happens
      if (phoneNumber.elevenLabsPhoneId) {
        const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
        if (integration && integration.apiKey) {
          try {
            const decryptedKey = decryptApiKey(integration.apiKey);
            
            // Update phone number in ElevenLabs with agent assignment
            // ElevenLabs expects just "agent_id" in the request body
            const payload: any = {};
            
            // Only include agent_id if we have one (to assign), otherwise empty payload (to unassign)
            if (elevenLabsAgentId) {
              payload.agent_id = elevenLabsAgentId;
            }
            
            // Try PATCH first, then fall back to PUT if it fails
            let response;
            try {
              response = await callElevenLabsAPI(
                decryptedKey,
                `/v1/convai/phone-numbers/${phoneNumber.elevenLabsPhoneId}`,
                "PATCH",
                payload,
                integration.id
              );
              console.log("ElevenLabs PATCH response:", response);
            } catch (patchError: any) {
              console.log("PATCH failed, trying PUT:", patchError.message);
              response = await callElevenLabsAPI(
                decryptedKey,
                `/v1/convai/phone-numbers/${phoneNumber.elevenLabsPhoneId}`,
                "PUT",
                payload,
                integration.id
              );
              console.log("ElevenLabs PUT response:", response);
            }
          } catch (elevenLabsError: any) {
            console.error("Error updating agent assignment in ElevenLabs:", elevenLabsError.message || elevenLabsError);
            // Continue even if ElevenLabs update fails - local update is still valid
          }
        } else {
          console.log("No ElevenLabs integration found, skipping sync");
        }
      } else {
        console.log("Phone number has no elevenLabsPhoneId, skipping ElevenLabs sync");
      }

      res.json(updatedPhoneNumber);
    } catch (error) {
      console.error("Error assigning agent to phone number:", error);
      res.status(500).json({ message: "Failed to assign agent to phone number" });
    }
  });

  // Re-sync phone number with ElevenLabs (to fix missing IDs)
  app.post("/api/phone-numbers/:id/resync", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { id } = req.params;
      const phoneNumber = await storage.getPhoneNumber(id, user.organizationId);
      
      if (!phoneNumber) {
        return res.status(404).json({ message: "Phone number not found" });
      }
      
      // Get ElevenLabs integration
      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs integration not configured" });
      }
      
      const decryptedKey = decryptApiKey(integration.apiKey);
      
      // Get all phone numbers from ElevenLabs to find this one
      try {
        const elevenLabsPhones = await callElevenLabsAPI(
          decryptedKey,
          "/v1/convai/phone-numbers",
          "GET",
          undefined,
          integration.id
        );
        
        console.log("ElevenLabs phone numbers:", JSON.stringify(elevenLabsPhones, null, 2));
        
        // Format our phone number for comparison
        const cleanPhoneNumber = phoneNumber.phoneNumber.replace(/\D/g, '');
        const rawCountryCode = (phoneNumber.countryCode || '+1').replace('+', '');
        let formattedPhoneNumber;
        if (cleanPhoneNumber.startsWith(rawCountryCode)) {
          formattedPhoneNumber = '+' + cleanPhoneNumber;
        } else {
          formattedPhoneNumber = '+' + rawCountryCode + cleanPhoneNumber;
        }
        
        // Find matching phone number in ElevenLabs
        const matchingPhone = elevenLabsPhones.find((p: any) => 
          p.phone_number === formattedPhoneNumber || 
          p.label === phoneNumber.label
        );
        
        if (matchingPhone) {
          const phoneId = matchingPhone.phone_number_id || matchingPhone.id;
          
          // Update our database with the ElevenLabs ID
          await storage.updatePhoneNumber(phoneNumber.id, user.organizationId, {
            elevenLabsPhoneId: phoneId,
            status: "active",
            lastSynced: new Date()
          });
          
          res.json({ 
            message: "Phone number re-synced successfully",
            elevenLabsPhoneId: phoneId,
            status: "active"
          });
        } else {
          res.status(404).json({ 
            message: "Phone number not found in ElevenLabs. You may need to delete and re-import it.",
            searchedFor: formattedPhoneNumber
          });
        }
      } catch (error: any) {
        console.error("Error re-syncing phone number:", error);
        res.status(500).json({ message: error.message || "Failed to re-sync phone number" });
      }
    } catch (error) {
      console.error("Error in resync:", error);
      res.status(500).json({ message: "Failed to re-sync phone number" });
    }
  });

  app.delete("/api/phone-numbers/:id", isAuthenticated, checkPermission('manage_phone_numbers'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { id } = req.params;
      
      // Get phone number to check if it has ElevenLabs ID
      const phoneNumber = await storage.getPhoneNumber(id, user.organizationId);
      if (!phoneNumber) {
        return res.status(404).json({ message: "Phone number not found" });
      }

      // Delete from ElevenLabs if synced
      if (phoneNumber.elevenLabsPhoneId) {
        const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
        if (integration && integration.apiKey) {
          try {
            const decryptedKey = decryptApiKey(integration.apiKey);
            await callElevenLabsAPI(
              decryptedKey,
              `/v1/convai/phone-numbers/${phoneNumber.elevenLabsPhoneId}`,
              "DELETE",
              undefined,
              integration.id
            );
          } catch (elevenLabsError) {
            console.error("Error deleting phone number from ElevenLabs:", elevenLabsError);
            // Continue with local deletion even if ElevenLabs deletion fails
          }
        }
      }

      await storage.deletePhoneNumber(id, user.organizationId);
      res.json({ message: "Phone number deleted successfully" });
    } catch (error) {
      console.error("Error deleting phone number:", error);
      res.status(500).json({ message: "Failed to delete phone number" });
    }
  });

  // Update agent settings
  app.patch("/api/agents/:agentId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { agentId } = req.params;
      const updates = req.body;
      
      console.log("\n=== AGENT UPDATE REQUEST ===");
      console.log("Updates received:", JSON.stringify(updates, null, 2));
      console.log("================================\n");

      // First, get the agent to get the ElevenLabs agent ID
      const agent = await storage.getAgent(agentId, user.organizationId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      // If we have any ElevenLabs-related updates, sync with ElevenLabs API
      const needsElevenLabsUpdate = updates.firstMessage !== undefined || 
                                     updates.systemPrompt !== undefined ||
                                     updates.language !== undefined ||
                                     updates.voiceId !== undefined || 
                                     updates.voiceSettings !== undefined ||
                                     updates.llmSettings !== undefined ||
                                     updates.tools !== undefined ||
                                     updates.dynamicVariables !== undefined ||
                                     updates.evaluationCriteria !== undefined ||
                                     updates.dataCollection !== undefined;

      if (needsElevenLabsUpdate && agent.elevenLabsAgentId) {
        const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
        if (integration && integration.apiKey) {
          const decryptedKey = decryptApiKey(integration.apiKey);
          
          try {
            // First, fetch the current agent configuration from ElevenLabs
            console.log("\n=== FETCHING CURRENT AGENT CONFIG ===");
            const currentAgentResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agent.elevenLabsAgentId}`, {
              headers: {
                "xi-api-key": decryptedKey,
                "Content-Type": "application/json",
              },
            });
            
            let currentAgentConfig: any = {};
            if (currentAgentResponse.ok) {
              currentAgentConfig = await currentAgentResponse.json();
            } else {
              console.error("Failed to fetch current agent config, using defaults");
            }
            
            // Build the update payload - COMPLETE OVERRIDE, not partial update
            const elevenLabsPayload: any = {
              name: updates.name || agent.name,
              conversation_config: {
                agent: {
                  prompt: {
                    prompt: updates.systemPrompt !== undefined ? updates.systemPrompt : (agent.systemPrompt || "You are a helpful AI assistant"),
                    first_message: updates.firstMessage !== undefined ? updates.firstMessage : (agent.firstMessage || "Hello! How can I help you today?"),
                    language: updates.language !== undefined ? updates.language : (agent.language || "en")
                  },
                  first_message: updates.firstMessage !== undefined ? updates.firstMessage : (agent.firstMessage || "Hello! How can I help you today?"),
                  language: updates.language !== undefined ? updates.language : (agent.language || "en")
                },
                turn: {
                  mode: "turn",
                  threshold: 0.5
                },
                asr: {
                  quality: "high",
                  provider: "elevenlabs"
                }
              },
              platform_settings: {
                auth: {
                  mode: "open" // Allow all calls without authentication
                }
              }
            };

            // Add LLM settings if provided
            if (updates.llmSettings || agent.llmSettings) {
              const llmSettings = updates.llmSettings || agent.llmSettings;
              elevenLabsPayload.conversation_config.llm = {
                model: llmSettings.model || "gpt-4",
                temperature: llmSettings.temperature || 0.7,
                max_tokens: llmSettings.maxTokens || 150,
              };
            }

            // Always include complete TTS settings for full override
            const voiceSettings = updates.voiceSettings || agent.voiceSettings || {};
            elevenLabsPayload.conversation_config.tts = {
              voice_id: updates.voiceId || agent.voiceId || "21m00Tcm4TlvDq8ikWAM", // Default to Rachel voice
              agent_output_audio_format: "pcm_16000",
              optimize_streaming_latency: 3,
              stability: voiceSettings.stability !== undefined ? voiceSettings.stability : 0.5,
              similarity_boost: voiceSettings.similarityBoost !== undefined ? voiceSettings.similarityBoost : 0.75,
              style: voiceSettings.style !== undefined ? voiceSettings.style : 0,
              use_speaker_boost: voiceSettings.useSpeakerBoost !== undefined ? voiceSettings.useSpeakerBoost : true
            };


            // Add tools configuration if provided
            if (updates.tools || agent.tools) {
              const tools = updates.tools || agent.tools;
              const toolConfigs: any[] = [];
              
              // System tools removed - not syncing with ElevenLabs anymore
              
              // Handle custom tools (webhooks, integrations)
              if (tools.customTools && tools.customTools.length > 0) {
                for (const customTool of tools.customTools) {
                  if (customTool.enabled && customTool.name) {
                    if (customTool.type === 'webhook' && customTool.url) {
                      try {
                        // Create webhook tool in ElevenLabs
                        const toolResponse = await fetch('https://api.elevenlabs.io/v1/convai/tools', {
                          method: 'POST',
                          headers: {
                            'xi-api-key': decryptedKey,
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            type: 'webhook',
                            name: customTool.name,
                            description: customTool.description || '',
                            webhook: {
                              url: customTool.url,
                              method: customTool.method || 'POST',
                              headers: customTool.headers || {}
                            },
                          }),
                        });
                        
                        if (toolResponse.ok) {
                          const toolData = await toolResponse.json();
                          toolConfigs.push({
                            type: 'custom',
                            tool_id: toolData.tool_id,
                            name: customTool.name
                          });
                        } else {
                          console.error(`Failed to create webhook tool ${customTool.name}:`, await toolResponse.text());
                        }
                      } catch (toolError) {
                        console.error(`Error creating webhook tool ${customTool.name}:`, toolError);
                      }
                    }
                  }
                }
              }
              
              // Use the new tools API format for RAG tools
              if (toolConfigs.length > 0) {
                const { toolIds, builtInTools } = await manageElevenLabsTools(
                  decryptedKey,
                  toolConfigs,
                  integration.id
                );
                
                // Ensure prompt object exists
                if (!elevenLabsPayload.conversation_config.agent.prompt) {
                  elevenLabsPayload.conversation_config.agent.prompt = {};
                }
                
                // Set tool_ids for webhook tools
                if (toolIds.length > 0) {
                  elevenLabsPayload.conversation_config.agent.prompt.tool_ids = 
                    [...(elevenLabsPayload.conversation_config.agent.prompt.tool_ids || []), ...toolIds];
                }
              }
            }

            // Add dynamic variables if provided
            if (updates.dynamicVariables || agent.dynamicVariables) {
              const vars = updates.dynamicVariables || agent.dynamicVariables;
              if (vars && Object.keys(vars).length > 0) {
                elevenLabsPayload.conversation_config.agent.dynamic_variables = vars;
              }
            }

            // Add evaluation criteria if provided
            if (updates.evaluationCriteria || agent.evaluationCriteria) {
              const evaluation = updates.evaluationCriteria || agent.evaluationCriteria;
              if (evaluation.enabled && evaluation.criteria) {
                elevenLabsPayload.platform_settings = {
                  ...elevenLabsPayload.platform_settings,
                  evaluation: {
                    criteria: evaluation.criteria.map((c: string) => ({
                      name: c,
                      description: `Evaluate if ${c}`,
                      type: "boolean"
                    }))
                  }
                };
              }
            }

            // Add data collection settings if provided
            if (updates.dataCollection || agent.dataCollection) {
              const collection = updates.dataCollection || agent.dataCollection;
              if (collection.enabled && collection.fields) {
                elevenLabsPayload.platform_settings = {
                  ...elevenLabsPayload.platform_settings,
                  data_collection: {
                    fields: collection.fields
                  }
                };
              }
            }

            // Add webhook settings if provided
            if (updates.tools || agent.tools) {
              const tools = updates.tools || agent.tools;
              
              // Add conversation initiation webhook
              if (tools.conversationInitiationWebhook) {
                elevenLabsPayload.platform_settings = {
                  ...elevenLabsPayload.platform_settings,
                  conversation_initiation_client_data_webhook: {
                    enabled: tools.conversationInitiationWebhook.enabled || false,
                    url: tools.conversationInitiationWebhook.url || ""
                  }
                };
              }
              
              // Add post-call webhook
              if (tools.postCallWebhook) {
                elevenLabsPayload.platform_settings = {
                  ...elevenLabsPayload.platform_settings,
                  post_call_webhook: {
                    enabled: tools.postCallWebhook.enabled || false,
                    url: tools.postCallWebhook.url || ""
                  }
                };
              }
            }

            // Always add client_config_override to enable ALL overrides by default
            elevenLabsPayload.client_config_override = {
              agent: {
                language: {},
                prompt: {
                  prompt: {},
                  first_message: {}
                },
                first_message: {},
                tools: {}
              },
              tts: {
                voice_id: {},
                stability: {},
                similarity_boost: {},
                style: {},
                use_speaker_boost: {},
                optimize_streaming_latency: {},
                agent_output_audio_format: {}
              },
              conversation: {
                text_only: {}
              },
              turn: {
                mode: {},
                threshold: {}
              },
              asr: {
                quality: {},
                provider: {}
              },
              llm: {
                model: {},
                temperature: {},
                max_tokens: {}
              },
              platform_settings: {
                conversation_initiation_client_data_webhook: {},
                post_call_webhook: {}
              }
            };
            
            console.log("\n=== UPDATING ELEVENLABS AGENT ===");
            console.log("Payload:", JSON.stringify(elevenLabsPayload, null, 2));

            // Try updating with PUT instead of PATCH if PATCH fails
            let response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agent.elevenLabsAgentId}`, {
              method: "PATCH",
              headers: {
                "xi-api-key": decryptedKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(elevenLabsPayload),
            });
            
            // If PATCH fails with 500, try a simpler update with just the conversation config
            if (response.status === 500) {
              console.log("\n=== PATCH failed, trying simpler update ===");
              const simplePayload = {
                conversation_config: {
                  agent: {
                    prompt: updates.systemPrompt !== undefined ? updates.systemPrompt : agent.systemPrompt,
                    first_message: updates.firstMessage !== undefined ? updates.firstMessage : agent.firstMessage,
                  }
                }
              };
              
              response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agent.elevenLabsAgentId}`, {
                method: "PATCH",
                headers: {
                  "xi-api-key": decryptedKey,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(simplePayload),
              });
            }

            if (!response.ok) {
              const errorText = await response.text();
              console.error("\n=== ELEVENLABS UPDATE FAILED ===");
              console.error("Status:", response.status);
              console.error("Error:", errorText);
              console.error("================================\n");
              // Continue anyway - we'll still update locally
            } else {
              const responseData = await response.json();
              console.log("\n=== ELEVENLABS UPDATE SUCCESS ===");
              console.log("Response:", JSON.stringify(responseData, null, 2));
              console.log("================================\n");
            }
          } catch (elevenLabsError) {
            console.error("\n=== ELEVENLABS SYNC ERROR ===");
            console.error("Error:", elevenLabsError);
            console.error("================================\n");
            // Continue with local update even if ElevenLabs update fails
          }
        }
      }

      // Update the agent in our database
      const updatedAgent = await storage.updateAgent(agentId, user.organizationId, updates);
      res.json(updatedAgent);
    } catch (error) {
      console.error("Error updating agent:", error);
      res.status(500).json({ message: "Failed to update agent" });
    }
  });

  // Call logs routes
  app.get("/api/call-logs", isAuthenticated, checkPermission('view_call_history'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { limit = 20, offset = 0, agentId, page = 1 } = req.query;
      const pageNumber = parseInt(page as string);
      const pageSize = parseInt(limit as string);
      const skip = pageNumber > 0 ? (pageNumber - 1) * pageSize : parseInt(offset as string);
      
      const result = await storage.getCallLogs(
        user.organizationId,
        pageSize,
        skip,
        agentId as string
      );

      // Set cache headers for better performance
      res.set({
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
        'ETag': `W/"${result.total}-${skip}"`
      });

      // Return paginated response
      res.json({
        data: result.data,
        total: result.total,
        page: pageNumber,
        pageSize: pageSize,
        totalPages: Math.ceil(result.total / pageSize)
      });
    } catch (error) {
      console.error("Error fetching call logs:", error);
      res.status(500).json({ message: "Failed to fetch call logs" });
    }
  });

  app.get("/api/call-logs/:id", isAuthenticated, checkPermission('view_call_history'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const callLog = await storage.getCallLog(req.params.id, user.organizationId);
      if (!callLog) {
        return res.status(404).json({ message: "Call log not found" });
      }

      res.json(callLog);
    } catch (error) {
      console.error("Error fetching call log:", error);
      res.status(500).json({ message: "Failed to fetch call log" });
    }
  });

  // ElevenLabs SDK webhook test endpoint
  app.get("/api/public/rag/test", async (req: any, res: any) => {
    res.json({
      status: "OK",
      message: "ElevenLabs RAG webhook is operational! Configure this webhook in your ElevenLabs agent.",
      webhook_url: `${req.protocol}://${req.get('host')}/api/public/rag`,
      test_query: `${req.protocol}://${req.get('host')}/api/public/rag?query=where does john live`,
      instructions: "Add this webhook to your ElevenLabs agent with a 'query' parameter (GET) or body field (POST)",
      elevenlabs_format: {
        method: "GET or POST",
        query_parameters: [{
          key: "query",
          description: "The search query for the knowledge base",
          required: true,
          dataType: "String",
          valueType: "LLM Prompt"
        }],
        expected_response: {
          message: "Text that the agent will speak based on search results"
        }
      }
    });
  });

  // RAG Search Webhook endpoint for ElevenLabs agents
  // Test Webhook Tools for ElevenLabs Server Tools integration
  const handleSearchTool = async (req: any, res: any) => {
    try {
      console.log("=== SEARCH TOOL CALLED ===");
      console.log("Method:", req.method);
      console.log("Headers:", req.headers);
      console.log("Query Parameters:", req.query);
      console.log("Body:", req.body);
      
      // Get the search query from URL parameters (ElevenLabs Server Tools style)
      const searchQuery = req.query.query || req.query.q || req.body?.query || '';
      
      console.log("Search Query:", searchQuery);
      
      if (!searchQuery) {
        return res.json({
          error: "No search query provided",
          message: "Please provide a 'query' parameter",
          example: "?query=hotels in Paris"
        });
      }

      // Mock search results that the agent can use
      const mockResults = [
        {
          title: `Best ${searchQuery} - Option 1`,
          description: `Detailed information about ${searchQuery} with premium features and excellent reviews.`,
          rating: "4.8/5",
          location: "Prime location",
          price: "$150-300"
        },
        {
          title: `Popular ${searchQuery} - Option 2`, 
          description: `Highly rated ${searchQuery} with modern amenities and great customer service.`,
          rating: "4.6/5",
          location: "Central area",
          price: "$100-250"
        },
        {
          title: `Budget-friendly ${searchQuery} - Option 3`,
          description: `Affordable ${searchQuery} with good value for money and basic amenities.`,
          rating: "4.2/5", 
          location: "Convenient location",
          price: "$50-150"
        }
      ];

      // Return data in a format the agent can easily parse and use
      return res.json({
        success: true,
        query: searchQuery,
        results_count: mockResults.length,
        results: mockResults,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error("Search tool error:", error);
      res.status(500).json({ 
        success: false,
        error: "Search tool error occurred",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  const handleInfoTool = async (req: any, res: any) => {
    try {
      console.log("=== INFO TOOL CALLED ===");
      console.log("Method:", req.method);
      console.log("Query Parameters:", req.query);
      console.log("Body:", req.body);
      
      const topic = req.query.topic || req.body?.topic || 'general';
      
      console.log("Info Topic:", topic);
      
      // Mock detailed information that the agent can use
      const mockInfo = {
        topic: topic,
        overview: `Comprehensive information about ${topic}`,
        key_points: [
          `${topic} is widely recognized for its quality and reliability`,
          `Key features include advanced functionality and user-friendly design`,
          `Popular among users for its effectiveness and versatility`
        ],
        details: {
          category: "Service/Product",
          availability: "Available 24/7",
          support: "Full customer support included",
          features: ["Feature A", "Feature B", "Feature C"]
        },
        recommendations: [
          "Best for first-time users",
          "Suitable for all experience levels", 
          "Highly recommended by experts"
        ]
      };

      return res.json({
        success: true,
        topic: topic,
        information: mockInfo,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error("Info tool error:", error);
      res.status(500).json({ 
        success: false,
        error: "Info tool error occurred",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };




  // Server Tools test endpoints for ElevenLabs webhook tools
  app.get("/api/tools/search", handleSearchTool);
  app.post("/api/tools/search", handleSearchTool);
  app.get("/api/tools/info", handleInfoTool);
  app.post("/api/tools/info", handleInfoTool);

  // ElevenLabs MCP-style webhook tools
  const handleTextToSpeech = async (req: any, res: any) => {
    try {
      console.log("=== TEXT TO SPEECH TOOL CALLED ===");
      console.log("Query Parameters:", req.query);
      console.log("Body:", req.body);
      
      const text = req.query.text || req.body?.text || '';
      const voiceId = req.query.voice_id || req.body?.voice_id || '21m00Tcm4TlvDq8ikWAM'; // Default voice
      const modelId = req.query.model_id || req.body?.model_id || 'eleven_v3'; // Default to new v3 model (2025)
      
      if (!text) {
        return res.json({
          error: "No text provided",
          message: "Please provide 'text' parameter",
          example: "?text=Hello world&voice_id=21m00Tcm4TlvDq8ikWAM&model_id=eleven_v3",
          available_models: ["eleven_v3", "eleven_flash_v2_5", "eleven_monolingual_v1"],
          note: "eleven_v3 is the latest high-quality model (2025) supporting 70+ languages"
        });
      }

      // Get user's organization and ElevenLabs integration
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const integration = await storage.getIntegration(user.organizationId, 'elevenlabs');
      if (!integration || !integration.apiKey) {
        return res.status(400).json({
          error: "ElevenLabs integration not found",
          message: "Please configure your ElevenLabs API key in Integrations settings"
        });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      
      // Call ElevenLabs TTS API
      try {
        const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': apiKey
          },
          body: JSON.stringify({
            text: text,
            model_id: modelId,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5
            }
          })
        });

        if (!ttsResponse.ok) {
          const errorText = await ttsResponse.text();
          throw new Error(`ElevenLabs API error: ${ttsResponse.status} - ${errorText}`);
        }

        // Return success response with metadata
        return res.json({
          success: true,
          message: `Successfully generated speech for text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
          details: {
            text_length: text.length,
            voice_id: voiceId,
            model_id: modelId,
            estimated_characters: text.length,
            audio_format: "mp3"
          },
          timestamp: new Date().toISOString()
        });

      } catch (error: any) {
        console.error("ElevenLabs TTS error:", error);
        return res.status(500).json({
          success: false,
          error: "TTS generation failed",
          message: error.message || "Unknown error occurred"
        });
      }
      
    } catch (error) {
      console.error("Text-to-speech tool error:", error);
      res.status(500).json({ 
        success: false,
        error: "Text-to-speech tool error occurred",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  const handleGetVoices = async (req: any, res: any) => {
    try {
      console.log("=== GET VOICES TOOL CALLED ===");
      
      // Get user's organization and ElevenLabs integration
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const integration = await storage.getIntegration(user.organizationId, 'elevenlabs');
      if (!integration || !integration.apiKey) {
        return res.status(400).json({
          error: "ElevenLabs integration not found",
          message: "Please configure your ElevenLabs API key in Integrations settings"
        });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      
      try {
        const voicesResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
          headers: {
            'xi-api-key': apiKey
          }
        });

        if (!voicesResponse.ok) {
          const errorText = await voicesResponse.text();
          throw new Error(`ElevenLabs API error: ${voicesResponse.status} - ${errorText}`);
        }

        const voicesData = await voicesResponse.json();
        
        // Format voices for easy consumption by voice agents
        const formattedVoices = voicesData.voices?.map((voice: any) => ({
          id: voice.voice_id,
          name: voice.name,
          category: voice.category,
          description: voice.description || `${voice.name} voice`,
          accent: voice.labels?.accent,
          age: voice.labels?.age,
          gender: voice.labels?.gender,
          use_case: voice.labels?.use_case
        })) || [];

        return res.json({
          success: true,
          voices_count: formattedVoices.length,
          voices: formattedVoices.slice(0, 10), // Limit to first 10 for agent response
          message: `Found ${formattedVoices.length} available voices. Here are the first 10 options.`,
          timestamp: new Date().toISOString()
        });

      } catch (error: any) {
        console.error("ElevenLabs get voices error:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to fetch voices",
          message: error.message || "Unknown error occurred"
        });
      }
      
    } catch (error) {
      console.error("Get voices tool error:", error);
      res.status(500).json({ 
        success: false,
        error: "Get voices tool error occurred",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  const handleVoiceClone = async (req: any, res: any) => {
    try {
      console.log("=== VOICE CLONE TOOL CALLED ===");
      console.log("Query Parameters:", req.query);
      console.log("Body:", req.body);
      
      const name = req.query.name || req.body?.name || '';
      const description = req.query.description || req.body?.description || '';
      
      if (!name) {
        return res.json({
          error: "No voice name provided",
          message: "Please provide 'name' parameter",
          example: "?name=My Custom Voice&description=A warm, friendly voice"
        });
      }

      // Get user's organization and ElevenLabs integration
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const integration = await storage.getIntegration(user.organizationId, 'elevenlabs');
      if (!integration || !integration.apiKey) {
        return res.status(400).json({
          error: "ElevenLabs integration not found",
          message: "Please configure your ElevenLabs API key in Integrations settings"
        });
      }

      // Return information about voice cloning process (actual implementation would need audio files)
      return res.json({
        success: true,
        message: `Voice cloning initiated for "${name}". In a real implementation, this would process audio samples to create a custom voice.`,
        details: {
          name: name,
          description: description || `Custom cloned voice: ${name}`,
          status: "would_process_audio_samples",
          requirements: [
            "High-quality audio samples (minimum 1 minute)",
            "Clear speech without background noise",
            "Multiple samples for better quality"
          ],
          next_steps: [
            "Upload audio samples",
            "Process voice characteristics", 
            "Generate voice model",
            "Test and refine"
          ]
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error("Voice clone tool error:", error);
      res.status(500).json({ 
        success: false,
        error: "Voice clone tool error occurred",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  // Register ElevenLabs MCP-style tools
  app.get("/api/tools/elevenlabs/text-to-speech", isAuthenticated, handleTextToSpeech);
  app.post("/api/tools/elevenlabs/text-to-speech", isAuthenticated, handleTextToSpeech);
  app.get("/api/tools/elevenlabs/get-voices", isAuthenticated, handleGetVoices);
  app.post("/api/tools/elevenlabs/get-voices", isAuthenticated, handleGetVoices);
  app.get("/api/tools/elevenlabs/voice-clone", isAuthenticated, handleVoiceClone);
  app.post("/api/tools/elevenlabs/voice-clone", isAuthenticated, handleVoiceClone);

  // ElevenLabs SDK Webhook endpoint for conversation events
  app.post("/api/webhooks/voiceai", async (req, res) => {
    try {
      console.log("ElevenLabs conversation event received:", JSON.stringify(req.body, null, 2));
      
      const { type, data } = req.body;
      
      if (type === "post_call_transcription") {
        // Extract call data from webhook
        const {
          conversation_id,
          agent_id,
          transcript,
          duration_seconds,
          conversation_metadata,
          analysis
        } = data;

        // Find the agent in our system
        const agent = await storage.getAgentByElevenLabsId(agent_id, "");
        if (agent) {
          // Extract cost data if available from webhook
          const costData = {
            llm_cost: data.llm_cost,
            cost: data.cost,
            credits_used: data.credits_used,
          };
          
          // Store call log
          await storage.createCallLog({
            organizationId: agent.organizationId,
            conversationId: conversation_id,
            agentId: agent.id,
            elevenLabsCallId: conversation_id,
            phoneNumber: data.customer_phone_number || data.phone_number || conversation_metadata?.phone_number || null,
            duration: duration_seconds || 0,
            transcript: transcript,
            audioUrl: "", // Will be populated from audio webhook if available
            cost: calculateCallCost(duration_seconds || 0, costData).toString(),
            status: "completed",
          });
          
          console.log("Call log saved for conversation:", conversation_id);
        }
      } else if (type === "post_call_audio") {
        // Update call log with audio URL
        const { conversation_id, full_audio } = data;
        
        // In production, you'd save the audio to cloud storage
        // For now, we'll just log that we received it
        console.log("Audio received for conversation:", conversation_id, "Size:", full_audio?.length || 0);
      }
      
      res.status(200).json({ message: "Webhook processed successfully" });
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });
  
  // Legacy webhook endpoint for backwards compatibility
  app.post("/api/webhooks/elevenlabs", async (req, res) => {
    try {
      console.log("Webhook received (legacy):", JSON.stringify(req.body, null, 2));
      
      const { type, data } = req.body;
      
      if (type === "post_call_transcription") {
        // Extract call data from webhook
        const {
          conversation_id,
          agent_id,
          transcript,
          duration_seconds,
          conversation_metadata,
          analysis
        } = data;

        // Find the agent in our system
        const agent = await storage.getAgentByElevenLabsId(agent_id, "");
        if (agent) {
          // Extract cost data if available from webhook
          const costData = {
            llm_cost: data.llm_cost,
            cost: data.cost,
            credits_used: data.credits_used,
          };
          
          // Store call log
          await storage.createCallLog({
            organizationId: agent.organizationId,
            conversationId: conversation_id,
            agentId: agent.id,
            elevenLabsCallId: conversation_id,
            phoneNumber: data.customer_phone_number || data.phone_number || conversation_metadata?.phone_number || null,
            duration: duration_seconds || 0,
            transcript: transcript,
            audioUrl: "", // Will be populated from audio webhook if available
            cost: calculateCallCost(duration_seconds || 0, costData).toString(),
            status: "completed",
          });
          
          console.log("Call log saved for conversation:", conversation_id);
        }
      } else if (type === "post_call_audio") {
        // Update call log with audio URL
        const { conversation_id, full_audio } = data;
        
        // In production, you'd save the audio to cloud storage
        // For now, we'll just log that we received it
        console.log("Audio received for conversation:", conversation_id, "Size:", full_audio?.length || 0);
      }
      
      res.status(200).json({ message: "Webhook processed successfully" });
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });



  // Audio proxy endpoint for ElevenLabs recordings
  app.get("/api/audio/:conversationId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { conversationId } = req.params;
      
      // Get the ElevenLabs integration to get the API key
      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || integration.status !== "ACTIVE") {
        return res.status(400).json({ message: "Active ElevenLabs integration required" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      
      // Fetch the audio from ElevenLabs
      const audioResponse = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`,
        {
          headers: {
            "xi-api-key": apiKey,
          },
        }
      );

      if (!audioResponse.ok) {
        console.error(`Failed to fetch audio for conversation ${conversationId}: ${audioResponse.status}`);
        return res.status(404).json({ message: "Audio not found" });
      }

      // Stream the audio response to the client
      res.setHeader("Content-Type", audioResponse.headers.get("Content-Type") || "audio/mpeg");
      res.setHeader("Cache-Control", "public, max-age=3600");
      
      const audioBuffer = await audioResponse.arrayBuffer();
      res.send(Buffer.from(audioBuffer));
    } catch (error) {
      console.error("Error fetching audio:", error);
      res.status(500).json({ message: "Failed to fetch audio" });
    }
  });

  // Get current organization details for user
  app.get("/api/organization/current", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const organization = await storage.getOrganization(user.organizationId);
      if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
      }

      res.json(organization);
    } catch (error) {
      console.error("Error fetching organization:", error);
      res.status(500).json({ message: "Failed to fetch organization data" });
    }
  });

  // Public whitelabel endpoint by subdomain (no auth required)
  app.get("/api/whitelabel/subdomain/:subdomain", cacheMiddleware.long, async (req, res) => {
    try {
      const { subdomain } = req.params;
      
      // Get organization by subdomain
      const org = await storage.getOrganizationBySubdomain(subdomain);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      // Get whitelabel config for this organization
      const config = await storage.getWhitelabelConfig(org.id);
      
      if (!config) {
        // Return default branding if no config exists
        return res.json({
          appName: org.name,
          companyName: org.name,
          removePlatformBranding: false
        });
      }
      
      // Return public whitelabel config
      res.json({
        appName: config.appName || org.name,
        companyName: config.companyName || org.name,
        logoUrl: config.logoUrl,
        faviconUrl: config.faviconUrl,
        removePlatformBranding: config.removePlatformBranding,
        supportUrl: config.supportUrl,
        documentationUrl: config.documentationUrl
      });
    } catch (error) {
      console.error("Error fetching subdomain whitelabel config:", error);
      res.status(500).json({ error: "Failed to fetch configuration" });
    }
  });

  // Domain configuration endpoint
  app.get("/api/config/domain", (req: any, res) => {
    const baseDomain = process.env.BASE_DOMAIN || 
      (process.env.NODE_ENV === 'production' ? req.get('host') : 'localhost:5000');
    
    res.json({
      baseDomain,
      isDevelopment: process.env.NODE_ENV !== 'production',
      supportsSubdomains: true,
      // In development, subdomain can be passed as query parameter
      developmentSubdomainParam: process.env.NODE_ENV !== 'production' ? 'subdomain' : null
    });
  });

  // Public whitelabel endpoint for login page
  app.get("/api/whitelabel/public", cacheMiddleware.long, async (req: any, res) => {
    try {
      const { subdomain } = req.query;
      
      // If subdomain is provided, look up the specific organization
      if (subdomain) {
        const org = await storage.getOrganizationBySubdomain(subdomain as string);
        
        if (org) {
          const config = await storage.getWhitelabelConfig(org.id);
          
          if (config) {
            // Return public-safe fields only
            return res.json({
              appName: config.appName,
              companyName: config.companyName,
              logoUrl: config.logoUrl,
              faviconUrl: config.faviconUrl,
              removePlatformBranding: config.removePlatformBranding,
            });
          }
        }
        
        // If subdomain not found, return 404
        return res.status(404).json({
          error: "Agency not found",
          appName: "VoiceAI Dashboard",
          companyName: "",
          removePlatformBranding: false,
        });
      }
      
      // Default behavior: Get the first whitelabel config (for single-tenant deployments)
      const allConfigs = await storage.getAllWhitelabelConfigs();
      
      if (allConfigs && allConfigs.length > 0) {
        const config = allConfigs[0];
        // Return public-safe fields only
        res.json({
          appName: config.appName,
          companyName: config.companyName,
          logoUrl: config.logoUrl,
          faviconUrl: config.faviconUrl,
          removePlatformBranding: config.removePlatformBranding,
        });
      } else {
        // Return default config
        res.json({
          appName: "VoiceAI Dashboard",
          companyName: "",
          removePlatformBranding: false,
        });
      }
    } catch (error) {
      console.error("Error fetching public whitelabel config:", error);
      // Return default config on error
      res.json({
        appName: "VoiceAI Dashboard",
        companyName: "",
        removePlatformBranding: false,
      });
    }
  });

  // Whitelabel configuration endpoints
  app.get("/api/whitelabel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user || !user.organizationId) {
        return res.status(403).json({ message: "User must belong to an organization" });
      }

      // Check if user's organization is an agency
      const organization = await storage.getOrganization(user.organizationId);
      if (!organization || organization.organizationType !== "agency") {
        return res.status(403).json({ message: "Whitelabel is only available for agencies" });
      }

      const config = await storage.getWhitelabelConfig(user.organizationId);
      if (!config) {
        // Return default config if none exists
        return res.json({
          organizationId: user.organizationId,
          appName: "VoiceAI Dashboard",
          companyName: organization.name,
          removePlatformBranding: false,
        });
      }

      res.json(config);
    } catch (error) {
      console.error("Error fetching whitelabel config:", error);
      res.status(500).json({ message: "Failed to fetch whitelabel configuration" });
    }
  });

  // Get current user's organization details
  app.get("/api/organization", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user || !user.organizationId) {
        return res.status(404).json({ message: "User organization not found" });
      }

      const organization = await storage.getOrganization(user.organizationId);
      if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
      }

      res.json({
        id: organization.id,
        name: organization.name,
        subdomain: organization.subdomain,
        customDomain: organization.customDomain,
        organizationType: organization.organizationType,
      });
    } catch (error) {
      console.error("Error fetching organization:", error);
      res.status(500).json({ message: "Failed to fetch organization" });
    }
  });

  // Check subdomain availability
  app.post("/api/subdomain/check", isAuthenticated, async (req: any, res) => {
    try {
      const { subdomain } = req.body;
      
      if (!subdomain) {
        return res.status(400).json({ message: "Subdomain is required" });
      }

      // Validate subdomain format
      const subdomainRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
      if (!subdomainRegex.test(subdomain)) {
        return res.status(400).json({ 
          available: false, 
          message: "Invalid subdomain format. Use only lowercase letters, numbers, and hyphens." 
        });
      }

      // Check if subdomain exists
      const existingOrg = await storage.getOrganizationBySubdomain(subdomain);
      
      if (existingOrg) {
        res.json({ 
          available: false, 
          organizationId: existingOrg.id,
          message: "Subdomain is already taken" 
        });
      } else {
        res.json({ 
          available: true, 
          message: "Subdomain is available" 
        });
      }
    } catch (error) {
      console.error("Error checking subdomain:", error);
      res.status(500).json({ message: "Failed to check subdomain availability" });
    }
  });

  app.post("/api/whitelabel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user || !user.organizationId) {
        return res.status(403).json({ message: "User must belong to an organization" });
      }

      // Check if user's organization is an agency
      const organization = await storage.getOrganization(user.organizationId);
      if (!organization || organization.organizationType !== "agency") {
        return res.status(403).json({ message: "Whitelabel is only available for agencies" });
      }

      // Check if user has permission to modify organization settings
      // Allow any user in an agency organization to modify whitelabel
      // (agencies should be able to customize their whitelabel regardless of role)

      const { appName, companyName, removePlatformBranding, supportUrl, documentationUrl, logoUrl, faviconUrl, subdomain } = req.body;

      // If subdomain is provided, update the organization
      if (subdomain !== undefined) {
        // Validate subdomain format
        const subdomainRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
        if (subdomain && !subdomainRegex.test(subdomain)) {
          return res.status(400).json({ message: "Invalid subdomain format. Use only lowercase letters, numbers, and hyphens." });
        }

        // Check if subdomain is already taken by another organization
        if (subdomain) {
          const existingOrg = await storage.getOrganizationBySubdomain(subdomain);
          if (existingOrg && existingOrg.id !== user.organizationId) {
            return res.status(400).json({ message: "This subdomain is already taken. Please choose another." });
          }
        }

        // Update organization with new subdomain
        await storage.updateOrganization(user.organizationId, { subdomain });
      }

      const config = await storage.updateWhitelabelConfig(user.organizationId, {
        organizationId: user.organizationId,
        appName,
        companyName,
        removePlatformBranding,
        supportUrl,
        documentationUrl,
        logoUrl,
        faviconUrl,
      });

      res.json(config);
    } catch (error) {
      console.error("Error updating whitelabel config:", error);
      res.status(500).json({ message: "Failed to update whitelabel configuration" });
    }
  });

  // Logo upload endpoint
  app.post("/api/whitelabel/upload-logo", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user || !user.organizationId) {
        return res.status(403).json({ message: "User must belong to an organization" });
      }

      // Check if user's organization is an agency
      const organization = await storage.getOrganization(user.organizationId);
      if (!organization || organization.organizationType !== "agency") {
        return res.status(403).json({ message: "Whitelabel is only available for agencies" });
      }

      // Check if user has permission
      // Allow any user in an agency organization to modify whitelabel
      // (agencies should be able to customize their whitelabel regardless of role)

      // For now, we'll store base64 encoded images directly
      // In production, you'd want to use cloud storage like S3 or Google Cloud Storage
      const { logo, type } = req.body; // type: "logo" or "favicon"
      
      if (!logo || !type) {
        return res.status(400).json({ message: "Logo data and type are required" });
      }

      const updateData = type === "favicon" 
        ? { faviconUrl: logo }
        : { logoUrl: logo };

      const config = await storage.updateWhitelabelConfig(user.organizationId, updateData);
      
      res.json({ success: true, url: type === "favicon" ? config.faviconUrl : config.logoUrl });
    } catch (error) {
      console.error("Error uploading logo:", error);
      res.status(500).json({ message: "Failed to upload logo" });
    }
  });

  // Analytics routes
  app.get("/api/analytics/organization", isAuthenticated, checkPermission('view_analytics'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const agentId = req.query.agentId as string | undefined;
      const stats = await storage.getOrganizationStats(user.organizationId, agentId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Webhook endpoint for ElevenLabs
  app.post("/api/webhooks/elevenlabs", async (req, res) => {
    try {
      const { agent_id, duration, transcript, audio_url, cost } = req.body;

      if (!agent_id) {
        return res.status(400).json({ message: "agent_id is required" });
      }

      // Find the agent to get organization context
      // Note: This is a simplified approach - in production you might want additional verification
      const agents = await storage.getAgents(""); // This would need organization context
      const agent = agents.find(a => a.elevenLabsAgentId === agent_id);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const callLogData = insertCallLogSchema.parse({
        organizationId: agent.organizationId,
        agentId: agent.id,
        elevenLabsCallId: req.body.call_id,
        duration,
        transcript,
        audioUrl: audio_url,
        cost,
        status: "completed",
      });

      const callLog = await storage.createCallLog(callLogData);
      res.json({ message: "Webhook processed successfully", id: callLog.id });
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });

  // Payment Routes
  app.post("/api/payments/create-intent", isAuthenticated, async (req: any, res) => {
    try {
      const { packageId, amount } = req.body;
      const organizationId = req.user.organizationId;
      
      // Check if Stripe is configured
      // Since we removed the stripe module, we'll use unified payment instead
      return res.status(400).json({ 
        error: 'This endpoint has been deprecated. Please use /api/unified-payments/create-payment-intent instead.' 
      });
    } catch (error) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ error: "Failed to create payment" });
    }
  });

  app.post("/api/payments/confirm", isAuthenticated, async (req: any, res) => {
    try {
      // This endpoint has been deprecated in favor of unified payments
      return res.status(400).json({ 
        error: 'This endpoint has been deprecated. Please use unified payment endpoints instead.' 
      });
    } catch (error) {
      console.error("Error confirming payment:", error);
      res.status(500).json({ error: "Failed to confirm payment" });
    }
  });

  app.post("/api/payments/subscribe", isAuthenticated, async (req: any, res) => {
    try {
      const { priceId } = req.body;
      const organizationId = req.user.organizationId;
      const email = req.user.email;
      
      // This endpoint has been deprecated in favor of unified payments
      return res.status(400).json({ 
        error: 'This endpoint has been deprecated. Please use unified payment endpoints instead.' 
      });
    } catch (error) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ error: "Failed to create subscription" });
    }
  });

  // Stripe webhook endpoint (no auth required)
  app.post("/api/webhooks/stripe", async (req, res) => {
    try {
      // This endpoint has been deprecated in favor of unified payments
      await unifiedPayment.handleUnifiedWebhook(req, res);
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(400).json({ error: "Webhook processing failed" });
    }
  });

  // Get payment history for an organization
  app.get("/api/payments/history", isAuthenticated, async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      const paymentHistory = await storage.getPaymentHistory(organizationId);
      res.json(paymentHistory);
    } catch (error) {
      console.error("Error fetching payment history:", error);
      res.status(500).json({ error: "Failed to fetch payment history" });
    }
  });

  // ============== UNIFIED PAYMENT ROUTES ==============
  // Create Stripe Connect account for agency
  app.post("/api/unified-payments/create-connect-account", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is agency admin
      const user = await storage.getUser(req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Only agency admins can create Connect accounts" });
      }
      
      req.body.organizationId = user.organizationId;
      await unifiedPayment.createStripeConnectAccount(req, res);
    } catch (error) {
      console.error("Error creating Connect account:", error);
      res.status(500).json({ error: "Failed to create Connect account" });
    }
  });

  // Create unified payment intent with automatic revenue splitting
  app.post("/api/unified-payments/create-payment-intent", isAuthenticated, async (req: any, res) => {
    try {
      await unifiedPayment.createUnifiedPaymentIntent(req, res);
    } catch (error) {
      console.error("Error creating unified payment intent:", error);
      res.status(500).json({ error: "Failed to create payment intent" });
    }
  });

  // Confirm unified payment and execute splits
  app.post("/api/unified-payments/confirm-payment", isAuthenticated, async (req: any, res) => {
    try {
      await unifiedPayment.confirmUnifiedPayment(req, res);
    } catch (error) {
      console.error("Error confirming payment:", error);
      res.status(500).json({ error: "Failed to confirm payment" });
    }
  });

  // Create unified subscription
  app.post("/api/unified-payments/create-subscription", isAuthenticated, async (req: any, res) => {
    try {
      await unifiedPayment.createUnifiedSubscription(req, res);
    } catch (error) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ error: "Failed to create subscription" });
    }
  });

  // Get unified payment analytics
  app.get("/api/unified-payments/analytics", isAuthenticated, async (req: any, res) => {
    try {
      await unifiedPayment.getUnifiedPaymentAnalytics(req, res);
    } catch (error) {
      console.error("Error fetching payment analytics:", error);
      res.status(500).json({ error: "Failed to fetch payment analytics" });
    }
  });

  // Unified Stripe webhook endpoint (no auth required)
  app.post("/api/webhooks/unified-stripe", async (req, res) => {
    try {
      await unifiedPayment.handleUnifiedWebhook(req, res);
    } catch (error) {
      console.error("Unified webhook error:", error);
      res.status(400).json({ error: "Webhook processing failed" });
    }
  });

  // Get unified billing plans
  app.get("/api/unified-billing/plans", async (req: any, res) => {
    try {
      const { organizationType } = req.query;
      const plans = await storage.getUnifiedBillingPlans(organizationType);
      res.json(plans);
    } catch (error) {
      console.error("Error fetching unified billing plans:", error);
      res.status(500).json({ error: "Failed to fetch billing plans" });
    }
  });

  // Get unified subscriptions for an organization
  app.get("/api/unified-billing/subscriptions", isAuthenticated, async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      const subscriptions = await storage.getUnifiedSubscriptions(organizationId);
      res.json(subscriptions);
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      res.status(500).json({ error: "Failed to fetch subscriptions" });
    }
  });
  // ============== END UNIFIED PAYMENT ROUTES ==============

  // Generate WebRTC conversation token (new ElevenLabs 2025 feature)
  app.post("/api/playground/webrtc-token", isAuthenticated, checkPermission('access_playground'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { agentId } = req.body;
      if (!agentId) {
        return res.status(400).json({ message: "Agent ID is required" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const decryptedKey = decryptApiKey(integration.apiKey);

      try {
        // Get WebRTC conversation token from ElevenLabs (2025 API)
        const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-webrtc-token?agent_id=${agentId}`, {
          method: "GET",
          headers: {
            "xi-api-key": decryptedKey,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
        }

        const tokenData = await response.json();
        res.json({
          conversationToken: tokenData.conversation_token,
          connectionType: "webrtc",
          message: "WebRTC token generated successfully"
        });
      } catch (error: any) {
        console.error("Error generating WebRTC token:", error);
        res.status(500).json({ message: `Failed to generate WebRTC token: ${error.message}` });
      }
    } catch (error) {
      console.error("Error in WebRTC token endpoint:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Playground - Start ElevenLabs session (supports both WebSocket and WebRTC)
  app.post("/api/playground/start-session", isAuthenticated, checkPermission('access_playground'), async (req: any, res) => {
    try {
      const { agentId, connectionType = "webrtc" } = req.body; // Default to WebRTC (2025 standard)
      const userId = req.user.id;
      
      console.log("Starting playground session:");
      console.log("  Connection Type:", connectionType);

      if (!agentId) {
        return res.status(400).json({ message: "Agent ID is required" });
      }

      // Validate connection type
      if (!['websocket', 'webrtc'].includes(connectionType)) {
        return res.status(400).json({ message: "Connection type must be 'websocket' or 'webrtc'" });
      }

      // Get user and organization
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get ElevenLabs API key
      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || integration.status !== "ACTIVE") {
        return res.status(400).json({ message: "VoiceAI integration not configured or inactive. Please configure your API key in the Integrations tab." });
      }

      const apiKey = decryptApiKey(integration.apiKey);

      // First, verify the agent exists in our database and user has access
      const agent = await storage.getAgent(agentId, user.organizationId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found in database" });
      }

      // Check if user has access to this agent
      if (!user.isAdmin && user.permissions?.indexOf('manage_all_agents') === -1) {
        // Get agents assigned to this user
        const userAgents = await storage.getAgentsForUser(userId, user.organizationId);
        const assignedAgentIds = userAgents.map(a => a.id);
        if (!assignedAgentIds.includes(agentId)) {
          return res.status(403).json({ message: "You don't have access to this agent" });
        }
      }

      // Use the ElevenLabs agent ID from the database
      const elevenLabsAgentId = agent.elevenLabsAgentId;

      let url, expectedField;
      if (connectionType === 'webrtc') {
        // Use new WebRTC token endpoint (2025)
        url = `https://api.elevenlabs.io/v1/convai/conversation/get-webrtc-token?agent_id=${elevenLabsAgentId}`;
        expectedField = 'conversation_token';
      } else {
        // Use legacy WebSocket signed URL
        url = `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${elevenLabsAgentId}`;
        expectedField = 'signed_url';
      }
      
      console.log("Calling VoiceAI API:", url);
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json"
        }
      });

      const responseText = await response.text();
      
      if (!response.ok) {
        console.error("ElevenLabs API error:");
        console.error("  Status:", response.status);
        console.error("  Response:", responseText);
        console.error("  Agent ID sent:", elevenLabsAgentId);
        
        // Parse error message
        let errorMessage = "Failed to start conversation session";
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.detail?.message) {
            errorMessage = errorData.detail.message;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          errorMessage = responseText || `ElevenLabs API returned ${response.status}`;
        }
        
        // Provide specific error messages
        if (response.status === 401) {
          errorMessage = "Invalid API key. Please check your ElevenLabs API key in the Integrations tab.";
        } else if (response.status === 404) {
          errorMessage = "Agent not found. Please verify the agent ID is correct.";
        } else if (response.status === 403) {
          errorMessage = "Access denied. Your API key may not have permission to access this agent.";
        }
        
        return res.status(response.status).json({ 
          message: errorMessage
        });
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse ElevenLabs response:", responseText);
        return res.status(500).json({ message: "Invalid response from ElevenLabs API" });
      }
      
      console.log("ElevenLabs response:", data);
      
      // Validate the response has the required fields
      if (!data[expectedField]) {
        console.error(`No ${expectedField} in response:`, data);
        return res.status(500).json({ message: `Invalid response from ElevenLabs API: missing ${expectedField}` });
      }
      
      // Return connection details based on type
      if (connectionType === 'webrtc') {
        res.json({ 
          conversationToken: data.conversation_token,
          connectionType: 'webrtc',
          sessionId: data.conversation_id || null,
          message: "WebRTC session ready"
        });
      } else {
        res.json({ 
          signedUrl: data.signed_url,
          connectionType: 'websocket',
          sessionId: data.conversation_id || null,
          message: "WebSocket session ready"
        });
      }
    } catch (error: any) {
      console.error("Error starting playground session:", error);
      res.status(500).json({ 
        message: error.message || "Failed to start session"
      });
    }
  });

  // ==========================================
  // CONVERSATIONAL AI ENDPOINTS (FULL SYNC)
  // ==========================================

  // Conversations API - List all conversations
  app.get("/api/convai/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { agent_id, user_id, page = 1, limit = 20 } = req.query;
      
      // Build query parameters
      const queryParams = new URLSearchParams();
      if (agent_id) queryParams.append('agent_id', agent_id);
      if (user_id) queryParams.append('user_id', user_id);
      queryParams.append('page', page.toString());
      queryParams.append('limit', limit.toString());

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations?${queryParams}`,
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: `Failed to fetch conversations: ${error.message}` });
    }
  });

  // Get conversation details
  app.get("/api/convai/conversations/:conversation_id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { conversation_id } = req.params;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${conversation_id}`,
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching conversation details:", error);
      res.status(500).json({ message: `Failed to fetch conversation details: ${error.message}` });
    }
  });

  // Send conversation feedback
  app.post("/api/convai/conversations/:conversation_id/feedback", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { conversation_id } = req.params;
      const { feedback } = req.body;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${conversation_id}/feedback`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ feedback }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error sending feedback:", error);
      res.status(500).json({ message: `Failed to send feedback: ${error.message}` });
    }
  });

  // Tools API - Create custom tool
  app.post("/api/convai/tools", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const toolData = req.body;

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/tools",
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(toolData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error creating tool:", error);
      res.status(500).json({ message: `Failed to create tool: ${error.message}` });
    }
  });

  // List custom tools
  app.get("/api/convai/tools", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/tools",
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching tools:", error);
      res.status(500).json({ message: `Failed to fetch tools: ${error.message}` });
    }
  });

  // Get tool details
  app.get("/api/convai/tools/:tool_id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { tool_id } = req.params;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/tools/${tool_id}`,
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching tool details:", error);
      res.status(500).json({ message: `Failed to fetch tool details: ${error.message}` });
    }
  });

  // Update tool
  app.patch("/api/convai/tools/:tool_id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { tool_id } = req.params;
      const updateData = req.body;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/tools/${tool_id}`,
        {
          method: "PATCH",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error updating tool:", error);
      res.status(500).json({ message: `Failed to update tool: ${error.message}` });
    }
  });

  // Delete tool
  app.delete("/api/convai/tools/:tool_id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { tool_id } = req.params;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/tools/${tool_id}`,
        {
          method: "DELETE",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      res.json({ message: "Tool deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting tool:", error);
      res.status(500).json({ message: `Failed to delete tool: ${error.message}` });
    }
  });










  // Widget API - Get widget configuration
  app.get("/api/convai/widget", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      // Return a default widget configuration
      // Note: ElevenLabs doesn't have a dedicated widget API endpoint
      // Widget configuration would typically be part of agent configuration
      const widgetConfig = {
        enabled: false,
        theme: {
          primary_color: '#6366f1',
          secondary_color: '#8b5cf6',
          background_color: '#ffffff',
          text_color: '#1f2937',
          font_family: 'Inter, sans-serif',
          border_radius: 12,
        },
        position: {
          horizontal: 'right',
          vertical: 'bottom',
          offset_x: 20,
          offset_y: 20,
        },
        size: {
          width: 400,
          height: 600,
          mobile_width: 320,
          mobile_height: 500,
        },
        behavior: {
          auto_open: false,
          auto_open_delay: 3000,
          close_on_outside_click: true,
          remember_state: true,
          expandable: true,
        },
        branding: {
          title: 'AI Assistant',
          subtitle: 'How can I help you today?',
          welcome_message: 'Hello! I\'m here to assist you with any questions you might have.',
          placeholder_text: 'Type your message...',
        },
      };

      res.json(widgetConfig);
    } catch (error: any) {
      console.error("Error fetching widget configuration:", error);
      res.status(500).json({ message: `Failed to fetch widget: ${error.message}` });
    }
  });

  // Create widget avatar
  app.post("/api/convai/widget/avatar", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      // Return a mock response for avatar creation
      // Note: ElevenLabs doesn't have a dedicated widget avatar API endpoint
      const avatarData = req.body;
      
      // Mock response with the provided avatar data
      const avatarResponse = {
        ...avatarData,
        id: `avatar_${Date.now()}`,
        created_at: new Date().toISOString(),
        status: 'active'
      };

      res.json(avatarResponse);
    } catch (error: any) {
      console.error("Error creating widget avatar:", error);
      res.status(500).json({ message: `Failed to create avatar: ${error.message}` });
    }
  });

  // Workspace API - Get settings
  app.get("/api/convai/workspace/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/workspace/settings",
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching workspace settings:", error);
      res.status(500).json({ message: `Failed to fetch settings: ${error.message}` });
    }
  });

  // Update workspace settings
  app.patch("/api/convai/workspace/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const settingsData = req.body;

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/workspace/settings",
        {
          method: "PATCH",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(settingsData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error updating workspace settings:", error);
      res.status(500).json({ message: `Failed to update settings: ${error.message}` });
    }
  });

  // Get workspace secrets
  app.get("/api/convai/workspace/secrets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/workspace/secrets",
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching workspace secrets:", error);
      res.status(500).json({ message: `Failed to fetch secrets: ${error.message}` });
    }
  });

  // Create workspace secret
  app.post("/api/convai/workspace/secrets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const secretData = req.body;

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/workspace/secrets",
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(secretData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error creating workspace secret:", error);
      res.status(500).json({ message: `Failed to create secret: ${error.message}` });
    }
  });

  // Delete workspace secret
  app.delete("/api/convai/workspace/secrets/:secret_id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { secret_id } = req.params;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/workspace/secrets/${secret_id}`,
        {
          method: "DELETE",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      res.json({ message: "Secret deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting workspace secret:", error);
      res.status(500).json({ message: `Failed to delete secret: ${error.message}` });
    }
  });

  // Tests API - Create agent test
  app.post("/api/convai/tests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const testData = req.body;

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/tests",
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(testData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error creating test:", error);
      res.status(500).json({ message: `Failed to create test: ${error.message}` });
    }
  });

  // List agent tests
  app.get("/api/convai/tests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { agent_id } = req.query;

      const queryParams = new URLSearchParams();
      if (agent_id) queryParams.append('agent_id', agent_id);

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/tests?${queryParams}`,
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching tests:", error);
      res.status(500).json({ message: `Failed to fetch tests: ${error.message}` });
    }
  });

  // Get test details
  app.get("/api/convai/tests/:test_id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { test_id } = req.params;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/tests/${test_id}`,
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching test details:", error);
      res.status(500).json({ message: `Failed to fetch test details: ${error.message}` });
    }
  });

  // Delete test
  app.delete("/api/convai/tests/:test_id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { test_id } = req.params;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/tests/${test_id}`,
        {
          method: "DELETE",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      res.json({ message: "Test deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting test:", error);
      res.status(500).json({ message: `Failed to delete test: ${error.message}` });
    }
  });

  // Twilio Integration - Make outbound call
  app.post("/api/convai/twilio/outbound-call", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const callData = req.body;

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/twilio/outbound-call",
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(callData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error making Twilio outbound call:", error);
      res.status(500).json({ message: `Failed to make call: ${error.message}` });
    }
  });

  // SIP Trunk - List SIP trunks
  app.get("/api/convai/sip-trunks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/sip-trunks",
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching SIP trunks:", error);
      res.status(500).json({ message: `Failed to fetch SIP trunks: ${error.message}` });
    }
  });

  // Create SIP trunk
  app.post("/api/convai/sip-trunks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const sipData = req.body;

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/sip-trunks",
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(sipData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error creating SIP trunk:", error);
      res.status(500).json({ message: `Failed to create SIP trunk: ${error.message}` });
    }
  });

  // Get SIP trunk details
  app.get("/api/convai/sip-trunks/:trunk_id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { trunk_id } = req.params;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/sip-trunks/${trunk_id}`,
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching SIP trunk details:", error);
      res.status(500).json({ message: `Failed to fetch SIP trunk: ${error.message}` });
    }
  });

  // Update SIP trunk
  app.patch("/api/convai/sip-trunks/:trunk_id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { trunk_id } = req.params;
      const updateData = req.body;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/sip-trunks/${trunk_id}`,
        {
          method: "PATCH",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error updating SIP trunk:", error);
      res.status(500).json({ message: `Failed to update SIP trunk: ${error.message}` });
    }
  });

  // Delete SIP trunk
  app.delete("/api/convai/sip-trunks/:trunk_id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { trunk_id } = req.params;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/sip-trunks/${trunk_id}`,
        {
          method: "DELETE",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      res.json({ message: "SIP trunk deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting SIP trunk:", error);
      res.status(500).json({ message: `Failed to delete SIP trunk: ${error.message}` });
    }
  });

  // LLM Usage API - Get LLM usage statistics
  app.get("/api/convai/llm-usage", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const { start_date, end_date } = req.query;

      const queryParams = new URLSearchParams();
      if (start_date) queryParams.append('start_date', start_date);
      if (end_date) queryParams.append('end_date', end_date);

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/llm-usage?${queryParams}`,
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching LLM usage:", error);
      res.status(500).json({ message: `Failed to fetch LLM usage: ${error.message}` });
    }
  });

  // MCP (Model Context Protocol) API - Get MCP status
  app.get("/api/convai/mcp/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/mcp/status",
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching MCP status:", error);
      res.status(500).json({ message: `Failed to fetch MCP status: ${error.message}` });
    }
  });

  // MCP - Configure MCP settings
  app.post("/api/convai/mcp/configure", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const integration = await storage.getIntegration(user.organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ message: "ElevenLabs API key not configured" });
      }

      const apiKey = decryptApiKey(integration.apiKey);
      const configData = req.body;

      const response = await fetch(
        "https://api.elevenlabs.io/v1/convai/mcp/configure",
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(configData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error configuring MCP:", error);
      res.status(500).json({ message: `Failed to configure MCP: ${error.message}` });
    }
  });

  // ==========================================
  // END OF CONVERSATIONAL AI ENDPOINTS
  // ==========================================

  // Batch calling routes
  app.get("/api/batch-calls", isAuthenticated, checkPermission('manage_agents'), async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      const batchCalls = await storage.getBatchCalls(organizationId);
      res.json(batchCalls);
    } catch (error: any) {
      console.error("Error fetching batch calls:", error);
      res.status(500).json({ error: error.message || "Failed to fetch batch calls" });
    }
  });

  app.post("/api/batch-calls", isAuthenticated, checkPermission('manage_agents'), async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      const userId = req.user.id;
      
      const batchCallData = insertBatchCallSchema.parse({
        ...req.body,
        organizationId,
        userId,
        status: "draft",
      });

      const batchCall = await storage.createBatchCall(batchCallData);
      res.json(batchCall);
    } catch (error: any) {
      console.error("Error creating batch call:", error);
      if (error.name === "ZodError") {
        res.status(400).json({ error: "Invalid batch call data", details: error.errors });
      } else {
        res.status(500).json({ error: error.message || "Failed to create batch call" });
      }
    }
  });

  app.get("/api/batch-calls/:id", isAuthenticated, checkPermission('manage_agents'), async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      const batchCall = await storage.getBatchCall(req.params.id, organizationId);
      
      if (!batchCall) {
        return res.status(404).json({ error: "Batch call not found" });
      }

      // Get recipients for this batch call
      const recipients = await storage.getBatchCallRecipients(req.params.id);
      
      res.json({ ...batchCall, recipients });
    } catch (error: any) {
      console.error("Error fetching batch call:", error);
      res.status(500).json({ error: error.message || "Failed to fetch batch call" });
    }
  });

  app.post("/api/batch-calls/:id/recipients", isAuthenticated, async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      const batchCall = await storage.getBatchCall(req.params.id, organizationId);
      
      if (!batchCall) {
        return res.status(404).json({ error: "Batch call not found" });
      }

      // Parse recipients from request body
      const { recipients } = req.body;
      if (!Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: "No recipients provided" });
      }

      // Create recipient records
      const recipientData = recipients.map((r: any) => {
        // Extract phone number and store all data as variables
        const phoneNumber = r.phone_number || r.phoneNumber;
        if (!phoneNumber) {
          throw new Error("Each recipient must have a phone_number field");
        }
        return {
          batchCallId: req.params.id,
          phoneNumber,
          variables: r, // Store all fields including overrides
        };
      });

      const createdRecipients = await storage.createBatchCallRecipients(recipientData);
      
      // Update batch call with total recipients count
      await storage.updateBatchCall(req.params.id, organizationId, {
        totalRecipients: createdRecipients.length,
      });

      res.json({ message: "Recipients added successfully", count: createdRecipients.length });
    } catch (error: any) {
      console.error("Error adding recipients:", error);
      res.status(500).json({ error: error.message || "Failed to add recipients" });
    }
  });

  app.post("/api/batch-calls/:id/test", isAuthenticated, async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required for test call" });
      }
      
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

      // Get agent details
      const agent = await storage.getAgent(batchCall.agentId, organizationId);
      if (!agent) {
        return res.status(400).json({ error: "Agent not found" });
      }

      // Get phone number details
      const phoneNumberRecord = await storage.getPhoneNumber(batchCall.phoneNumberId || "", organizationId);
      if (!phoneNumberRecord) {
        return res.status(400).json({ error: "Phone number not found" });
      }

      // Make a single test call using ElevenLabs conversational AI API
      // This creates a single outbound call for testing
      const payload = {
        agent_id: agent.elevenLabsAgentId,
        phone_number_id: phoneNumberRecord.elevenLabsPhoneId,
        customer_phone_number: phoneNumber,
        initial_message: "This is a test call for your batch calling campaign.",
      };

      // Call ElevenLabs to initiate the test call
      const response = await callElevenLabsAPI(
        apiKey,
        "/v1/convai/conversations",
        "POST",
        payload,
        integration.id
      );

      res.json({ 
        message: "Test call initiated successfully", 
        conversationId: response.conversation_id || response.id,
        status: response.status
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
      
      // TODO: Send invitation email
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
      
      // TODO: Resend invitation email
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
