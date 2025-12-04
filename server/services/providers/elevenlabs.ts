import { IConversationalAIProvider, ITTSProvider, ProviderType } from "./types";
import ElevenLabsService from "../elevenlabs";

export class ElevenLabsProvider implements IConversationalAIProvider, ITTSProvider {
    id = "elevenlabs";
    name = "ElevenLabs";
    type: ProviderType = "conversational_ai";
    private client: ElevenLabsService | null = null;

    async initialize(config: any): Promise<void> {
        this.client = new ElevenLabsService(config);
    }

    private getClient(): ElevenLabsService {
        if (!this.client) {
            throw new Error("ElevenLabsProvider not initialized");
        }
        return this.client;
    }

    // ITTSProvider implementation
    async getVoices(): Promise<any[]> {
        const response = await this.getClient().getVoices();
        if (!response.success) {
            throw new Error(response.error || "Failed to fetch voices");
        }
        return response.data.voices;
    }

    async getVoice(voiceId: string): Promise<any> {
        const response = await this.getClient().getVoice(voiceId);
        if (!response.success) {
            throw new Error(response.error || "Failed to fetch voice");
        }
        return response.data;
    }

    async generateAudio(text: string, voiceId: string, options?: any): Promise<ArrayBuffer> {
        return this.getClient().textToSpeech(text, voiceId, options?.modelId);
    }

    // IConversationalAIProvider implementation
    async createAgent(agentData: any): Promise<any> {
        const response = await this.getClient().createAgent(agentData);
        if (!response.success) throw new Error(response.error);
        return response.data;
    }

    async updateAgent(agentId: string, updates: any): Promise<any> {
        const response = await this.getClient().updateAgent(agentId, updates);
        if (!response.success) throw new Error(response.error);
        return response.data;
    }

    async deleteAgent(agentId: string): Promise<any> {
        const response = await this.getClient().deleteAgent(agentId);
        if (!response.success) throw new Error(response.error);
        return response.data;
    }

    async getAgent(agentId: string): Promise<any> {
        const response = await this.getClient().getAgent(agentId);
        if (!response.success) throw new Error(response.error);
        return response.data;
    }

    async getAgents(): Promise<any[]> {
        const response = await this.getClient().getAgents();
        if (!response.success) throw new Error(response.error);
        return response.data.agents;
    }

    async getConversations(params?: any): Promise<any> {
        const response = await this.getClient().getConversations(params);
        if (!response.success) throw new Error(response.error);
        return response.data;
    }

    async getConversation(conversationId: string): Promise<any> {
        const response = await this.getClient().getConversation(conversationId);
        if (!response.success) throw new Error(response.error);
        return response.data;
    }

    async getConversationTranscript(conversationId: string): Promise<any> {
        const response = await this.getClient().getConversationTranscript(conversationId);
        if (!response.success) throw new Error(response.error);
        return response.data;
    }

    async getConversationAudio(conversationId: string): Promise<{ buffer: Buffer | null; error?: string; notFound?: boolean }> {
        return this.getClient().getConversationAudio(conversationId);
    }

    async createWebRTCSession(agentId: string, options?: any): Promise<any> {
        const response = await this.getClient().createWebRTCSession(agentId, options?.enableMicrophone);
        if (!response.success) throw new Error(response.error);
        return response.data;
    }

