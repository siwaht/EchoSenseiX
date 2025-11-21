import { Router } from "express";
import { isAuthenticated } from "../middleware/auth";
import crypto from "crypto";

const router = Router();

// Testing endpoints (simplified implementation)
// Store test scenarios in memory for now (can be moved to database later)
// Note: These Maps will be reset on server restart. Ideally, use database.
const testScenarios = new Map<string, any[]>();
const testResults = new Map<string, any[]>();

// Get test scenarios for an agent
router.get("/scenarios", isAuthenticated, async (req: any, res) => {
    try {
        const { agentId } = req.query;
        if (!agentId) {
            return res.status(400).json({ error: "Agent ID is required" });
        }

        const scenarios = testScenarios.get(agentId as string) || [];
        res.json(scenarios);
    } catch (error) {
        console.error("Error fetching test scenarios:", error);
        res.status(500).json({ error: "Failed to fetch test scenarios" });
    }
});

// Create a test scenario
router.post("/scenarios", isAuthenticated, async (req: any, res) => {
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
router.delete("/scenarios/:id", isAuthenticated, async (req: any, res) => {
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
router.post("/run", isAuthenticated, async (req: any, res) => {
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
router.get("/results", isAuthenticated, async (req: any, res) => {
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

export default router;
