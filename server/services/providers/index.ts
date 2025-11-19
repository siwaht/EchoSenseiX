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
    if (process.env.OPENAI_API_KEY) {
        try {
            const openai = new OpenAIProvider();
            await openai.initialize({ apiKey: process.env.OPENAI_API_KEY });
            providerRegistry.register(openai);
            console.log("[Providers] OpenAI provider initialized");
        } catch (error) {
            console.error("[Providers] Failed to initialize OpenAI provider:", error);
        }
    }
}
