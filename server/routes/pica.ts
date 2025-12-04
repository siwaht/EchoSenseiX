import { Router } from 'express';
import { picaService } from '../services/pica';

const router = Router();

// Generic action execution
router.post('/actions', async (req, res) => {
    try {
        const { tool, action, params } = req.body;

        if (!tool || !action) {
            return res.status(400).json({ error: 'Tool and action are required' });
        }

        const result = await picaService.executeAction({ tool, action, params });
        return res.json(result);
    } catch (error: any) {
        console.error('Error executing PicaOS action:', error);
        return res.status(500).json({ error: error.message || 'Failed to execute action' });
    }
});

// List connections
router.get('/connections', async (_req, res) => {
    try {
        const connections = await picaService.listConnections();
        return res.json(connections);
    } catch (error: any) {
        console.error('Error listing PicaOS connections:', error);
        return res.status(500).json({ error: error.message || 'Failed to list connections' });
    }
});

export const picaRouter = router;
