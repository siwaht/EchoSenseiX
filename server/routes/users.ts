import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../middleware/auth";
import { hashPassword } from "../auth";
import EmailService from "../services/email-service";
// import { z } from "zod";
import crypto from "crypto";

const router = Router();

// In-memory storage for invitations and activity logs (should be moved to database in production)
// Note: These Maps will be reset on server restart. Ideally, use database.
// const userInvitations = new Map<string, any[]>();
const activityLogs = new Map<string, any[]>();

// ==========================================
// User Management Routes (Non-Admin)
// ==========================================

// Get current user details
router.get('/users', isAuthenticated, async (req: any, res) => {
    try {
        const organizationId = req.user.organizationId;
        const currentUser = await storage.getUser(req.user.id);

        // If admin, return all users (or filtered by org if agency)
        // The original code had logic for "Get users in the same organization (for managers)"
        // But also "Get current user details" at /api/users (which conflicts if not careful)
        // Actually, /api/users usually returns list. /api/auth/user returns current.
        // Let's check the original code.
        // Original code: app.get('/api/users', isAuthenticated, async (req: any, res) => { ... logic for managers ... })
        // And app.get("/api/auth/user") for current user.

        // So this route should be for listing users (for managers/admins)

        // Only admins can view all users (or managers for their org)
        if (!currentUser?.isAdmin && currentUser?.role !== 'manager') {
            return res.status(403).json({ message: "Insufficient permissions" });
        }

        const allUsers = await storage.getAllUsers();
        // Filter by organization
        const orgUsers = allUsers.filter(u => u.organizationId === organizationId);

        // Add role and status fields if not present
        const enrichedUsers = orgUsers.map(user => ({
            ...user,
            role: user.role || (user.isAdmin ? 'admin' : 'user'),
            status: user.status || 'active',
            organizationName: 'Organization',
        }));

        return res.json(enrichedUsers);
    } catch (error) {
        console.error("Error fetching users:", error);
        return res.status(500).json({ message: "Failed to fetch users" });
    }
});

// Update user details
router.patch('/users/:userId', isAuthenticated, async (req: any, res) => {
    try {
        const { userId } = req.params;
        const organizationId = req.user.organizationId;
        const currentUser = await storage.getUser(req.user.id);

        // Check permissions
        // Users can update themselves? Original code said "Only admins can update users" in the manager section.
        // But there was also a general update.
        // Let's allow self-update or manager/admin update.

        if (req.user.id !== parseInt(userId)) {
            if (!currentUser?.isAdmin && currentUser?.role !== 'manager') {
                return res.status(403).json({ message: "Insufficient permissions" });
            }
            // Verify target user belongs to same org
            const targetUser = await storage.getUser(userId);
            if (!targetUser || targetUser.organizationId !== organizationId) {
                return res.status(404).json({ message: "User not found" });
            }
        }

        const updates = { ...req.body };
        if (updates.password) {
            updates.password = await hashPassword(updates.password);
        }

        const updatedUser = await storage.updateUser(userId, updates);

        // Log activity
        const log = {
            id: crypto.randomBytes(16).toString('hex'),
            userId: req.user.id,
            userEmail: currentUser?.email,
            action: 'updated user',
            details: `Updated user ${userId}`,
            timestamp: new Date().toISOString(),
        };
        const logs = activityLogs.get(organizationId) || [];
        logs.unshift(log);
        activityLogs.set(organizationId, logs.slice(0, 100));

        return res.json(updatedUser);
    } catch (error) {
        console.error("Error updating user:", error);
        return res.status(500).json({ message: "Failed to update user" });
    }
});

// Create new user (e.g. by agency admin/manager)
router.post('/users/create', isAuthenticated, async (req: any, res) => {
    try {
        const organizationId = req.user.organizationId;
        const currentUser = await storage.getUser(req.user.id);

        // Only admins and managers can create users
        if (!currentUser?.isAdmin && !currentUser?.permissions?.includes('manage_users') && currentUser?.role !== 'manager') {
            return res.status(403).json({ message: "Forbidden: Insufficient permissions to create users" });
        }

        const { email, firstName, lastName, password, role, permissions } = req.body;

        // Basic validation
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const existingUser = await storage.getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: "Email already exists" });
        }

        const hashedPassword = await hashPassword(password);
        const newUser = await storage.createUser({
            email,
            firstName,
            lastName,
            password: hashedPassword,
            organizationId: organizationId,
            role: role || 'user',
            isAdmin: false,
            permissions: permissions || []
        });

        return res.status(201).json(newUser);
    } catch (error) {
        console.error("Error creating user:", error);
        return res.status(500).json({ message: "Failed to create user" });
    }
});

