import { ILLMProvider, ProviderType } from "./types";
import OpenAI from "openai";
import { generateText } from "ai";
import { openai as openaiModel } from "@ai-sdk/openai";
import { Pica } from "@picahq/toolkit";

export class OpenAIProvider implements ILLMProvider {
    id = "openai";
    name = "OpenAI";
    type: ProviderType = "llm";
    private client: OpenAI | null = null;
    private picaFallback: Pica | null = null;

    setPicaFallback(pica: Pica) {
        this.picaFallback = pica;
        console.log("[OpenAIProvider] Pica fallback configured");
    }

    async initialize(config: any): Promise<void> {
        this.client = new OpenAI({
            apiKey: config.apiKey,
        });
    }

    async generateResponse(prompt: string, context?: any[], options?: any): Promise<string> {
        if (!this.client) throw new Error("OpenAIProvider not initialized");

        const messages = context ? [...context, { role: "user", content: prompt }] : [{ role: "user", content: prompt }];

        try {
            const response = await this.client.chat.completions.create({
                model: options?.model || "gpt-4o",
                messages: messages,
                ...options
            });

            return response.choices[0]?.message?.content || "";
        } catch (error) {
            if (this.picaFallback) {
                console.warn("[OpenAIProvider] Main connection failed, attempting Pica fallback...", error);

                try {
                    const pica = this.picaFallback as any;
                    const generateOptions: any = {
                        model: openaiModel(options?.model || "gpt-4o"),
                        system: pica.systemPrompt,
                        prompt: prompt,
                        tools: { ...pica.tools() },
                        maxSteps: 10,
                    };
                    const { text } = await generateText(generateOptions);

                    console.log("[OpenAIProvider] Pica fallback successful");
                    return text;
                } catch (fallbackError) {
                    console.error("[OpenAIProvider] Pica fallback also failed:", fallbackError);
                    throw error;
                }
            }
            throw error;
        }
    }

    async streamResponse(prompt: string, context?: any[], options?: any): Promise<ReadableStream> {
        if (!this.client) throw new Error("OpenAIProvider not initialized");

        const messages = context ? [...context, { role: "user", content: prompt }] : [{ role: "user", content: prompt }];

        const stream = await this.client.chat.completions.create({
            model: options?.model || "gpt-4o",
            messages: messages,
            stream: true,
            ...options
        }) as unknown as AsyncIterable<any>;

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
