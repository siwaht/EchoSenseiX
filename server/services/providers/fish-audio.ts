import { ITTSProvider, ProviderType } from "./types";

export class FishAudioProvider implements ITTSProvider {
    id = "fish-audio-tts";
    name = "Fish Audio";
    type: ProviderType = "tts";
    private apiKey: string | null = null;
    private baseUrl = "https://api.fish.audio";

    async initialize(config: any): Promise<void> {
        this.apiKey = config.apiKey || config.api_key || null;
        this.baseUrl = (config.baseUrl || this.baseUrl).replace(/\/$/, "");
        if (!this.apiKey) throw new Error("Fish Audio API key is required");
    }

    private getHeaders(contentType?: string): Record<string, string> {
        if (!this.apiKey) throw new Error("Fish Audio provider not initialized");
        return {
            Authorization: `Bearer ${this.apiKey}`,
            ...(contentType ? { "Content-Type": contentType } : {}),
        };
    }

    private async request(path: string, init: RequestInit = {}): Promise<Response> {
        const response = await fetch(`${this.baseUrl}${path}`, {
            ...init,
            headers: {
                ...this.getHeaders(),
                ...(init.headers || {}),
            },
        });
        if (!response.ok) {
            const message = await response.text().catch(() => "");
            throw new Error(`Fish Audio request failed (${response.status}): ${message || response.statusText}`);
        }
        return response;
    }

    async healthCheck(): Promise<boolean> {
        try {
            await this.request("/model?page_size=1&page_number=1&sort_by=score");
            return true;
        } catch {
            return false;
        }
    }

    async getVoices(): Promise<any[]> {
        const response = await this.request("/model?page_size=100&page_number=1&sort_by=score");
        const data = await response.json() as { items?: any[] };
        return data.items || [];
    }

    async getVoice(voiceId: string): Promise<any> {
        const response = await this.request(`/model/${encodeURIComponent(voiceId)}`);
        return response.json();
    }

    async generateAudio(text: string, voiceId: string, options: any = {}): Promise<ArrayBuffer> {
        const model = options.modelId || options.model || "s2.1-pro-free";
        const body = {
            text,
            reference_id: voiceId,
            format: options.format || "mp3",
            ...(options.sampleRate ? { sample_rate: options.sampleRate } : {}),
            ...(options.mp3Bitrate ? { mp3_bitrate: options.mp3Bitrate } : {}),
            ...(options.prosody ? { prosody: options.prosody } : {}),
            ...(options.latency ? { latency: options.latency } : {}),
            ...(options.chunkLength ? { chunk_length: options.chunkLength } : {}),
        };
        const response = await fetch(`${this.baseUrl}/v1/tts`, {
            method: "POST",
            headers: {
                ...this.getHeaders("application/json"),
                model,
                Accept: "audio/mpeg",
            },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const message = await response.text().catch(() => "");
            throw new Error(`Fish Audio synthesis failed (${response.status}): ${message || response.statusText}`);
        }
        return response.arrayBuffer();
    }
}
