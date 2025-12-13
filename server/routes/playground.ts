import { Router } from 'express';
import { storage } from '../storage';
import { ElevenLabsService, decryptApiKey } from '../services/elevenlabs';

const router = Router();

router.post('/start-session', async (req: any, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const { agentId, connectionType = 'websocket' } = req.body;

    if (!agentId) {
      return res.status(400).json({ message: 'Agent ID is required' });
    }

    const user = req.user;

    const agent = await storage.getAgent(agentId, user.organizationId);
    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    if (!agent.elevenLabsAgentId) {
      return res.status(400).json({
        message: 'Agent is not linked to ElevenLabs. Please sync the agent first.',
      });
    }

    const integration = await storage.getIntegration(user.organizationId, 'elevenlabs');
    if (!integration || !integration.apiKey) {
      return res.status(400).json({
        message:
          'ElevenLabs integration not configured. Please add your API key in the Integrations tab.',
      });
    }

    const apiKey = decryptApiKey(integration.apiKey);
    const service = new ElevenLabsService({ apiKey });

    const result = await service.createWebRTCSession(agent.elevenLabsAgentId);

    if (!result.success) {
      console.error('[Playground] Failed to get signed URL:', result.error);
      return res.status(500).json({
        message: result.error || 'Failed to create session with ElevenLabs',
      });
    }

    const signedUrl = result.data?.signed_url;
    if (!signedUrl) {
      console.error('[Playground] No signed URL in response:', result.data);
      return res.status(500).json({
        message: 'Failed to get signed URL from ElevenLabs',
      });
    }

    console.log(
      `[Playground] Session started for agent ${agent.name} (${agent.elevenLabsAgentId})`
    );

    return res.json({
      signedUrl,
      connectionType: connectionType,
      agentId: agent.elevenLabsAgentId,
      agentName: agent.name,
    });
  } catch (error: any) {
    console.error('[Playground] Error starting session:', error);
    return res.status(500).json({
      message: error.message || 'Failed to start playground session',
    });
  }
});

router.post('/end-session', async (req: any, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    console.log(`[Playground] Session ended by user ${req.user.email}`);
    return res.json({ message: 'Session ended successfully' });
  } catch (error: any) {
    console.error('[Playground] Error ending session:', error);
    return res.status(500).json({
      message: error.message || 'Failed to end session',
    });
  }
});

export default router;
