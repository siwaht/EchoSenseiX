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
}
