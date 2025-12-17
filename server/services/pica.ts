import axios, { AxiosInstance } from 'axios';
import { IConversationalAIProvider, ITelephonyProvider, ILLMProvider, ITTSProvider, ISTTProvider, ProviderType } from './providers/types';
import { Readable } from 'stream';

// PicaOS Action IDs for ElevenLabs passthrough
const PICA_ACTION_IDS = {
    // Agent Management
    LIST_AGENTS: 'conn_mod_def::GCcb-NFocrI::TWFlai4QQhuDVXZnNOaTeA',
    GET_AGENT: 'conn_mod_def::GCcb-vHVNgs::-804MkN5TgOFbcxSH14dRg',
    CREATE_AGENT: 'conn_mod_def::GCcb_iT9I0k::xNo_w809TEu2pRzqcCQ4_w',
    UPDATE_AGENT: 'conn_mod_def::GCccCqafPzo::zXp48cfcToK6-opzHLYe7g',
    DELETE_AGENT: 'conn_mod_def::GCcb-AieXyI::fUZGVTkhRyK5DFsh956RTg',
    GET_AGENT_LINK: 'conn_mod_def::GCcb-Nm7Gpc::xlWjCJFJSkKAfp8KPP9BaA',
    GET_DEPENDENT_AGENTS: 'conn_mod_def::GCcb_oq6wtM::cpl68YtwTwuJ3WcMHd2big',

    // Knowledge Base Management
    LIST_KB_DOCUMENTS: 'conn_mod_def::GCcb_ZgOwos::MhWc8fTFRj2BeqvqrnvKBA',
    CREATE_KB_DOCUMENT: 'conn_mod_def::GCcb_oYZVn8::bkNMgIt5S7iT222YoMrhwQ',
    GET_KB_DOCUMENT: 'conn_mod_def::GCcb_UYJ55g::jV7u86sDSWWw6HEprHxtNA',
    DELETE_KB_DOCUMENT: 'conn_mod_def::GCcb_LZDmeA::AALq-OEBQEOJgWLXjSzh_w',

    // Conversation/Call History Management
    LIST_CONVERSATIONS: 'conn_mod_def::GCcb-oM9Wxk::S5TI7_cuQAS6oIbDcX6SXg',
    GET_CONVERSATION: 'conn_mod_def::GCcb-2-J_rw::qjRyRZbVRUeySosJocrT-w',
    DELETE_CONVERSATION: 'conn_mod_def::GCcb-8VswgU::tNsGlwfGTNup5hOJBdGKIQ',
    GET_CONVERSATION_AUDIO: 'conn_mod_def::GCcb-cGKkqU::GhWURfavRkuy6xKx6kam6Q',
    SEND_CONVERSATION_FEEDBACK: 'conn_mod_def::GCcb-pY0rV4::UkvnvUzLSmSdLDGcabyMAA',

    // Phone Number Management
    LIST_PHONE_NUMBERS: 'conn_mod_def::GCcb_kyEHuo::aJqzbfJKRNyo75jg-K1bhg',
    GET_PHONE_NUMBER: 'conn_mod_def::GCcb_5Fdys8::RrHeoNxrT02H0M3fqqsVnw',
    CREATE_PHONE_NUMBER: 'conn_mod_def::GCcb_c6ac1E::4CIaoE3kSK2k_AKKGDvPnA',
    UPDATE_PHONE_NUMBER: 'conn_mod_def::GCcb_14eRBE::i31l3EAxT1a0pshgClWaAQ',
    DELETE_PHONE_NUMBER: 'conn_mod_def::GCcb_kw9qGI::KXCqBWWjSZWK0_OiQTu2WQ',

    // Voice Management
    LIST_VOICES: 'conn_mod_def::GCccDGTXyS4::tPfw-4H5Rd-0aLiJH7LymA',
    GET_VOICE: 'conn_mod_def::GCccDgqZtlY::WMyx89s5TWW-qPbWYMjytg',
    SAVE_VOICE_PREVIEW: 'conn_mod_def::GCccDkO1YJI::OMhDXHjsT5S8gAqmRcByig',
    ADD_SHARED_VOICE: 'conn_mod_def::GCccCjo3J8c::mDkm3U-qTUKsOHr3pwMt4g',
    LIST_SIMILAR_VOICES: 'conn_mod_def::GCccD4R15Zk::6klTYjSURxKm1dYLyCxTIA',
};

