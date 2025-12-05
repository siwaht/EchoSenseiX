import { ITelephonyProvider, ILLMProvider, ITTSProvider, ISTTProvider, ProviderType } from "./types";
import { PicaService } from "../pica";

export class PicaTwilioAdapter implements ITelephonyProvider {
    id = "twilio";
    name = "Twilio (via PicaOS)";
    type: ProviderType = "telephony";

    constructor(private pica: PicaService) { }

    async initialize(_config: any): Promise<void> {
        // No initialization needed, PicaService is already initialized
    }

    async getPhoneNumbers(agentId?: string): Promise<any[]> {
        return this.pica.getPhoneNumbers(agentId);
    }

    async createPhoneNumber(data: any): Promise<any> {
        return this.pica.createPhoneNumber(data);
    }

    async deletePhoneNumber(phoneNumberId: string): Promise<any> {
        return this.pica.deletePhoneNumber(phoneNumberId);
    }

    async makeOutboundCall(to: string, from: string, config: any): Promise<any> {
        return this.pica.makeOutboundCall(to, from, config);
    }
}

export class PicaOpenAIAdapter implements ILLMProvider {
    id = "openai";
    name = "OpenAI (via PicaOS)";
    type: ProviderType = "llm";

    constructor(private pica: PicaService) { }

    async initialize(_config: any): Promise<void> {
        // No initialization needed
    }

    async generateResponse(prompt: string, context?: any[], options?: any): Promise<string> {
        return this.pica.generateResponse(prompt, context, options);
    }

    async streamResponse(prompt: string, context?: any[], options?: any): Promise<ReadableStream> {
        return this.pica.streamResponse(prompt, context, options) as Promise<ReadableStream>;
    }
}

export class PicaTTSAdapter implements ITTSProvider {
    id = "elevenlabs"; // Mimic ElevenLabs ID for seamless replacement
    name = "ElevenLabs TTS (via PicaOS)";
    type: ProviderType = "tts";

    constructor(private pica: PicaService) { }

    async initialize(_config: any): Promise<void> {
        // No initialization needed
    }

    async getVoices(): Promise<any[]> {
        return this.pica.getVoices();
    }

    async getVoice(voiceId: string): Promise<any> {
        return this.pica.getVoice(voiceId);
    }

    async generateAudio(text: string, voiceId: string, options?: any): Promise<ArrayBuffer> {
        return this.pica.generateAudio(text, voiceId, options);
    }
}

export class PicaSTTAdapter implements ISTTProvider {
    id = "openai"; // Mimic OpenAI ID for seamless replacement
    name = "OpenAI Whisper (via PicaOS)";
    type: ProviderType = "stt";

    constructor(private pica: PicaService) { }

    async initialize(_config: any): Promise<void> {
        // No initialization needed
    }

    async transcribe(audioBuffer: Buffer, options?: any): Promise<string> {
        return this.pica.transcribe(audioBuffer, options);
    }
}
