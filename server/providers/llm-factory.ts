/**
 * LLM Provider Factory
 */

import type { LLMProvider, LLMConfig } from './llm-provider';

export class LLMProviderFactory {
  private static instance: LLMProvider | null = null;

  static createProvider(config: LLMConfig): LLMProvider {
    console.log(`[LLM-FACTORY] Creating ${config.provider} provider...`);

    throw new Error('LLM providers not yet implemented - create adapters for OpenAI, Anthropic, etc.');
  }

  static async getInstance(config?: LLMConfig): Promise<LLMProvider> {
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

  static reset(): void {
    this.instance = null;
  }

  static getConfigFromEnv(): LLMConfig {
    const provider = (process.env.LLM_PROVIDER || 'openai') as LLMConfig['provider'];

    return {
      provider,
      apiKey: process.env.OPENAI_API_KEY || process.env.LLM_API_KEY,
      model: process.env.LLM_MODEL || 'gpt-4',
    };
  }
}

export async function getLLMProvider(config?: LLMConfig): Promise<LLMProvider> {
  return LLMProviderFactory.getInstance(config);
}
