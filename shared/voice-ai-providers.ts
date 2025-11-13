/**
 * Voice AI Provider Metadata
 * Comprehensive definitions for all supported AI providers
 */

export type ProviderCategory = 'llm' | 'tts' | 'stt' | 'telephony' | 'all-in-one';

export interface ProviderCapability {
  streaming?: boolean;
  realtime?: boolean;
  customVoices?: boolean;
  emotionDetection?: boolean;
  multiLanguage?: boolean;
  customModels?: boolean;
}

export interface ProviderCredential {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url';
  required: boolean;
  placeholder?: string;
  description?: string;
}

export interface VoiceAIProviderMetadata {
  id: string;
  name: string;
  displayName: string;
  category: ProviderCategory;
  subcategories: Array<'llm' | 'tts' | 'stt' | 'telephony'>;
  description: string;
  capabilities: ProviderCapability;
  supportedLanguages?: string[];
  pricing: {
    model: string;
    details: string;
  };
  credentials: ProviderCredential[];
  integration: {
    apiVersion: string;
    baseUrl?: string;
    testEndpoint?: string;
  };
  status: 'production' | 'beta' | 'coming_soon';
  tier: 'enterprise' | 'professional' | 'standard' | 'free';
  logo?: string;
  docsUrl?: string;
}

// LLM Providers
export const LLM_PROVIDERS: Record<string, VoiceAIProviderMetadata> = {
  'openai': {
    id: 'openai',
    name: 'openai',
    displayName: 'OpenAI',
    category: 'llm',
    subcategories: ['llm'],
    description: 'GPT-4, GPT-3.5 Turbo - Industry-leading language models',
    capabilities: {
      streaming: true,
      realtime: true,
      customModels: true,
      multiLanguage: true,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh'],
    pricing: {
      model: 'Token-based',
      details: 'GPT-4: $0.03/1K input, $0.06/1K output | GPT-3.5: $0.0015/1K',
    },
    credentials: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'sk-...',
        description: 'Your OpenAI API key from platform.openai.com',
      },
      {
        key: 'organization',
        label: 'Organization ID (Optional)',
        type: 'text',
        required: false,
        placeholder: 'org-...',
      },
    ],
    integration: {
      apiVersion: 'v1',
      baseUrl: 'https://api.openai.com/v1',
      testEndpoint: '/models',
    },
    status: 'production',
    tier: 'professional',
    docsUrl: 'https://platform.openai.com/docs',
  },
  'anthropic': {
    id: 'anthropic',
    name: 'anthropic',
    displayName: 'Anthropic (Claude)',
    category: 'llm',
    subcategories: ['llm'],
    description: 'Claude 3 Opus, Sonnet, Haiku - Advanced reasoning and conversation',
    capabilities: {
      streaming: true,
      customModels: false,
      multiLanguage: true,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh'],
    pricing: {
      model: 'Token-based',
      details: 'Opus: $15/$75 per MTok | Sonnet: $3/$15 | Haiku: $0.25/$1.25',
    },
    credentials: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'sk-ant-...',
        description: 'Your Anthropic API key',
      },
    ],
    integration: {
      apiVersion: '2023-06-01',
      baseUrl: 'https://api.anthropic.com',
      testEndpoint: '/v1/messages',
    },
    status: 'production',
    tier: 'professional',
    docsUrl: 'https://docs.anthropic.com',
  },
  'mistral': {
    id: 'mistral',
    name: 'mistral',
    displayName: 'Mistral AI',
    category: 'llm',
    subcategories: ['llm'],
    description: 'Open-source and proprietary models - Efficient and powerful',
    capabilities: {
      streaming: true,
      customModels: true,
      multiLanguage: true,
    },
    supportedLanguages: ['en', 'fr', 'de', 'es', 'it'],
    pricing: {
      model: 'Token-based',
      details: 'Mistral Large: $8/$24 per MTok | Small: $2/$6 | Open models available',
    },
    credentials: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'your-api-key',
      },
    ],
    integration: {
      apiVersion: 'v1',
      baseUrl: 'https://api.mistral.ai',
      testEndpoint: '/v1/models',
    },
    status: 'production',
    tier: 'professional',
    docsUrl: 'https://docs.mistral.ai',
  },
  'google-gemini': {
    id: 'google-gemini',
    name: 'google-gemini',
    displayName: 'Google Gemini',
    category: 'llm',
    subcategories: ['llm'],
    description: 'Gemini Pro, Ultra - Multimodal AI from Google',
    capabilities: {
      streaming: true,
      multiLanguage: true,
      customModels: false,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'hi', 'ar'],
    pricing: {
      model: 'Token-based',
      details: 'Gemini Pro: $0.50/$1.50 per MTok | Free tier available',
    },
    credentials: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'AIza...',
        description: 'Your Google AI API key',
      },
    ],
    integration: {
      apiVersion: 'v1',
      baseUrl: 'https://generativelanguage.googleapis.com',
      testEndpoint: '/v1/models',
    },
    status: 'production',
    tier: 'professional',
    docsUrl: 'https://ai.google.dev/docs',
  },
};

