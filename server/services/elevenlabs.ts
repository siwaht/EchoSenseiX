import crypto from "crypto";

export interface ElevenLabsConfig {
  apiKey: string;
  baseUrl?: string;
  maxRetries?: number;
  retryDelay?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

class ElevenLabsService {
  private config: ElevenLabsConfig;
  private defaultHeaders: HeadersInit;

  constructor(config: ElevenLabsConfig) {
    // Sanitize the API key to ensure no non-ASCII characters
    const sanitizedApiKey = config.apiKey
      .replace(/[\u2010-\u2015]/g, '-')  // Replace Unicode dashes
      .replace(/[\u2018-\u201B]/g, "'")  // Replace smart quotes
      .replace(/[\u201C-\u201F]/g, '"')  // Replace smart double quotes
      .replace(/\u2026/g, '...')         // Replace ellipsis
      .replace(/\s+/g, '')               // Remove whitespace
      .replace(/[^\x20-\x7E]/g, '')      // Remove non-ASCII
      .trim();

    this.config = {
      baseUrl: "https://api.elevenlabs.io",
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
      apiKey: sanitizedApiKey,
    };

    this.defaultHeaders = {
      "xi-api-key": sanitizedApiKey,
      "Content-Type": "application/json",
    };
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const maxRetries = this.config.maxRetries || 3;
    const retryDelay = this.config.retryDelay || 1000;

    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            ...this.defaultHeaders,
            ...options.headers,
          },
        });

        const responseText = await response.text();
        
        if (!response.ok) {
          // Don't retry on client errors (400-499)
          if (response.status >= 400 && response.status < 500) {
            let errorMessage = `API Error: ${response.status} ${response.statusText}`;
            try {
              const errorData = JSON.parse(responseText);
              errorMessage = errorData.message || errorData.detail?.message || errorMessage;
            } catch {
              errorMessage = responseText || errorMessage;
            }
            
            return {
              success: false,
              error: errorMessage,
              statusCode: response.status,
            };
          }
          
          // Retry on server errors (500-599)
          throw new Error(`Server error: ${response.status}`);
        }

        // Parse successful response
        let data: T;
        try {
          data = responseText ? JSON.parse(responseText) : null;
        } catch {
          data = responseText as unknown as T;
        }

        return {
          success: true,
          data,
          statusCode: response.status,
        };
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on the last attempt
        if (attempt < maxRetries - 1) {
          // Exponential backoff
          const delay = retryDelay * Math.pow(2, attempt);
          console.log(`Retrying ElevenLabs API call (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || "Failed after maximum retries",
    };
  }

  // User endpoints
  async getUser() {
    return this.makeRequest<any>("/v1/user");
  }

  async getSubscription() {
    const result = await this.getUser();
    return {
      success: result.success,
      data: result.data?.subscription,
      error: result.error,
    };
  }

  // Agent endpoints
  async getAgents() {
    return this.makeRequest<any>("/v1/convai/agents");
  }

  async getAgent(agentId: string) {
    return this.makeRequest<any>(`/v1/convai/agents/${agentId}`);
  }

  async createAgent(agentData: any) {
    return this.makeRequest<any>("/v1/convai/agents", {
      method: "POST",
      body: JSON.stringify(agentData),
    });
  }

  async updateAgent(agentId: string, updates: any) {
    return this.makeRequest<any>(`/v1/convai/agents/${agentId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async deleteAgent(agentId: string) {
    return this.makeRequest<any>(`/v1/convai/agents/${agentId}`, {
      method: "DELETE",
    });
  }

  // Conversation endpoints
  async getConversations(params?: {
    agent_id?: string;
    page_size?: number;
    page?: number;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.agent_id) queryParams.append("agent_id", params.agent_id);
    if (params?.page_size) queryParams.append("page_size", params.page_size.toString());
    if (params?.page) queryParams.append("page", params.page.toString());
    
    const endpoint = `/v1/convai/conversations${queryParams.toString() ? `?${queryParams}` : ""}`;
    return this.makeRequest<any>(endpoint);
  }

  async getConversation(conversationId: string) {
    return this.makeRequest<any>(`/v1/convai/conversations/${conversationId}`);
  }

  async getConversationTranscript(conversationId: string) {
    return this.makeRequest<any>(`/v1/convai/conversations/${conversationId}/transcript`);
  }

  async sendConversationFeedback(conversationId: string, feedback: any) {
    return this.makeRequest<any>(`/v1/convai/conversations/${conversationId}/feedback`, {
      method: "POST",
      body: JSON.stringify(feedback),
    });
  }

  // Conversation audio endpoints
  // Note: ElevenLabs API doesn't return recording_enabled/has_recording fields
  // The only reliable way to check for audio is to try fetching it directly
  async getConversationAudio(conversationId: string): Promise<{ buffer: Buffer | null; error?: string; notFound?: boolean }> {
    try {
      const url = `${this.config.baseUrl}/v1/convai/conversations/${conversationId}/audio`;
      const keyLast4 = this.config.apiKey.slice(-4);
      
      console.log(`[ELEVENLABS-AUDIO] Fetching audio for conversation ${conversationId}`);
      console.log(`[ELEVENLABS-AUDIO] Using API key: ***${keyLast4}`);
      console.log(`[ELEVENLABS-AUDIO] Request URL: ${url}`);
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "xi-api-key": this.config.apiKey,
        },
      });

      console.log(`[ELEVENLABS-AUDIO] Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`[ELEVENLABS-AUDIO] No audio available for conversation ${conversationId} (404)`);
          return { buffer: null, notFound: true };
        }
        if (response.status === 401) {
          console.error(`[ELEVENLABS-AUDIO] ❌ 401 Unauthorized - Invalid API key ***${keyLast4}`);
        }
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      console.log(`[ELEVENLABS-AUDIO] ✅ Successfully fetched ${arrayBuffer.byteLength} bytes of audio`);
      return { buffer: Buffer.from(arrayBuffer) };
    } catch (error: any) {
      console.error(`[ELEVENLABS-AUDIO] ❌ Error fetching conversation audio for ${conversationId}:`, error.message);
      // Propagate non-404 errors so they can be handled as failures (not unavailable)
      return { buffer: null, error: error.message };
    }
  }

  async fetchAndStoreAudio(
    conversationId: string, 
    callId: string, 
    audioStorageService: any,
    storage: any,
    organizationId: string
  ): Promise<{ success: boolean; storageKey?: string; recordingUrl?: string; error?: string }> {
    try {
      console.log(`[FETCH-STORE-AUDIO] Starting fetch for conversation ${conversationId}, callId ${callId}`);

      // Directly attempt to fetch the audio - the API will tell us if it doesn't exist
      console.log(`[FETCH-STORE-AUDIO] Step 1: Downloading audio from ElevenLabs...`);
      const audioResult = await this.getConversationAudio(conversationId);
      
      if (!audioResult.buffer) {
        // Distinguish between 404 (unavailable) and other errors (failed)
        if (audioResult.notFound) {
          console.log(`[FETCH-STORE-AUDIO] Step 1: Audio not found (404), updating status to 'unavailable'`);
          await storage.updateCallAudioStatus(callId, organizationId, {
            audioFetchStatus: 'unavailable',
            audioFetchedAt: new Date(),
          });
          return { success: false, error: 'Audio not available for this conversation' };
        } else {
          console.log(`[FETCH-STORE-AUDIO] Step 1: API error - ${audioResult.error}, updating status to 'failed'`);
          await storage.updateCallAudioStatus(callId, organizationId, {
            audioFetchStatus: 'failed',
            audioFetchedAt: new Date(),
          });
          return { success: false, error: `Failed to fetch audio: ${audioResult.error}` };
        }
      }

      console.log(`[FETCH-STORE-AUDIO] Step 1: Successfully downloaded ${audioResult.buffer.length} bytes`);

      // Store the audio
      console.log(`[FETCH-STORE-AUDIO] Step 2: Uploading audio to local storage...`);
      const { storageKey } = await audioStorageService.uploadAudio(conversationId, audioResult.buffer, {
        callId,
        organizationId,
      });
      console.log(`[FETCH-STORE-AUDIO] Step 2: Audio uploaded with storageKey: ${storageKey}`);

      console.log(`[FETCH-STORE-AUDIO] Step 3: Generating signed URL...`);
      const recordingUrl = audioStorageService.getSignedUrl(storageKey);
      console.log(`[FETCH-STORE-AUDIO] Step 3: Generated signed URL: ${recordingUrl}`);

      // Update database
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
      console.error(`[FETCH-STORE-AUDIO] Error stack:`, error.stack);
      
      try {
        await storage.updateCallAudioStatus(callId, organizationId, {
          audioFetchStatus: 'failed',
          audioFetchedAt: new Date(),
        });
        console.log(`[FETCH-STORE-AUDIO] Updated status to 'failed' after error`);
      } catch (dbError: any) {
        console.error(`[FETCH-STORE-AUDIO] Failed to update status after error:`, dbError);
      }

      return { success: false, error: error.message };
    }
  }

  // Voice endpoints
  async getVoices() {
    return this.makeRequest<any>("/v1/voices");
  }

  async getVoice(voiceId: string) {
    return this.makeRequest<any>(`/v1/voices/${voiceId}`);
  }

  // Text-to-speech endpoints
  async textToSpeech(text: string, voiceId: string, modelId?: string) {
    const response = await fetch(`${this.config.baseUrl}/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        ...this.defaultHeaders,
      },
      body: JSON.stringify({
        text,
        model_id: modelId || "eleven_multilingual_v2",
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS failed: ${response.status}`);
    }

    return response.arrayBuffer();
  }

  // WebRTC session endpoints
  async createWebRTCSession(agentId: string, enableMicrophone: boolean = true) {
    return this.makeRequest<any>("/v1/convai/conversation/websocket", {
      method: "POST",
      body: JSON.stringify({
        agent_id: agentId,
        enable_microphone: enableMicrophone,
      }),
    });
  }

  async createWebSocketSession(agentId: string) {
    return this.makeRequest<any>("/v1/convai/conversation/websocket", {
      method: "POST",
      body: JSON.stringify({
        agent_id: agentId,
      }),
    });
  }

  // Phone endpoints
  async getPhoneNumbers(agentId?: string) {
    const endpoint = agentId 
      ? `/v1/convai/phone-numbers?agent_id=${agentId}`
      : "/v1/convai/phone-numbers";
    return this.makeRequest<any>(endpoint);
  }

  async createPhoneNumber(phoneNumberData: any) {
    return this.makeRequest<any>("/v1/convai/phone-numbers", {
      method: "POST",
      body: JSON.stringify(phoneNumberData),
    });
  }

  async deletePhoneNumber(phoneNumberId: string) {
    return this.makeRequest<any>(`/v1/convai/phone-numbers/${phoneNumberId}`, {
      method: "DELETE",
    });
  }

  // Analytics endpoints
  async getUsageAnalytics(startDate?: string, endDate?: string) {
    const queryParams = new URLSearchParams();
    if (startDate) queryParams.append("start_date", startDate);
    if (endDate) queryParams.append("end_date", endDate);
    
    const endpoint = `/v1/usage/character-stats${queryParams.toString() ? `?${queryParams}` : ""}`;
    return this.makeRequest<any>(endpoint);
  }

  async getMCPStatus() {
    return this.makeRequest<any>("/v1/convai/mcp/status");
  }

  async updateMCPConfig(config: any) {
    return this.makeRequest<any>("/v1/convai/mcp/config", {
      method: "POST",
      body: JSON.stringify(config),
    });
  }

  // Tool endpoints
  async getTools() {
    return this.makeRequest<any>("/v1/convai/tools");
  }

  async createTool(toolData: any) {
    return this.makeRequest<any>("/v1/convai/tools", {
      method: "POST",
      body: JSON.stringify(toolData),
    });
  }

  async updateTool(toolId: string, updates: any) {
    return this.makeRequest<any>(`/v1/convai/tools/${toolId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async deleteTool(toolId: string) {
    return this.makeRequest<any>(`/v1/convai/tools/${toolId}`, {
      method: "DELETE",
    });
  }

  // Agent Testing endpoints
  async getAgentTests(agentId: string) {
    return this.makeRequest<any>(`/v1/convai/tests?agent_id=${agentId}`);
  }

  async createAgentTest(testData: any) {
    return this.makeRequest<any>("/v1/convai/tests", {
      method: "POST",
      body: JSON.stringify(testData),
    });
  }

  async runAgentTest(testId: string) {
    return this.makeRequest<any>(`/v1/convai/tests/${testId}/run`, {
      method: "POST",
    });
  }

  async getTestResults(testId: string) {
    return this.makeRequest<any>(`/v1/convai/tests/${testId}/results`);
  }

  // Widget endpoints
  async getWidgetConfig(agentId: string) {
    return this.makeRequest<any>(`/v1/convai/widget?agent_id=${agentId}`);
  }

  async updateWidgetConfig(agentId: string, config: any) {
    return this.makeRequest<any>("/v1/convai/widget", {
      method: "POST",
      body: JSON.stringify({ agent_id: agentId, ...config }),
    });
  }

  async getWidgetEmbedCode(agentId: string) {
    return this.makeRequest<any>(`/v1/convai/widget/embed/${agentId}`);
  }

  // SIP Trunk endpoints
  async getSipTrunks() {
    return this.makeRequest<any>("/v1/convai/sip-trunk");
  }

  async createSipTrunk(sipData: any) {
    return this.makeRequest<any>("/v1/convai/sip-trunk", {
      method: "POST",
      body: JSON.stringify(sipData),
    });
  }

  async updateSipTrunk(sipId: string, updates: any) {
    return this.makeRequest<any>(`/v1/convai/sip-trunk/${sipId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async deleteSipTrunk(sipId: string) {
    return this.makeRequest<any>(`/v1/convai/sip-trunk/${sipId}`, {
      method: "DELETE",
    });
  }

  // Batch Calling endpoints
  async getBatchCalls() {
    return this.makeRequest<any>("/v1/convai/batch-calling");
  }

  async createBatchCall(batchData: any) {
    return this.makeRequest<any>("/v1/convai/batch-calling", {
      method: "POST",
      body: JSON.stringify(batchData),
    });
  }

  async getBatchCallStatus(batchId: string) {
    return this.makeRequest<any>(`/v1/convai/batch-calling/${batchId}`);
  }

  async cancelBatchCall(batchId: string) {
    return this.makeRequest<any>(`/v1/convai/batch-calling/${batchId}/cancel`, {
      method: "POST",
    });
  }

  // Workspace endpoints
  async getWorkspace() {
    return this.makeRequest<any>("/v1/convai/workspace");
  }

  async updateWorkspaceSettings(settings: any) {
    return this.makeRequest<any>("/v1/convai/workspace", {
      method: "PATCH",
      body: JSON.stringify(settings),
    });
  }

  async getWorkspaceMembers() {
    return this.makeRequest<any>("/v1/convai/workspace/members");
  }

  async inviteWorkspaceMember(email: string, role: string) {
    return this.makeRequest<any>("/v1/convai/workspace/members/invite", {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
  }

  // LLM Usage endpoints
  async getLlmUsage(startDate?: string, endDate?: string, agentId?: string) {
    const queryParams = new URLSearchParams();
    if (startDate) queryParams.append("start_date", startDate);
    if (endDate) queryParams.append("end_date", endDate);
    if (agentId) queryParams.append("agent_id", agentId);
    
    const endpoint = `/v1/convai/llm-usage${queryParams.toString() ? `?${queryParams}` : ""}`;
    return this.makeRequest<any>(endpoint);
  }

  async getLlmUsageDetails(conversationId: string) {
    return this.makeRequest<any>(`/v1/convai/llm-usage/${conversationId}`);
  }

  // Twilio endpoints
  async getTwilioConfig() {
    return this.makeRequest<any>("/v1/convai/twilio");
  }

  async updateTwilioConfig(config: any) {
    return this.makeRequest<any>("/v1/convai/twilio", {
      method: "POST",
      body: JSON.stringify(config),
    });
  }

  async verifyTwilioPhone(phoneNumber: string) {
    return this.makeRequest<any>("/v1/convai/twilio/verify", {
      method: "POST",
      body: JSON.stringify({ phone_number: phoneNumber }),
    });
  }

  // MCP Server endpoints
  async getMcpServers() {
    return this.makeRequest<any>("/v1/convai/mcp/servers");
  }

  async addMcpServer(serverConfig: any) {
    return this.makeRequest<any>("/v1/convai/mcp/servers", {
      method: "POST",
      body: JSON.stringify(serverConfig),
    });
  }

  async updateMcpServer(serverId: string, updates: any) {
    return this.makeRequest<any>(`/v1/convai/mcp/servers/${serverId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async deleteMcpServer(serverId: string) {
    return this.makeRequest<any>(`/v1/convai/mcp/servers/${serverId}`, {
      method: "DELETE",
    });
  }

  async testMcpServer(serverId: string) {
    return this.makeRequest<any>(`/v1/convai/mcp/servers/${serverId}/test`, {
      method: "POST",
    });
  }

  // Evaluation endpoints
  async getEvaluationCriteria(agentId: string) {
    return this.makeRequest<any>(`/v1/convai/agents/${agentId}/evaluation`);
  }

  async updateEvaluationCriteria(agentId: string, criteria: any) {
    return this.makeRequest<any>(`/v1/convai/agents/${agentId}/evaluation`, {
      method: "POST",
      body: JSON.stringify(criteria),
    });
  }

  async getEvaluationResults(agentId: string, startDate?: string, endDate?: string) {
    const queryParams = new URLSearchParams();
    if (startDate) queryParams.append("start_date", startDate);
    if (endDate) queryParams.append("end_date", endDate);
    
    const endpoint = `/v1/convai/agents/${agentId}/evaluation/results${queryParams.toString() ? `?${queryParams}` : ""}`;
    return this.makeRequest<any>(endpoint);
  }

  // Privacy & Compliance endpoints
  async getPrivacySettings(agentId: string) {
    return this.makeRequest<any>(`/v1/convai/agents/${agentId}/privacy`);
  }

  async updatePrivacySettings(agentId: string, settings: any) {
    return this.makeRequest<any>(`/v1/convai/agents/${agentId}/privacy`, {
      method: "PATCH",
      body: JSON.stringify(settings),
    });
  }

  // Dynamic variables endpoints
  async getDynamicVariables(agentId: string) {
    return this.makeRequest<any>(`/v1/convai/agents/${agentId}/variables`);
  }

  async updateDynamicVariables(agentId: string, variables: any) {
    return this.makeRequest<any>(`/v1/convai/agents/${agentId}/variables`, {
      method: "POST",
      body: JSON.stringify(variables),
    });
  }

  // Agent cloning endpoint
  async cloneAgent(agentId: string, name: string) {
    return this.makeRequest<any>(`/v1/convai/agents/${agentId}/clone`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  // Concurrency settings endpoint
  async getConcurrencySettings() {
    return this.makeRequest<any>("/v1/convai/concurrency");
  }

  async updateConcurrencySettings(settings: any) {
    return this.makeRequest<any>("/v1/convai/concurrency", {
      method: "PATCH",
      body: JSON.stringify(settings),
    });
  }
}

/**
 * Helper functions to handle API key encryption/decryption with backward compatibility.
 * - decryptApiKey: Accepts both plaintext and encrypted values. Never throws on malformed input,
 *   instead falls back to treating the input as plaintext to avoid blocking API calls.
 * - encryptApiKey: AES-256-CBC with scrypt-derived key and random IV. Format: ivHex:encryptedHex
 */
export function decryptApiKey(encryptedApiKey: string): string {
  if (!encryptedApiKey) {
    throw new Error("Missing ElevenLabs API key");
  }
  try {
    // If it's already a plaintext key (typical ElevenLabs format like "sk_...")
    if (!encryptedApiKey.includes(":")) {
      if (/^sk_[A-Za-z0-9]+$/.test(encryptedApiKey)) {
        return encryptedApiKey.trim();
      }
      // Try legacy decryption (old hex format with createDecipher)
      try {
        const decipher = crypto.createDecipher("aes-256-cbc", process.env.ENCRYPTION_KEY || "default-key");
        let decrypted = decipher.update(encryptedApiKey, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted.trim();
      } catch {
        // Fallback: treat as plaintext
        return encryptedApiKey.trim();
      }
    }

    // New format ivHex:encryptedHex (AES-256-CBC)
    const algorithm = "aes-256-cbc";
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || "default-key", "salt", 32);
    const [ivHex, encrypted] = encryptedApiKey.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted.trim();
  } catch (error) {
    console.warn("decryptApiKey: falling back to plaintext due to error:", error);
    return encryptedApiKey.trim();
  }
}

export function encryptApiKey(plainApiKey: string): string {
  const algorithm = "aes-256-cbc";
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || "default-key", "salt", 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(plainApiKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

// Factory function to create client with encrypted key
export function createElevenLabsClient(encryptedApiKey: string): ElevenLabsService {
  const decryptedKey = decryptApiKey(encryptedApiKey);
  return new ElevenLabsService({ apiKey: decryptedKey });
}

export default ElevenLabsService;