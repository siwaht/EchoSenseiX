# Provider API Notes

These implementation notes are based on the official provider documentation retrieved during the EchoSenseiX audit.

## Fish Audio

Fish Audio text-to-speech uses `POST https://api.fish.audio/v1/tts` with Bearer authentication (`Authorization: Bearer <token>`), a `model` request header, and a JSON body containing `text`, `reference_id`, and optional output/prosody settings. The official API supports `mp3`, `wav`, `pcm`, and `opus`; the adapter defaults to `s2.1-pro-free` and `mp3`. Fish voice models are listed with `GET https://api.fish.audio/model?page_size=10&page_number=1&sort_by=score`, also using Bearer authentication. Official sources: [Fish Audio Text to Speech](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech), [Fish Audio TTS feature guide](https://docs.fish.audio/features/text-to-speech), [Fish Audio model list](https://docs.fish.audio/api-reference/endpoint/model/list-models), and [Fish Audio JavaScript SDK reference](https://docs.fish.audio/api-reference/sdk/javascript/api-reference).

## Deepgram

Deepgram TTS uses `POST https://api.deepgram.com/v1/speak?model=<voice-model>` with `Authorization: Token <apiKey>`, `Content-Type: application/json`, and a JSON body containing `text`. The adapter defaults to the Aura model `aura-2-thalia-en`. Deepgram prerecorded STT uses `POST https://api.deepgram.com/v1/listen` with `Authorization: Token <apiKey>`, an audio content type, and query parameters such as `model=nova-3` and `smart_format=true`. The provider health check uses `GET https://api.deepgram.com/v1/models`. Official sources: [Deepgram TTS REST](https://developers.deepgram.com/docs/tts-rest), [Deepgram single text request](https://developers.deepgram.com/reference/text-to-speech/speak-request), [Deepgram prerecorded audio](https://developers.deepgram.com/docs/pre-recorded-audio), and [Deepgram prerecorded listen reference](https://developers.deepgram.com/reference/speech-to-text/listen-pre-recorded).