// TTS Providers
export const TTS_PROVIDERS: Record<string, VoiceAIProviderMetadata> = {
  'elevenlabs-tts': {
    id: 'elevenlabs-tts',
    name: 'elevenlabs-tts',
    displayName: 'ElevenLabs TTS',
    category: 'tts',
    subcategories: ['tts'],
    description: 'Premium text-to-speech with voice cloning',
    capabilities: {
      streaming: true,
      customVoices: true,
      emotionDetection: true,
      multiLanguage: true,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'hi', 'ar'],
    pricing: {
      model: 'Character-based',
      details: 'Starter: $5/mo (30K chars) | Creator: $22/mo (100K) | Pro: $99/mo (500K)',
    },
    credentials: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'your-elevenlabs-api-key',
      },
    ],
    integration: {
      apiVersion: 'v1',
      baseUrl: 'https://api.elevenlabs.io',
      testEndpoint: '/v1/voices',
    },
    status: 'production',
    tier: 'professional',
    docsUrl: 'https://docs.elevenlabs.io',
  },
  'deepgram-tts': {
    id: 'deepgram-tts',
    name: 'deepgram-tts',
    displayName: 'Deepgram TTS',
    category: 'tts',
    subcategories: ['tts'],
    description: 'Fast, natural text-to-speech API',
    capabilities: {
      streaming: true,
      customVoices: false,
      multiLanguage: true,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'pt'],
    pricing: {
      model: 'Character-based',
      details: '$0.015 per 1K characters',
    },
    credentials: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'your-deepgram-api-key',
      },
    ],
    integration: {
      apiVersion: 'v1',
      baseUrl: 'https://api.deepgram.com',
      testEndpoint: '/v1/speak',
    },
    status: 'production',
    tier: 'professional',
    docsUrl: 'https://developers.deepgram.com',
  },
  'cartesia': {
    id: 'cartesia',
    name: 'cartesia',
    displayName: 'Cartesia',
    category: 'tts',
    subcategories: ['tts'],
    description: 'Ultra-low latency voice synthesis',
    capabilities: {
      streaming: true,
      realtime: true,
      customVoices: true,
      multiLanguage: true,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt'],
    pricing: {
      model: 'Character-based',
      details: '$0.10 per 1K characters | Real-time optimized',
    },
    credentials: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'your-cartesia-api-key',
      },
    ],
    integration: {
      apiVersion: 'v1',
      baseUrl: 'https://api.cartesia.ai',
      testEndpoint: '/tts',
    },
    status: 'production',
    tier: 'professional',
    docsUrl: 'https://docs.cartesia.ai',
  },
  'google-tts': {
    id: 'google-tts',
    name: 'google-tts',
    displayName: 'Google Cloud TTS',
    category: 'tts',
    subcategories: ['tts'],
    description: 'Google Cloud Text-to-Speech with WaveNet voices',
    capabilities: {
      streaming: true,
      customVoices: true,
      multiLanguage: true,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'hi', 'ar', 'nl', 'pl', 'ru'],
    pricing: {
      model: 'Character-based',
      details: 'Standard: $4 per 1M chars | WaveNet: $16 per 1M | Neural2: $16 per 1M',
    },
    credentials: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'your-google-cloud-api-key',
      },
      {
        key: 'projectId',
        label: 'Project ID',
        type: 'text',
        required: true,
        placeholder: 'your-project-id',
      },
    ],
    integration: {
      apiVersion: 'v1',
      baseUrl: 'https://texttospeech.googleapis.com',
      testEndpoint: '/v1/voices',
    },
    status: 'production',
    tier: 'enterprise',
    docsUrl: 'https://cloud.google.com/text-to-speech/docs',
  },
  'azure-tts': {
    id: 'azure-tts',
    name: 'azure-tts',
    displayName: 'Azure Cognitive Services TTS',
    category: 'tts',
    subcategories: ['tts'],
    description: 'Microsoft Azure Neural TTS',
    capabilities: {
      streaming: true,
      customVoices: true,
      multiLanguage: true,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ar', 'hi', 'nl', 'pl', 'ru'],
    pricing: {
      model: 'Character-based',
      details: 'Neural: $16 per 1M chars | Free tier: 0.5M chars/month',
    },
    credentials: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'your-azure-api-key',
      },
      {
        key: 'region',
        label: 'Region',
        type: 'text',
        required: true,
        placeholder: 'eastus',
      },
    ],
    integration: {
      apiVersion: 'v1',
      baseUrl: 'https://{region}.tts.speech.microsoft.com',
      testEndpoint: '/cognitiveservices/voices/list',
    },
    status: 'production',
    tier: 'enterprise',
    docsUrl: 'https://docs.microsoft.com/en-us/azure/cognitive-services/speech-service/',
  },
  'aws-polly': {
    id: 'aws-polly',
    name: 'aws-polly',
    displayName: 'Amazon Polly',
    category: 'tts',
    subcategories: ['tts'],
    description: 'AWS text-to-speech service',
    capabilities: {
      streaming: true,
      customVoices: false,
      multiLanguage: true,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ar', 'hi', 'nl', 'pl', 'ru'],
    pricing: {
      model: 'Character-based',
      details: 'Standard: $4 per 1M chars | Neural: $16 per 1M | Free tier: 5M chars/month',
    },
    credentials: [
      {
        key: 'accessKeyId',
        label: 'Access Key ID',
        type: 'text',
        required: true,
        placeholder: 'AKIA...',
      },
      {
        key: 'secretAccessKey',
        label: 'Secret Access Key',
        type: 'password',
        required: true,
        placeholder: 'your-secret-key',
      },
      {
        key: 'region',
        label: 'Region',
        type: 'text',
        required: true,
        placeholder: 'us-east-1',
      },
    ],
    integration: {
      apiVersion: 'v1',
      baseUrl: 'https://polly.{region}.amazonaws.com',
      testEndpoint: '/v1/voices',
    },
    status: 'production',
    tier: 'enterprise',
    docsUrl: 'https://docs.aws.amazon.com/polly/',
  },
};

