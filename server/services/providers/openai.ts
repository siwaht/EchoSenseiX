import { ILLMProvider, ProviderType } from "./types";
import OpenAI from "openai";

export class OpenAIProvider implements ILLMProvider {
    id = "openai";
    name = "OpenAI";
    type: ProviderType = "llm";
    private client: OpenAI | null = null;

    async initialize(config: any): Promise<void> {
        this.client = new OpenAI({
            apiKey: config.apiKey,
        });
    }

    async generateResponse(prompt: string, context?: any[], options?: any): Promise<string> {
        if (!this.client) throw new Error("OpenAIProvider not initialized");

        const messages = context ? [...context, { role: "user", content: prompt }] : [{ role: "user", content: prompt }];

        const response = await this.client.chat.completions.create({
            model: options?.model || "gpt-4o",
            messages: messages,
            ...options
        });

        return response.choices[0].message.content || "";
    }

    async streamResponse(prompt: string, context?: any[], options?: any): Promise<ReadableStream> {
        if (!this.client) throw new Error("OpenAIProvider not initialized");

        const messages = context ? [...context, { role: "user", content: prompt }] : [{ role: "user", content: prompt }];

        const stream = await this.client.chat.completions.create({
            model: options?.model || "gpt-4o",
            messages: messages,
            stream: true,
            ...options
        });

        // Convert OpenAI stream to ReadableStream
        return new ReadableStream({
            async start(controller) {
                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || "";
                    if (content) {
                        controller.enqueue(new TextEncoder().encode(content));
                    }
                }
                controller.close();
            }
        });
    }
}
