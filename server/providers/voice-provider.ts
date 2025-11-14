/**
 * Voice Provider Interface
 *
 * Platform-agnostic voice AI provider abstraction
 * Supports: ElevenLabs, OpenAI, Google TTS, Azure TTS, AWS Polly, and more
 */

export interface VoiceConfig {
  provider: 'elevenlabs' | 'openai' | 'google' | 'azure' | 'aws-polly' | 'custom';
  apiKey?: string;
  region?: string;
  projectId?: string;
  options?: Record<string, any>;
}

export interface VoiceModel {
  id: string;
  name: string;
  language?: string;
  gender?: 'male' | 'female' | 'neutral';
  previewUrl?: string;
  category?: string;
}

export interface SynthesizeOptions {
  text: string;
  voiceId: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
  outputFormat?: 'mp3' | 'wav' | 'pcm' | 'ogg';
  sampleRate?: number;
}

export interface StreamingOptions extends SynthesizeOptions {
  onChunk?: (chunk: Buffer) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export interface ConversationConfig {
  agentId: string;
  firstMessage?: string;
  language?: string;
  voice?: {
    voiceId: string;
    stability?: number;
    similarityBoost?: number;
  };
  model?: {
    provider: string;
    modelId: string;
    temperature?: number;
  };
  maxDuration?: number;
}

export interface VoiceProvider {
  /**
   * Get provider name
   */
  getProviderName(): string;

  /**
   * Initialize the provider
   */
  initialize(): Promise<void>;

  /**
   * Check if provider is ready
   */
  isReady(): boolean;

  /**
   * Get available voices
   */
  getVoices(): Promise<VoiceModel[]>;

  /**
   * Get a specific voice by ID
   */
  getVoice(voiceId: string): Promise<VoiceModel | null>;

  /**
   * Synthesize speech from text
   */
  textToSpeech(options: SynthesizeOptions): Promise<Buffer>;

  /**
   * Stream speech synthesis
   */
  textToSpeechStream(options: StreamingOptions): Promise<void>;

  /**
   * Start a conversational AI agent
   */
  startConversation?(config: ConversationConfig): Promise<{ signedUrl: string }>;

  /**
   * Get usage statistics
   */
  getUsage?(): Promise<{
    characterCount: number;
    characterLimit: number;
  }>;

  /**
   * Health check
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Base Voice Provider with common functionality
 */
export abstract class BaseVoiceProvider implements VoiceProvider {
  protected config: VoiceConfig;
  protected ready: boolean = false;

  constructor(config: VoiceConfig) {
    this.config = config;
  }

  abstract getProviderName(): string;
  abstract initialize(): Promise<void>;
  abstract getVoices(): Promise<VoiceModel[]>;
  abstract getVoice(voiceId: string): Promise<VoiceModel | null>;
  abstract textToSpeech(options: SynthesizeOptions): Promise<Buffer>;
  abstract textToSpeechStream(options: StreamingOptions): Promise<void>;
  abstract healthCheck(): Promise<boolean>;

  isReady(): boolean {
    return this.ready;
  }

  /**
   * Log provider operations
   */
  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const prefix = `[VOICE:${this.getProviderName().toUpperCase()}]`;
    const fullMessage = `${prefix} ${message}`;

    switch (level) {
      case 'info':
        console.log(fullMessage);
        break;
      case 'warn':
        console.warn(fullMessage);
        break;
      case 'error':
        console.error(fullMessage);
        break;
    }
  }

  /**
   * Validate configuration
   */
  protected validateConfig(): void {
    if (!this.config.apiKey && this.config.provider !== 'custom') {
      throw new Error(`API key is required for ${this.config.provider} provider`);
    }
  }
}