export class PicaService implements IConversationalAIProvider, ITelephonyProvider, ILLMProvider, ITTSProvider, ISTTProvider {
    id = 'pica';
    name = 'PicaOS';
    type: ProviderType = 'conversational_ai';

    private client: AxiosInstance;
    private secretKey: string;
    private connectionKey: string;

    constructor() {
        this.secretKey = process.env.PICA_SECRET_KEY || '';
        this.connectionKey = process.env.PICA_ELEVENLABS_CONNECTION_KEY || '';

        if (!this.secretKey) {
            console.warn('⚠️ PICA_SECRET_KEY is not set. PicaOS integration will not work.');
        }
        if (!this.connectionKey) {
            console.warn('⚠️ PICA_ELEVENLABS_CONNECTION_KEY is not set. ElevenLabs passthrough will not work.');
        }

        this.client = axios.create({
            baseURL: 'https://api.picaos.com/v1/passthrough',
            headers: {
                'x-pica-secret': this.secretKey,
                'x-pica-connection-key': this.connectionKey,
                'Content-Type': 'application/json'
            }
        });
    }

    async initialize(config: any): Promise<void> {
        if (config.apiKey || config.secretKey) {
            this.secretKey = config.apiKey || config.secretKey;
            this.client.defaults.headers['x-pica-secret'] = this.secretKey;
        }
        if (config.connectionKey) {
            this.connectionKey = config.connectionKey;
            this.client.defaults.headers['x-pica-connection-key'] = this.connectionKey;
        }
    }

    /**
     * Check if PicaOS is properly configured
     */
    isConfigured(): boolean {
        return !!this.secretKey && !!this.connectionKey;
    }

    /**
     * Execute a generic action via PicaOS (Legacy compatibility)
     */
    async executeAction({ tool, action, params }: { tool: string; action: string; params?: any }): Promise<any> {
        // Map legacy actions to new passthrough methods
        if (tool === 'elevenlabs') {
            switch (action) {
                case 'get_agents':
                    return { agents: await this.getAgents() };
                case 'get_agent':
                    return this.getAgent(params?.agent_id);
                case 'create_agent':
                    return this.createAgent(params);
                case 'update_agent':
                    return this.updateAgent(params?.agent_id, params);
                case 'delete_agent':
                    return this.deleteAgent(params?.agent_id);
                default:
                    throw new Error(`Unknown action: ${action}`);
            }
        }
        throw new Error(`Unknown tool: ${tool}`);
    }

    /**
     * Make a passthrough request with proper headers
     */
    private async passthroughRequest(
        method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
        path: string,
        actionId: string,
        data?: any
    ): Promise<any> {
        try {
            const config = {
                method,
                url: path,
                headers: {
                    'x-pica-action-id': actionId,
                },
                data: method !== 'GET' ? data : undefined,
            };

            const response = await this.client.request(config);
            return response.data;
        } catch (error: any) {
            console.error(`❌ PicaOS Passthrough Failed: ${method} ${path}`, error.response?.data || error.message);
            throw new Error(`PicaOS Passthrough Failed: ${error.response?.data?.message || error.message}`);
        }
    }

    // --- IConversationalAIProvider Implementation ---

    async getAgents(): Promise<any[]> {
        if (!this.isConfigured()) {
            console.warn('[PicaOS] Not configured, returning empty agents list');
            return [];
        }

        const response = await this.passthroughRequest(
            'GET',
            '/v1/convai/agents',
            PICA_ACTION_IDS.LIST_AGENTS
        );
        return response.agents || [];
    }

    async getAgent(agentId: string): Promise<any> {
        if (!this.isConfigured()) {
            throw new Error('PicaOS is not configured');
        }

        return this.passthroughRequest(
            'GET',
            `/v1/convai/agents/${agentId}`,
            PICA_ACTION_IDS.GET_AGENT
        );
    }

    async createAgent(agentData: any): Promise<any> {
        if (!this.isConfigured()) {
            throw new Error('PicaOS is not configured');
        }

        return this.passthroughRequest(
            'POST',
            '/v1/convai/agents/create',
            PICA_ACTION_IDS.CREATE_AGENT,
            agentData
        );
    }