    async manageTools(tools: any[], _integrationId?: string): Promise<{ toolIds: string[]; builtInTools: any }> {
        const client = this.getClient();
        const toolIds: string[] = [];
        const builtInTools: any = {};

        if (!tools || tools.length === 0) {
            return { toolIds, builtInTools };
        }

        for (const tool of tools) {
            // Handle system/built-in tools
            if (tool.type === 'system' || tool.name === 'end_call' || tool.name === 'language_detection' ||
                tool.name === 'skip_turn' || tool.name === 'transfer_to_agent' || tool.name === 'transfer_to_number' ||
                tool.name === 'play_dtmf' || tool.name === 'voicemail_detection') {
                // Map our system tool names to ElevenLabs built-in tool names
                let builtInToolName = tool.name;
                if (tool.name === 'play_dtmf') {
                    builtInToolName = 'play_keypad_tone';
                }
                // Add tool to object format with proper configuration
                builtInTools[builtInToolName] = {
                    enabled: true
                };
            }
            // Handle client and server tools (webhooks)
            else if (tool.type === 'webhook' || tool.type === 'client') {
                try {
                    // First, try to get existing tools to check if this tool already exists
                    const existingToolsResponse = await client.getTools();
                    const existingTools = existingToolsResponse.success ? existingToolsResponse.data.tools : [];

                    // Check if a tool with the same name already exists
                    const existingTool = existingTools.find((t: any) => t.name === tool.name);

                    let toolId;
                    if (existingTool) {
                        // Update existing tool
                        console.log(`Updating existing tool: ${tool.name} (ID: ${existingTool.tool_id})`);
                        const updatePayload = {
                            type: tool.type === 'webhook' ? 'webhook' : 'client',
                            name: tool.name,
                            description: tool.description,
                            ...(tool.type === 'webhook' ? {
                                url: tool.url,
                                method: tool.method,
                                headers: tool.headers || {},
                                query_parameters: tool.query_parameters || [],
                                body_parameters: tool.body_parameters || [],
                                path_parameters: tool.path_parameters || []
                            } : {
                                parameters: tool.parameters || {}
                            })
                        };

                        await client.updateTool(existingTool.tool_id, updatePayload);
                        toolId = existingTool.tool_id;
                    } else {
                        // Create new tool
                        const createPayload = {
                            type: tool.type === 'webhook' ? 'webhook' : 'client',
                            name: tool.name,
                            description: tool.description,
                            ...(tool.type === 'webhook' ? {
                                url: tool.url,
                                method: tool.method,
                                headers: tool.headers || {},
                                query_parameters: tool.query_parameters || [],
                                body_parameters: tool.body_parameters || [],
                                path_parameters: tool.path_parameters || []
                            } : {
                                parameters: tool.parameters || {}
                            })
                        };

                        const response = await client.createTool(createPayload);
                        toolId = response.success ? response.data.tool_id : null;
                    }

                    if (toolId) {
                        toolIds.push(toolId);
                    }
                } catch (error) {
                    console.error(`Error managing tool ${tool.name}:`, error);
                    // Continue with other tools even if one fails
                }
            }
        }

        return { toolIds, builtInTools };
    }
    // Phone Number Management
    async getPhoneNumbers(): Promise<any[]> {
        const response = await this.getClient().getPhoneNumbers();
        if (!response.success) throw new Error(response.error);
        return response.data.phone_numbers || response.data;
    }

    async createPhoneNumber(data: any): Promise<any> {
        const response = await this.getClient().createPhoneNumber(data);
        if (!response.success) throw new Error(response.error);
        return response.data;
    }

    async updatePhoneNumber(id: string, updates: any): Promise<any> {
        const response = await this.getClient().updatePhoneNumber(id, updates);
        if (!response.success) throw new Error(response.error);
        return response.data;
    }

    async deletePhoneNumber(phoneNumberId: string): Promise<any> {
        const response = await this.getClient().deletePhoneNumber(phoneNumberId);
        if (!response.success) throw new Error(response.error);
        return response.data;
    }

    // Batch Calling
    async createBatchCall(data: any): Promise<any> {
        const response = await this.getClient().createBatchCall(data);
        if (!response.success) throw new Error(response.error);
        return response.data;
    }

    async getBatchCalls(): Promise<any[]> {
        const response = await this.getClient().getBatchCalls();
        if (!response.success) throw new Error(response.error);
        return response.data.batch_calls || response.data;
    }

    async getBatchCallStatus(batchId: string): Promise<any> {
        const response = await this.getClient().getBatchCallStatus(batchId);
        if (!response.success) throw new Error(response.error);
        return response.data;
    }

    async cancelBatchCall(batchId: string): Promise<any> {
        const response = await this.getClient().cancelBatchCall(batchId);
        if (!response.success) throw new Error(response.error);
        return response.data;
    }

    // Conversation Initiation
    async createConversation(data: any): Promise<any> {
        const response = await this.getClient().createConversation(data);
        if (!response.success) throw new Error(response.error);
        return response.data;
    }
}
