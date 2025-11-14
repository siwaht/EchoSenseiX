/**
 * LLM Provider Interface
 *
 * Platform-agnostic Large Language Model abstraction
 * Supports: OpenAI, Anthropic, Mistral, Google Gemini, and more
 */

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'mistral' | 'google' | 'custom';
  apiKey?: string;
  baseURL?: string;
  model?: string;
  options?: Record<string, any>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  stop?: string[];
}

export interface CompletionResponse {
  content: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMProvider {
  getProviderName(): string;
  initialize(): Promise<void>;
  isReady(): boolean;
  complete(options: CompletionOptions): Promise<CompletionResponse>;
  healthCheck(): Promise<boolean>;
}

export abstract class BaseLLMProvider implements LLMProvider {
  protected config: LLMConfig;
  protected ready: boolean = false;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  abstract getProviderName(): string;
  abstract initialize(): Promise<void>;
  abstract complete(options: CompletionOptions): Promise<CompletionResponse>;
  abstract healthCheck(): Promise<boolean>;

  isReady(): boolean {
    return this.ready;
  }

  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const prefix = `[LLM:${this.getProviderName().toUpperCase()}]`;
    console[level](`${prefix} ${message}`);
  }
}
