import { DeepgramSTTProvider, DeepgramTTSProvider } from "../services/providers/deepgram";
import { FishAudioProvider } from "../services/providers/fish-audio";

export {};

const originalFetch = globalThis.fetch;
const requests: Array<{ url: string; init?: RequestInit }> = [];

globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input);
  requests.push({ url, init });

  if (url.includes("api.fish.audio/model")) {
    return new Response(JSON.stringify({ items: [{ _id: "fish-voice", title: "Test voice" }] }), { status: 200 });
  }
  if (url.includes("api.fish.audio/v1/tts")) {
    return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
  }
  if (url.includes("api.deepgram.com/v1/models")) {
    return new Response(JSON.stringify({ models: [{ model: "aura-2-thalia-en", capabilities: ["tts"] }] }), { status: 200 });
  }
  if (url.includes("api.deepgram.com/v1/speak")) {
    return new Response(new Uint8Array([4, 5, 6]), { status: 200 });
  }
  if (url.includes("api.deepgram.com/v1/listen")) {
    return new Response(JSON.stringify({ results: { channels: [{ alternatives: [{ transcript: "hello from deepgram" }] }] } }), { status: 200 });
  }
  return new Response("not found", { status: 404 });
};

try {
  const fish = new FishAudioProvider();
  await fish.initialize({ apiKey: "fish-test-key" });
  const voices = await fish.getVoices();
  const fishAudio = await fish.generateAudio("hello", "fish-voice");

  const deepgramTts = new DeepgramTTSProvider();
  await deepgramTts.initialize({ apiKey: "deepgram-test-key" });
  const ttsHealthy = await deepgramTts.healthCheck();
  const deepgramAudio = await deepgramTts.generateAudio("hello", "aura-2-thalia-en");

  const deepgramStt = new DeepgramSTTProvider();
  await deepgramStt.initialize({ apiKey: "deepgram-test-key" });
  const transcript = await deepgramStt.transcribe(Buffer.from([7, 8, 9]), { contentType: "audio/wav" });

  const fishRequest = requests.find(request => request.url.includes("api.fish.audio/v1/tts"));
  const deepgramListenRequest = requests.find(request => request.url.includes("api.deepgram.com/v1/listen"));
  const fishBody = JSON.parse(String(fishRequest?.init?.body));

  if (voices.length !== 1 || fishAudio.byteLength !== 3 || !ttsHealthy || deepgramAudio.byteLength !== 3) {
    throw new Error("Provider adapter response contract failed");
  }
  if (transcript !== "hello from deepgram") throw new Error("Deepgram STT transcript contract failed");
  if (fishBody.reference_id !== "fish-voice" || fishBody.text !== "hello") throw new Error("Fish Audio request contract failed");
  if (!deepgramListenRequest?.url.includes("model=nova-3") || !deepgramListenRequest.url.includes("smart_format=true")) {
    throw new Error("Deepgram STT request contract failed");
  }

  console.log(`PASS provider adapters (${requests.length} mocked requests)`);
} finally {
  globalThis.fetch = originalFetch;
}
