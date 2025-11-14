/**
 * Google Cloud Text-to-Speech Provider
 */

import { BaseVoiceProvider, type VoiceConfig, type VoiceModel, type SynthesizeOptions, type StreamingOptions } from '../voice-provider';

export class GoogleVoiceProvider extends BaseVoiceProvider {
  private client: any;

  constructor(config: VoiceConfig) {
    super(config);
  }

  async initialize(): Promise<void> {
    this.log('Initializing Google Cloud TTS provider...');

    try {
      // Dynamically import Google Cloud TTS
      const { TextToSpeechClient } = await import('@google-cloud/text-to-speech');

      this.client = new TextToSpeechClient({
        keyFilename: this.config.options?.credentialsPath,
        projectId: this.config.projectId,
      });

      this.ready = true;
      this.log('Google Cloud TTS provider initialized successfully');
    } catch (error: any) {
      this.log(`Failed to initialize: ${error.message}`, 'error');
      throw error;
    }
  }

  getProviderName(): string {
    return 'google';
  }

  async getVoices(): Promise<VoiceModel[]> {
    if (!this.ready) await this.initialize();

    try {
      const [result] = await this.client.listVoices({});

      return (result.voices || []).map((voice: any) => ({
        id: `${voice.languageCodes[0]}-${voice.name}`,
        name: voice.name,
        language: voice.languageCodes[0],
        gender: voice.ssmlGender?.toLowerCase() || 'neutral',
      }));
    } catch (error: any) {
      this.log(`Failed to get voices: ${error.message}`, 'error');
      throw error;
    }
  }

  async getVoice(voiceId: string): Promise<VoiceModel | null> {
    const voices = await this.getVoices();
    return voices.find(v => v.id === voiceId) || null;
  }

  async textToSpeech(options: SynthesizeOptions): Promise<Buffer> {
    if (!this.ready) await this.initialize();

    try {
      // Parse voice ID (format: language-code-voice-name)
      const [languageCode, ...nameParts] = options.voiceId.split('-');
      const voiceName = nameParts.join('-');

      const [response] = await this.client.synthesizeSpeech({
        input: { text: options.text },
        voice: {
          languageCode: languageCode || 'en-US',
          name: voiceName || 'en-US-Standard-A',
        },
        audioConfig: {
          audioEncoding: this.getAudioEncoding(options.outputFormat),
          sampleRateHertz: options.sampleRate || 24000,
          speakingRate: options.style || 1.0,
        },
      });

      return Buffer.from(response.audioContent as Uint8Array);
    } catch (error: any) {
      this.log(`Text-to-speech failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async textToSpeechStream(options: StreamingOptions): Promise<void> {
    // Google TTS doesn't support streaming, so we synthesize and chunk
    const buffer = await this.textToSpeech(options);

    if (options.onChunk) {
      // Split into chunks
      const chunkSize = 4096;
      for (let i = 0; i < buffer.length; i += chunkSize) {
        options.onChunk(buffer.slice(i, i + chunkSize));
      }
    }

    if (options.onComplete) {
      options.onComplete();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.ready) return false;

      await this.client.listVoices({});
      return true;
    } catch (error: any) {
      this.log(`Health check failed: ${error.message}`, 'error');
      return false;
    }
  }

  private getAudioEncoding(format?: string): string {
    switch (format) {
      case 'mp3':
        return 'MP3';
      case 'wav':
        return 'LINEAR16';
      case 'ogg':
        return 'OGG_OPUS';
      default:
        return 'MP3';
    }
  }
}