    async updateAgent(agentId: string, updates: any): Promise<any> {
        if (!this.isConfigured()) {
            throw new Error('PicaOS is not configured');
        }

        return this.passthroughRequest(
            'PATCH',
            `/v1/convai/agents/${agentId}`,
            PICA_ACTION_IDS.UPDATE_AGENT,
            updates
        );
    }

    async deleteAgent(agentId: string): Promise<any> {
        if (!this.isConfigured()) {
            throw new Error('PicaOS is not configured');
        }

        return this.passthroughRequest(
            'DELETE',
            `/v1/convai/agents/${agentId}`,
            PICA_ACTION_IDS.DELETE_AGENT
        );
    }

    /**
     * Get agent link/token for conversation
     */
    async getAgentLink(agentId: string): Promise<any> {
        if (!this.isConfigured()) {
            throw new Error('PicaOS is not configured');
        }

        return this.passthroughRequest(
            'GET',
            `/v1/convai/agents/${agentId}/link`,
            PICA_ACTION_IDS.GET_AGENT_LINK
        );
    }

    // --- Knowledge Base Management ---

    /**
     * List Knowledge Base documents
     */
    async listKnowledgeBaseDocuments(cursor?: string, pageSize: number = 30): Promise<any> {
        if (!this.isConfigured()) {
            console.warn('[PicaOS] Not configured, returning empty documents list');
            return { documents: [], has_more: false };
        }

        const params = new URLSearchParams();
        if (cursor) params.append('cursor', cursor);
        params.append('page_size', pageSize.toString());

        return this.passthroughRequest(
            'GET',
            `/v1/convai/knowledge-base?${params.toString()}`,
            PICA_ACTION_IDS.LIST_KB_DOCUMENTS
        );
    }

    /**
     * Create a Knowledge Base document from URL
     */
    async createKnowledgeBaseDocument(url: string): Promise<any> {
        if (!this.isConfigured()) {
            throw new Error('PicaOS is not configured');
        }

        // Note: The API uses multipart/form-data but we send JSON for simplicity
        // If file upload is needed, this needs to be updated with FormData
        return this.passthroughRequest(
            'POST',
            '/v1/convai/knowledge-base',
            PICA_ACTION_IDS.CREATE_KB_DOCUMENT,
            { url }
        );
    }

    /**
     * Get a specific Knowledge Base document
     */
    async getKnowledgeBaseDocument(documentId: string): Promise<any> {
        if (!this.isConfigured()) {
            throw new Error('PicaOS is not configured');
        }

        return this.passthroughRequest(
            'GET',
            `/v1/convai/knowledge-base/${documentId}`,
            PICA_ACTION_IDS.GET_KB_DOCUMENT
        );
    }

    /**
     * Delete a Knowledge Base document
     */
    async deleteKnowledgeBaseDocument(documentId: string): Promise<any> {
        if (!this.isConfigured()) {
            throw new Error('PicaOS is not configured');
        }

        return this.passthroughRequest(
            'DELETE',
            `/v1/convai/knowledge-base/${documentId}`,
            PICA_ACTION_IDS.DELETE_KB_DOCUMENT
        );
    }

    // --- Conversation/Call History Management ---

    /**
     * List conversations with optional filters
     */
    async getConversations(params?: {
        cursor?: string;
        agent_id?: string;
        call_successful?: 'success' | 'failure' | 'unknown';
        page_size?: number
    }): Promise<any> {
        if (!this.isConfigured()) {
            console.warn('[PicaOS] Not configured, returning empty conversations');
            return { conversations: [], has_more: false };
        }

        const searchParams = new URLSearchParams();
        if (params?.cursor) searchParams.append('cursor', params.cursor);
        if (params?.agent_id) searchParams.append('agent_id', params.agent_id);
        if (params?.call_successful) searchParams.append('call_successful', params.call_successful);
        if (params?.page_size) searchParams.append('page_size', params.page_size.toString());

        return this.passthroughRequest(
            'GET',
            `/v1/convai/conversations?${searchParams.toString()}`,
            PICA_ACTION_IDS.LIST_CONVERSATIONS
        );
    }

