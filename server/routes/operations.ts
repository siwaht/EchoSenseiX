import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../middleware/auth";
import SyncService from "../services/sync-service";

const router = Router();

router.use(isAuthenticated);

router.get("/call-logs", async (req: any, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 1000);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const agentId = typeof req.query.agentId === "string" ? req.query.agentId : undefined;
    const result = await storage.getCallLogs(req.user.organizationId, limit, offset, agentId);
    return res.json({ ...result, limit, offset });
  } catch (error) {
    console.error("Failed to fetch call logs:", error);
    return res.status(500).json({ message: "Failed to fetch call logs" });
  }
});

router.get("/call-logs/summary-status", async (req: any, res) => {
  try {
    const { data } = await storage.getCallLogs(req.user.organizationId, 1000, 0);
    const counts = data.reduce(
      (result: Record<string, number>, callLog: any) => {
        const status = callLog.summaryStatus || (callLog.summary ? "success" : "pending");
        result[status] = (result[status] || 0) + 1;
        return result;
      },
      {},
    );
    return res.json({ total: data.length, counts });
  } catch (error) {
    console.error("Failed to fetch summary status:", error);
    return res.status(500).json({ message: "Failed to fetch summary status" });
  }
});

router.get("/call-logs/:id", async (req: any, res) => {
  try {
    const callLog = await storage.getCallLog(req.params.id, req.user.organizationId);
    if (!callLog) return res.status(404).json({ message: "Call log not found" });
    return res.json(callLog);
  } catch (error) {
    console.error("Failed to fetch call log:", error);
    return res.status(500).json({ message: "Failed to fetch call log" });
  }
});

router.post("/call-logs/:id/summary", async (req: any, res) => {
  try {
    const callLog = await storage.getCallLog(req.params.id, req.user.organizationId);
    if (!callLog) return res.status(404).json({ message: "Call log not found" });
    return res.json({
      success: true,
      message: callLog.summary
        ? "Summary already exists for this call"
        : "Summaries are generated from provider post-call webhooks",
      callLog,
    });
  } catch (error) {
    console.error("Failed to process call summary request:", error);
    return res.status(500).json({ message: "Failed to process call summary request" });
  }
});

async function syncCallLogs(req: any, res: any) {
  try {
    const result = await SyncService.syncCallLogs({
      organizationId: req.user.organizationId,
      agentId: typeof req.body?.agentId === "string" ? req.body.agentId : undefined,
      limit: Number(req.body?.limit) || 100,
    });
    return res.json(result);
  } catch (error) {
    console.error("Failed to sync call logs:", error);
    return res.status(500).json({ message: "Failed to sync call logs" });
  }
}

router.post("/sync-calls", syncCallLogs);
router.post("/sync/trigger", syncCallLogs);

router.get("/sync/status", async (req: any, res) => {
  try {
    return res.json(await SyncService.getSyncStatus(req.user.organizationId));
  } catch (error) {
    console.error("Failed to fetch sync status:", error);
    return res.status(500).json({ message: "Failed to fetch sync status" });
  }
});

router.get("/analytics/organization", async (req: any, res) => {
  try {
    const agentId = typeof req.query.agentId === "string" ? req.query.agentId : undefined;
    return res.json(await storage.getOrganizationStats(req.user.organizationId, agentId));
  } catch (error) {
    console.error("Failed to fetch organization analytics:", error);
    return res.status(500).json({ message: "Failed to fetch organization analytics" });
  }
});

router.post("/jobs/generate-all-summaries", (_req, res) => {
  return res.json({
    successful: 0,
    failed: 0,
    message: "Summaries are generated from provider post-call webhooks.",
  });
});

router.post("/jobs/fetch-missing-audio", (_req, res) => {
  return res.json({
    successful: 0,
    failed: 0,
    message: "Audio fetching is available when the provider supplies a recording URL.",
  });
});

export default router;
