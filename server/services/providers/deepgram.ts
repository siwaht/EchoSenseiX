import { ISTTProvider, ITTSProvider, ProviderType } from "./types";

abstract class DeepgramBaseProvider {
    protected apiKey: string | null = null;
    protected baseUrl = "https://api.deepgram.com";

    protected async initializeBase(config: any): Promise<void> {
        this.apiKey = config.apiKey || config.api_key || null;
        this.baseUrl = (config.baseUrl || this.baseUrl).replace(/\/$/, "");
        if (!this.apiKey) throw new Error("Deepgram API key is required");
    }

    protected headers(contentType?: string): Record<string, string> {
        if (!this.apiKey) throw new Error("Deepgram provider not initialized");
        return {
            Authorization: `Token ${this.apiKey}`,
            ...(contentType ? { "Content-Type": contentType } : {}),
        };
    }

    protected async checkModels(): Promise<boolean> {
        if (!this.apiKey) return false;
        try {
            const response = await fetch(`${this.baseUrl}/v1/models`, {
                headers: this.headers(),
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}

export class DeepgramTTSProvider extends DeepgramBaseProvider implements ITTSProvider {
    id = "deepgram-tts";
    name = "Deepgram TTS";
    type: ProviderType = "tts";

    async initialize(config: any): Promise<void> {
        await this.initializeBase(config);
    }

    async healthCheck(): Promise<boolean> {
        return this.checkModels();
    }

    async getVoices(): Promise<any[]> {
        const response = await fetch(`${this.baseUrl}/v1/models?capability=tts`, {
            headers: this.headers(),
        });
        if (!response.ok) throw new Error(`Deepgram model listing failed (${response.status})`);
        const data = await response.json() as { models?: any[] };
        return (data.models || []).filter(model => model.capabilities?.includes?.("tts") || model.model?.includes?.("aura"));
    }

    async getVoice(voiceId: string): Promise<any> {
        const response = await fetch(`${this.baseUrl}/v1/models/${encodeURIComponent(voiceId)}`, {
            headers: this.headers(),
        });
        if (!response.ok) throw new Error(`Deepgram voice lookup failed (${response.status})`);
        return response.json();
    }

    async generateAudio(text: string, voiceId: string, options: any = {}): Promise<ArrayBuffer> {
        const model = voiceId || options.modelId || options.model || "aura-2-thalia-en";
        const response = await fetch(`${this.baseUrl}/v1/speak?model=${encodeURIComponent(model)}`, {
            method: "POST",
            headers: {
                ...this.headers("application/json"),
                Accept: options.accept || "audio/mpeg",
            },
            body: JSON.stringify({ text }),
        });
        if (!response.ok) {
            const message = await response.text().catch(() => "");
            throw new Error(`Deepgram synthesis failed (${response.status}): ${message || response.statusText}`);
        }
        return response.arrayBuffer();
    }
}

export class DeepgramSTTProvider extends DeepgramBaseProvider implements ISTTProvider {
    id = "deepgram-stt";
    name = "Deepgram STT";
    type: ProviderType = "stt";

    async initialize(config: any): Promise<void> {
        await this.initializeBase(config);
    }

    async healthCheck(): Promise<boolean> {
        return this.checkModels();
    }

    async transcribe(audioBuffer: Buffer, options: any = {}): Promise<string> {
        const params = new URLSearchParams({
            model: options.model || "nova-3",
            smart_format: String(options.smartFormat ?? true),
        });
        if (options.language) params.set("language", options.language);
        if (options.diarization) params.set("diarize", "true");

        const response = await fetch(`${this.baseUrl}/v1/listen?${params.toString()}`, {
            method: "POST",
            headers: this.headers(options.contentType || "audio/mpeg"),
            body: new Uint8Array(audioBuffer),
        });
        if (!response.ok) {
            const message = await response.text().catch(() => "");
            throw new Error(`Deepgram transcription failed (${response.status}): ${message || response.statusText}`);
        }

        const data = await response.json() as any;
        return data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
    }
}
