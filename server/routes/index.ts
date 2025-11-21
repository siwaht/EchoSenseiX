import { Router } from "express";
import adminRouter from "./admin";
import webhookRouter from "./webhooks";
import userRouter from "./users";
import testingRouter from "./testing";

const router = Router();

// Mount routes
// Note: These are mounted under /api in the main server/routes.ts

router.use("/admin", adminRouter);
router.use("/webhooks", webhookRouter);
router.use("/users", userRouter); // Covers /users and /agency
router.use("/testing", testingRouter);

export default router;
