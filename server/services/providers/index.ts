import { providerRegistry } from "./registry";
import { ElevenLabsProvider } from "./elevenlabs";
import { TwilioProvider } from "./twilio";
import { OpenAIProvider } from "./openai";
import logger from "../../utils/logger";

export async function initializeProviders() {
    logger.info("Initializing providers...");

    // Initialize ElevenLabs
    if (process.env.ELEVENLABS_API_KEY) {
        try {
            const elevenLabs = new ElevenLabsProvider();
            await elevenLabs.initialize({ apiKey: process.env.ELEVENLABS_API_KEY });
            providerRegistry.register(elevenLabs);
            logger.info("ElevenLabs provider initialized");
        } catch (error) {
            logger.error("Failed to initialize ElevenLabs provider", {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    // Initialize Twilio
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        try {
            const twilio = new TwilioProvider();
            await twilio.initialize({
                accountSid: process.env.TWILIO_ACCOUNT_SID,
                authToken: process.env.TWILIO_AUTH_TOKEN
            });
            providerRegistry.register(twilio);
            logger.info("Twilio provider initialized");
        } catch (error) {
            logger.error("Failed to initialize Twilio provider", {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    // Initialize OpenAI
    let openaiProvider: OpenAIProvider | null = null;
    if (process.env.OPENAI_API_KEY) {
        try {
            openaiProvider = new OpenAIProvider();
            await openaiProvider.initialize({ apiKey: process.env.OPENAI_API_KEY });
            providerRegistry.register(openaiProvider);
            logger.info("OpenAI provider initialized");
        } catch (error) {
            logger.error("Failed to initialize OpenAI provider", {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    // Initialize PicaOS
    if (process.env.PICA_SECRET_KEY) {
        try {
            const { picaService } = await import("../pica");
            const { PicaTwilioAdapter, PicaOpenAIAdapter } = await import("./pica-adapters");

            await picaService.initialize({ apiKey: process.env.PICA_SECRET_KEY });
            providerRegistry.register(picaService);
            logger.info("PicaOS provider initialized");

            const twilioAdapter = new PicaTwilioAdapter(picaService);
            providerRegistry.register(twilioAdapter);
            logger.info("Twilio adapter registered via PicaOS");

            if (openaiProvider) {
                try {
                    const { PicaToolkitService } = await import("../pica-toolkit");
                    const toolkit = new PicaToolkitService(process.env.PICA_SECRET_KEY);
                    openaiProvider.setPicaFallback(toolkit.instance);
                    logger.info("Pica fallback configured for OpenAI");
                } catch (picaError) {
                    logger.error("Failed to load Pica toolkit for fallback", {
                        error: picaError instanceof Error ? picaError.message : String(picaError)
                    });
                }
            } else {
                const openaiAdapter = new PicaOpenAIAdapter(picaService);
                providerRegistry.register(openaiAdapter);
                logger.info("OpenAI adapter registered via PicaOS (primary)");
            }

            const { PicaTTSAdapter, PicaSTTAdapter } = await import("./pica-adapters");

            const ttsAdapter = new PicaTTSAdapter(picaService);
            providerRegistry.register(ttsAdapter);
            logger.info("TTS adapter registered via PicaOS");

            const sttAdapter = new PicaSTTAdapter(picaService);
            providerRegistry.register(sttAdapter);
            logger.info("STT adapter registered via PicaOS");

        } catch (error) {
            logger.error("Failed to initialize PicaOS provider", {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    logger.info("Provider initialization complete", {
        registered: providerRegistry.getAllProviders().map(p => p.id)
    });
}
