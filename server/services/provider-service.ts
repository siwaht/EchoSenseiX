import type { DatabaseStorage } from '../storage';
import { decryptApiKey } from '../utils/encryption';
import type { ProviderIntegration, InsertProviderUsage } from '@shared/schema';

export interface VoiceAgentConfig {
  name: string;
  firstMessage: string;
  systemPrompt: string;
  language: string;
  voiceId?: string;
  model?: string;
}

export interface VoiceAgentResponse {
  agentId: string;
  provider: string;
  metadata?: Record<string, any>;
}

/**
 * Provider abstraction layer for voice platforms
 * Supports multiple providers like ElevenLabs, Vapi, Bland, Retell
 */
export class ProviderService {
  constructor(private storage: DatabaseStorage) {}

  /**
   * Get the primary active provider for a given type
   * Falls back to legacy integration if new provider integrations don't exist
   */
  async getPrimaryProvider(
    organizationId: string,
    providerType: 'TTS' | 'STT' | 'LLM' | 'DATABASE' | 'VOICE_PLATFORM'
  ): Promise<ProviderIntegration | null> {
    // First try to get the primary provider
    const primary = await this.storage.getPrimaryProvider(organizationId, providerType);
    if (primary && primary.status === 'ACTIVE') {
      return primary;
    }

    // If no primary, get any active provider of that type
    const providers = await this.storage.getProviderIntegrations(organizationId, providerType);
    const activeProvider = providers.find(p => p.status === 'ACTIVE');

    if (activeProvider) {
      return activeProvider;
    }

    // Fallback: Check legacy integration for VOICE_PLATFORM
    if (providerType === 'VOICE_PLATFORM') {
      const legacyIntegration = await this.storage.getIntegration(organizationId, 'elevenlabs');
      if (legacyIntegration && legacyIntegration.status === 'ACTIVE') {
        // Convert legacy integration to provider integration format
        const convertedProvider: ProviderIntegration = {
          id: legacyIntegration.id,
          organizationId: legacyIntegration.organizationId,
          providerType: 'VOICE_PLATFORM',
          providerName: 'elevenlabs',
          displayName: 'ElevenLabs (Legacy)',
          status: legacyIntegration.status,
          isPrimary: true,
          credentials: { apiKey: legacyIntegration.apiKey },
          config: {},
          metadata: {},
          lastTested: legacyIntegration.lastTested,
          lastUsed: null,
          createdAt: legacyIntegration.createdAt,
          updatedAt: legacyIntegration.updatedAt
        };
        return convertedProvider;
      }
    }

    return null;
  }

  /**
   * Get all active providers for a given type
   */
  async getActiveProviders(
    organizationId: string,
    providerType: 'TTS' | 'STT' | 'LLM' | 'DATABASE' | 'VOICE_PLATFORM'
  ): Promise<ProviderIntegration[]> {
    const providers = await this.storage.getProviderIntegrations(organizationId, providerType);
    return providers.filter(p => p.status === 'ACTIVE');
  }

  /**
   * Create a voice agent using the appropriate provider
   */
  async createVoiceAgent(
    organizationId: string,
    config: VoiceAgentConfig,
    providerId?: string
  ): Promise<VoiceAgentResponse> {
    let provider: ProviderIntegration | null;

    if (providerId) {
      // Use specified provider
      provider = await this.storage.getProviderIntegration(providerId, organizationId);
      if (!provider || provider.status !== 'ACTIVE') {
        throw new Error('Specified provider not found or inactive');
      }
    } else {
      // Use primary VOICE_PLATFORM provider
      provider = await this.getPrimaryProvider(organizationId, 'VOICE_PLATFORM');
      if (!provider) {
        throw new Error('No active voice platform provider configured. Please add a provider in integrations.');
      }
    }

    // Route to appropriate provider implementation
    switch (provider.providerName.toLowerCase()) {
      case 'elevenlabs':
        return await this.createElevenLabsAgent(provider, config);
      case 'vapi':
        return await this.createVapiAgent(provider, config);
      case 'bland':
        return await this.createBlandAgent(provider, config);
      case 'retell':
        return await this.createRetellAgent(provider, config);
      default:
        throw new Error(`Unsupported voice platform provider: ${provider.providerName}`);
    }
  }

