import axios, { AxiosInstance } from 'axios';
import { IConversationalAIProvider, ProviderType } from './providers/types';

interface PicaActionParams {
    tool: string;
    action: string;
    params?: any;
}

export class PicaService implements IConversationalAIProvider {
    id = 'pica';
    name = 'PicaOS';
    type: ProviderType = 'conversational_ai';

    private client: AxiosInstance;
    private secretKey: string;

    constructor() {
        this.secretKey = process.env.PICA_SECRET_KEY || '';

        if (!this.secretKey) {
            console.warn('⚠️ PICA_SECRET_KEY is not set. PicaOS integration will not work.');
        }

        this.client = axios.create({
            baseURL: 'https://api.picaos.com/v1',
            headers: {
                'Authorization': `Bearer ${this.secretKey}`,
                'Content-Type': 'application/json'
            }
        });
    }

    async initialize(config: any): Promise<void> {
        if (config.apiKey) {
            this.secretKey = config.apiKey;
            this.client.defaults.headers['Authorization'] = `Bearer ${this.secretKey}`;
        }
    }

    /**
     * Execute a generic action via PicaOS Passthrough API
     */
    async executeAction({ tool, action, params }: PicaActionParams): Promise<any> {
        try {
            const response = await this.client.post('/passthrough', {
                tool,
                action,
                params
            });

            return response.data;
        } catch (error: any) {
            console.error(`❌ PicaOS Action Failed: ${tool}.${action}`, error.response?.data || error.message);
            throw new Error(`PicaOS Action Failed: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * List available connections
     */
    async listConnections(): Promise<any[]> {
        try {
            const response = await this.client.get('/connections');
            return response.data;
        } catch (error: any) {
            console.error('❌ Failed to list PicaOS connections', error.response?.data || error.message);
            return [];
        }
    }

    // --- IConversationalAIProvider Implementation ---

    async createAgent(agentData: any): Promise<any> {
        return this.executeAction({
            tool: 'elevenlabs',
            action: 'create_agent',
            params: agentData
        });
    }

    async updateAgent(agentId: string, updates: any): Promise<any> {
        return this.executeAction({
            tool: 'elevenlabs',
            action: 'update_agent',
            params: { ...updates, agent_id: agentId }
        });
    }

    async deleteAgent(agentId: string): Promise<any> {
        return this.executeAction({
            tool: 'elevenlabs',
            action: 'delete_agent',
            params: { agent_id: agentId }
        });
    }

    async getAgent(agentId: string): Promise<any> {
        return this.executeAction({
            tool: 'elevenlabs',
            action: 'get_agent',
            params: { agent_id: agentId }
        });
    }

    async getAgents(): Promise<any[]> {
        const response = await this.executeAction({
            tool: 'elevenlabs',
            action: 'get_agents',
            params: {}
        });
        return response.agents || response;
    }

    async getConversations(params?: any): Promise<any> {
        return this.executeAction({
            tool: 'elevenlabs',
            action: 'get_history', // Mapping getConversations to get_history
            params
        });
    }

    async getConversation(conversationId: string): Promise<any> {
        return this.executeAction({
            tool: 'elevenlabs',
            action: 'get_conversation',
            params: { conversation_id: conversationId }
        });
    }

    async getConversationTranscript(conversationId: string): Promise<any> {
        try {
            return await this.executeAction({
                tool: 'elevenlabs',
                action: 'get_transcript',
                params: { conversation_id: conversationId }
            });
        } catch (e) {
            console.warn('getConversationTranscript not fully supported via PicaOS yet');
            return null;
        }
    }

    async getConversationAudio(conversationId: string): Promise<{ buffer: Buffer | null; error?: string; notFound?: boolean }> {
        try {
            const conversation = await this.getConversation(conversationId);
            if (conversation && conversation.recording_url) {
                const response = await axios.get(conversation.recording_url, { responseType: 'arraybuffer' });
                return { buffer: Buffer.from(response.data) };
            }
            return { buffer: null, notFound: true };
        } catch (error: any) {
            return { buffer: null, error: error.message };
        }
    }

    async createWebRTCSession(_agentId: string, _options?: any): Promise<any> {
        throw new Error('createWebRTCSession not implemented in PicaService');
    }

    async manageTools(_tools: any[], _integrationId?: string): Promise<{ toolIds: string[]; builtInTools: any }> {
        return { toolIds: [], builtInTools: {} };
    }

    async createBatchCall(_data: any): Promise<any> {
        throw new Error('createBatchCall not implemented in PicaService');
    }

    async getBatchCalls(): Promise<any[]> {
        return [];
    }

    async getBatchCallStatus(_batchId: string): Promise<any> {
        return null;
    }

    async cancelBatchCall(_batchId: string): Promise<any> {
        return null;
    }

    async createConversation(data: any): Promise<any> {
        return this.executeAction({
            tool: 'elevenlabs',
            action: 'outbound_call',
            params: data
        });
    }

    // --- Additional Helper Methods ---

    /**
     * Create Knowledge Base
     */
    async createKnowledgeBase(params: any): Promise<any> {
        return this.executeAction({
            tool: 'elevenlabs',
            action: 'create_knowledge_base',
            params
        });
    }

    /**
     * Initiate Outbound Call (Alias for createConversation)
     */
    async outboundCall(params: any): Promise<any> {
        return this.createConversation(params);
    }

    /**
     * Get Call History (Alias for getConversations)
     */
    async getCallHistory(params: any): Promise<any> {
        return this.getConversations(params);
    }
}

export const picaService = new PicaService();