// STT Providers
export const STT_PROVIDERS: Record<string, VoiceAIProviderMetadata> = {
  'deepgram-stt': {
    id: 'deepgram-stt',
    name: 'deepgram-stt',
    displayName: 'Deepgram STT',
    category: 'stt',
    subcategories: ['stt'],
    description: 'Real-time speech recognition with high accuracy',
    capabilities: {
      streaming: true,
      realtime: true,
      customModels: true,
      multiLanguage: true,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'hi', 'ja', 'ko', 'zh'],
    pricing: {
      model: 'Per-minute',
      details: 'Nova: $0.0043/min | Base: $0.0125/min | Enhanced: $0.0145/min',
    },
    credentials: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'your-deepgram-api-key',
      },
    ],
    integration: {
      apiVersion: 'v1',
      baseUrl: 'https://api.deepgram.com',
      testEndpoint: '/v1/listen',
    },
    status: 'production',
    tier: 'professional',
    docsUrl: 'https://developers.deepgram.com',
  },
  'openai-whisper': {
    id: 'openai-whisper',
    name: 'openai-whisper',
    displayName: 'OpenAI Whisper',
    category: 'stt',
    subcategories: ['stt'],
    description: 'Whisper large-v3 - Highly accurate transcription',
    capabilities: {
      streaming: false,
      multiLanguage: true,
      customModels: false,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ar', 'hi', 'nl', 'pl', 'ru'],
    pricing: {
      model: 'Per-minute',
      details: '$0.006 per minute',
    },
    credentials: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'sk-...',
      },
    ],
    integration: {
      apiVersion: 'v1',
      baseUrl: 'https://api.openai.com/v1',
      testEndpoint: '/audio/transcriptions',
    },
    status: 'production',
    tier: 'professional',
    docsUrl: 'https://platform.openai.com/docs/guides/speech-to-text',
  },
  'assemblyai': {
    id: 'assemblyai',
    name: 'assemblyai',
    displayName: 'AssemblyAI',
    category: 'stt',
    subcategories: ['stt'],
    description: 'AI-powered transcription with speaker diarization',
    capabilities: {
      streaming: true,
      realtime: true,
      multiLanguage: true,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'hi', 'ja'],
    pricing: {
      model: 'Per-minute',
      details: 'Core: $0.00025/sec | Best: $0.00037/sec',
    },
    credentials: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'your-assemblyai-api-key',
      },
    ],
    integration: {
      apiVersion: 'v2',
      baseUrl: 'https://api.assemblyai.com',
      testEndpoint: '/v2/transcript',
    },
    status: 'production',
    tier: 'professional',
    docsUrl: 'https://www.assemblyai.com/docs',
  },
  'google-stt': {
    id: 'google-stt',
    name: 'google-stt',
    displayName: 'Google Cloud STT',
    category: 'stt',
    subcategories: ['stt'],
    description: 'Google Cloud Speech-to-Text',
    capabilities: {
      streaming: true,
      realtime: true,
      customModels: true,
      multiLanguage: true,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ar', 'hi', 'nl', 'pl', 'ru'],
    pricing: {
      model: 'Per-minute',
      details: 'Standard: $0.024/min | Enhanced: $0.09/min | Free tier: 60 min/month',
    },
    credentials: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'your-google-cloud-api-key',
      },
      {
        key: 'projectId',
        label: 'Project ID',
        type: 'text',
        required: true,
        placeholder: 'your-project-id',
      },
    ],
    integration: {
      apiVersion: 'v1',
      baseUrl: 'https://speech.googleapis.com',
      testEndpoint: '/v1/speech:recognize',
    },
    status: 'production',
    tier: 'enterprise',
    docsUrl: 'https://cloud.google.com/speech-to-text/docs',
  },
  'azure-stt': {
    id: 'azure-stt',
    name: 'azure-stt',
    displayName: 'Azure Speech Services',
    category: 'stt',
    subcategories: ['stt'],
    description: 'Microsoft Azure Speech-to-Text',
    capabilities: {
      streaming: true,
      realtime: true,
      customModels: true,
      multiLanguage: true,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ar', 'hi', 'nl', 'pl', 'ru'],
    pricing: {
      model: 'Per-hour',
      details: 'Standard: $1/hour | Custom: $1.40/hour | Free tier: 5 hours/month',
    },
    credentials: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'your-azure-api-key',
      },
      {
        key: 'region',
        label: 'Region',
        type: 'text',
        required: true,
        placeholder: 'eastus',
      },
    ],
    integration: {
      apiVersion: 'v3.0',
      baseUrl: 'https://{region}.stt.speech.microsoft.com',
      testEndpoint: '/speech/recognition/conversation/cognitiveservices/v1',
    },
    status: 'production',
    tier: 'enterprise',
    docsUrl: 'https://docs.microsoft.com/en-us/azure/cognitive-services/speech-service/',
  },
};

