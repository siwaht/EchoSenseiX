export type ProviderType = 'tts' | 'stt' | 'llm' | 'telephony' | 'conversational_ai';

export interface IProvider {
    id: string;
    name: string;
    type: ProviderType;
    initialize(config: any): Promise<void>;
}

export interface IConversationalAIProvider extends IProvider {
    // Agent Management
    createAgent(agentData: any): Promise<any>;
    updateAgent(agentId: string, updates: any): Promise<any>;
    deleteAgent(agentId: string): Promise<any>;
    getAgent(agentId: string): Promise<any>;
    getAgents(): Promise<any[]>;

    // Conversation Management
    getConversations(params?: any): Promise<any>;
    getConversation(conversationId: string): Promise<any>;
    getConversationTranscript(conversationId: string): Promise<any>;
    getConversationAudio(conversationId: string): Promise<{ buffer: Buffer | null; error?: string; notFound?: boolean }>;

    // Real-time
    createWebRTCSession(agentId: string, options?: any): Promise<any>;

    // Tool Management
    manageTools(tools: any[], integrationId?: string): Promise<{ toolIds: string[]; builtInTools: any }>;

    // Phone Number Management
    getPhoneNumbers(): Promise<any[]>;
    createPhoneNumber(data: any): Promise<any>;
    updatePhoneNumber(id: string, updates: any): Promise<any>;
    deletePhoneNumber(phoneNumberId: string): Promise<any>;

    // Batch Calling
    createBatchCall(data: any): Promise<any>;
    getBatchCalls(): Promise<any[]>;
    getBatchCallStatus(batchId: string): Promise<any>;
    cancelBatchCall(batchId: string): Promise<any>;

    // Conversation Initiation
    createConversation(data: any): Promise<any>;
}

export interface ITTSProvider extends IProvider {
    getVoices(): Promise<any[]>;
    getVoice(voiceId: string): Promise<any>;
    cloneVoice(name: string, description: string, files: any[], removeBackgroundNoise?: boolean): Promise<any>;
    deleteVoice(voiceId: string): Promise<any>;
    generateAudio(text: string, voiceId: string, options?: any): Promise<ArrayBuffer>;
}

export interface ITelephonyProvider extends IProvider {
    getPhoneNumbers(agentId?: string): Promise<any[]>;
    createPhoneNumber(data: any): Promise<any>;
    deletePhoneNumber(phoneNumberId: string): Promise<any>;
}

export interface ILLMProvider extends IProvider {
    generateResponse(prompt: string, context?: any[], options?: any): Promise<string>;
    streamResponse(prompt: string, context?: any[], options?: any): Promise<ReadableStream>;
}
