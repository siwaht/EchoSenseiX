import axios, { AxiosInstance } from 'axios';

interface PicaActionParams {
    tool: string;
    action: string;
    params?: any;
}

export class PicaService {
    private client: AxiosInstance;
    private secretKey: string;

    constructor() {
        this.secretKey = process.env.PICA_SECRET_KEY || '';

        if (!this.secretKey) {
            console.warn('⚠️ PICA_SECRET_KEY is not set. PicaOS integration will not work.');
        }

        this.client = axios.create({
            baseURL: 'https://api.picaos.com/v1', // Assuming v1 based on docs structure, will verify if needed
            headers: {
                'Authorization': `Bearer ${this.secretKey}`,
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Execute a generic action via PicaOS Passthrough API
     */
    async executeAction({ tool, action, params }: PicaActionParams): Promise<any> {
        try {
            // Based on Passthrough API docs, structure might vary. 
            // Using a generic POST to /passthrough or similar if that's the endpoint.
            // Re-checking docs: "Building Requests" usually implies a specific structure.
            // If PicaOS acts as a proxy, we might need to hit specific endpoints or a central execution endpoint.
            // For now, assuming a central execution endpoint or direct tool endpoints via Pica.

            // If using the MCP server pattern or direct API:
            // POST https://api.picaos.com/passthrough
            // Body: { tool, action, params }

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

    // --- ElevenLabs Specific Methods ---

    /**
     * Create an ElevenLabs Agent
     */
    async createAgent(params: any): Promise<any> {
        return this.executeAction({
            tool: 'elevenlabs',
            action: 'create_agent',
            params
        });
    }

    /**
     * Update an ElevenLabs Agent
     */
    async updateAgent(agentId: string, params: any): Promise<any> {
        return this.executeAction({
            tool: 'elevenlabs',
            action: 'update_agent',
            params: { ...params, agent_id: agentId }
        });
    }

    /**
     * Delete an ElevenLabs Agent
     */
    async deleteAgent(agentId: string): Promise<any> {
        return this.executeAction({
            tool: 'elevenlabs',
            action: 'delete_agent',
            params: { agent_id: agentId }
        });
    }

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
     * Get Call History
     */
    async getCallHistory(params: any): Promise<any> {
        return this.executeAction({
            tool: 'elevenlabs',
            action: 'get_history',
            params
        });
    }

    /**
     * Initiate Outbound Call
     */
    async outboundCall(params: any): Promise<any> {
        return this.executeAction({
            tool: 'elevenlabs',
            action: 'outbound_call',
            params
        });
    }
}

export const picaService = new PicaService();
