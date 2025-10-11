/**
 * ElevenLabs Real-Time Sync Service
 * 
 * This service provides comprehensive real-time synchronization of all ElevenLabs data:
 * - Credits used and cost tracking
 * - Dashboard data (agents, conversations, analytics)
 * - Call transcripts and recordings
 * - Call logs and history
 * - Call summaries and analysis
 * - Usage statistics and billing
 */

import { storage } from "../storage";
import ElevenLabsService, { createElevenLabsClient } from "./elevenlabs";
import type { InsertCallLog, InsertAgent } from "@shared/schema";

export interface RealtimeSyncResult {
  success: boolean;
  data: {
    credits?: CreditsData;
    dashboard?: DashboardData;
    calls?: CallsData;
    analytics?: AnalyticsData;
  };
  errors: string[];
  duration: number;
  timestamp: string;
}

export interface CreditsData {
  used: number;
  remaining: number;
  cost: number;
  subscription: any;
  billing: any;
}

export interface DashboardData {
  agents: any[];
  recentCalls: any[];
  totalCalls: number;
  activeAgents: number;
  lastSync: string;
}

export interface CallsData {
  conversations: any[];
  transcripts: any[];
  recordings: any[];
  summaries: any[];
  logs: any[];
}

export interface AnalyticsData {
  usage: any;
  performance: any;
  trends: any;
  insights: any;
}

export class ElevenLabsRealtimeSync {
  private client: ElevenLabsService;
  private organizationId: string;
  private apiKey: string;

  constructor(organizationId: string, apiKey: string) {
    this.organizationId = organizationId;
    this.apiKey = apiKey;
    this.client = createElevenLabsClient(apiKey);
  }

  /**
   * Comprehensive real-time sync of all ElevenLabs data
   */
  async syncAllData(): Promise<RealtimeSyncResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const errors: string[] = [];

