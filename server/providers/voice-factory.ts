/**
 * Voice Provider Factory
 *
 * Auto-detects and creates the appropriate voice provider
 */

import type { VoiceProvider, VoiceConfig } from './voice-provider';
import { ElevenLabsVoiceProvider } from './voice/elevenlabs-voice-provider';
import { OpenAIVoiceProvider } from './voice/openai-voice-provider';
import { GoogleVoiceProvider } from './voice/google-voice-provider';

export class VoiceProviderFactory {
  private static instance: VoiceProvider | null = null;

  /**
   * Create a voice provider based on configuration
   */
  static createProvider(config: VoiceConfig): VoiceProvider {
    console.log(`[VOICE-FACTORY] Creating ${config.provider} provider...`);

    switch (config.provider) {
      case 'elevenlabs':
        return new ElevenLabsVoiceProvider(config);

      case 'openai':
        return new OpenAIVoiceProvider(config);

      case 'google':
        return new GoogleVoiceProvider(config);

      case 'azure':
        // TODO: Implement Azure TTS provider
        throw new Error('Azure TTS provider not yet implemented');

      case 'aws-polly':
        // TODO: Implement AWS Polly provider
        throw new Error('AWS Polly provider not yet implemented');

      default:
        throw new Error(`Unsupported voice provider: ${config.provider}`);
    }
  }

  /**
   * Get or create a singleton voice provider instance
   */
  static async getInstance(config?: VoiceConfig): Promise<VoiceProvider> {
    if (this.instance && this.instance.isReady()) {
      return this.instance;
    }

    if (!config) {
      config = this.getConfigFromEnv();
    }

    this.instance = this.createProvider(config);
    await this.instance.initialize();

    return this.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static reset(): void {
    this.instance = null;
  }

  /**
   * Get voice configuration from environment variables
   */
  static getConfigFromEnv(): VoiceConfig {
    const provider = this.detectProvider();

    const config: VoiceConfig = {
      provider,
      apiKey: process.env.VOICE_API_KEY,
      options: {},
    };

    // Provider-specific configuration
    switch (provider) {
      case 'elevenlabs':
        config.apiKey = process.env.ELEVENLABS_API_KEY || config.apiKey;
        break;

      case 'openai':
        config.apiKey = process.env.OPENAI_API_KEY || config.apiKey;
        break;

      case 'google':
        config.projectId = process.env.GOOGLE_CLOUD_PROJECT;
        config.options = {
          credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        };
        break;

      case 'azure':
        config.apiKey = process.env.AZURE_SPEECH_KEY || config.apiKey;
        config.region = process.env.AZURE_SPEECH_REGION;
        break;

      case 'aws-polly':
        config.region = process.env.AWS_REGION || 'us-east-1';
        config.options = {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        };
        break;
    }

    return config;
  }

  /**
   * Detect voice provider from environment variables
   */
  private static detectProvider(): VoiceConfig['provider'] {
    // Explicit provider setting
    const explicitProvider = process.env.VOICE_PROVIDER?.toLowerCase();
    if (explicitProvider) {
      return explicitProvider as VoiceConfig['provider'];
    }

    // Auto-detect from API keys
    if (process.env.ELEVENLABS_API_KEY) {
      return 'elevenlabs';
    }
    if (process.env.OPENAI_API_KEY && process.env.USE_OPENAI_TTS === 'true') {
      return 'openai';
    }
    if (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return 'google';
    }
    if (process.env.AZURE_SPEECH_KEY) {
      return 'azure';
    }
    if (process.env.AWS_ACCESS_KEY_ID && process.env.USE_AWS_POLLY === 'true') {
      return 'aws-polly';
    }

    // Default to ElevenLabs (current default)
    console.warn(
      '[VOICE-FACTORY] No voice provider specified, defaulting to ElevenLabs. ' +
        'Set VOICE_PROVIDER environment variable to change this.'
    );
    return 'elevenlabs';
  }

  /**
   * Health check for the current voice provider
   */
  static async healthCheck(): Promise<{
    healthy: boolean;
    provider: string;
    message?: string;
  }> {
    try {
      if (!this.instance) {
        return {
          healthy: false,
          provider: 'none',
          message: 'No voice provider initialized',
        };
      }

      const healthy = await this.instance.healthCheck();
      return {
        healthy,
        provider: this.instance.getProviderName(),
        message: healthy ? 'Voice provider is healthy' : 'Voice provider is unhealthy',
      };
    } catch (error: any) {
      return {
        healthy: false,
        provider: this.instance?.getProviderName() || 'unknown',
        message: error.message,
      };
    }
  }
}

/**
 * Convenience function to get voice provider instance
 */
export async function getVoiceProvider(config?: VoiceConfig): Promise<VoiceProvider> {
  return VoiceProviderFactory.getInstance(config);
}
