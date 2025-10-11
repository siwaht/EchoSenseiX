/**
 * Real-time Sync Service
 * 
 * Handles real-time updates for dashboard data synchronization
 * Uses WebSocket connections to broadcast sync events to connected clients
 */

import { WebSocket } from 'ws';
import { SyncService, SyncResult } from './sync-service';

export interface SyncEvent {
  type: 'sync_started' | 'sync_progress' | 'sync_completed' | 'sync_failed';
  organizationId: string;
  data: any;
  timestamp: string;
}

export interface ClientConnection {
  ws: WebSocket;
  organizationId: string;
  userId: string;
  isAlive: boolean;
}

class RealtimeSyncService {
  private clients: Map<string, ClientConnection[]> = new Map();
  private syncInProgress: Map<string, boolean> = new Map();

  /**
   * Register a client connection for real-time updates
   */
  registerClient(ws: WebSocket, organizationId: string, userId: string) {
    const connectionId = `${organizationId}-${userId}`;
    
    if (!this.clients.has(organizationId)) {
      this.clients.set(organizationId, []);
    }
    
    const connection: ClientConnection = {
      ws,
      organizationId,
      userId,
      isAlive: true
    };
    
    this.clients.get(organizationId)!.push(connection);
    
    // Set up ping/pong to keep connection alive
    ws.on('pong', () => {
      connection.isAlive = true;
    });
    
    ws.on('close', () => {
      this.removeClient(organizationId, userId);
    });
    
    console.log(`[REALTIME-SYNC] Client registered: ${connectionId}`);
  }

  /**
   * Remove a client connection
   */
  private removeClient(organizationId: string, userId: string) {
    const connections = this.clients.get(organizationId);
    if (connections) {
      const filtered = connections.filter(conn => conn.userId !== userId);
      this.clients.set(organizationId, filtered);
      
      if (filtered.length === 0) {
        this.clients.delete(organizationId);
      }
    }
    
    console.log(`[REALTIME-SYNC] Client removed: ${organizationId}-${userId}`);
  }

  /**
   * Broadcast sync event to all clients in an organization
   */
  private broadcastToOrganization(organizationId: string, event: SyncEvent) {
    const connections = this.clients.get(organizationId);
    if (!connections) return;

    const message = JSON.stringify(event);
    const deadConnections: number[] = [];

    connections.forEach((connection, index) => {
      if (connection.isAlive && connection.ws.readyState === WebSocket.OPEN) {
        try {
          connection.ws.send(message);
        } catch (error) {
          console.error(`[REALTIME-SYNC] Failed to send message to client:`, error);
          deadConnections.push(index);
        }
      } else {
        deadConnections.push(index);
      }
    });

    // Remove dead connections
    deadConnections.reverse().forEach(index => {
      connections.splice(index, 1);
    });

    if (connections.length === 0) {
      this.clients.delete(organizationId);
    }
  }

  /**
   * Start real-time sync for an organization
   */
  async startRealtimeSync(organizationId: string, agentId?: string): Promise<{
    success: boolean;
    agents: SyncResult;
    callLogs: SyncResult;
    totalDuration: number;
  }> {
    // Check if sync is already in progress
    if (this.syncInProgress.get(organizationId)) {
      throw new Error('Sync already in progress for this organization');
    }

    this.syncInProgress.set(organizationId, true);

    try {
      // Broadcast sync started event
      this.broadcastToOrganization(organizationId, {
        type: 'sync_started',
        organizationId,
        data: { agentId, timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString()
      });

      console.log(`[REALTIME-SYNC] Starting real-time sync for organization ${organizationId}`);

      // Perform the actual sync
      const result = await SyncService.syncDashboard(organizationId, agentId);

      // Broadcast sync completed event
      this.broadcastToOrganization(organizationId, {
        type: result.success ? 'sync_completed' : 'sync_failed',
        organizationId,
        data: {
          agents: result.agents,
          callLogs: result.callLogs,
          totalDuration: result.totalDuration,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });

      console.log(`[REALTIME-SYNC] Real-time sync completed for organization ${organizationId}`);

      return result;
    } catch (error: any) {
      // Broadcast sync failed event
      this.broadcastToOrganization(organizationId, {
        type: 'sync_failed',
        organizationId,
        data: {
          error: error.message,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });

      console.error(`[REALTIME-SYNC] Real-time sync failed for organization ${organizationId}:`, error);
      throw error;
    } finally {
      this.syncInProgress.set(organizationId, false);
    }
  }

  /**
   * Send progress updates during sync
   */
  sendProgressUpdate(organizationId: string, progress: any) {
    this.broadcastToOrganization(organizationId, {
      type: 'sync_progress',
      organizationId,
      data: progress,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Check if sync is in progress for an organization
   */
  isSyncInProgress(organizationId: string): boolean {
    return this.syncInProgress.get(organizationId) || false;
  }

  /**
   * Get connected clients count for an organization
   */
  getConnectedClientsCount(organizationId: string): number {
    return this.clients.get(organizationId)?.length || 0;
  }

  /**
   * Cleanup dead connections periodically
   */
  startHeartbeat() {
    setInterval(() => {
      this.clients.forEach((connections, organizationId) => {
        connections.forEach(connection => {
          if (!connection.isAlive) {
            connection.ws.terminate();
            this.removeClient(organizationId, connection.userId);
          } else {
            connection.isAlive = false;
            connection.ws.ping();
          }
        });
      });
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Broadcast custom event to organization
   */
  broadcastEvent(organizationId: string, eventType: string, data: any) {
    this.broadcastToOrganization(organizationId, {
      type: eventType as any,
      organizationId,
      data,
      timestamp: new Date().toISOString()
    });
  }
}

// Export singleton instance
export const realtimeSyncService = new RealtimeSyncService();

// Start heartbeat on module load
realtimeSyncService.startHeartbeat();

export default realtimeSyncService;
