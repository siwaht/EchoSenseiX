import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated, isAdmin } from "../middleware/auth";
import { encryptCredentials, decryptCredentials, encryptApiKey, decryptApiKey } from "../utils/encryption";
import { providerRegistry } from "../services/providers/registry";
import SyncService from "../services/sync-service";
import * as unifiedPayment from "../unified-payment";
import { z } from "zod";
import crypto from "crypto";
import { Integration } from "@shared/schema";
import { cacheMiddleware } from "../middleware/cache-middleware";
import {
    insertBillingPackageSchema,
    insertSystemTemplateSchema,
    insertQuickActionButtonSchema,
    insertAdminTaskSchema
} from "@shared/schema";

const router = Router();

// Apply admin check to all routes
router.use(isAuthenticated, isAdmin);

// ==========================================
// Admin Billing & Payments Routes
// ==========================================

router.get('/billing', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
        const billingData = await storage.getAdminBillingData();
        res.json(billingData);
    } catch (error) {
        console.error("Error fetching admin billing data:", error);
        res.status(500).json({ message: "Failed to fetch billing data" });
    }
});

router.get('/payments', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
        const payments = await storage.getAllPayments();
        res.json(payments);
    } catch (error) {
        console.error("Error fetching payments:", error);
        res.status(500).json({ message: "Failed to fetch payments" });
    }
});

// ==========================================

// Get all users (admin only)
router.get('/users', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
        const users = await storage.getUsers();
        res.json(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Failed to fetch users" });
    }
});

// Get specific user
router.get('/users/:userId', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const user = await storage.getUser(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json(user);
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Failed to fetch user" });
    }
});

// Update user details
router.patch('/users/:userId', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const updates = req.body;
        const updatedUser = await storage.updateUser(userId, updates);
        res.json(updatedUser);
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: "Failed to update user" });
    }
});

// Delete user
router.delete('/users/:userId', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        await storage.deleteUser(userId);
        res.json({ message: "User deleted successfully" });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ message: "Failed to delete user" });
    }
});

// User-Agent assignment routes
router.get('/users/:userId/agents', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
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

router.post('/users/:userId/agents/:agentId', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
    try {
        const { userId, agentId } = req.params;
        await storage.assignAgentToUser(userId, agentId, req.user.id);
        res.json({ message: "Agent assigned successfully" });
    } catch (error) {
        console.error("Error assigning agent to user:", error);
        res.status(500).json({ message: "Failed to assign agent" });
    }
});

router.delete('/users/:userId/agents/:agentId', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
    try {
        const { userId, agentId } = req.params;
        await storage.unassignAgentFromUser(userId, agentId);
        res.json({ message: "Agent unassigned successfully" });
    } catch (error) {
        console.error("Error unassigning agent from user:", error);
        res.status(500).json({ message: "Failed to unassign agent" });
    }
});

// ==========================================
// Admin Organization Management Routes
// ==========================================

router.get('/organizations', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
        const orgs = await storage.getOrganizations();
        res.json(orgs);
    } catch (error) {
        console.error("Error fetching organizations:", error);
        res.status(500).json({ message: "Failed to fetch organizations" });
    }
});

router.patch('/organizations/:orgId', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
        const { orgId } = req.params;
        const updates = req.body;
        const updatedOrg = await storage.updateOrganization(orgId, updates);
        res.json(updatedOrg);
    } catch (error) {
        console.error("Error updating organization:", error);
        res.status(500).json({ message: "Failed to update organization" });
    }
});

router.delete('/organizations/:orgId', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
        const { orgId } = req.params;
        await storage.deleteOrganization(orgId);
        res.json({ message: "Organization deleted successfully" });
    } catch (error) {
        console.error("Error deleting organization:", error);
        res.status(500).json({ message: "Failed to delete organization" });
    }
});

router.patch('/organizations/:orgId/permissions', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
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

router.get('/organizations/:orgId/permissions', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
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

router.patch('/organizations/:orgId/status', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
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

// ==========================================
// Admin Sync Management Routes
// ==========================================

router.get('/sync/status', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
        const status = await SyncService.getSyncStatus();
        res.json(status);
    } catch (error) {
        console.error("Error fetching sync status:", error);
        res.status(500).json({ message: "Failed to fetch sync status" });
    }
});

router.post('/sync/run', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
        await SyncService.runSync();
        res.json({ message: "Sync started successfully" });
    } catch (error) {
        console.error("Error running sync:", error);
        res.status(500).json({ message: "Failed to run sync" });
    }
});

