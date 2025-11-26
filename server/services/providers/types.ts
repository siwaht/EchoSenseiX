import { Readable } from 'stream';

export type ProviderType = 'tts' | 'stt' | 'llm' | 'telephony' | 'conversational_ai' | 'vad' | 'knowledge_base';

export interface IProvider {
    id: string;
    name: string;
    type: ProviderType;
    initialize(config: any): Promise<void>;
    healthCheck?(): Promise<boolean>;
}

// 1. Text-to-Speech (TTS) Provider
export interface ITTSProvider extends IProvider {
    getVoices(): Promise<any[]>;
    getVoice(voiceId: string): Promise<any>;
    generateAudio(text: string, voiceId: string, options?: any): Promise<ArrayBuffer | Buffer>;
    streamAudio?(text: string, voiceId: string, options?: any): Promise<ReadableStream | Readable>;
}

// 2. Speech-to-Text (STT) Provider (NEW)
export interface ISTTProvider extends IProvider {
    transcribe(audioBuffer: Buffer, options?: any): Promise<string>;
    createTranscriptionStream?(): any; // Return a writable stream that emits transcription events
}

// 3. Large Language Model (LLM) Provider
export interface ILLMProvider extends IProvider {
    generateResponse(prompt: string, context?: any[], options?: any): Promise<string>;
    streamResponse(prompt: string, context?: any[], options?: any): Promise<ReadableStream | Readable>;
}

// 4. Voice Activity Detection (VAD) Provider (NEW)
export interface IVADProvider extends IProvider {
    detectVoice(audioChunk: Buffer): Promise<{ isSpeech: boolean; confidence: number }>;
}

// 5. Telephony Provider
export interface ITelephonyProvider extends IProvider {
    getPhoneNumbers(agentId?: string): Promise<any[]>;
    createPhoneNumber(data: any): Promise<any>;
    deletePhoneNumber(phoneNumberId: string): Promise<any>;
    makeOutboundCall(to: string, from: string, config: any): Promise<any>;
}

// 6. Conversational AI Provider (All-in-One wrappers like ElevenLabs/Vapi)
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

    // WebRTC / Realtime
    createWebRTCSession(agentId: string, options?: any): Promise<any>;

    // Tools
    manageTools(tools: any[], integrationId?: string): Promise<{ toolIds: string[]; builtInTools: any }>;

    // Batch Calling
    createBatchCall(data: any): Promise<any>;
    getBatchCalls(): Promise<any[]>;
    getBatchCallStatus(batchId: string): Promise<any>;
    cancelBatchCall(batchId: string): Promise<any>;

    // Conversation Initiation
    createConversation(data: any): Promise<any>;
}
