import { Router } from "express";
import adminRouter from "./admin";
import webhookRouter from "./webhooks";
import userRouter from "./users";

import livekitRouter from "./livekit";
import { picaRouter } from "./pica";

import integrationsRouter from "./integrations";

const router = Router();

// Mount routes
// Note: These are mounted under /api in the main server/routes.ts

router.use("/admin", adminRouter);
router.use("/webhooks", webhookRouter);
router.use("/users", userRouter); // Covers /users and /agency
router.use("/integrations", integrationsRouter);

router.use("/livekit", livekitRouter);
router.use("/pica", picaRouter);

export default router;
