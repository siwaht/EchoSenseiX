import { Router } from 'express';
import adminRouter from './admin';
import webhookRouter from './webhooks';
import userRouter from './users';

import integrationsRouter from './integrations';
import agentsRouter from './agents';
import playgroundRouter from './playground';
import operationsRouter from './operations';

const router = Router();

// Mount routes
// Note: These are mounted under /api in the main server/routes.ts

router.use('/admin', adminRouter);
router.use('/webhooks', webhookRouter);
router.use('/users', userRouter); // Covers /users and /agency
router.use('/integrations', integrationsRouter);
router.use('/agents', agentsRouter);
router.use('/playground', playgroundRouter);
router.use('/', operationsRouter);

export default router;