// Telephony Providers
export const TELEPHONY_PROVIDERS: Record<string, VoiceAIProviderMetadata> = {
  'twilio': {
    id: 'twilio',
    name: 'twilio',
    displayName: 'Twilio',
    category: 'telephony',
    subcategories: ['telephony'],
    description: 'Cloud communications platform for voice, SMS, and video',
    capabilities: {
      streaming: true,
      multiLanguage: true,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh'],
    pricing: {
      model: 'Per-minute',
      details: 'Voice: $0.0085-$0.013/min | SMS: $0.0075/msg | Phone numbers: $1/mo',
    },
    credentials: [
      {
        key: 'accountSid',
        label: 'Account SID',
        type: 'text',
        required: true,
        placeholder: 'AC...',
      },
      {
        key: 'authToken',
        label: 'Auth Token',
        type: 'password',
        required: true,
        placeholder: 'your-auth-token',
      },
    ],
    integration: {
      apiVersion: '2010-04-01',
      baseUrl: 'https://api.twilio.com',
      testEndpoint: '/2010-04-01/Accounts',
    },
    status: 'production',
    tier: 'professional',
    docsUrl: 'https://www.twilio.com/docs',
  },
  'vonage': {
    id: 'vonage',
    name: 'vonage',
    displayName: 'Vonage (Nexmo)',
    category: 'telephony',
    subcategories: ['telephony'],
    description: 'Global communications APIs for voice and messaging',
    capabilities: {
      streaming: true,
      multiLanguage: true,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt'],
    pricing: {
      model: 'Per-minute',
      details: 'Voice: $0.004-$0.016/min | SMS: $0.005-$0.072/msg',
    },
    credentials: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'text',
        required: true,
        placeholder: 'your-api-key',
      },
      {
        key: 'apiSecret',
        label: 'API Secret',
        type: 'password',
        required: true,
        placeholder: 'your-api-secret',
      },
    ],
    integration: {
      apiVersion: 'v1',
      baseUrl: 'https://api.nexmo.com',
      testEndpoint: '/v1/applications',
    },
    status: 'production',
    tier: 'professional',
    docsUrl: 'https://developer.vonage.com',
  },
  'telnyx': {
    id: 'telnyx',
    name: 'telnyx',
    displayName: 'Telnyx',
    category: 'telephony',
    subcategories: ['telephony'],
    description: 'Private communications network for voice and messaging',
    capabilities: {
      streaming: true,
      multiLanguage: true,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt'],
    pricing: {
      model: 'Per-minute',
      details: 'Voice: $0.004-$0.013/min | SMS: $0.004/msg | SIP trunking available',
    },
    credentials: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'KEY...',
      },
    ],
    integration: {
      apiVersion: 'v2',
      baseUrl: 'https://api.telnyx.com',
      testEndpoint: '/v2/phone_numbers',
    },
    status: 'production',
    tier: 'professional',
    docsUrl: 'https://developers.telnyx.com',
  },
};