    /**
     * Get a single conversation with transcript and analysis
     */
    async getConversation(conversationId: string): Promise<any> {
        if (!this.isConfigured()) {
            throw new Error('PicaOS is not configured');
        }

        return this.passthroughRequest(
            'GET',
            `/v1/convai/conversations/${conversationId}`,
            PICA_ACTION_IDS.GET_CONVERSATION
        );
    }

    /**
     * Get conversation transcript (alias for getConversation since transcript is included)
     */
    async getConversationTranscript(conversationId: string): Promise<any> {
        return this.getConversation(conversationId);
    }

    /**
     * Get conversation audio
     */
    async getConversationAudio(conversationId: string): Promise<{ buffer: Buffer | null; error?: string; notFound?: boolean }> {
        if (!this.isConfigured()) {
            return { buffer: null, error: 'PicaOS not configured' };
        }

        try {
            const response = await this.passthroughRequest(
                'GET',
                `/v1/convai/conversations/${conversationId}/audio`,
                PICA_ACTION_IDS.GET_CONVERSATION_AUDIO
            );
            return { buffer: response };
        } catch (error: any) {
            return { buffer: null, error: error.message };
        }
    }

    /**
     * Delete a conversation
     */
    async deleteConversation(conversationId: string): Promise<any> {
        if (!this.isConfigured()) {
            throw new Error('PicaOS is not configured');
        }

        return this.passthroughRequest(
            'DELETE',
            `/v1/convai/conversations/${conversationId}`,
            PICA_ACTION_IDS.DELETE_CONVERSATION
        );
    }