router.delete('/users/:userId', isAuthenticated, async (req: any, res) => {
    try {
        const organizationId = req.user.organizationId;
        const currentUser = await storage.getUser(req.user.id);

        // Only admins/managers can delete users
        if (!currentUser?.isAdmin && currentUser?.role !== 'manager') {
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
            userEmail: currentUser?.email,
            action: 'deleted user',
            details: `Deleted ${targetUser.email}`,
            timestamp: new Date().toISOString(),
        };
        const logs = activityLogs.get(organizationId) || [];
        logs.unshift(log);
        activityLogs.set(organizationId, logs);

        return res.json({ message: "User deleted successfully" });
    } catch (error) {
        console.error("Error deleting user:", error);
        return res.status(500).json({ message: "Failed to delete user" });
    }
});

// ==========================================
// Agency User Management Routes
// ==========================================

router.get("/agency/users", isAuthenticated, async (req: any, res) => {
    try {
        const users = await storage.getOrganizationUsers(req.user.organizationId);
        return res.json(users);
    } catch (error) {
        console.error("Error fetching agency users:", error);
        return res.status(500).json({ message: "Failed to fetch users" });
    }
});

router.patch("/agency/users/:userId", isAuthenticated, async (req: any, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body;

        // Verify user belongs to agency
        const targetUser = await storage.getUser(userId);
        if (!targetUser || targetUser.organizationId !== req.user.organizationId) {
            return res.status(404).json({ message: "User not found" });
        }

        const updatedUser = await storage.updateUser(userId, updates);
        return res.json(updatedUser);
    } catch (error) {
        console.error("Error updating agency user:", error);
        return res.status(500).json({ message: "Failed to update user" });
    }
});

router.delete("/agency/users/:userId", isAuthenticated, async (req: any, res) => {
    try {
        const { userId } = req.params;

        // Verify user belongs to agency
        const targetUser = await storage.getUser(userId);
        if (!targetUser || targetUser.organizationId !== req.user.organizationId) {
            return res.status(404).json({ message: "User not found" });
        }

        await storage.deleteUser(userId);
        return res.json({ message: "User deleted successfully" });
    } catch (error) {
        console.error("Error deleting agency user:", error);
        return res.status(500).json({ message: "Failed to delete user" });
    }
});

router.post("/agency/users/:userId/agents", isAuthenticated, async (req: any, res) => {
    try {
        const { userId } = req.params;
        const { agentIds } = req.body; // Expecting array of agent IDs

        // Verify user belongs to agency
        const targetUser = await storage.getUser(userId);
        if (!targetUser || targetUser.organizationId !== req.user.organizationId) {
            return res.status(404).json({ message: "User not found" });
        }

        if (Array.isArray(agentIds)) {
            for (const agentId of agentIds) {
                await storage.assignAgentToUser(userId, agentId, req.user.id);
            }
        }

        return res.json({ message: "Agents assigned successfully" });
    } catch (error) {
        console.error("Error assigning agents:", error);
        return res.status(500).json({ message: "Failed to assign agents" });
    }
});

// ==========================================
// Invitation Routes
// ==========================================

// ==========================================
// Invitation Routes
// ==========================================

router.get('/agency/invitations', isAuthenticated, async (req: any, res) => {
    try {
        const invitations = await storage.getOrganizationInvitations(req.user.organizationId);
        return res.json(invitations);
    } catch (error) {
        console.error("Error fetching invitations:", error);
        return res.status(500).json({ message: "Failed to fetch invitations" });
    }
});

router.get('/users/invitations', isAuthenticated, async (req: any, res) => {
    try {
        const organizationId = req.user.organizationId;
        const invitations = await storage.getOrganizationInvitations(organizationId);
        return res.json(invitations);
    } catch (error) {
        console.error("Error fetching invitations:", error);
        return res.status(500).json({ message: "Failed to fetch invitations" });
    }
});

router.post('/agency/invitations', isAuthenticated, async (req: any, res) => {
    try {
        const { email, role } = req.body;

        // Create invitation
        const invitation = await storage.createInvitation({
            email,
            organizationId: req.user.organizationId,
            role: role || 'user',
            invitedBy: req.user.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        });

        // Send email
        const inviteUrl = `${process.env.APP_URL}/accept-invite?token=${invitation.code}`;
        await EmailService.sendAgencyInvitation(email, {
            inviteeName: email.split('@')[0], // Fallback name
            inviterName: `${req.user.firstName} ${req.user.lastName}`,
            inviterCompany: "Agency", // Should get org name
            invitationCode: invitation.code,
            invitationType: 'agency',
            acceptUrl: inviteUrl
        });

        return res.status(201).json(invitation);
    } catch (error) {
        console.error("Error creating invitation:", error);
        return res.status(500).json({ message: "Failed to create invitation" });
    }
});

