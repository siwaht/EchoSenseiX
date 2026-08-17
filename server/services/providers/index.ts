import { providerRegistry } from "./registry";
import { ElevenLabsProvider } from "./elevenlabs";
import { FishAudioProvider } from "./fish-audio";
import { DeepgramSTTProvider, DeepgramTTSProvider } from "./deepgram";
import { TwilioProvider } from "./twilio";
import { OpenAIProvider } from "./openai";
import logger from "../../utils/logger";

async function registerProvider(
    provider: { id: string; initialize(config: any): Promise<void> },
    config: any,
): Promise<void> {
    try {
        await provider.initialize(config);
        providerRegistry.register(provider as any);
        logger.info(`${provider.id} provider initialized`);
    } catch (error) {
        logger.error(`Failed to initialize ${provider.id} provider`, {
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

export async function initializeProviders() {
    logger.info("Initializing providers...");

    if (process.env.ELEVENLABS_API_KEY) {
        await registerProvider(new ElevenLabsProvider(), { apiKey: process.env.ELEVENLABS_API_KEY });
    }

    if (process.env.FISH_AUDIO_API_KEY) {
        await registerProvider(new FishAudioProvider(), {
            apiKey: process.env.FISH_AUDIO_API_KEY,
            baseUrl: process.env.FISH_AUDIO_BASE_URL,
        });
    }

    if (process.env.DEEPGRAM_API_KEY) {
        await registerProvider(new DeepgramTTSProvider(), { apiKey: process.env.DEEPGRAM_API_KEY });
        await registerProvider(new DeepgramSTTProvider(), { apiKey: process.env.DEEPGRAM_API_KEY });
    }

    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        await registerProvider(new TwilioProvider(), {
            accountSid: process.env.TWILIO_ACCOUNT_SID,
            authToken: process.env.TWILIO_AUTH_TOKEN,
        });
    }

    if (process.env.OPENAI_API_KEY) {
        await registerProvider(new OpenAIProvider(), { apiKey: process.env.OPENAI_API_KEY });
    }

    logger.info("Provider initialization complete", {
        registered: providerRegistry.getAllProviders().map(provider => provider.id),
    });
}
