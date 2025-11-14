## Platform-Agnostic Architecture

EchoSenseiX is now a **completely platform-agnostic wrapper** that works with ANY service provider. Every integration uses the **Adapter Pattern** for maximum flexibility.

---

## 🎯 Core Principle

> **"Plug and Play"** - Swap any service provider without changing application code

---

## 📦 Provider Types

### 1. **Voice/AI Providers** 🎙️

**Interface:** `VoiceProvider`
**Factory:** `VoiceProviderFactory`

| Provider | Status | Configuration |
|----------|--------|---------------|
| **ElevenLabs** | ✅ Implemented | `ELEVENLABS_API_KEY` |
| **OpenAI TTS** | ✅ Implemented | `OPENAI_API_KEY` |
| **Google TTS** | ✅ Implemented | `GOOGLE_CLOUD_PROJECT`, `GOOGLE_APPLICATION_CREDENTIALS` |
| Azure TTS | 🔜 Planned | `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` |
| AWS Polly | 🔜 Planned | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |

**Usage:**
```typescript
import { getVoiceProvider } from './providers';

const voice = await getVoiceProvider();
const audio = await voice.textToSpeech({
  text: 'Hello World',
  voiceId: 'alloy',
});
```

**Environment:**
```bash
VOICE_PROVIDER=elevenlabs  # or: openai, google, azure, aws-polly
ELEVENLABS_API_KEY=your_key
```

---

### 2. **Payment Providers** 💳

**Interface:** `PaymentProvider`
**Factory:** `PaymentProviderFactory`

| Provider | Status | Configuration |
|----------|--------|---------------|
| **Stripe** | ✅ Implemented | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| PayPal | 🔜 Planned | `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET` |
| Square | 🔜 Planned | `SQUARE_ACCESS_TOKEN` |
| Braintree | 🔜 Planned | `BRAINTREE_MERCHANT_ID` |
| Razorpay | 🔜 Planned | `RAZORPAY_KEY_ID` |

**Usage:**
```typescript
import { getPaymentProvider } from './providers';

const payment = await getPaymentProvider();
const intent = await payment.createPaymentIntent({
  amount: 1000, // $10.00
  currency: 'usd',
});
```

**Environment:**
```bash
PAYMENT_PROVIDER=stripe  # or: paypal, square, braintree
STRIPE_SECRET_KEY=sk_test_...
```

---

### 3. **Database Providers** 🗄️

**Interface:** `DatabaseAdapter`
**Factory:** `DatabaseFactory`