router.post('/users/invite', isAuthenticated, async (req: any, res) => {
    try {
        const organizationId = req.user.organizationId;
        const currentUser = await storage.getUser(req.user.id);

        // Only admins and managers can invite users
        if (!currentUser?.isAdmin && currentUser?.role !== 'manager') {
            return res.status(403).json({ message: "Insufficient permissions" });
        }

        const { email, role, message: _message } = req.body;

        // Check if user already exists
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.organizationId === organizationId) {
            return res.status(400).json({ message: "User already exists in organization" });
        }

        // Create invitation
        const invitation = await storage.createInvitation({
            email,
            organizationId,
            role: role || 'user',
            invitedBy: req.user.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        });

        // Log activity
        const log = {
            id: crypto.randomBytes(16).toString('hex'),
            userId: req.user.id,
            userEmail: currentUser?.email,
            action: 'invited user',
            details: `Invited ${email} as ${role}`,
            timestamp: new Date().toISOString(),
        };
        const logs = activityLogs.get(organizationId) || [];
        logs.unshift(log);
        activityLogs.set(organizationId, logs);

        // In production, send email with invitation link
        console.log(`Invitation link: ${process.env.APP_URL || 'http://localhost:5000'}/invite/${invitation.code}`);

        return res.json(invitation);
    } catch (error) {
        console.error("Error inviting user:", error);
        return res.status(500).json({ message: "Failed to invite user" });
    }
});

router.post('/users/invitations/:invitationId/resend', isAuthenticated, async (req: any, res) => {
    try {
        const invitation = await storage.getInvitation(req.params.invitationId);

        if (!invitation) {
            return res.status(404).json({ message: "Invitation not found" });
        }

        // Update expiration
        const updatedInvitation = await storage.updateInvitation(invitation.id, {
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });

        // In production, resend email
        console.log(`Resending invitation to ${invitation.email}`);

        return res.json(updatedInvitation);
    } catch (error) {
        console.error("Error resending invitation:", error);
        return res.status(500).json({ message: "Failed to resend invitation" });
    }
});

router.delete("/agency/invitations/:invitationId", isAuthenticated, async (req: any, res) => {
    try {
        const { invitationId } = req.params;
        await storage.deleteInvitation(invitationId);
        return res.json({ message: "Invitation deleted" });
    } catch (error) {
        console.error("Error deleting invitation:", error);
        return res.status(500).json({ message: "Failed to delete invitation" });
    }
});

router.delete('/users/invitations/:invitationId', isAuthenticated, async (req: any, res) => {
    try {
        await storage.deleteInvitation(req.params.invitationId);
        return res.json({ message: "Invitation cancelled successfully" });
    } catch (error) {
        console.error("Error cancelling invitation:", error);
        return res.status(500).json({ message: "Failed to cancel invitation" });
    }
});

// Public route for accepting invitation
router.post("/invitations/accept", async (req: any, res) => {
    try {
        const { token, password, firstName, lastName } = req.body;

        const invitation = await storage.getInvitationByCode(token);
        if (!invitation) {
            return res.status(404).json({ message: "Invalid or expired invitation" });
        }

        if (invitation.expiresAt && new Date() > new Date(invitation.expiresAt)) {
            return res.status(400).json({ message: "Invitation expired" });
        }

        const hashedPassword = await hashPassword(password);
        const newUser = await storage.createUser({
            email: invitation.email,
            firstName,
            lastName,
            password: hashedPassword,
            organizationId: invitation.organizationId,
            role: invitation.role,
            isAdmin: false
        });

        // Delete invitation after use
        await storage.deleteInvitation(invitation.id);

        // Log user in
        await new Promise<void>((resolve, reject) => {
            req.login(newUser, (err: any) => {
                if (err) reject(err);
                else resolve();
            });
        });
        return res.json(newUser);

    } catch (error) {
        console.error("Error accepting invitation:", error);
        return res.status(500).json({ message: "Failed to accept invitation" });
    }
});

// ==========================================
// Other User Routes
// ==========================================

// Activity logs endpoint
router.get('/users/activity-logs', isAuthenticated, async (req: any, res) => {
    try {
        const organizationId = req.user.organizationId;
        const currentUser = await storage.getUser(req.user.id);

        // Only admins and managers can view activity logs
        if (!currentUser?.isAdmin && currentUser?.role !== 'manager') {
            return res.status(403).json({ message: "Insufficient permissions" });
        }

        const logs = activityLogs.get(organizationId) || [];
        return res.json(logs);
    } catch (error) {
        console.error("Error fetching activity logs:", error);
        return res.status(500).json({ message: "Failed to fetch activity logs" });
    }
});

// User tasks - Get pending approval tasks for current user
router.get('/user/pending-approvals', isAuthenticated, async (req: any, res) => {
    try {
        // Get all pending tasks
        const allTasks = await storage.getAdminTasks("pending");

        // Filter tasks created by or related to the current user
        const userTasks = allTasks.filter(task =>
            task.requestedBy === req.user.id ||
            task.metadata?.userId === req.user.id ||
            task.metadata?.requestedBy === req.user.id
        );

        return res.json(userTasks);
    } catch (error) {
        console.error("Error fetching user pending approvals:", error);
        return res.status(500).json({ message: "Failed to fetch pending approvals" });
    }
});

// Public route to get active system templates (for all users)
router.get('/system-templates', isAuthenticated, async (_req: any, res) => {
    try {
        const templates = await storage.getSystemTemplates();
        return res.json(templates);
    } catch (error) {
        console.error("Error fetching system templates:", error);
        return res.status(500).json({ message: "Failed to fetch system templates" });
    }
});

export default router;
