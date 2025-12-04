/**
 * Multilingual Service
 * 
 * Handles multiple language support for voice agents
 * Similar to ElevenLabs' language configuration interface
 */

import { storage } from "../storage";
// import { createElevenLabsClient } from "./elevenlabs";

export interface LanguageConfig {
  code: string;
  name: string;
  flag: string;
  isDefault: boolean;
  firstMessage?: string;
  systemPrompt?: string;
}

export interface MultilingualAgent {
  id: string;
  name: string;
  defaultLanguage: string;
  supportedLanguages: LanguageConfig[];
  languageOverrides: Record<string, {
    firstMessage?: string;
    systemPrompt?: string;
  }>;
}

export class MultilingualService {
  /**
   * Supported languages with their configurations
   */
  static readonly SUPPORTED_LANGUAGES: LanguageConfig[] = [
    { code: 'en', name: 'English', flag: '🇺🇸', isDefault: true },
    { code: 'es', name: 'Spanish', flag: '🇪🇸', isDefault: false },
    { code: 'fr', name: 'French', flag: '🇫🇷', isDefault: false },
    { code: 'de', name: 'German', flag: '🇩🇪', isDefault: false },
    { code: 'it', name: 'Italian', flag: '🇮🇹', isDefault: false },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹', isDefault: false },
    { code: 'ru', name: 'Russian', flag: '🇷🇺', isDefault: false },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵', isDefault: false },
    { code: 'ko', name: 'Korean', flag: '🇰🇷', isDefault: false },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳', isDefault: false },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦', isDefault: false },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳', isDefault: false },
    { code: 'nl', name: 'Dutch', flag: '🇳🇱', isDefault: false },
    { code: 'sv', name: 'Swedish', flag: '🇸🇪', isDefault: false },
    { code: 'no', name: 'Norwegian', flag: '🇳🇴', isDefault: false },
    { code: 'da', name: 'Danish', flag: '🇩🇰', isDefault: false },
    { code: 'fi', name: 'Finnish', flag: '🇫🇮', isDefault: false },
    { code: 'pl', name: 'Polish', flag: '🇵🇱', isDefault: false },
    { code: 'tr', name: 'Turkish', flag: '🇹🇷', isDefault: false },
    { code: 'th', name: 'Thai', flag: '🇹🇭', isDefault: false },
  ];

  /**
   * Get all supported languages
   */
  static getSupportedLanguages(): LanguageConfig[] {
    return this.SUPPORTED_LANGUAGES;
  }

  /**
   * Add additional language to agent
   */
  static async addLanguageToAgent(
    organizationId: string,
    agentId: string,
    languageCode: string,
    config: {
      firstMessage?: string;
      systemPrompt?: string;
    }
  ): Promise<void> {
    try {
      console.log(`[MULTILINGUAL] Adding language ${languageCode} to agent ${agentId}`);

      const agent = await storage.getAgent(agentId, organizationId);
      if (!agent) {
        throw new Error("Agent not found");
      }

      // Get current multilingual config
      let multilingualConfig = (agent as any).multilingualConfig || {
        supportedLanguages: ['en'],
        languageOverrides: {}
      };

      // Add language if not already supported
      if (!multilingualConfig.supportedLanguages.includes(languageCode)) {
        multilingualConfig.supportedLanguages.push(languageCode);
      }

      // Add language overrides
      multilingualConfig.languageOverrides[languageCode] = {
        firstMessage: config.firstMessage,
        systemPrompt: config.systemPrompt
      };

      // Update agent with new multilingual config
      await storage.updateAgent(agentId, organizationId, {
        multilingualConfig,
        lastSynced: new Date()
      } as any);

      console.log(`[MULTILINGUAL] Language ${languageCode} added to agent ${agentId}`);

    } catch (error: any) {
      console.error(`[MULTILINGUAL] Failed to add language:`, error);
      throw new Error(`Failed to add language: ${error.message}`);
    }
  }

  /**
   * Remove language from agent
   */
  static async removeLanguageFromAgent(
    organizationId: string,
    agentId: string,
    languageCode: string
  ): Promise<void> {
    try {
      console.log(`[MULTILINGUAL] Removing language ${languageCode} from agent ${agentId}`);

      const agent = await storage.getAgent(agentId, organizationId);
      if (!agent) {
        throw new Error("Agent not found");
      }

      const multilingualConfig = (agent as any).multilingualConfig;
      if (!multilingualConfig) {
        return;
      }

      // Don't allow removing default language
      if (languageCode === 'en' && multilingualConfig.supportedLanguages.length > 1) {
        throw new Error("Cannot remove default English language");
      }

      // Remove language from supported languages
      multilingualConfig.supportedLanguages = multilingualConfig.supportedLanguages.filter(
        (lang: string) => lang !== languageCode
      );

      // Remove language overrides
      delete multilingualConfig.languageOverrides[languageCode];

      // Update agent
      await storage.updateAgent(agentId, organizationId, {
        multilingualConfig,
        lastSynced: new Date()
      } as any);

      console.log(`[MULTILINGUAL] Language ${languageCode} removed from agent ${agentId}`);

    } catch (error: any) {
      console.error(`[MULTILINGUAL] Failed to remove language:`, error);
      throw new Error(`Failed to remove language: ${error.message}`);
    }
  }

  /**
   * Update language configuration for agent
   */
  static async updateLanguageConfig(
    organizationId: string,
    agentId: string,
    languageCode: string,
    config: {
      firstMessage?: string;
      systemPrompt?: string;
    }
  ): Promise<void> {
    try {
      console.log(`[MULTILINGUAL] Updating language config for ${languageCode} in agent ${agentId}`);

      const agent = await storage.getAgent(agentId, organizationId);
      if (!agent) {
        throw new Error("Agent not found");
      }

      let multilingualConfig = (agent as any).multilingualConfig || {
        supportedLanguages: ['en'],
        languageOverrides: {}
      };

      // Update language overrides
      multilingualConfig.languageOverrides[languageCode] = {
        ...multilingualConfig.languageOverrides[languageCode],
        ...config
      };

      // Update agent
      await storage.updateAgent(agentId, organizationId, {
        multilingualConfig,
        lastSynced: new Date()
      } as any);

      console.log(`[MULTILINGUAL] Language config updated for ${languageCode} in agent ${agentId}`);

    } catch (error: any) {
      console.error(`[MULTILINGUAL] Failed to update language config:`, error);
      throw new Error(`Failed to update language config: ${error.message}`);
    }
  }

  /**
   * Translate text to all supported languages
   */
  static async translateToAllLanguages(
    organizationId: string,
    text: string,
    targetLanguages: string[]
  ): Promise<Record<string, string>> {
    try {
      console.log(`[MULTILINGUAL] Translating text to ${targetLanguages.length} languages`);

      const integration = await storage.getIntegration(organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        throw new Error("ElevenLabs integration not configured");
      }

      // const client = createElevenLabsClient(integration.apiKey);
      const translations: Record<string, string> = {};

      // For now, we'll use a simple approach
      // In a real implementation, you might use ElevenLabs' translation capabilities
      // or integrate with Google Translate API

      for (const languageCode of targetLanguages) {
        try {
          // This is a placeholder - in reality, you'd call ElevenLabs translation API
          // or another translation service
          translations[languageCode] = await this.translateText(text, languageCode);
        } catch (error) {
          console.warn(`[MULTILINGUAL] Failed to translate to ${languageCode}:`, error);
          translations[languageCode] = text; // Fallback to original text
        }
      }

      console.log(`[MULTILINGUAL] Translation completed for ${Object.keys(translations).length} languages`);
      return translations;

    } catch (error: any) {
      console.error(`[MULTILINGUAL] Translation failed:`, error);
      throw new Error(`Translation failed: ${error.message}`);
    }
  }

  /**
   * Translate text to specific language
   */
  private static async translateText(text: string, targetLanguage: string): Promise<string> {
    // This is a placeholder implementation
    // In a real app, you would integrate with a translation service
    // For now, we'll return the original text with a note

    const languageNames: Record<string, string> = {
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'nl': 'Dutch',
      'sv': 'Swedish',
      'no': 'Norwegian',
      'da': 'Danish',
      'fi': 'Finnish',
      'pl': 'Polish',
      'tr': 'Turkish',
      'th': 'Thai'
    };

    const languageName = languageNames[targetLanguage] || targetLanguage;

    // Return a mock translation - in reality, this would be actual translation
    return `[${languageName} Translation] ${text}`;
  }

  /**
   * Get agent's multilingual configuration
   */
  static async getAgentMultilingualConfig(
    organizationId: string,
    agentId: string
  ): Promise<MultilingualAgent | null> {
    try {
      const agent = await storage.getAgent(agentId, organizationId);
      if (!agent) {
        return null;
      }

      const multilingualConfig = (agent as any).multilingualConfig || {
        supportedLanguages: ['en'],
        languageOverrides: {}
      };

      const supportedLanguages = this.SUPPORTED_LANGUAGES.filter(lang =>
        multilingualConfig.supportedLanguages.includes(lang.code)
      );

      return {
        id: agent.id,
        name: agent.name,
        defaultLanguage: 'en',
        supportedLanguages,
        languageOverrides: multilingualConfig.languageOverrides
      };

    } catch (error: any) {
      console.error(`[MULTILINGUAL] Failed to get agent config:`, error);
      throw new Error(`Failed to get agent config: ${error.message}`);
    }
  }

  /**
   * Get message for specific language
   */
  static async getMessageForLanguage(
    organizationId: string,
    agentId: string,
    languageCode: string,
    messageType: 'firstMessage' | 'systemPrompt'
  ): Promise<string> {
    try {
      const agent = await storage.getAgent(agentId, organizationId);
      if (!agent) {
        throw new Error("Agent not found");
      }

      const multilingualConfig = (agent as any).multilingualConfig;

      // Check if there's a language-specific override
      if (multilingualConfig?.languageOverrides[languageCode]?.[messageType]) {
        return multilingualConfig.languageOverrides[languageCode][messageType]!;
      }

      // Return default message
      if (messageType === 'firstMessage') {
        return agent.firstMessage || "Hello! How can I help you today?";
      } else {
        return agent.systemPrompt || "You are a helpful AI assistant.";
      }

    } catch (error: any) {
      console.error(`[MULTILINGUAL] Failed to get message:`, error);
      throw new Error(`Failed to get message: ${error.message}`);
    }
  }
}

export default MultilingualService;
