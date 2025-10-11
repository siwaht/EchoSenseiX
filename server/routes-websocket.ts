/**
 * WebSocket Routes for Real-time Sync
 * 
 * Handles WebSocket connections for real-time dashboard updates
 */

import { Express, Request, Response } from "express";
import { WebSocketServer } from 'ws';
import { realtimeSyncService } from './services/realtime-sync';

// Define isAuthenticated middleware locally (same as in routes.ts)
const isAuthenticated = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
};

export function setupWebSocketRoutes(app: Express, server: any) {
  // Create WebSocket server
  const wss = new WebSocketServer({ 
    server,
    path: '/ws/realtime-sync'
  });

  console.log('[WEBSOCKET] Real-time sync WebSocket server started');

  wss.on('connection', async (ws, req) => {
    console.log('[WEBSOCKET] New connection attempt');

    try {
      // Extract user info from query parameters or headers
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const token = url.searchParams.get('token') || req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        console.log('[WEBSOCKET] No authentication token provided');
        ws.close(1008, 'Authentication required');
        return;
      }

      // For now, we'll use a simple approach - in production you'd verify the JWT token
      // This is a simplified version - you might want to implement proper JWT verification
      const userId = url.searchParams.get('userId');
      const organizationId = url.searchParams.get('organizationId');
      
      if (!userId || !organizationId) {
        console.log('[WEBSOCKET] Missing userId or organizationId');
        ws.close(1008, 'Missing user or organization information');
        return;
      }

      // Register the client for real-time updates
      realtimeSyncService.registerClient(ws, organizationId, userId);
      
      console.log(`[WEBSOCKET] Client connected: ${organizationId}-${userId}`);

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        data: {
          message: 'Connected to real-time sync',
          organizationId,
          userId,
          timestamp: new Date().toISOString()
        }
      }));

      // Handle incoming messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          switch (message.type) {
            case 'ping':
              ws.send(JSON.stringify({
                type: 'pong',
                data: { timestamp: new Date().toISOString() }
              }));
              break;
              
            case 'sync_request':
              // Handle sync request from client
              handleSyncRequest(organizationId, userId, message.data, ws);
              break;
              
            default:
              console.log('[WEBSOCKET] Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('[WEBSOCKET] Error processing message:', error);
        }
      });

      ws.on('close', () => {
        console.log(`[WEBSOCKET] Client disconnected: ${organizationId}-${userId}`);
      });

      ws.on('error', (error) => {
        console.error(`[WEBSOCKET] Connection error for ${organizationId}-${userId}:`, error);
      });

    } catch (error) {
      console.error('[WEBSOCKET] Error setting up connection:', error);
      ws.close(1011, 'Internal server error');
    }
  });

  return wss;
}

/**
 * Handle sync request from WebSocket client
 */
async function handleSyncRequest(organizationId: string, userId: string, data: any, ws: WebSocket) {
  try {
    console.log(`[WEBSOCKET] Sync request from ${organizationId}-${userId}`);
    
    // Check if sync is already in progress
    if (realtimeSyncService.isSyncInProgress(organizationId)) {
      ws.send(JSON.stringify({
        type: 'sync_error',
        data: {
          error: 'Sync already in progress',
          timestamp: new Date().toISOString()
        }
      }));
      return;
    }

    // Start real-time sync
    const result = await realtimeSyncService.startRealtimeSync(organizationId, data.agentId);
    
    // Send success confirmation
    ws.send(JSON.stringify({
      type: 'sync_success',
      data: {
        result,
        timestamp: new Date().toISOString()
      }
    }));

  } catch (error: any) {
    console.error(`[WEBSOCKET] Sync request failed for ${organizationId}-${userId}:`, error);
    
    ws.send(JSON.stringify({
      type: 'sync_error',
      data: {
        error: error.message,
        timestamp: new Date().toISOString()
      }
    }));
  }
}

/**
 * Setup HTTP endpoints for WebSocket connection info
 */
export function setupWebSocketEndpoints(app: Express) {
  // Get WebSocket connection info
  app.get('/api/websocket/info', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const organizationId = user.organizationId;
      
      const connectionInfo = {
        wsUrl: `/ws/realtime-sync?token=${user.id}&userId=${user.id}&organizationId=${organizationId}`,
        connectedClients: realtimeSyncService.getConnectedClientsCount(organizationId),
        syncInProgress: realtimeSyncService.isSyncInProgress(organizationId)
      };
      
      res.json(connectionInfo);
    } catch (error: any) {
      console.error('[WEBSOCKET] Error getting connection info:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Trigger real-time sync via HTTP (alternative to WebSocket)
  app.post('/api/websocket/sync', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const organizationId = user.organizationId;
      const { agentId } = req.body;
      
      console.log(`[WEBSOCKET] HTTP sync request from user ${user.id}`);
      
      // Start real-time sync
      const result = await realtimeSyncService.startRealtimeSync(organizationId, agentId);
      
      res.json({
        success: true,
        message: 'Real-time sync completed',
        result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error('[WEBSOCKET] HTTP sync request failed:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
}