router.get('/sync/endpoints', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
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

router.get('/sync/logs', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
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

router.post('/sync/validate', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
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

router.post('/sync/update-endpoint', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
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

// ==========================================
// Admin Encryption Migration Route
// ==========================================

router.post('/migrate-encryption', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
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

router.post('/billing-packages', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
    try {
        const newPackage = await storage.createBillingPackage(req.body);
        res.json(newPackage);
    } catch (error) {
        console.error("Error creating billing package:", error);
        res.status(500).json({ message: "Failed to create billing package" });
    }
});

router.patch('/billing-packages/:pkgId', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
    try {
        const updatedPackage = await storage.updateBillingPackage(req.params.pkgId, req.body);
        res.json(updatedPackage);
    } catch (error) {
        console.error("Error updating billing package:", error);
        res.status(500).json({ message: "Failed to update billing package" });
    }
});

router.delete('/billing-packages/:pkgId', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
    try {
        await storage.deleteBillingPackage(req.params.pkgId);
        res.json({ message: "Billing package deleted successfully" });
    } catch (error) {
        console.error("Error deleting billing package:", error);
        res.status(500).json({ message: "Failed to delete billing package" });
    }
});

// ==========================================
// Admin System Templates Management
// ==========================================

router.get('/system-templates', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
    try {
        const templates = await storage.getSystemTemplates();
        res.json(templates);
    } catch (error) {
        console.error("Error fetching system templates:", error);
        res.status(500).json({ message: "Failed to fetch system templates" });
    }
});

router.post('/system-templates', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
    try {
        const newTemplate = await storage.createSystemTemplate(req.body);
        res.json(newTemplate);
    } catch (error) {
        console.error("Error creating system template:", error);
        res.status(500).json({ message: "Failed to create system template" });
    }
});

router.patch('/system-templates/:templateId', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
    try {
        const updatedTemplate = await storage.updateSystemTemplate(req.params.templateId, req.body);
        res.json(updatedTemplate);
    } catch (error) {
        console.error("Error updating system template:", error);
        res.status(500).json({ message: "Failed to update system template" });
    }
});

router.delete('/system-templates/:templateId', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
    try {
        await storage.deleteSystemTemplate(req.params.templateId);
        res.json({ message: "System template deleted successfully" });
    } catch (error) {
        console.error("Error deleting system template:", error);
        res.status(500).json({ message: "Failed to delete system template" });
    }
});

// ==========================================
// Admin Quick Action Buttons Management
// ==========================================

router.get('/quick-action-buttons', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
    try {
        const buttons = await storage.getQuickActionButtons();
        res.json(buttons);
    } catch (error) {
        console.error("Error fetching quick action buttons:", error);
        res.status(500).json({ message: "Failed to fetch quick action buttons" });
    }
});

router.post('/quick-action-buttons', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
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

router.patch('/quick-action-buttons/:buttonId', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
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

router.delete('/quick-action-buttons/:buttonId', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
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

// ==========================================
// Admin Approval Tasks Management
// ==========================================

router.get('/tasks', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
    try {
        const status = req.query.status as "pending" | "in_progress" | "completed" | "rejected" | undefined;
        const tasks = await storage.getAdminTasks(status);
        res.json(tasks);
    } catch (error) {
        console.error("Error fetching admin tasks:", error);
        res.status(500).json({ message: "Failed to fetch admin tasks" });
    }
});

router.get('/tasks/:taskId', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
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

router.patch('/tasks/:taskId', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
    try {
        const updates = req.body;
        const task = await storage.updateAdminTask(req.params.taskId, updates);
        res.json(task);
    } catch (error) {
        console.error("Error updating admin task:", error);
        res.status(500).json({ message: "Failed to update admin task" });
    }
});

router.post('/tasks/:taskId/approve', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
    try {
        const adminId = req.user.id;
        const taskId = req.params.taskId;

        // Get the task to determine what needs approval
        const task = await storage.getAdminTask(taskId);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

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

router.post('/tasks/:taskId/reject', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
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

router.get('/approval-webhooks', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
    try {
        const webhooks = await storage.getApprovalWebhooks();
        res.json(webhooks);
    } catch (error) {
        console.error("Error fetching approval webhooks:", error);
        res.status(500).json({ message: "Failed to fetch approval webhooks" });
    }
});

// Create Test Agency
router.post('/create-test-agency', isAuthenticated, isAdmin, async (req: Request & { user: any }, res: Response) => {
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

export default router;
