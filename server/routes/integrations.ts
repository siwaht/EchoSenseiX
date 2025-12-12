import { Router } from "express";
import { storage } from "../storage";
import { providerRegistry } from "../services/providers/registry";

const router = Router();

// Get all integrations for the current organization
router.get("/all", async (req: any, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    try {
        const integrations = await storage.getIntegrations(req.user.organizationId);
        return res.json(integrations);
    } catch (error) {
        return res.status(500).json({ message: "Failed to fetch integrations" });
    }
});

// Save integration
router.post("/", async (req: any, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    try {
        const { provider, providerCategory, credentials } = req.body;

        // Basic validation
        if (!provider || !credentials) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const integration = await storage.upsertIntegration({
            organizationId: req.user.organizationId,
            provider,
            providerCategory,
            credentials,
            status: "ACTIVE",
            config: {}, // Optional config
            apiKey: credentials.apiKey || credentials.api_key || "", // Extract API key if possible
        });

        return res.json(integration);
    } catch (error) {
        console.error("Save integration error:", error);
        return res.status(500).json({ message: "Failed to save integration" });
    }
});

// Delete integration
router.delete("/:provider", async (req: any, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    try {
        const { provider } = req.params;
        await storage.deleteIntegration(req.user.organizationId, provider);
        return res.json({ message: "Integration deleted" });
    } catch (error) {
        return res.status(500).json({ message: "Failed to delete integration" });
    }
});

// Test integration
router.post("/:provider/test", async (req: any, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    try {
        const { provider } = req.params;
        const integration = await storage.getIntegration(req.user.organizationId, provider);

        if (!integration) {
            return res.status(404).json({ message: "Integration not found" });
        }

        // Try to get provider from registry and run health check if available
        try {
            const providerInstance = providerRegistry.getProvider(provider);
            // Initialize with credentials
            await providerInstance.initialize(integration.credentials);

            if (providerInstance.healthCheck) {
                const isHealthy = await providerInstance.healthCheck();
                if (!isHealthy) throw new Error("Health check failed");
            }

            // Update last tested
            await storage.updateIntegrationStatus(integration.id, "ACTIVE", new Date());

            return res.json({ message: "Connection successful" });
        } catch (registryError) {
            console.warn(`Provider ${provider} test failed:`, registryError);
            return res.status(400).json({
                message: "Connection test failed: " + (registryError instanceof Error ? registryError.message : "Unknown error")
            });
        }

    } catch (error) {
        console.error("Test integration error:", error);
        return res.status(500).json({ message: "Failed to test integration" });
    }
});

export default router;