  /**
   * ElevenLabs agent creation implementation
   */
  private async createElevenLabsAgent(
    provider: ProviderIntegration,
    config: VoiceAgentConfig
  ): Promise<VoiceAgentResponse> {
    const apiKey = decryptApiKey((provider.credentials as any)?.apiKey || '');

    const agentPayload = {
      name: config.name,
      conversation_config: {
        agent: {
          prompt: {
            prompt: config.systemPrompt,
            first_message: config.firstMessage,
            language: config.language || 'en'
          },
          first_message: config.firstMessage,
          language: config.language || 'en',
          tools: [
            {
              type: 'system',
              name: 'end_call',
              description: 'Allows agent to end the call'
            },
            {
              type: 'system',
              name: 'language_detection',
              description: 'Automatically detect and switch languages',
              config: { supported_languages: [] }
            },
            {
              type: 'system',
              name: 'skip_turn',
              description: 'Skip agent turn when user needs a moment'
            },
            {
              type: 'system',
              name: 'transfer_to_agent',
              description: 'Transfer to another AI agent',
              config: { target_agent_id: '' }
            },
            {
              type: 'system',
              name: 'transfer_to_number',
              description: 'Transfer to human operator',
              config: { phone_numbers: [] }
            },
            {
              type: 'system',
              name: 'play_dtmf',
              description: 'Play keypad touch tones'
            },
            {
              type: 'system',
              name: 'voicemail_detection',
              description: 'Detect voicemail systems',
              config: { leave_message: false, message_content: '' }
            }
          ]
        },
        tts: {
          voice_id: config.voiceId || '21m00Tcm4TlvDq8ikWAM',
          agent_output_audio_format: 'pcm_16000',
          optimize_streaming_latency: 3,
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true
        },
        turn: {
          mode: 'turn',
          threshold: 0.5
        },
        asr: {
          quality: 'high',
          provider: 'elevenlabs'
        }
      },
      platform_settings: {
        auth: {
          mode: 'open'
        },
        conversation_initiation_client_data_webhook: {
          enabled: false,
          url: ''
        },
        post_call_webhook: {
          enabled: true,
          url: `${process.env.PUBLIC_URL || 'http://localhost:5000'}/api/webhooks/elevenlabs/post-call`
        }
      },
      client_config_override: {
        agent: {
          language: {},
          prompt: { prompt: {}, first_message: {} },
          first_message: {},
          tools: {}
        },
        tts: {
          voice_id: {},
          stability: {},
          similarity_boost: {},
          style: {},
          use_speaker_boost: {},
          optimize_streaming_latency: {},
          agent_output_audio_format: {}
        },
        conversation: { text_only: {} },
        turn: { mode: {}, threshold: {} },
        asr: { quality: {}, provider: {} },
        llm: { model: {}, temperature: {}, max_tokens: {} },
        platform_settings: {
          conversation_initiation_client_data_webhook: {},
          post_call_webhook: {}
        }
      }
    };

    const response = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(agentPayload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`ElevenLabs API error: ${error.message || response.statusText}`);
    }

    const data = await response.json();

    // Track provider usage
    await this.storage.trackProviderUsage({
      organizationId: provider.organizationId,
      providerIntegrationId: provider.id,
      usageType: 'agent_creation',
      quantity: '1',
      metadata: { agentId: data.agent_id, agentName: config.name }
    });

    return {
      agentId: data.agent_id,
      provider: 'elevenlabs',
      metadata: data
    };
  }

  /**
   * Vapi agent creation implementation
   */
  private async createVapiAgent(
    provider: ProviderIntegration,
    config: VoiceAgentConfig
  ): Promise<VoiceAgentResponse> {
    const apiKey = decryptApiKey((provider.credentials as any)?.apiKey || '');

    const agentPayload = {
      name: config.name,
      firstMessage: config.firstMessage,
      model: {
        provider: config.model || 'openai',
        model: 'gpt-4',
        systemPrompt: config.systemPrompt,
        temperature: 0.7
      },
      voice: {
        provider: 'elevenlabs', // This would come from TTS provider integration
        voiceId: config.voiceId || '21m00Tcm4TlvDq8ikWAM'
      }
    };

    const response = await fetch('https://api.vapi.ai/assistant', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(agentPayload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Vapi API error: ${error.message || response.statusText}`);
    }

    const data = await response.json();

    // Track provider usage
    await this.storage.trackProviderUsage({
      organizationId: provider.organizationId,
      providerIntegrationId: provider.id,
      usageType: 'agent_creation',
      quantity: '1',
      metadata: { assistantId: data.id, agentName: config.name }
    });

    return {
      agentId: data.id,
      provider: 'vapi',
      metadata: data
    };
  }

  /**
   * Bland agent creation implementation
   */
  private async createBlandAgent(
    provider: ProviderIntegration,
    config: VoiceAgentConfig
  ): Promise<VoiceAgentResponse> {
    const apiKey = decryptApiKey((provider.credentials as any)?.apiKey || '');

    const agentPayload = {
      prompt: config.systemPrompt,
      voice: config.voiceId || 'maya',
      first_sentence: config.firstMessage,
      language: config.language || 'en'
    };

    const response = await fetch('https://api.bland.ai/v1/agents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(agentPayload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Bland API error: ${error.message || response.statusText}`);
    }

    const data = await response.json();

    // Track provider usage
    await this.storage.trackProviderUsage({
      organizationId: provider.organizationId,
      providerIntegrationId: provider.id,
      usageType: 'agent_creation',
      quantity: '1',
      metadata: { agentId: data.agent_id, agentName: config.name }
    });

    return {
      agentId: data.agent_id || data.id,
      provider: 'bland',
      metadata: data
    };
  }

  /**
   * Retell agent creation implementation
   */
  private async createRetellAgent(
    provider: ProviderIntegration,
    config: VoiceAgentConfig
  ): Promise<VoiceAgentResponse> {
    const apiKey = decryptApiKey((provider.credentials as any)?.apiKey || '');

    const agentPayload = {
      agent_name: config.name,
      general_prompt: config.systemPrompt,
      begin_message: config.firstMessage,
      voice_id: config.voiceId || 'default',
      language: config.language || 'en-US'
    };

    const response = await fetch('https://api.retellai.com/create-agent', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(agentPayload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Retell API error: ${error.message || response.statusText}`);
    }

    const data = await response.json();

    // Track provider usage
    await this.storage.trackProviderUsage({
      organizationId: provider.organizationId,
      providerIntegrationId: provider.id,
      usageType: 'agent_creation',
      quantity: '1',
      metadata: { agentId: data.agent_id, agentName: config.name }
    });

    return {
      agentId: data.agent_id,
      provider: 'retell',
      metadata: data
    };
  }
}
