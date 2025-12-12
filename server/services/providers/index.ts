import { providerRegistry } from "./registry";
import { ElevenLabsProvider } from "./elevenlabs";
import { TwilioProvider } from "./twilio";
import { OpenAIProvider } from "./openai";

export async function initializeProviders() {
    console.log("[Providers] Initializing providers...");

    // Initialize ElevenLabs
    if (process.env.ELEVENLABS_API_KEY) {
        try {
            const elevenLabs = new ElevenLabsProvider();
            await elevenLabs.initialize({ apiKey: process.env.ELEVENLABS_API_KEY });
            providerRegistry.register(elevenLabs);
            console.log("[Providers] ElevenLabs provider initialized");
        } catch (error) {
            console.error("[Providers] Failed to initialize ElevenLabs provider:", error);
        }
    } else {
        console.warn("[Providers] ELEVENLABS_API_KEY not found, skipping ElevenLabs provider");
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
            console.log("[Providers] Twilio provider initialized");
        } catch (error) {
            console.error("[Providers] Failed to initialize Twilio provider:", error);
        }
    }

    // Initialize OpenAI
    let openaiProvider: OpenAIProvider | null = null;
    if (process.env.OPENAI_API_KEY) {
        try {
            openaiProvider = new OpenAIProvider();
            await openaiProvider.initialize({ apiKey: process.env.OPENAI_API_KEY });
            providerRegistry.register(openaiProvider);
            console.log("[Providers] OpenAI provider initialized");
        } catch (error) {
            console.error("[Providers] Failed to initialize OpenAI provider:", error);
        }
    }

    // Initialize PicaOS
    if (process.env.PICA_SECRET_KEY) {
        try {
            const { picaService } = await import("../pica");
            const { PicaTwilioAdapter, PicaOpenAIAdapter } = await import("./pica-adapters");

            await picaService.initialize({ apiKey: process.env.PICA_SECRET_KEY });
            providerRegistry.register(picaService);
            console.log("[Providers] PicaOS provider initialized");

            // Register PicaOS adapters to replace/augment existing providers
            // Note: This will overwrite existing 'twilio' and 'openai' providers if they were registered above
            // which is what we want for "replacement" behavior if Pica is the preferred gateway.

            const twilioAdapter = new PicaTwilioAdapter(picaService);
            providerRegistry.register(twilioAdapter);
            console.log("[Providers] Registered Twilio adapter via PicaOS");

            // If OpenAI wasn't initialized (e.g. no key), fallback to Pica adapter as primary
            if (!openaiProvider) {
                const openaiAdapter = new PicaOpenAIAdapter(picaService);
                providerRegistry.register(openaiAdapter);
                console.log("[Providers] Registered OpenAI adapter via PicaOS (Primary)");
            }

            const { PicaTTSAdapter, PicaSTTAdapter } = await import("./pica-adapters");

            const ttsAdapter = new PicaTTSAdapter(picaService);
            providerRegistry.register(ttsAdapter);
            console.log("[Providers] Registered TTS adapter via PicaOS");

            const sttAdapter = new PicaSTTAdapter(picaService);
            providerRegistry.register(sttAdapter);
            console.log("[Providers] Registered STT adapter via PicaOS");

        } catch (error) {
            console.error("[Providers] Failed to initialize PicaOS provider:", error);
        }
    } else {
        console.warn("[Providers] PICA_SECRET_KEY not found, skipping PicaOS provider");
    }
}
