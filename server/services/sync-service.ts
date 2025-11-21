/**
 * Sync Service - Handles synchronization of data from Voice Providers
 * 
 * This service provides reliable sync functionality with:
 * - Deduplication to prevent duplicate call logs
 * - Comprehensive error handling
 * - Detailed logging and statistics
 * - Retry logic for transient failures
 * - Platform-agnostic provider integration
 */

import { storage } from "../storage";
import { providerRegistry } from "./providers/registry";
import { IConversationalAIProvider } from "./providers/types";
import type { InsertCallLog, InsertAgent, Integration } from "@shared/schema";

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
   * Sync call logs from Provider
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

      // Get all active integrations for this organization
      const integrations = await storage.getIntegrations(organizationId);
      const activeIntegrations = integrations.filter(i => i.status === 'ACTIVE' && i.apiKey);

      if (activeIntegrations.length === 0) {
        console.log(`[SYNC] No active integrations found for organization ${organizationId}`);
        return {
          success: true,
          syncedCount: 0,
          updatedCount: 0,
          errorCount: 0,
          errors: [],
          duration: Date.now() - startTime
        };
      }

      for (const integration of activeIntegrations) {
        try {
          console.log(`[SYNC] Processing integration: ${integration.provider}`);

          // Get provider from registry
          const provider = providerRegistry.getProvider(integration.provider);
          if (!provider) {
            console.warn(`[SYNC] Provider ${integration.provider} not found in registry, skipping`);
            continue;
          }

          // Filter for conversational AI providers
          if (provider.type !== "conversational_ai") {
            continue;
          }

          const aiProvider = provider as IConversationalAIProvider;
          if (!aiProvider.getConversations) {
            console.log(`[SYNC] Provider ${integration.provider} does not support getConversations, skipping`);
            continue;
          }

          // Initialize provider with API key
          await aiProvider.initialize({ apiKey: integration.apiKey });
          console.log(`[SYNC] Provider ${integration.provider} initialized successfully`);

          // Fetch conversations from Provider
          console.log(`[SYNC] Fetching conversations from ${integration.provider}...`);
          const conversationsResult = await aiProvider.getConversations({
            agent_id: agentId,
            page_size: limit,
          });

          // Handle provider response structure (adapter should normalize this, but being safe)
          const conversations = conversationsResult.conversations || conversationsResult || [];
          console.log(`[SYNC] Found ${conversations.length} conversations from ${integration.provider}`);

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
                const detailResult = await aiProvider.getConversation(conversation.conversation_id);
                if (detailResult) {
                  detailedConversation = detailResult;
                  console.log(`[SYNC] Fetched detailed data for ${conversation.conversation_id}`);
                }
              } catch (detailError: any) {
                console.warn(`[SYNC] Could not fetch detailed data for ${conversation.conversation_id}:`, detailError.message);
                // Continue with list data
              }

              // Look up the local agent using the Provider agent ID
              const providerAgentId = detailedConversation.agent_id || agentId;
              let localAgentId = null;

              if (providerAgentId) {
                try {
                  // We need a way to find agent by provider-specific ID
                  // The current getAgentByElevenLabsId is specific. 
                  // We should probably have a generic method or use the same column for now if it maps 1:1
                  // Assuming 'elevenLabsAgentId' column is used for the external ID for now.
                  // TODO: Rename elevenLabsAgentId to externalAgentId in schema in future refactor
                  const localAgent = await storage.getAgentByElevenLabsId(providerAgentId, organizationId);
                  if (localAgent) {
                    localAgentId = localAgent.id;
                    console.log(`[SYNC] Mapped provider agent ${providerAgentId} to local agent ${localAgentId}`);
                  } else {
                    console.warn(`[SYNC] No local agent found for provider agent ID: ${providerAgentId}. Call log will be created without agent reference.`);
                  }
                } catch (agentLookupError: any) {
                  console.warn(`[SYNC] Failed to lookup local agent for ${providerAgentId}:`, agentLookupError.message);
                }
              }

              // Extract duration
              const duration = detailedConversation.conversation_initiation_client_data?.dynamic_variables?.system__call_duration_secs ||
                detailedConversation.dynamic_variables?.system__call_duration_secs ||
                detailedConversation.duration_seconds || 0;

              // Fetch transcript explicitly
              let transcript = null;
              if (includeTranscripts) {
                try {
                  console.log(`[SYNC] Fetching transcript for ${conversation.conversation_id}`);
                  const transcriptData = await aiProvider.getConversationTranscript(conversation.conversation_id);

                  if (transcriptData) {
                    // Store transcript as JSON string
                    transcript = JSON.stringify(transcriptData);
                    console.log(`[SYNC] Successfully fetched transcript for ${conversation.conversation_id}`);
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
                elevenLabsCallId: detailedConversation.conversation_id, // This column might need renaming too, but using it for now
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

                // Auto-fetch audio recording if available and not already fetched
                if (updatedLog && updatedLog.conversationId && !updatedLog.audioStorageKey) {
                  await this.fetchAndStoreAudio(
                    aiProvider,
                    updatedLog.conversationId,
                    updatedLog.id,
                    organizationId
                  );
                }
              } else {
                // Create new call log
                const newCallLog = await storage.createCallLog({
                  ...callLogData,
                  createdAt: conversation.created_at ? new Date(conversation.created_at) : new Date(),
                } as InsertCallLog);
                syncedCount++;
                console.log(`[SYNC] Created new call log for conversation ${conversation.conversation_id}`);

                // Auto-fetch audio recording if available
                if (newCallLog && newCallLog.conversationId && !newCallLog.audioStorageKey) {
                  await this.fetchAndStoreAudio(
                    aiProvider,
                    newCallLog.conversationId,
                    newCallLog.id,
                    organizationId
                  );
                }
              }
            } catch (error: any) {
              errorCount++;
              const errorMsg = `Failed to process conversation ${conversation?.conversation_id || 'unknown'} from ${integration.provider}: ${error.message}`;
              errors.push(errorMsg);
              console.error(`[SYNC] ${errorMsg}`, error);
            }
          }

          // Update integration last sync time
          await storage.updateIntegrationStatus(integration.id, "ACTIVE", new Date());

        } catch (integrationError: any) {
          console.error(`[SYNC] Error processing integration ${integration.provider}:`, integrationError);
          errorCount++;
          errors.push(`Integration ${integration.provider} failed: ${integrationError.message}`);
        }
      }

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
   * Sync agents from Provider
   */
  static async syncAgents(organizationId: string): Promise<SyncResult> {
    const startTime = Date.now();
    let syncedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      console.log(`[SYNC] Starting agent sync for organization ${organizationId}`);

      // Get all active integrations
      const integrations = await storage.getIntegrations(organizationId);
      const activeIntegrations = integrations.filter(i => i.status === 'ACTIVE' && i.apiKey);

      if (activeIntegrations.length === 0) {
        console.log(`[SYNC] No active integrations found for organization ${organizationId}`);
        return {
          success: true,
          syncedCount: 0,
          updatedCount: 0,
          errorCount: 0,
          errors: [],
          duration: Date.now() - startTime
        };
      }

      for (const integration of activeIntegrations) {
        try {
          console.log(`[SYNC] Processing integration for agents: ${integration.provider}`);

          // Get provider from registry
          const provider = providerRegistry.getProvider(integration.provider);
          if (!provider) {
            console.warn(`[SYNC] Provider ${integration.provider} not found in registry, skipping`);
            continue;
          }

          const aiProvider = provider as IConversationalAIProvider;
          if (!aiProvider.getAgents) {
            console.log(`[SYNC] Provider ${integration.provider} does not support getAgents, skipping`);
            continue;
          }

          // Initialize provider
          await aiProvider.initialize({ apiKey: integration.apiKey });
          console.log(`[SYNC] Provider ${integration.provider} initialized for agent sync`);

          // Fetch agents from Provider
          console.log(`[SYNC] Fetching agents from ${integration.provider}...`);
          const agents = await aiProvider.getAgents();
          console.log(`[SYNC] Found ${agents.length} agents from ${integration.provider}`);

          // Process each agent
          for (const agent of agents) {
            try {
              // Validate agent data
              if (!agent.agent_id && !agent.id) {
                console.warn(`[SYNC] Skipping agent without ID:`, agent);
                errorCount++;
                errors.push(`Agent missing ID: ${JSON.stringify(agent)}`);
                continue;
              }

              const agentId = agent.agent_id || agent.id;
              const existingAgent = await storage.getAgentByElevenLabsId(agentId, organizationId);

              // Extract agent data
              const agentData: Partial<InsertAgent> = {
                organizationId,
                elevenLabsAgentId: agentId, // Using this column for external ID
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
                console.log(`[SYNC] Created new agent ${agentId}`);
              }
            } catch (error: any) {
              errorCount++;
              const errorMsg = `Failed to process agent ${agent?.agent_id || 'unknown'}: ${error.message}`;
              errors.push(errorMsg);
              console.error(`[SYNC] ${errorMsg}`, error);
            }
          }
        } catch (integrationError: any) {
          console.error(`[SYNC] Error processing integration ${integration.provider} for agents:`, integrationError);
          errorCount++;
          errors.push(`Integration ${integration.provider} failed: ${integrationError.message}`);
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
   * Get current sync status
   */
  static async getSyncStatus(organizationId?: string) {
    // For now, return a basic status based on the last sync time of integrations
    const integrations = organizationId
      ? await storage.getIntegrations(organizationId)
      : await storage.getAllIntegrations();

    const activeIntegrations = integrations.filter(i => i.status === 'ACTIVE');

    if (activeIntegrations.length === 0) {
      return {
        status: 'idle',
        lastSync: null,
        details: 'No active integrations'
      };
    }

    // Find the most recent sync time
    const lastSync = activeIntegrations.reduce((latest, current) => {
      if (!current.lastSyncAt) return latest;
      return !latest || new Date(current.lastSyncAt) > new Date(latest)
        ? current.lastSyncAt
        : latest;
    }, null as Date | null);

    return {
      status: 'idle', // We don't currently track active running state in DB
      lastSync,
      details: `${activeIntegrations.length} active integrations`
    };
  }

  /**
   * Run full sync (alias for syncDashboard)
   */
  static async runSync(organizationId?: string) {
    if (organizationId) {
      return this.syncDashboard(organizationId);
    }

    // Sync all organizations
    const organizations = await storage.getOrganizations();
    const results = [];
    for (const org of organizations) {
      results.push(await this.syncDashboard(org.id));
    }
    return results;
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
  /**
   * Fetch and store audio for a conversation
   */
  public static async fetchAndStoreAudio(
    provider: IConversationalAIProvider,
    conversationId: string,
    callId: string,
    organizationId: string
  ): Promise<{ success: boolean; storageKey?: string; recordingUrl?: string; error?: string }> {
    try {
      console.log(`[FETCH-STORE-AUDIO] Starting fetch for conversation ${conversationId}, callId ${callId}`);

      // Import AudioStorageService dynamically to avoid circular dependencies if any
      const { default: AudioStorageService } = await import('./audio-storage-service');
      const audioStorage = new AudioStorageService();

      // Step 1: Download audio from Provider
      console.log(`[FETCH-STORE-AUDIO] Step 1: Downloading audio from Provider...`);
      const audioResult = await provider.getConversationAudio(conversationId);

      if (!audioResult.buffer) {
        if (audioResult.notFound) {
          console.log(`[FETCH-STORE-AUDIO] Step 1: Audio not found (404), updating status to 'unavailable'`);
          await storage.updateCallAudioStatus(callId, organizationId, {
            audioFetchStatus: 'unavailable',
            audioFetchedAt: new Date(),
          });
          return { success: false, error: 'Audio not available for this conversation' };
        } else {
          console.log(`[FETCH-STORE-AUDIO] Step 1: Provider error - ${audioResult.error}, updating status to 'failed'`);
          await storage.updateCallAudioStatus(callId, organizationId, {
            audioFetchStatus: 'failed',
            audioFetchedAt: new Date(),
          });
          return { success: false, error: `Failed to fetch audio: ${audioResult.error}` };
        }
      }

      console.log(`[FETCH-STORE-AUDIO] Step 1: Successfully downloaded ${audioResult.buffer.length} bytes`);

      // Step 2: Store the audio
      console.log(`[FETCH-STORE-AUDIO] Step 2: Uploading audio to local storage...`);
      const { storageKey } = await audioStorage.uploadAudio(conversationId, audioResult.buffer, {
        callId,
        organizationId,
      });
      console.log(`[FETCH-STORE-AUDIO] Step 2: Audio uploaded with storageKey: ${storageKey}`);

      // Step 3: Generate signed URL
      console.log(`[FETCH-STORE-AUDIO] Step 3: Generating signed URL...`);
      const recordingUrl = audioStorage.getSignedUrl(storageKey);
      console.log(`[FETCH-STORE-AUDIO] Step 3: Generated signed URL: ${recordingUrl}`);

      // Step 4: Update database
      console.log(`[FETCH-STORE-AUDIO] Step 4: Updating database with storageKey=${storageKey}, recordingUrl=${recordingUrl}, status='available'`);
      const updated = await storage.updateCallAudioStatus(callId, organizationId, {
        audioStorageKey: storageKey,
        audioFetchStatus: 'available',
        recordingUrl,
        audioFetchedAt: new Date(),
      });
      console.log(`[FETCH-STORE-AUDIO] Step 4: Database update result:`, updated ? 'SUCCESS' : 'FAILED');

      console.log(`[FETCH-STORE-AUDIO] ✅ Complete success for conversation ${conversationId}: ${storageKey}`);
      return { success: true, storageKey, recordingUrl };
    } catch (error: any) {
      console.error(`[FETCH-STORE-AUDIO] ❌ Error in fetchAndStoreAudio for ${conversationId}:`, error);

      try {
        await storage.updateCallAudioStatus(callId, organizationId, {
          audioFetchStatus: 'failed',
          audioFetchedAt: new Date(),
        });
      } catch (dbError: any) {
        console.error(`[FETCH-STORE-AUDIO] Failed to update status after error:`, dbError);
      }

      return { success: false, error: error.message };
    }
  }
}

export default SyncService;
