/**
 * ElevenLabs Voice Provider
 */

import { BaseVoiceProvider, type VoiceConfig, type VoiceModel, type SynthesizeOptions, type StreamingOptions, type ConversationConfig } from '../voice-provider';

export class ElevenLabsVoiceProvider extends BaseVoiceProvider {
  private client: any;

  constructor(config: VoiceConfig) {
    super(config);
  }

  async initialize(): Promise<void> {
    this.validateConfig();
    this.log('Initializing ElevenLabs provider...');

    try {
      // Dynamically import ElevenLabs SDK
      const { ElevenLabsClient } = await import('elevenlabs');

      this.client = new ElevenLabsClient({
        apiKey: this.config.apiKey!,
      });

      this.ready = true;
      this.log('ElevenLabs provider initialized successfully');
    } catch (error: any) {
      this.log(`Failed to initialize: ${error.message}`, 'error');
      throw error;
    }
  }

  getProviderName(): string {
    return 'elevenlabs';
  }

  async getVoices(): Promise<VoiceModel[]> {
    if (!this.ready) await this.initialize();

    try {
      const response = await this.client.voices.getAll();

      return response.voices.map((voice: any) => ({
        id: voice.voice_id,
        name: voice.name,
        language: voice.labels?.language || 'en',
        gender: voice.labels?.gender || 'neutral',
        previewUrl: voice.preview_url,
        category: voice.category,
      }));
    } catch (error: any) {
      this.log(`Failed to get voices: ${error.message}`, 'error');
      throw error;
    }
  }

  async getVoice(voiceId: string): Promise<VoiceModel | null> {
    if (!this.ready) await this.initialize();

    try {
      const voice = await this.client.voices.get(voiceId);

      if (!voice) return null;

      return {
        id: voice.voice_id,
        name: voice.name,
        language: voice.labels?.language || 'en',
        gender: voice.labels?.gender || 'neutral',
        previewUrl: voice.preview_url,
        category: voice.category,
      };
    } catch (error: any) {
      this.log(`Failed to get voice ${voiceId}: ${error.message}`, 'error');
      return null;
    }
  }

  async textToSpeech(options: SynthesizeOptions): Promise<Buffer> {
    if (!this.ready) await this.initialize();

    try {
      const audio = await this.client.textToSpeech.convert(options.voiceId, {
        text: options.text,
        model_id: options.modelId || 'eleven_multilingual_v2',
        voice_settings: {
          stability: options.stability ?? 0.5,
          similarity_boost: options.similarityBoost ?? 0.75,
          style: options.style,
          use_speaker_boost: options.useSpeakerBoost,
        },
        output_format: options.outputFormat || 'mp3_44100_128',
      });

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of audio) {
        chunks.push(Buffer.from(chunk));
      }

      return Buffer.concat(chunks);
    } catch (error: any) {
      this.log(`Text-to-speech failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async textToSpeechStream(options: StreamingOptions): Promise<void> {
    if (!this.ready) await this.initialize();

    try {
      const audio = await this.client.textToSpeech.convertAsStream(options.voiceId, {
        text: options.text,
        model_id: options.modelId || 'eleven_multilingual_v2',
        voice_settings: {
          stability: options.stability ?? 0.5,
          similarity_boost: options.similarityBoost ?? 0.75,
          style: options.style,
          use_speaker_boost: options.useSpeakerBoost,
        },
        output_format: options.outputFormat || 'mp3_44100_128',
      });

      for await (const chunk of audio) {
        if (options.onChunk) {
          options.onChunk(Buffer.from(chunk));
        }
      }

      if (options.onComplete) {
        options.onComplete();
      }
    } catch (error: any) {
      this.log(`Streaming failed: ${error.message}`, 'error');
      if (options.onError) {
        options.onError(error);
      }
      throw error;
    }
  }

  async startConversation(config: ConversationConfig): Promise<{ signedUrl: string }> {
    if (!this.ready) await this.initialize();

    try {
      const conversation = await this.client.conversationalAi.createConversation({
        agent_id: config.agentId,
      });

      const signedUrl = await conversation.startSession({
        first_message: config.firstMessage,
        language: config.language,
      });

      return { signedUrl };
    } catch (error: any) {
      this.log(`Failed to start conversation: ${error.message}`, 'error');
      throw error;
    }
  }

  async getUsage(): Promise<{ characterCount: number; characterLimit: number }> {
    if (!this.ready) await this.initialize();

    try {
      const subscription = await this.client.user.getSubscription();

      return {
        characterCount: subscription.character_count || 0,
        characterLimit: subscription.character_limit || 0,
      };
    } catch (error: any) {
      this.log(`Failed to get usage: ${error.message}`, 'error');
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.ready) return false;

      // Simple API check - get voices list
      await this.client.voices.getAll();
      return true;
    } catch (error: any) {
      this.log(`Health check failed: ${error.message}`, 'error');
      return false;
    }
  }
}