// All-in-One Platforms
export const ALL_IN_ONE_PROVIDERS: Record<string, VoiceAIProviderMetadata> = {
  'elevenlabs': {
    id: 'elevenlabs',
    name: 'elevenlabs',
    displayName: 'ElevenLabs Conversational AI',
    category: 'all-in-one',
    subcategories: ['llm', 'tts', 'stt'],
    description: 'Complete conversational AI platform with premium voices',
    capabilities: {
      streaming: true,
      realtime: true,
      customVoices: true,
      emotionDetection: true,
      multiLanguage: true,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'hi', 'ar'],
    pricing: {
      model: 'Subscription + Usage',
      details: 'Pro: $99/mo | Scale: $330/mo | Enterprise: Custom',
    },
    credentials: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'your-elevenlabs-api-key',
      },
    ],
    integration: {
      apiVersion: 'v1',
      baseUrl: 'https://api.elevenlabs.io',
      testEndpoint: '/v1/user',
    },
    status: 'production',
    tier: 'professional',
    docsUrl: 'https://docs.elevenlabs.io',
  },
  'livekit': {
    id: 'livekit',
    name: 'livekit',
    displayName: 'LiveKit',
    category: 'all-in-one',
    subcategories: ['llm', 'tts', 'stt', 'telephony'],
    description: 'Open-source WebRTC platform with AI Agents SDK',
    capabilities: {
      streaming: true,
      realtime: true,
      customModels: true,
      multiLanguage: true,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'],
    pricing: {
      model: 'Self-hosted (Free) / Cloud',
      details: 'Open source free | Cloud: $0.0008/min participant | Enterprise available',
    },
    credentials: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'text',
        required: false,
        placeholder: 'API...',
        description: 'Required for LiveKit Cloud',
      },
      {
        key: 'apiSecret',
        label: 'API Secret',
        type: 'password',
        required: false,
        placeholder: 'your-secret',
      },
      {
        key: 'wsUrl',
        label: 'WebSocket URL',
        type: 'url',
        required: true,
        placeholder: 'wss://your-livekit-server.com',
        description: 'Your LiveKit server URL',
      },
    ],
    integration: {
      apiVersion: 'v1',
      baseUrl: 'https://cloud.livekit.io',
      testEndpoint: '/rooms',
    },
    status: 'production',
    tier: 'free',
    docsUrl: 'https://docs.livekit.io',
  },
  'vapi': {
    id: 'vapi',
    name: 'vapi',
    displayName: 'Vapi',
    category: 'all-in-one',
    subcategories: ['llm', 'tts', 'stt', 'telephony'],
    description: 'Voice AI platform for building conversational agents',
    capabilities: {
      streaming: true,
      realtime: true,
      customVoices: true,
      multiLanguage: true,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt'],
    pricing: {
      model: 'Per-minute',
      details: '$0.05-$0.15 per minute depending on models used',
    },
    credentials: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'your-vapi-api-key',
      },
    ],
    integration: {
      apiVersion: 'v1',
      baseUrl: 'https://api.vapi.ai',
      testEndpoint: '/assistant',
    },
    status: 'production',
    tier: 'professional',
    docsUrl: 'https://docs.vapi.ai',
  },
  'retell-ai': {
    id: 'retell-ai',
    name: 'retell-ai',
    displayName: 'Retell AI',
    category: 'all-in-one',
    subcategories: ['llm', 'tts', 'stt', 'telephony'],
    description: 'Conversational voice AI for customer service',
    capabilities: {
      streaming: true,
      realtime: true,
      customVoices: true,
      multiLanguage: true,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt'],
    pricing: {
      model: 'Per-minute',
      details: '$0.10 per minute',
    },
    credentials: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'your-retell-api-key',
      },
    ],
    integration: {
      apiVersion: 'v2',
      baseUrl: 'https://api.retellai.com',
      testEndpoint: '/v2/get-agent',
    },
    status: 'production',
    tier: 'professional',
    docsUrl: 'https://docs.retellai.com',
  },
  'bland-ai': {
    id: 'bland-ai',
    name: 'bland-ai',
    displayName: 'Bland AI',
    category: 'all-in-one',
    subcategories: ['llm', 'tts', 'stt', 'telephony'],
    description: 'AI phone calling platform for automation',
    capabilities: {
      streaming: true,
      realtime: true,
      multiLanguage: true,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt'],
    pricing: {
      model: 'Per-minute',
      details: '$0.09 per minute',
    },
    credentials: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'your-bland-api-key',
      },
    ],
    integration: {
      apiVersion: 'v1',
      baseUrl: 'https://api.bland.ai',
      testEndpoint: '/v1/calls',
    },
    status: 'production',
    tier: 'professional',
    docsUrl: 'https://docs.bland.ai',
  },
  'vocode': {
    id: 'vocode',
    name: 'vocode',
    displayName: 'Vocode',
    category: 'all-in-one',
    subcategories: ['llm', 'tts', 'stt', 'telephony'],
    description: 'Open-source framework for building voice AI agents',
    capabilities: {
      streaming: true,
      realtime: true,
      customModels: true,
      multiLanguage: true,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt'],
    pricing: {
      model: 'Open Source',
      details: 'Free (self-hosted) | Managed service pricing available',
    },
    credentials: [
      {
        key: 'apiKey',
        label: 'API Key (Optional)',
        type: 'password',
        required: false,
        placeholder: 'your-api-key',
        description: 'For managed service',
      },
      {
        key: 'baseUrl',
        label: 'Base URL (Self-hosted)',
        type: 'url',
        required: false,
        placeholder: 'https://your-vocode-server.com',
      },
    ],
    integration: {
      apiVersion: 'v1',
      baseUrl: 'https://api.vocode.dev',
      testEndpoint: '/v1/calls',
    },
    status: 'production',
    tier: 'free',
    docsUrl: 'https://docs.vocode.dev',
  },
  'pipecat': {
    id: 'pipecat',
    name: 'pipecat',
    displayName: 'Pipecat',
    category: 'all-in-one',
    subcategories: ['llm', 'tts', 'stt'],
    description: 'Open-source framework for voice and multimodal AI',
    capabilities: {
      streaming: true,
      realtime: true,
      customModels: true,
      multiLanguage: true,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt'],
    pricing: {
      model: 'Open Source',
      details: 'Free (self-hosted)',
    },
    credentials: [
      {
        key: 'baseUrl',
        label: 'Base URL (Self-hosted)',
        type: 'url',
        required: true,
        placeholder: 'https://your-pipecat-server.com',
      },
    ],
    integration: {
      apiVersion: 'v1',
      baseUrl: 'http://localhost:8000',
    },
    status: 'production',
    tier: 'free',
    docsUrl: 'https://docs.pipecat.ai',
  },
  'openai-realtime': {
    id: 'openai-realtime',
    name: 'openai-realtime',
    displayName: 'OpenAI Realtime API',
    category: 'all-in-one',
    subcategories: ['llm', 'tts', 'stt'],
    description: 'Ultra-low latency voice conversations with GPT-4o',
    capabilities: {
      streaming: true,
      realtime: true,
      multiLanguage: true,
    },
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'],
    pricing: {
      model: 'Token-based',
      details: 'Input: $5/$2.50 per MTok | Output: $20/$10 per MTok (text/audio)',
    },
    credentials: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'sk-...',
      },
    ],
    integration: {
      apiVersion: 'v1',
      baseUrl: 'https://api.openai.com/v1',
      testEndpoint: '/realtime',
    },
    status: 'beta',
    tier: 'professional',
    docsUrl: 'https://platform.openai.com/docs/guides/realtime',
  },
};

// Combined export
export const VOICE_AI_PROVIDERS: Record<string, VoiceAIProviderMetadata> = {
  ...ALL_IN_ONE_PROVIDERS,
  ...LLM_PROVIDERS,
  ...TTS_PROVIDERS,
  ...STT_PROVIDERS,
  ...TELEPHONY_PROVIDERS,
};

// Helper functions
export function getProvidersByCategory(category: ProviderCategory): VoiceAIProviderMetadata[] {
  return Object.values(VOICE_AI_PROVIDERS).filter(
    (provider) => provider.category === category
  );
}

export function getProviderById(id: string): VoiceAIProviderMetadata | undefined {
  return VOICE_AI_PROVIDERS[id];
}

export function getAllProviders(): VoiceAIProviderMetadata[] {
  return Object.values(VOICE_AI_PROVIDERS);
}
