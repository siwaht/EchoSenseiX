/**
 * OpenAI Voice Provider (TTS)
 */

import { BaseVoiceProvider, type VoiceConfig, type VoiceModel, type SynthesizeOptions, type StreamingOptions } from '../voice-provider';

export class OpenAIVoiceProvider extends BaseVoiceProvider {
  private client: any;

  // OpenAI TTS voices
  private readonly VOICES: VoiceModel[] = [
    { id: 'alloy', name: 'Alloy', gender: 'neutral', language: 'en' },
    { id: 'echo', name: 'Echo', gender: 'male', language: 'en' },
    { id: 'fable', name: 'Fable', gender: 'neutral', language: 'en' },
    { id: 'onyx', name: 'Onyx', gender: 'male', language: 'en' },
    { id: 'nova', name: 'Nova', gender: 'female', language: 'en' },
    { id: 'shimmer', name: 'Shimmer', gender: 'female', language: 'en' },
  ];

  constructor(config: VoiceConfig) {
    super(config);
  }

  async initialize(): Promise<void> {
    this.validateConfig();
    this.log('Initializing OpenAI TTS provider...');

    try {
      // Dynamically import OpenAI SDK
      const { OpenAI } = await import('openai');

      this.client = new OpenAI({
        apiKey: this.config.apiKey!,
      });

      this.ready = true;
      this.log('OpenAI TTS provider initialized successfully');
    } catch (error: any) {
      this.log(`Failed to initialize: ${error.message}`, 'error');
      throw error;
    }
  }

  getProviderName(): string {
    return 'openai';
  }

  async getVoices(): Promise<VoiceModel[]> {
    return this.VOICES;
  }

  async getVoice(voiceId: string): Promise<VoiceModel | null> {
    return this.VOICES.find(v => v.id === voiceId) || null;
  }

  async textToSpeech(options: SynthesizeOptions): Promise<Buffer> {
    if (!this.ready) await this.initialize();

    try {
      const mp3 = await this.client.audio.speech.create({
        model: options.modelId || 'tts-1',
        voice: options.voiceId as any,
        input: options.text,
        response_format: options.outputFormat || 'mp3',
        speed: options.style || 1.0,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      return buffer;
    } catch (error: any) {
      this.log(`Text-to-speech failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async textToSpeechStream(options: StreamingOptions): Promise<void> {
    if (!this.ready) await this.initialize();

    try {
      const stream = await this.client.audio.speech.create({
        model: options.modelId || 'tts-1',
        voice: options.voiceId as any,
        input: options.text,
        response_format: options.outputFormat || 'mp3',
        speed: options.style || 1.0,
      });

      const reader = stream.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get stream reader');
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          if (options.onComplete) {
            options.onComplete();
          }
          break;
        }

        if (value && options.onChunk) {
          options.onChunk(Buffer.from(value));
        }
      }
    } catch (error: any) {
      this.log(`Streaming failed: ${error.message}`, 'error');
      if (options.onError) {
        options.onError(error);
      }
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.ready) return false;

      // Test with a very short synthesis
      await this.client.audio.speech.create({
        model: 'tts-1',
        voice: 'alloy',
        input: 'Test',
      });

      return true;
    } catch (error: any) {
      this.log(`Health check failed: ${error.message}`, 'error');
      return false;
    }
  }
}
