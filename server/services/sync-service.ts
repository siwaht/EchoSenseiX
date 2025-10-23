/**
 * Sync Service - Handles synchronization of data from ElevenLabs API
 * 
 * This service provides reliable sync functionality with:
 * - Deduplication to prevent duplicate call logs
 * - Comprehensive error handling
 * - Detailed logging and statistics
 * - Retry logic for transient failures
 */

import { storage } from "../storage";
import ElevenLabsService, { createElevenLabsClient } from "./elevenlabs";
import type { InsertCallLog, InsertAgent } from "@shared/schema";

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  updatedCount: number;
  errorCount: number;
  errors: string[];
  duration: number;
}

export interface SyncOptions {
  organizationId: string;
  agentId?: string;
  limit?: number;
  includeTranscripts?: boolean;
}

export class SyncService {
  /**
   * Sync call logs from ElevenLabs
   */
  static async syncCallLogs(options: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    const { organizationId, agentId, limit = 100, includeTranscripts = true } = options;
    
    let syncedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      console.log(`[SYNC] Starting call log sync for organization ${organizationId}`);
      
      // Get ElevenLabs integration
      const integration = await storage.getIntegration(organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        throw new Error("ElevenLabs integration not configured");
      }

      // Validate API key before proceeding
      let client;
      try {
        client = createElevenLabsClient(integration.apiKey);
        // Test API connectivity
        const testResult = await client.getUser();
        if (!testResult.success) {
          throw new Error(`API key validation failed: ${testResult.error}`);
        }
        console.log(`[SYNC] API key validated successfully`);
      } catch (apiError: any) {
        throw new Error(`Failed to validate ElevenLabs API key: ${apiError.message}`);
      }

      // Fetch conversations from ElevenLabs
      console.log(`[SYNC] Fetching conversations from ElevenLabs...`);
      const conversationsResult = await client.getConversations({
        agent_id: agentId,
        page_size: limit,
      });

      if (!conversationsResult.success || !conversationsResult.data) {
        throw new Error(conversationsResult.error || "Failed to fetch conversations");
      }

      const conversations = conversationsResult.data.conversations || conversationsResult.data || [];
      console.log(`[SYNC] Found ${conversations.length} conversations`);

      // Process each conversation
      for (const conversation of conversations) {
        try {
          // Validate conversation data
          if (!conversation.conversation_id) {
            console.warn(`[SYNC] Skipping conversation without ID:`, conversation);
            errorCount++;
            errors.push(`Conversation missing ID: ${JSON.stringify(conversation)}`);
            continue;
          }

          // Check if call log already exists (deduplication)
          const existingLog = await storage.getCallLogByConversationId(
            organizationId,
            conversation.conversation_id
          );

          // Fetch detailed conversation data to get accurate duration and cost
          let detailedConversation = conversation;
          try {
            const detailResult = await client.getConversation(conversation.conversation_id);
            if (detailResult.success && detailResult.data) {
              detailedConversation = detailResult.data;
              console.log(`[SYNC] Fetched detailed data for ${conversation.conversation_id}`);
            } else {
              console.warn(`[SYNC] Failed to fetch detailed data for ${conversation.conversation_id}: ${detailResult.error}`);
            }
          } catch (detailError: any) {
            console.warn(`[SYNC] Could not fetch detailed data for ${conversation.conversation_id}:`, detailError.message);
            // Continue with list data
          }

          // Look up the local agent using the ElevenLabs agent ID
          const elevenLabsAgentId = detailedConversation.agent_id || agentId;
          let localAgentId = null;
          
          if (elevenLabsAgentId) {
            try {
              const localAgent = await storage.getAgentByElevenLabsId(elevenLabsAgentId, organizationId);
              if (localAgent) {
                localAgentId = localAgent.id;
                console.log(`[SYNC] Mapped ElevenLabs agent ${elevenLabsAgentId} to local agent ${localAgentId}`);
              } else {
                console.warn(`[SYNC] No local agent found for ElevenLabs agent ID: ${elevenLabsAgentId}. Call log will be created without agent reference.`);
              }
            } catch (agentLookupError: any) {
              console.warn(`[SYNC] Failed to lookup local agent for ${elevenLabsAgentId}:`, agentLookupError.message);
            }
          }

          // Extract duration from conversation_initiation_client_data.dynamic_variables or other sources
          const duration = detailedConversation.conversation_initiation_client_data?.dynamic_variables?.system__call_duration_secs ||
                         detailedConversation.dynamic_variables?.system__call_duration_secs || 
                         detailedConversation.duration_seconds || 0;
          
          // Fetch transcript explicitly from ElevenLabs API
          let transcript = null;
          if (includeTranscripts) {
            try {
              console.log(`[SYNC] Fetching transcript for ${conversation.conversation_id}`);
              const transcriptResult = await client.getConversationTranscript(conversation.conversation_id);
              
              if (transcriptResult.success && transcriptResult.data) {
                // Store transcript as JSON string
                transcript = JSON.stringify(transcriptResult.data);
                console.log(`[SYNC] Successfully fetched transcript for ${conversation.conversation_id}`);
              } else {
                console.log(`[SYNC] No transcript available for ${conversation.conversation_id}: ${transcriptResult.error || 'Unknown error'}`);
              }
            } catch (transcriptError: any) {
              console.warn(`[SYNC] Failed to fetch transcript for ${conversation.conversation_id}:`, transcriptError.message);
            }
          }
          
          // Prepare call log data using detailed conversation info
          const callLogData: Partial<InsertCallLog> = {
            organizationId,
            conversationId: detailedConversation.conversation_id,
            agentId: localAgentId,
            elevenLabsCallId: detailedConversation.conversation_id,
            phoneNumber: detailedConversation.metadata?.caller_number || null,
            status: detailedConversation.status || "completed",
            duration: duration,
            cost: detailedConversation.cost ? String(detailedConversation.cost) : null,
            transcript: transcript,
            audioUrl: detailedConversation.recording_url || null,
          };

          if (existingLog) {
            // Update existing call log
            const updatedLog = await storage.updateCallLog(existingLog.id, organizationId, callLogData);
            updatedCount++;
            console.log(`[SYNC] Updated call log ${existingLog.id}`);
            
            // Note: Summary generation now handled by ElevenLabs webhook
            // No longer auto-generating summaries with Mistral during sync
            if (updatedLog && updatedLog.transcript && !updatedLog.summary) {
              console.log(`[SYNC] Call ${existingLog.id} has transcript but no summary - waiting for ElevenLabs webhook`);
            }
            
            // Auto-fetch audio recording if available and not already fetched
            if (updatedLog && updatedLog.conversationId && !updatedLog.audioStorageKey) {
              try {
                console.log(`[SYNC] Auto-fetching recording for updated call: ${existingLog.id}`);
                const { default: AudioStorageService } = await import('./audio-storage-service');
                const audioStorage = new AudioStorageService();
                
                const audioResult = await client.fetchAndStoreAudio(
                  updatedLog.conversationId,
                  updatedLog.id,
                  audioStorage,
                  storage,
                  organizationId
                );
                
                if (audioResult.success) {
                  console.log(`[SYNC] Recording auto-fetched for updated call: ${existingLog.id}`);
                } else {
                  console.log(`[SYNC] Recording not available for updated call ${existingLog.id}: ${audioResult.error}`);
                }
              } catch (audioError: any) {
                console.error(`[SYNC] Failed to auto-fetch recording for updated call ${existingLog.id}:`, audioError.message);
              }
            }
          } else {
            // Create new call log
            const newCallLog = await storage.createCallLog({
              ...callLogData,
              createdAt: conversation.created_at ? new Date(conversation.created_at) : new Date(),
            } as InsertCallLog);
            syncedCount++;
            console.log(`[SYNC] Created new call log for conversation ${conversation.conversation_id}`);
            
            // Note: Summary generation now handled by ElevenLabs webhook
            // No longer auto-generating summaries with Mistral during sync
            if (newCallLog && newCallLog.transcript && !newCallLog.summary) {
              console.log(`[SYNC] Call ${newCallLog.id} has transcript but no summary - waiting for ElevenLabs webhook`);
            }
            
            // Auto-fetch audio recording if available
            if (newCallLog && newCallLog.conversationId && !newCallLog.audioStorageKey) {
              try {
                console.log(`[SYNC] Auto-fetching recording for new call: ${newCallLog.id}`);
                const { default: AudioStorageService } = await import('./audio-storage-service');
                const audioStorage = new AudioStorageService();
                
                const audioResult = await client.fetchAndStoreAudio(
                  newCallLog.conversationId,
                  newCallLog.id,
                  audioStorage,
                  storage,
                  organizationId
                );
                
                if (audioResult.success) {
                  console.log(`[SYNC] Recording auto-fetched for new call: ${newCallLog.id}`);
                } else {
                  console.log(`[SYNC] Recording not available for new call ${newCallLog.id}: ${audioResult.error}`);
                }
              } catch (audioError: any) {
                console.error(`[SYNC] Failed to auto-fetch recording for new call ${newCallLog.id}:`, audioError.message);
              }
            }
          }
        } catch (error: any) {
          errorCount++;
          const errorMsg = `Failed to process conversation ${conversation?.conversation_id || 'unknown'}: ${error.message}`;
          errors.push(errorMsg);
          console.error(`[SYNC] ${errorMsg}`, error);
        }
      }

      // Update integration last sync time
      await storage.updateIntegrationStatus(integration.id, "ACTIVE", new Date());

      const duration = Date.now() - startTime;
      console.log(`[SYNC] Completed in ${duration}ms: ${syncedCount} new, ${updatedCount} updated, ${errorCount} errors`);

      return {
        success: true,
        syncedCount,
        updatedCount,
        errorCount,
        errors,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[SYNC] Failed after ${duration}ms:`, error);
      
      return {
        success: false,
        syncedCount,
        updatedCount,
        errorCount: errorCount + 1,
        errors: [...errors, error.message],
        duration,
      };
    }
  }

  /**
   * Sync agents from ElevenLabs
   */
  static async syncAgents(organizationId: string): Promise<SyncResult> {
    const startTime = Date.now();
    let syncedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      console.log(`[SYNC] Starting agent sync for organization ${organizationId}`);
      
      // Get ElevenLabs integration
      const integration = await storage.getIntegration(organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        throw new Error("ElevenLabs integration not configured");
      }

      // Validate API key before proceeding
      let client;
      try {
        client = createElevenLabsClient(integration.apiKey);
        // Test API connectivity
        const testResult = await client.getUser();
        if (!testResult.success) {
          throw new Error(`API key validation failed: ${testResult.error}`);
        }
        console.log(`[SYNC] API key validated successfully for agent sync`);
      } catch (apiError: any) {
        throw new Error(`Failed to validate ElevenLabs API key: ${apiError.message}`);
      }

      // Fetch agents from ElevenLabs
      console.log(`[SYNC] Fetching agents from ElevenLabs...`);
      const agentsResult = await client.getAgents();

      console.log(`[SYNC] Agents API response:`, {
        success: agentsResult.success,
        hasData: !!agentsResult.data,
        error: agentsResult.error,
        statusCode: agentsResult.statusCode
      });

      if (!agentsResult.success) {
        throw new Error(`Failed to fetch agents: ${agentsResult.error}`);
      }

      if (!agentsResult.data) {
        throw new Error("No data returned from agents API");
      }

      // Handle different response structures
      let agents = [];
      if (Array.isArray(agentsResult.data)) {
        agents = agentsResult.data;
      } else if (agentsResult.data.agents && Array.isArray(agentsResult.data.agents)) {
        agents = agentsResult.data.agents;
      } else if (agentsResult.data.data && Array.isArray(agentsResult.data.data)) {
        agents = agentsResult.data.data;
      } else {
        console.log(`[SYNC] Unexpected agents data structure:`, agentsResult.data);
        agents = [];
      }

      console.log(`[SYNC] Found ${agents.length} agents`);

      // Process each agent
      for (const agent of agents) {
        try {
          // Validate agent data
          if (!agent.agent_id) {
            console.warn(`[SYNC] Skipping agent without ID:`, agent);
            errorCount++;
            errors.push(`Agent missing ID: ${JSON.stringify(agent)}`);
            continue;
          }

          // Check if agent already exists
          const agentId = agent.agent_id || agent.id;
          const existingAgent = await storage.getAgentByElevenLabsId(agentId, organizationId);

          // Extract agent data with better error handling
          const agentData: Partial<InsertAgent> = {
            organizationId,
            elevenLabsAgentId: agent.agent_id || agent.id,
            name: agent.name || agent.agent_name || "Unnamed Agent",
            voiceId: agent.conversation_config?.voice?.voice_id || agent.voice_id || null,
            systemPrompt: agent.prompt?.prompt || agent.system_prompt || agent.prompt || null,
            firstMessage: agent.conversation_config?.first_message || agent.first_message || null,
            language: agent.conversation_config?.language || agent.language || "en",
            isActive: true, // Set imported agents as active by default
          };

          console.log(`[SYNC] Processing agent:`, {
            id: agentData.elevenLabsAgentId,
            name: agentData.name,
            hasVoice: !!agentData.voiceId,
            hasPrompt: !!agentData.systemPrompt,
            hasFirstMessage: !!agentData.firstMessage,
            language: agentData.language
          });

          if (existingAgent) {
            // Update existing agent
            await storage.updateAgent(existingAgent.id, organizationId, agentData);
            updatedCount++;
            console.log(`[SYNC] Updated agent ${existingAgent.id}`);
          } else {
            // Create new agent
            await storage.createAgent(agentData as InsertAgent);
            syncedCount++;
            console.log(`[SYNC] Created new agent ${agent.agent_id}`);
          }
        } catch (error: any) {
          errorCount++;
          const errorMsg = `Failed to process agent ${agent?.agent_id || 'unknown'}: ${error.message}`;
          errors.push(errorMsg);
          console.error(`[SYNC] ${errorMsg}`, error);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[SYNC] Agent sync completed in ${duration}ms: ${syncedCount} new, ${updatedCount} updated, ${errorCount} errors`);

      return {
        success: true,
        syncedCount,
        updatedCount,
        errorCount,
        errors,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[SYNC] Agent sync failed after ${duration}ms:`, error);
      
      return {
        success: false,
        syncedCount,
        updatedCount,
        errorCount: errorCount + 1,
        errors: [...errors, error.message],
        duration,
      };
    }
  }

  /**
   * Comprehensive dashboard sync - syncs both agents and call logs
   */
  static async syncDashboard(organizationId: string, agentId?: string): Promise<{
    success: boolean;
    agents: SyncResult;
    callLogs: SyncResult;
    totalDuration: number;
  }> {
    const startTime = Date.now();
    const SYNC_TIMEOUT = 60000; // 60 seconds timeout
    
    console.log(`[SYNC] Starting comprehensive dashboard sync for organization ${organizationId}`);

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Sync operation timed out after 60 seconds')), SYNC_TIMEOUT);
      });

      // Run sync operations with timeout
      const syncPromise = this.runDashboardSync(organizationId, agentId);
      const result = await Promise.race([syncPromise, timeoutPromise]);

      const totalDuration = Date.now() - startTime;
      console.log(`[SYNC] Dashboard sync completed in ${totalDuration}ms`);

      return result;
    } catch (error: any) {
      const totalDuration = Date.now() - startTime;
      console.error(`[SYNC] Dashboard sync failed after ${totalDuration}ms:`, error.message);
      
      // Return error result
      const errorResult: SyncResult = {
        success: false,
        syncedCount: 0,
        updatedCount: 0,
        errorCount: 1,
        errors: [error.message],
        duration: totalDuration,
      };

      return {
        success: false,
        agents: errorResult,
        callLogs: errorResult,
        totalDuration,
      };
    }
  }

  /**
   * Internal method to run dashboard sync operations
   */
  private static async runDashboardSync(organizationId: string, agentId?: string) {
    // Sync agents first
    const agentsResult = await this.syncAgents(organizationId);

    // Then sync call logs (limited to recent calls for dashboard)
    const callLogsResult = await this.syncCallLogs({
      organizationId,
      agentId,
      limit: 50, // Limit for dashboard performance
      includeTranscripts: false, // Skip transcripts for faster sync
    });

    const totalDuration = Date.now();
    const success = agentsResult.success && callLogsResult.success;

    return {
      success,
      agents: agentsResult,
      callLogs: callLogsResult,
      totalDuration,
    };
  }
}

export default SyncService;
