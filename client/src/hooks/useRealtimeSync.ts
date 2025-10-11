/**
 * Real-time Sync Hook
 * 
 * Handles WebSocket connections for real-time dashboard updates
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';

export interface SyncEvent {
  type: 'connected' | 'sync_started' | 'sync_progress' | 'sync_completed' | 'sync_failed' | 'sync_error' | 'sync_success' | 'pong';
  data: any;
  timestamp: string;
}

export interface RealtimeSyncState {
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncResult: any | null;
  error: string | null;
}

export function useRealtimeSync(organizationId: string, userId: string) {
  const [state, setState] = useState<RealtimeSyncState>({
    isConnected: false,
    isSyncing: false,
    lastSyncResult: null,
    error: null
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/realtime-sync?token=${userId}&userId=${userId}&organizationId=${organizationId}`;
      
      console.log('[REALTIME-SYNC] Connecting to:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[REALTIME-SYNC] Connected to WebSocket');
        setState(prev => ({ ...prev, isConnected: true, error: null }));

        // Start ping interval
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000); // Ping every 30 seconds
      };

      ws.onmessage = (event) => {
        try {
          const message: SyncEvent = JSON.parse(event.data);
          console.log('[REALTIME-SYNC] Received message:', message);

          switch (message.type) {
            case 'connected':
              console.log('[REALTIME-SYNC] Connection confirmed');
              break;

            case 'sync_started':
              setState(prev => ({ ...prev, isSyncing: true, error: null }));
              toast({
                title: "Sync Started",
                description: "Data synchronization is in progress...",
              });
              break;

            case 'sync_progress':
              // Handle progress updates
              console.log('[REALTIME-SYNC] Sync progress:', message.data);
              break;

            case 'sync_completed':
              setState(prev => ({ 
                ...prev, 
                isSyncing: false, 
                lastSyncResult: message.data,
                error: null 
              }));
              
              // Invalidate queries to refresh data
              queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
              queryClient.invalidateQueries({ queryKey: ["/api/call-logs"] });
              queryClient.invalidateQueries({ queryKey: ["/api/analytics/organization"] });
              
              const agentStats = message.data.agents || {};
              const callStats = message.data.callLogs || {};
              
              const successMessage = [
                `Agents: ${agentStats.syncedCount || 0} new, ${agentStats.updatedCount || 0} updated`,
                `Calls: ${callStats.syncedCount || 0} new, ${callStats.updatedCount || 0} updated`,
                `Completed in ${message.data.totalDuration || 0}ms`
              ].join(' | ');

              toast({
                title: "Sync Complete",
                description: successMessage,
              });
              break;

            case 'sync_failed':
            case 'sync_error':
              setState(prev => ({ 
                ...prev, 
                isSyncing: false, 
                error: message.data.error || 'Sync failed'
              }));
              
              toast({
                title: "Sync Failed",
                description: message.data.error || 'Data synchronization failed',
                variant: "destructive",
              });
              break;

            case 'sync_success':
              setState(prev => ({ 
                ...prev, 
                isSyncing: false, 
                lastSyncResult: message.data.result,
                error: null 
              }));
              
              // Invalidate queries to refresh data
              queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
              queryClient.invalidateQueries({ queryKey: ["/api/call-logs"] });
              queryClient.invalidateQueries({ queryKey: ["/api/analytics/organization"] });
              
              toast({
                title: "Sync Complete",
                description: "Data synchronized successfully",
              });
              break;

            case 'pong':
              // Handle pong response
              break;

            default:
              console.log('[REALTIME-SYNC] Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('[REALTIME-SYNC] Error parsing message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('[REALTIME-SYNC] WebSocket closed:', event.code, event.reason);
        setState(prev => ({ ...prev, isConnected: false }));
        
        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Attempt to reconnect after a delay (unless it was a clean close)
        if (event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[REALTIME-SYNC] Attempting to reconnect...');
            connect();
          }, 5000);
        }
      };

      ws.onerror = (error) => {
        console.error('[REALTIME-SYNC] WebSocket error:', error);
        setState(prev => ({ ...prev, error: 'Connection error' }));
      };

    } catch (error) {
      console.error('[REALTIME-SYNC] Failed to create WebSocket connection:', error);
      setState(prev => ({ ...prev, error: 'Failed to connect' }));
    }
  }, [organizationId, userId, queryClient, toast]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }

    setState(prev => ({ ...prev, isConnected: false }));
  }, []);

  // Trigger sync
  const triggerSync = useCallback((agentId?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      // Fallback to HTTP if WebSocket is not available
      fetch('/api/websocket/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ agentId })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
          queryClient.invalidateQueries({ queryKey: ["/api/call-logs"] });
          queryClient.invalidateQueries({ queryKey: ["/api/analytics/organization"] });
          
          toast({
            title: "Sync Complete",
            description: "Data synchronized successfully",
          });
        } else {
          toast({
            title: "Sync Failed",
            description: data.error || 'Data synchronization failed',
            variant: "destructive",
          });
        }
      })
      .catch(error => {
        console.error('HTTP sync failed:', error);
        toast({
          title: "Sync Failed",
          description: 'Failed to synchronize data',
          variant: "destructive",
        });
      });
      return;
    }

    // Send sync request via WebSocket
    wsRef.current.send(JSON.stringify({
      type: 'sync_request',
      data: { agentId }
    }));
  }, [queryClient, toast]);

  // Auto-connect on mount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    triggerSync
  };
}
