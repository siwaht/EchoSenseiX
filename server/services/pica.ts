import axios, { AxiosInstance } from 'axios';
import { IConversationalAIProvider, ITelephonyProvider, ILLMProvider, ITTSProvider, ISTTProvider, ProviderType } from './providers/types';
import { Readable } from 'stream';

interface PicaActionParams {
    tool: string;
    action: string;
    params?: any;
}

export class PicaService implements IConversationalAIProvider, ITelephonyProvider, ILLMProvider, ITTSProvider, ISTTProvider {
    id = 'pica';
    name = 'PicaOS';
    type: ProviderType = 'conversational_ai'; // Primary type, but implements others

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

    // --- ITelephonyProvider Implementation (Twilio via PicaOS) ---

    async getPhoneNumbers(_agentId?: string): Promise<any[]> {
        return this.executeAction({
            tool: 'twilio',
            action: 'get_phone_numbers',
            params: {}
        });
    }

    async createPhoneNumber(data: any): Promise<any> {
        return this.executeAction({
            tool: 'twilio',
            action: 'create_phone_number',
            params: data
        });
    }

    async deletePhoneNumber(phoneNumberId: string): Promise<any> {
        return this.executeAction({
            tool: 'twilio',
            action: 'delete_phone_number',
            params: { phone_number_id: phoneNumberId }
        });
    }

    async makeOutboundCall(to: string, from: string, config: any): Promise<any> {
        return this.executeAction({
            tool: 'twilio',
            action: 'make_call',
            params: { to, from, ...config }
        });
    }

    // --- ILLMProvider Implementation (OpenAI via PicaOS) ---

    async generateResponse(prompt: string, context?: any[], options?: any): Promise<string> {
        const response = await this.executeAction({
            tool: 'openai',
            action: 'chat_completion',
            params: {
                messages: context ? [...context, { role: "user", content: prompt }] : [{ role: "user", content: prompt }],
                ...options
            }
        });
        return response.choices?.[0]?.message?.content || response.content || "";
    }

    async streamResponse(_prompt: string, _context?: any[], _options?: any): Promise<ReadableStream | Readable> {
        throw new Error("Streaming not supported via PicaOS passthrough yet.");
    }

    // --- ITTSProvider Implementation (ElevenLabs via PicaOS) ---

    async getVoices(): Promise<any[]> {
        const response = await this.executeAction({
            tool: 'elevenlabs',
            action: 'get_voices',
            params: {}
        });
        return response.voices || response;
    }

    async getVoice(voiceId: string): Promise<any> {
        return this.executeAction({
            tool: 'elevenlabs',
            action: 'get_voice',
            params: { voice_id: voiceId }
        });
    }

    async generateAudio(text: string, voiceId: string, options?: any): Promise<ArrayBuffer> {
        const response = await this.executeAction({
            tool: 'elevenlabs',
            action: 'text_to_speech',
            params: { text, voice_id: voiceId, ...options }
        });
        // Assuming PicaOS returns audio as base64 or buffer, we might need adjustment here
        // If response is base64 string:
        if (typeof response === 'string') {
            return Buffer.from(response, 'base64');
        }
        return response;
    }

    // --- ISTTProvider Implementation (OpenAI via PicaOS) ---

    async transcribe(audioBuffer: Buffer, options?: any): Promise<string> {
        // We'll likely need to send base64 audio
        const audioBase64 = audioBuffer.toString('base64');
        const response = await this.executeAction({
            tool: 'openai',
            action: 'transcribe',
            params: { file: audioBase64, ...options }
        });
        return response.text || response;
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

    // --- Stripe Specific Methods ---

    /**
     * Create a Stripe Payment Link
     */
    async createPaymentLink(params: any): Promise<any> {
        return this.executeAction({
            tool: 'stripe',
            action: 'create_payment_link',
            params
        });
    }

    /**
     * Get Stripe Payment Status
     */
    async getPaymentStatus(paymentId: string): Promise<any> {
        return this.executeAction({
            tool: 'stripe',
            action: 'get_payment_status',
            params: { payment_id: paymentId }
        });
    }

    /**
     * List Stripe Payments
     */
    async listPayments(params: any): Promise<any> {
        return this.executeAction({
            tool: 'stripe',
            action: 'list_payments',
            params
        });
    }

    /**
     * Create Stripe Customer
     */
    async createCustomer(params: any): Promise<any> {
        return this.executeAction({
            tool: 'stripe',
            action: 'create_customer',
            params
        });
    }

    // --- MongoDB Atlas Integration ---

    /**
     * Find documents in MongoDB
     */
    async mongoFind(collection: string, filter: any = {}): Promise<any> {
        return this.executeAction({
            tool: 'mongodb',
            action: 'find',
            params: { collection, filter }
        });
    }

    /**
     * Insert a document into MongoDB
     */
    async mongoInsertOne(collection: string, document: any): Promise<any> {
        return this.executeAction({
            tool: 'mongodb',
            action: 'insert_one',
            params: { collection, document }
        });
    }

    // --- Supabase Integration ---

    /**
     * Execute a Supabase Query (Select)
     */
    async supabaseQuery(table: string, select: string = '*', filters: any = {}): Promise<any> {
        return this.executeAction({
            tool: 'supabase',
            action: 'query',
            params: { table, select, filters }
        });
    }

    /**
     * Insert data into Supabase
     */
    async supabaseInsert(table: string, data: any): Promise<any> {
        return this.executeAction({
            tool: 'supabase',
            action: 'insert',
            params: { table, data }
        });
    }
}

export const picaService = new PicaService();
