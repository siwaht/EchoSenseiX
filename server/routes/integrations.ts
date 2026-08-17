import { Router } from "express";
import { storage } from "../storage";
import { providerRegistry } from "../services/providers/registry";

const router = Router();

async function listIntegrations(req: any, res: any) {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    try {
        const integrations = await storage.getIntegrations(req.user.organizationId);
        return res.json(integrations);
    } catch (error) {
        console.error("Failed to fetch integrations:", error);
        return res.status(500).json({ message: "Failed to fetch integrations" });
    }
}

// Keep both paths because the dashboard uses the root path while older clients use /all.
router.get("/", listIntegrations);
router.get("/all", listIntegrations);

// Save integration
router.post("/", async (req: any, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    try {
        const { provider = "elevenlabs", providerCategory = "tts", credentials, apiKey } = req.body;
        const normalizedCredentials = credentials || (apiKey ? { apiKey } : null);

        if (!normalizedCredentials) {
            return res.status(400).json({ message: "Missing required credentials" });
        }

        const integration = await storage.upsertIntegration({
            organizationId: req.user.organizationId,
            provider,
            providerCategory,
            credentials: normalizedCredentials,
            status: "ACTIVE",
            config: {},
            apiKey: normalizedCredentials.apiKey || normalizedCredentials.api_key || "",
        });

        return res.json(integration);
    } catch (error) {
        console.error("Save integration error:", error);
        return res.status(500).json({ message: "Failed to save integration" });
    }
});

// Test the default integration used by the integrations page.
router.post("/test", async (req: any, res) => {
    const provider = typeof req.body?.provider === "string" ? req.body.provider : "elevenlabs";
    return testIntegration({ ...req, params: { provider } }, res);
});

async function testIntegration(req: any, res: any) {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    try {
        const { provider } = req.params;
        const integration = await storage.getIntegration(req.user.organizationId, provider);

        if (!integration) {
            return res.status(404).json({ message: "Integration not found" });
        }

        try {
            const providerInstance = providerRegistry.getProvider(provider);
            await providerInstance.initialize(integration.credentials);

            if (providerInstance.healthCheck) {
                const isHealthy = await providerInstance.healthCheck();
                if (!isHealthy) throw new Error("Health check failed");
            }

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
}

router.post("/:provider/test", testIntegration);

// Delete integration
router.delete("/:provider", async (req: any, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    try {
        await storage.deleteIntegration(req.user.organizationId, req.params.provider);
        return res.json({ message: "Integration deleted" });
    } catch (error) {
        console.error("Delete integration error:", error);
        return res.status(500).json({ message: "Failed to delete integration" });
    }
});

export default router;