    try {
      console.log(`[REALTIME-SYNC] Starting comprehensive sync for organization ${this.organizationId}`);

      // Parallel execution of all sync operations
      const [creditsResult, dashboardResult, callsResult, analyticsResult] = await Promise.allSettled([
        this.syncCreditsData(),
        this.syncDashboardData(),
        this.syncCallsData(),
        this.syncAnalyticsData()
      ]);

      const result: RealtimeSyncResult = {
        success: true,
        data: {},
        errors,
        duration: Date.now() - startTime,
        timestamp
      };

      // Process credits data
      if (creditsResult.status === 'fulfilled') {
        result.data.credits = creditsResult.value;
      } else {
        errors.push(`Credits sync failed: ${creditsResult.reason}`);
      }

      // Process dashboard data
      if (dashboardResult.status === 'fulfilled') {
        result.data.dashboard = dashboardResult.value;
      } else {
        errors.push(`Dashboard sync failed: ${dashboardResult.reason}`);
      }

      // Process calls data
      if (callsResult.status === 'fulfilled') {
        result.data.calls = callsResult.value;
      } else {
        errors.push(`Calls sync failed: ${callsResult.reason}`);
      }

      // Process analytics data
      if (analyticsResult.status === 'fulfilled') {
        result.data.analytics = analyticsResult.value;
      } else {
        errors.push(`Analytics sync failed: ${analyticsResult.reason}`);
      }

      // Update integration status
      await this.updateIntegrationStatus();

      console.log(`[REALTIME-SYNC] Completed in ${result.duration}ms`);
      return result;

    } catch (error: any) {
      console.error(`[REALTIME-SYNC] Failed:`, error);
      return {
        success: false,
        data: {},
        errors: [...errors, error.message],
        duration: Date.now() - startTime,
        timestamp
      };
    }
  }

  /**
   * Sync credits and billing data
   */
  public async syncCreditsData(): Promise<CreditsData> {
    try {
      console.log(`[REALTIME-SYNC] Syncing credits data...`);

      // Get user subscription data
      const userResult = await this.client.getUser();
      if (!userResult.success || !userResult.data) {
        throw new Error(userResult.error || "Failed to fetch user data");
      }

      const user = userResult.data;
      const subscription = user.subscription;

      // Get usage statistics
      const usageResult = await this.client.getUsageAnalytics();
      const usage = usageResult.success ? usageResult.data : null;

      const creditsData: CreditsData = {
        used: subscription?.character_count || 0,
        remaining: subscription?.character_limit ? subscription.character_limit - (subscription.character_count || 0) : 0,
        cost: subscription?.next_invoice?.amount_due_cents ? subscription.next_invoice.amount_due_cents / 100 : 0,
        subscription: subscription,
        billing: {
          nextInvoice: subscription?.next_invoice,
          paymentMethod: subscription?.payment_method,
          plan: subscription?.plan
        }
      };

      console.log(`[REALTIME-SYNC] Credits data synced: ${creditsData.used} used, ${creditsData.remaining} remaining`);
      return creditsData;

    } catch (error: any) {
      console.error(`[REALTIME-SYNC] Credits sync error:`, error);
      throw error;
    }
  }

  /**
   * Sync dashboard data (agents, recent calls, overview)
   */
  public async syncDashboardData(): Promise<DashboardData> {
    try {
      console.log(`[REALTIME-SYNC] Syncing dashboard data...`);

      // Get agents
      const agentsResult = await this.client.getAgents();
      const agents = agentsResult.success ? (agentsResult.data.agents || agentsResult.data || []) : [];

      // Get recent conversations (last 50 for dashboard performance)
      const conversationsResult = await this.client.getConversations({ page_size: 50 });
      const conversations = conversationsResult.success ? (conversationsResult.data.conversations || conversationsResult.data || []) : [];

      // Process agents and sync to database
      for (const agent of agents) {
        await this.syncAgentToDatabase(agent);
      }

      // Process recent conversations
      const recentCalls = [];
      for (const conversation of conversations) {
        const callData = await this.processConversationData(conversation);
        recentCalls.push(callData);
        await this.syncCallLogToDatabase(conversation);
      }

      const dashboardData: DashboardData = {
        agents: agents,
        recentCalls: recentCalls,
        totalCalls: conversations.length,
        activeAgents: agents.filter((a: any) => a.status === 'active').length,
        lastSync: new Date().toISOString()
      };

      console.log(`[REALTIME-SYNC] Dashboard data synced: ${agents.length} agents, ${conversations.length} recent calls`);
      return dashboardData;

    } catch (error: any) {
      console.error(`[REALTIME-SYNC] Dashboard sync error:`, error);
      throw error;
    }
  }

  /**
   * Sync comprehensive calls data (transcripts, recordings, summaries, logs)
   */
  public async syncCallsData(): Promise<CallsData> {
    try {
      console.log(`[REALTIME-SYNC] Syncing calls data...`);

      // Get all conversations with pagination
      const allConversations = await this.getAllConversations();
      
      const callsData: CallsData = {
        conversations: [],
        transcripts: [],
        recordings: [],
        summaries: [],
        logs: []
      };

      // Process each conversation comprehensively
      for (const conversation of allConversations) {
        try {
          // Get detailed conversation data
          const detailResult = await this.client.getConversation(conversation.conversation_id);
          if (detailResult.success && detailResult.data) {
            const detailedConversation = detailResult.data;
            callsData.conversations.push(detailedConversation);

            // Get transcript
            try {
              const transcriptResult = await this.client.getConversationTranscript(conversation.conversation_id);
              if (transcriptResult.success && transcriptResult.data) {
                callsData.transcripts.push({
                  conversation_id: conversation.conversation_id,
                  transcript: transcriptResult.data
                });
              }
            } catch (transcriptError) {
              console.warn(`[REALTIME-SYNC] Failed to get transcript for ${conversation.conversation_id}`);
            }

            // Get recording URL if available
            if (detailedConversation.recording_url) {
              callsData.recordings.push({
                conversation_id: conversation.conversation_id,
                recording_url: detailedConversation.recording_url
              });
            }

            // Extract summary and analysis if available
            if (detailedConversation.analysis || detailedConversation.summary) {
              callsData.summaries.push({
                conversation_id: conversation.conversation_id,
                analysis: detailedConversation.analysis,
                summary: detailedConversation.summary,
                sentiment: detailedConversation.sentiment,
                keywords: detailedConversation.keywords
              });
            }

            // Create comprehensive call log
            const callLog = await this.createComprehensiveCallLog(detailedConversation);
            callsData.logs.push(callLog);

            // Sync to database
            await this.syncCallLogToDatabase(detailedConversation);

          }
        } catch (error: any) {
          console.error(`[REALTIME-SYNC] Failed to process conversation ${conversation.conversation_id}:`, error);
        }
      }

      console.log(`[REALTIME-SYNC] Calls data synced: ${callsData.conversations.length} conversations, ${callsData.transcripts.length} transcripts, ${callsData.recordings.length} recordings`);
      return callsData;

    } catch (error: any) {
      console.error(`[REALTIME-SYNC] Calls sync error:`, error);
      throw error;
    }
  }

  /**
   * Sync analytics and usage data
   */
  public async syncAnalyticsData(): Promise<AnalyticsData> {
    try {
      console.log(`[REALTIME-SYNC] Syncing analytics data...`);

      // Get usage analytics
      const usageResult = await this.client.getUsageAnalytics();
      const usage = usageResult.success ? usageResult.data : null;

      // Get LLM usage data
      const llmUsageResult = await this.client.getLlmUsage();
      const llmUsage = llmUsageResult.success ? llmUsageResult.data : null;

      // Calculate performance metrics
      const performance = await this.calculatePerformanceMetrics();

      // Generate insights
      const insights = await this.generateInsights(usage, llmUsage);

      const analyticsData: AnalyticsData = {
        usage: usage,
        performance: performance,
        trends: {
          dailyUsage: usage?.daily_usage || [],
          monthlyUsage: usage?.monthly_usage || [],
          costTrends: usage?.cost_trends || []
        },
        insights: insights
      };

      console.log(`[REALTIME-SYNC] Analytics data synced`);
      return analyticsData;

    } catch (error: any) {
      console.error(`[REALTIME-SYNC] Analytics sync error:`, error);
      throw error;
    }
  }

  /**
   * Get all conversations with pagination
   */
  private async getAllConversations(): Promise<any[]> {
    const allConversations = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      try {
        const result = await this.client.getConversations({ 
          page_size: pageSize, 
          page: page 
        });
        
        if (!result.success || !result.data) {
          break;
        }

        const conversations = result.data.conversations || result.data || [];
        if (conversations.length === 0) {
          hasMore = false;
        } else {
          allConversations.push(...conversations);
          page++;
          
          // Limit to prevent infinite loops
          if (page > 50) {
            console.warn(`[REALTIME-SYNC] Reached page limit (50), stopping pagination`);
            break;
          }
        }
      } catch (error) {
        console.error(`[REALTIME-SYNC] Pagination error on page ${page}:`, error);
        break;
      }
    }

    console.log(`[REALTIME-SYNC] Retrieved ${allConversations.length} total conversations`);
    return allConversations;
  }

  /**
   * Sync agent to database
   */
  private async syncAgentToDatabase(agent: any): Promise<void> {
    try {
      const existingAgent = await storage.getAgentByElevenLabsId(agent.agent_id, this.organizationId);

      const agentData: Partial<InsertAgent> = {
        organizationId: this.organizationId,
        elevenLabsAgentId: agent.agent_id,
        name: agent.name || "Unnamed Agent",
        voiceId: agent.conversation_config?.voice?.voice_id || null,
        systemPrompt: agent.prompt?.prompt || null,
        firstMessage: agent.conversation_config?.first_message || null,
        language: agent.conversation_config?.language || "en",
      };

      if (existingAgent) {
        await storage.updateAgent(existingAgent.id, this.organizationId, agentData);
      } else {
        await storage.createAgent(agentData as InsertAgent);
      }
    } catch (error) {
      console.error(`[REALTIME-SYNC] Failed to sync agent ${agent.agent_id}:`, error);
    }
  }

  /**
   * Sync call log to database
   */
  private async syncCallLogToDatabase(conversation: any): Promise<void> {
    try {
      const existingLog = await storage.getCallLogByConversationId(
        this.organizationId,
        conversation.conversation_id
      );

      const callLogData: Partial<InsertCallLog> = {
        organizationId: this.organizationId,
        conversationId: conversation.conversation_id,
        agentId: conversation.agent_id,
        elevenLabsCallId: conversation.conversation_id,
        phoneNumber: conversation.metadata?.caller_number || null,
        status: conversation.status || "completed",
        duration: conversation.duration_seconds || 0,
        cost: conversation.cost ? String(conversation.cost) : null,
        transcript: null,
        audioUrl: conversation.recording_url || null,
        createdAt: conversation.created_at ? new Date(conversation.created_at) : new Date(),
      };

      // Get transcript if available
      try {
        const transcriptResult = await this.client.getConversationTranscript(conversation.conversation_id);
        if (transcriptResult.success && transcriptResult.data) {
          callLogData.transcript = JSON.stringify(transcriptResult.data);
        }
      } catch (transcriptError) {
        // Continue without transcript
      }

      if (existingLog) {
        await storage.updateCallLog(existingLog.id, this.organizationId, callLogData);
      } else {
        await storage.createCallLog(callLogData as InsertCallLog);
      }
    } catch (error) {
      console.error(`[REALTIME-SYNC] Failed to sync call log ${conversation.conversation_id}:`, error);
    }
  }

  /**
   * Create comprehensive call log with all available data
   */
  private async createComprehensiveCallLog(conversation: any): Promise<any> {
    const callLog = {
      conversation_id: conversation.conversation_id,
      agent_id: conversation.agent_id,
      status: conversation.status,
      duration: conversation.duration_seconds,
      cost: conversation.cost,
      created_at: conversation.created_at,
      updated_at: conversation.updated_at,
      end_reason: conversation.end_reason,
      recording_url: conversation.recording_url,
      metadata: conversation.metadata,
      analysis: conversation.analysis,
      summary: conversation.summary,
      sentiment: conversation.sentiment,
      keywords: conversation.keywords,
      call_quality: conversation.call_quality,
      customer_satisfaction: conversation.customer_satisfaction,
      lastSynced: new Date().toISOString()
    };

    return callLog;
  }

  /**
   * Process conversation data for dashboard
   */
  private async processConversationData(conversation: any): Promise<any> {
    return {
      id: conversation.conversation_id,
      agent_id: conversation.agent_id,
      status: conversation.status,
      duration: conversation.duration_seconds,
      cost: conversation.cost,
      created_at: conversation.created_at,
      end_reason: conversation.end_reason,
      has_recording: !!conversation.recording_url,
      has_transcript: false // Will be updated when transcript is fetched
    };
  }

  /**
   * Calculate performance metrics
   */
  private async calculatePerformanceMetrics(): Promise<any> {
    try {
      // Get recent call logs from database
      const recentCalls = await storage.getCallLogs(this.organizationId, { limit: 100 });
      
      const metrics = {
        totalCalls: recentCalls.length,
        averageDuration: 0,
        totalCost: 0,
        successRate: 0,
        averageSatisfaction: 0
      };

      if (recentCalls.length > 0) {
        const totalDuration = recentCalls.reduce((sum, call) => sum + (call.duration || 0), 0);
        const totalCost = recentCalls.reduce((sum, call) => sum + (parseFloat(call.cost || '0')), 0);
        const successfulCalls = recentCalls.filter(call => call.status === 'completed').length;

        metrics.averageDuration = totalDuration / recentCalls.length;
        metrics.totalCost = totalCost;
        metrics.successRate = (successfulCalls / recentCalls.length) * 100;
      }

      return metrics;
    } catch (error) {
      console.error(`[REALTIME-SYNC] Failed to calculate performance metrics:`, error);
      return {};
    }
  }

  /**
   * Generate insights from usage data
   */
  private async generateInsights(usage: any, llmUsage: any): Promise<any> {
    const insights = {
      peakUsageHours: [],
      costOptimization: [],
      performanceRecommendations: [],
      trends: []
    };

    // Analyze usage patterns
    if (usage) {
      // Peak usage analysis
      if (usage.daily_usage) {
        const hourlyUsage = {};
        usage.daily_usage.forEach((day: any) => {
          if (day.hourly_breakdown) {
            Object.entries(day.hourly_breakdown).forEach(([hour, count]) => {
              hourlyUsage[hour] = (hourlyUsage[hour] || 0) + (count as number);
            });
          }
        });
        
        const sortedHours = Object.entries(hourlyUsage)
          .sort(([,a], [,b]) => (b as number) - (a as number))
          .slice(0, 3);
        
        insights.peakUsageHours = sortedHours.map(([hour, count]) => ({
          hour: parseInt(hour),
          calls: count
        }));
      }

      // Cost optimization suggestions
      if (usage.monthly_cost && usage.monthly_cost > 100) {
        insights.costOptimization.push({
          type: "high_usage",
          message: "Consider optimizing agent responses to reduce character usage",
          potential_savings: "15-30%"
        });
      }
    }

    return insights;
  }

  /**
   * Update integration status
   */
  private async updateIntegrationStatus(): Promise<void> {
    try {
      const integration = await storage.getIntegration(this.organizationId, "elevenlabs");
      if (integration) {
        await storage.updateIntegrationStatus(integration.id, "ACTIVE", new Date());
      }
    } catch (error) {
      console.error(`[REALTIME-SYNC] Failed to update integration status:`, error);
    }
  }
}

export default ElevenLabsRealtimeSync;