| Provider | Status | Configuration |
|----------|--------|---------------|
| **PostgreSQL** | ✅ Implemented | `DATABASE_URL` (postgresql://) |
| **MongoDB** | ✅ Implemented | `DATABASE_URL` (mongodb://) |
| **MySQL** | ✅ Implemented | `DATABASE_URL` (mysql://) |
| **Supabase** | ✅ Implemented | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| SQLite | 🔜 Planned | `SQLITE_PATH` |

**Usage:**
```typescript
import { getDatabase } from './database/database-factory';

const db = await getDatabase();
const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
```

**Environment:**
```bash
DATABASE_PROVIDER=postgresql  # or: mongodb, mysql, supabase
DATABASE_URL=postgresql://user:pass@host:5432/db
```

---

### 4. **Storage Providers** 📁

**Interface:** `StorageAdapter`
**Factory:** `StorageFactory`

| Provider | Status | Configuration |
|----------|--------|---------------|
| **Local** | ✅ Implemented | `UPLOAD_DIR`, `AUDIO_DIR` |
| **AWS S3** | ✅ Implemented | `S3_BUCKET`, `S3_ACCESS_KEY_ID` |
| **Google Cloud** | ✅ Implemented | `GCS_BUCKET`, `GCS_PROJECT_ID` |
| **Azure Blob** | ✅ Implemented | `AZURE_STORAGE_ACCOUNT_NAME` |

**Usage:**
```typescript
import { StorageFactory } from './storage/storage-factory';

const storage = StorageFactory.getAdapter();
await storage.save('audio/file.mp3', buffer);
```

**Environment:**
```bash
STORAGE_PROVIDER=s3  # or: local, gcs, azure
S3_BUCKET=my-bucket
S3_REGION=us-east-1
```

---

### 5. **Email Providers** 📧

**Interface:** `EmailService`
**Factory:** Auto-detected

| Provider | Status | Configuration |
|----------|--------|---------------|
| **SendGrid** | ✅ Implemented | `SENDGRID_API_KEY` |
| **Mailgun** | ✅ Implemented | `MAILGUN_API_KEY` |
| **SMTP** | ✅ Implemented | `SMTP_HOST`, `SMTP_PORT` |

**Usage:**
```typescript
import { EmailService } from './services/email-service';

await EmailService.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome',
  text: 'Hello!',
});
```

---

### 6. **LLM Providers** 🤖

**Interface:** `LLMProvider`
**Factory:** `LLMProviderFactory`

| Provider | Status | Configuration |
|----------|--------|---------------|
| OpenAI | 🔜 Planned | `OPENAI_API_KEY` |
| Anthropic | 🔜 Planned | `ANTHROPIC_API_KEY` |
| Mistral | 🔜 Planned | `MISTRAL_API_KEY` |
| Google Gemini | 🔜 Planned | `GOOGLE_AI_API_KEY` |

**Environment:**
```bash
LLM_PROVIDER=openai  # or: anthropic, mistral, google
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│      Application Layer              │
│   (Routes, Controllers, Services)   │
└──────────────┬──────────────────────┘
               │
               │ Uses Factories
               ▼
┌─────────────────────────────────────┐
│       Provider Factories            │
│  VoiceFactory, PaymentFactory, etc. │
└──────────────┬──────────────────────┘
               │
               │ Creates Adapters
               ▼
┌─────────────────────────────────────┐
│      Provider Adapters              │
│   (Implement Common Interface)      │
├─────────────────────────────────────┤
│  ElevenLabs │ OpenAI  │ Google      │
│  Stripe     │ PayPal  │ Square      │
│  PostgreSQL │ MongoDB │ MySQL       │
│  S3         │ GCS     │ Azure       │
└─────────────────────────────────────┘
               │
               │ Calls
               ▼
┌─────────────────────────────────────┐
│     External Services               │
│  (Third-party APIs and SDKs)        │
└─────────────────────────────────────┘
```

---

## 🔄 How It Works

### 1. **Auto-Detection**

Providers are automatically detected from environment variables:

```typescript
// Detects based on env vars
const voice = await getVoiceProvider();
// ✅ Uses ELEVENLABS_API_KEY if present
// ✅ Falls back to OPENAI_API_KEY
// ✅ Checks GOOGLE_CLOUD_PROJECT
```

### 2. **Explicit Configuration**

Or specify explicitly:

```typescript
const voice = await getVoiceProvider({
  provider: 'openai',
  apiKey: 'sk-...',
});
```

### 3. **Unified Interface**

All providers implement the same interface:

```typescript
// Works with ANY voice provider
const audio = await voice.textToSpeech({
  text: 'Hello',
  voiceId: 'some-voice-id',
});
```

---

## 🎨 Adding New Providers

### Step 1: Create Adapter

```typescript
// server/providers/voice/my-voice-provider.ts
import { BaseVoiceProvider } from '../voice-provider';

export class MyVoiceProvider extends BaseVoiceProvider {
  async initialize() {
    // Setup SDK
  }

  async textToSpeech(options) {
    // Call API
  }

  // Implement other required methods...
}
```

### Step 2: Register in Factory

```typescript
// server/providers/voice-factory.ts
case 'my-provider':
  return new MyVoiceProvider(config);
```

### Step 3: Update Registry

```typescript
// server/providers/index.ts
export const PROVIDER_REGISTRY = {
  voice: {
    available: [..., 'my-provider'],
    implemented: [..., 'my-provider'],
  }
};
```

### Step 4: Use It!

```bash
VOICE_PROVIDER=my-provider
MY_PROVIDER_API_KEY=...
```

---

## 🌍 Environment Configuration

### Minimal Setup (Uses Defaults)

```bash
# Just provide API keys, providers auto-detected
ELEVENLABS_API_KEY=...
DATABASE_URL=postgresql://...
STRIPE_SECRET_KEY=...
```

### Explicit Setup

```bash
# Explicitly choose providers
VOICE_PROVIDER=openai
PAYMENT_PROVIDER=paypal
DATABASE_PROVIDER=mongodb
STORAGE_PROVIDER=s3

# Provide corresponding credentials
OPENAI_API_KEY=...
PAYPAL_CLIENT_ID=...
DATABASE_URL=mongodb://...
S3_BUCKET=...
```

---

## 📊 Provider Status

| Category | Implemented | Planned | Total |
|----------|-------------|---------|-------|
| Voice | 3 | 2 | 5 |
| Payment | 1 | 4 | 5 |
| Database | 4 | 1 | 5 |
| Storage | 4 | 0 | 4 |
| Email | 3 | 0 | 3 |
| LLM | 0 | 4 | 4 |
| Auth | 1 | 3 | 4 |
| SMS | 0 | 3 | 3 |
| Cache | 1 | 2 | 3 |
| Logging | 1 | 3 | 4 |

**Total:** 18 implemented, 22 planned = **40 provider integrations**

---

## 💡 Benefits

✅ **Zero Vendor Lock-in** - Switch providers anytime
✅ **Cost Optimization** - Use cheapest provider for each service
✅ **Redundancy** - Fallback to alternate providers
✅ **Testing** - Easy to mock providers
✅ **Multi-Region** - Use different providers per region
✅ **Progressive Migration** - Migrate one service at a time

---

## 🚀 Next Steps

1. **Implement remaining providers** (LLM, Auth, SMS, Cache)
2. **Add provider fallback** - Auto-switch if primary fails
3. **Add provider monitoring** - Track usage, costs, errors
4. **Add provider testing** - Automated health checks
5. **Add provider documentation** - Per-provider guides

---

## 📚 Documentation

- [Database Integration Guide](./DATABASE_INTEGRATION_GUIDE.md)
- [File Upload Guide](./FILE_UPLOAD_GUIDE.md)
- [Voice Provider Guide](./VOICE_PROVIDER_GUIDE.md) *(TODO)*
- [Payment Provider Guide](./PAYMENT_PROVIDER_GUIDE.md) *(TODO)*

---

## 🎯 Vision

**Make EchoSenseiX the most flexible voice AI platform:**
- ✅ Run on ANY infrastructure
- ✅ Use ANY database
- ✅ Use ANY voice provider
- ✅ Use ANY payment processor
- ✅ Deploy ANYWHERE

**Zero lock-in. Maximum flexibility. Complete control.**