    /**
     * Send feedback for a conversation (like/dislike)
     */
    async sendConversationFeedback(conversationId: string, feedback: 'like' | 'dislike'): Promise<any> {
        if (!this.isConfigured()) {
            throw new Error('PicaOS is not configured');
        }

        return this.passthroughRequest(
            'POST',
            `/v1/convai/conversations/${conversationId}/feedback`,
            PICA_ACTION_IDS.SEND_CONVERSATION_FEEDBACK,
            { feedback }
        );
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

    async createConversation(_data: any): Promise<any> {
        // Use ElevenLabs outbound call endpoint if available
        throw new Error('createConversation not implemented in PicaService passthrough');
    }

    // --- ITelephonyProvider Implementation (Phone Numbers) ---

    /**
     * List all phone numbers
     */
    async getPhoneNumbers(_agentId?: string): Promise<any[]> {
        if (!this.isConfigured()) {
            console.warn('[PicaOS] Not configured, returning empty phone numbers');
            return [];
        }

        return this.passthroughRequest(
            'GET',
            '/v1/convai/phone-numbers/',
            PICA_ACTION_IDS.LIST_PHONE_NUMBERS
        );
    }

    /**
     * Get a single phone number
     */
    async getPhoneNumber(phoneNumberId: string): Promise<any> {
        if (!this.isConfigured()) {
            throw new Error('PicaOS is not configured');
        }

        return this.passthroughRequest(
            'GET',
            `/v1/convai/phone-numbers/${phoneNumberId}`,
            PICA_ACTION_IDS.GET_PHONE_NUMBER
        );
    }

    /**
     * Create a phone number
     */
    async createPhoneNumber(data: {
        phone_number: string;
        provider: 'twilio';
        label: string;
        sid: string;
        token: string;
    }): Promise<any> {
        if (!this.isConfigured()) {
            throw new Error('PicaOS is not configured');
        }

        return this.passthroughRequest(
            'POST',
            '/v1/convai/phone-numbers/create',
            PICA_ACTION_IDS.CREATE_PHONE_NUMBER,
            data
        );
    }

    /**
     * Update a phone number (assign agent)
     */
    async updatePhoneNumber(phoneNumberId: string, data: { agent_id?: string }): Promise<any> {
        if (!this.isConfigured()) {
            throw new Error('PicaOS is not configured');
        }

        return this.passthroughRequest(
            'PATCH',
            `/v1/convai/phone-numbers/${phoneNumberId}`,
            PICA_ACTION_IDS.UPDATE_PHONE_NUMBER,
            data
        );
    }

    /**
     * Delete a phone number
     */
    async deletePhoneNumber(phoneNumberId: string): Promise<any> {
        if (!this.isConfigured()) {
            throw new Error('PicaOS is not configured');
        }

        return this.passthroughRequest(
            'DELETE',
            `/v1/convai/phone-numbers/${phoneNumberId}`,
            PICA_ACTION_IDS.DELETE_PHONE_NUMBER
        );
    }

    async makeOutboundCall(_to: string, _from: string, _config: any): Promise<any> {
        throw new Error('makeOutboundCall not implemented in PicaService passthrough');
    }

    // --- ILLMProvider Implementation ---

    async generateResponse(_prompt: string, _context?: any[], _options?: any): Promise<string> {
        throw new Error('generateResponse not implemented - use direct LLM provider');
    }

    async streamResponse(_prompt: string, _context?: any[], _options?: any): Promise<ReadableStream | Readable> {
        throw new Error('Streaming not supported via PicaOS passthrough.');
    }

    // --- ITTSProvider Implementation (Voice Management) ---

    /**
     * List all voices
     */
    async getVoices(showLegacy: boolean = false): Promise<any[]> {
        if (!this.isConfigured()) {
            console.warn('[PicaOS] Not configured, returning empty voices');
            return [];
        }

        const params = showLegacy ? '?show_legacy=true' : '';
        const response = await this.passthroughRequest(
            'GET',
            `/v1/voices${params}`,
            PICA_ACTION_IDS.LIST_VOICES
        );
        return response.voices || [];
    }

    /**
     * Get a single voice
     */
    async getVoice(voiceId: string): Promise<any> {
        if (!this.isConfigured()) {
            throw new Error('PicaOS is not configured');
        }

        return this.passthroughRequest(
            'GET',
            `/v1/voices/${voiceId}`,
            PICA_ACTION_IDS.GET_VOICE
        );
    }

    /**
     * Save a voice preview (create voice from generated preview)
     */
    async saveVoicePreview(data: {
        voice_name: string;
        voice_description: string;
        generated_voice_id: string;
        labels?: Record<string, string>;
        played_not_selected_voice_ids?: string[];
    }): Promise<any> {
        if (!this.isConfigured()) {
            throw new Error('PicaOS is not configured');
        }

        return this.passthroughRequest(
            'POST',
            '/v1/text-to-voice/create-voice-from-preview',
            PICA_ACTION_IDS.SAVE_VOICE_PREVIEW,
            data
        );
    }

    /**
     * Add a shared voice from the voice library
     */
    async addSharedVoice(publicUserId: string, voiceId: string, newName: string): Promise<any> {
        if (!this.isConfigured()) {
            throw new Error('PicaOS is not configured');
        }

        return this.passthroughRequest(
            'POST',
            `/v1/voices/add/${publicUserId}/${voiceId}`,
            PICA_ACTION_IDS.ADD_SHARED_VOICE,
            { new_name: newName }
        );
    }

    /**
     * Find similar voices (search by audio similarity)
     */
    async listSimilarVoices(options?: {
        similarity_threshold?: number;
        top_k?: number;
    }): Promise<any> {
        if (!this.isConfigured()) {
            throw new Error('PicaOS is not configured');
        }

        return this.passthroughRequest(
            'POST',
            '/v1/similar-voices',
            PICA_ACTION_IDS.LIST_SIMILAR_VOICES,
            options || {}
        );
    }

    async generateAudio(_text: string, _voiceId: string, _options?: any): Promise<ArrayBuffer> {
        throw new Error('generateAudio not implemented in PicaService passthrough');
    }

    // --- ISTTProvider Implementation ---

    async transcribe(_audioBuffer: Buffer, _options?: any): Promise<string> {
        throw new Error('transcribe not implemented in PicaService passthrough');
    }

    // --- Legacy Compatibility Methods ---

    /**
     * List available connections from PicaOS
     */
    async listConnections(): Promise<any[]> {
        try {
            // Use non-passthrough endpoint for connections
            const response = await axios.get('https://api.picaos.com/v1/connections', {
                headers: {
                    'x-pica-secret': this.secretKey,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        } catch (error: any) {
            console.error('❌ Failed to list PicaOS connections', error.response?.data || error.message);
            return [];
        }
    }
}

export const picaService = new PicaService();
