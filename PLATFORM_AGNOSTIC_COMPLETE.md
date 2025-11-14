# Platform-Agnostic Implementation - Complete Guide

## Overview

EchoSenseiX is now **completely platform-agnostic**, allowing users to connect any voice platform, TTS provider, STT provider, LLM provider, or database to their agents.

## What Was Fixed

### Agent Creation Issue
**Problem**: Users were unable to create agents because the system was hardcoded to use ElevenLabs only.

**Solution**: Implemented a comprehensive provider abstraction layer that supports multiple voice platforms:
- **ElevenLabs** - Full conversational AI platform
- **Vapi** - Voice AI assistant platform
- **Bland** - Simple voice agent platform
- **Retell** - AI phone agent platform

### Platform-Specific Dependencies Removed
All hardcoded ElevenLabs dependencies have been replaced with a flexible provider system.

## Architecture

### Provider Service Layer (`server/services/provider-service.ts`)

The `ProviderService` class abstracts all voice platform operations:

```typescript
class ProviderService {
  // Get primary active provider for a type
  async getPrimaryProvider(organizationId, providerType)

  // Get all active providers
  async getActiveProviders(organizationId, providerType)

  // Create voice agent on any platform
  async createVoiceAgent(organizationId, config, providerId?)

  // Provider-specific implementations
  private async createElevenLabsAgent(provider, config)
  private async createVapiAgent(provider, config)
  private async createBlandAgent(provider, config)
  private async createRetellAgent(provider, config)
}
```

### Provider Types Supported

#### 1. **VOICE_PLATFORM** (Primary for agent creation)
- **ElevenLabs**: Full conversational AI with system tools, TTS, STT, LLM
- **Vapi**: Voice assistant with customizable models
- **Bland**: Simple voice agent platform
- **Retell**: AI phone agent platform

#### 2. **TTS** (Text-to-Speech)
- ElevenLabs
- OpenAI
- Azure
- Google Cloud
- AWS Polly

#### 3. **STT** (Speech-to-Text)
- Deepgram
- Whisper (OpenAI)
- Google Cloud
- Azure
- AssemblyAI

#### 4. **LLM** (Large Language Models)
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude)
- Google Gemini
- Azure OpenAI
- Local models

#### 5. **DATABASE**
- MongoDB
- Supabase (PostgreSQL)
- SQLite
- MySQL
- PostgreSQL

## How It Works

### Agent Creation Flow

1. **User creates agent** via `/api/agents/create` endpoint
2. **Provider service checks** for active VOICE_PLATFORM provider:
   - First checks new provider integrations system
   - Falls back to legacy ElevenLabs integration if needed
3. **Routes to appropriate provider** implementation based on provider name
4. **Creates agent** on the selected platform's API
5. **Tracks usage** in provider_usage table
6. **Saves agent** to local database with provider metadata

### Backward Compatibility

The system maintains **100% backward compatibility** with existing ElevenLabs integrations:

```typescript
// Fallback to legacy integration
if (providerType === 'VOICE_PLATFORM') {
  const legacyIntegration = await this.storage.getIntegration(orgId, 'elevenlabs');
  if (legacyIntegration && legacyIntegration.status === 'ACTIVE') {
    // Convert to provider integration format
    return convertedProvider;
  }
}
```

## Database Schema

### Provider Integrations Table

```sql
CREATE TABLE provider_integrations (
  id VARCHAR PRIMARY KEY,
  organization_id VARCHAR NOT NULL,
  provider_type ENUM('TTS', 'STT', 'LLM', 'DATABASE', 'VOICE_PLATFORM'),
  provider_name VARCHAR NOT NULL,
  display_name VARCHAR NOT NULL,
  status ENUM('ACTIVE', 'INACTIVE', 'ERROR', 'PENDING_APPROVAL'),
  is_primary BOOLEAN DEFAULT false,
  credentials JSONB, -- Encrypted API keys and secrets
  config JSONB,      -- Provider-specific configuration
  metadata JSONB,    -- Additional metadata
  last_tested TIMESTAMP,
  last_used TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Provider Usage Tracking

```sql
CREATE TABLE provider_usage (
  id VARCHAR PRIMARY KEY,
  organization_id VARCHAR NOT NULL,
  provider_integration_id VARCHAR NOT NULL,
  usage_type VARCHAR NOT NULL, -- 'agent_creation', 'tts_generation', 'stt_transcription', etc.
  quantity VARCHAR,
  cost VARCHAR,
  metadata JSONB,
  related_entity_id VARCHAR,
  related_entity_type VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

### Provider Management (`/api/providers`)

```
GET    /api/providers              - List all providers (optional ?type=VOICE_PLATFORM)
GET    /api/providers/:id          - Get single provider
POST   /api/providers              - Create new provider
PUT    /api/providers/:id          - Update provider
DELETE /api/providers/:id          - Delete provider
POST   /api/providers/:id/set-primary - Set as primary provider
GET    /api/providers/:id/usage    - Get usage statistics
```

### Agent Creation (Updated)

```
POST /api/agents/create
Body: {
  name: string,
  firstMessage: string,
  systemPrompt: string,
  language?: string,
  voiceId?: string,
  providerId?: string  // NEW: Optional provider ID
}
```

If `providerId` is not specified, the system uses the **primary VOICE_PLATFORM provider**.

## Frontend Integration

### Provider Management UI (`/providers`)

Full-featured provider management interface:
- Add new providers with credentials
- Filter by provider type
- Set primary providers
- View status and usage
- Delete providers

### Integrations Page Updated (`/integrations`)

Displays all provider integrations with:
- Provider type icons (Database, Mic, Volume2, Brain, Phone)
- Status badges (ACTIVE/INACTIVE)
- Primary provider indicators (Star icon)
- Color coding by type
- Link to full provider management page

### Agent Creation Modal

Users can now:
- Select specific voice platform provider
- Or use default (primary) provider
- Create agents on any supported platform

## Security

### Credential Encryption

All provider credentials are encrypted using **AES-256-CBC** encryption:

```typescript
// server/utils/encryption.ts
export function encryptApiKey(apiKey: string): string
export function decryptApiKey(encryptedApiKey: string): string
export function encryptCredentials(credentials: object): string
export function decryptCredentials(encrypted: string): object
```

Encryption key is stored in `process.env.ENCRYPTION_KEY` environment variable.

## Migration Guide

### For Existing Users with ElevenLabs

**No action required!** The system automatically:
1. Detects legacy ElevenLabs integration
2. Converts it to provider integration format on-the-fly
3. Uses it for agent creation

### Adding New Provider

1. **Navigate to Integrations** → Click "View All" providers
2. **Click "Add Provider"**
3. **Select Provider Type** (e.g., VOICE_PLATFORM)
4. **Select Provider Name** (e.g., Vapi, Bland, Retell)
5. **Enter Display Name** (e.g., "My Vapi Integration")
6. **Add Credentials** as JSON:
   ```json
   {
     "apiKey": "your-api-key-here"
   }
   ```
7. **Optionally add Config** as JSON (provider-specific settings)
8. **Click "Add Provider"**
9. **Set as Primary** (optional) to use by default for new agents

### Migrating from ElevenLabs to Another Platform

1. **Add new provider** (e.g., Vapi) via `/providers` page
2. **Test the provider** by creating a test agent
3. **Set as primary** if you want all new agents to use it
4. **Existing ElevenLabs agents continue working** unchanged

## Provider-Specific Examples

### ElevenLabs Configuration

```json
{
  "apiKey": "xi_abc123..."
}
```

### Vapi Configuration

```json
{
  "apiKey": "vapi_abc123...",
  "model": "gpt-4"
}
```

### Bland Configuration

```json
{
  "apiKey": "bland_abc123..."
}
```

### Retell Configuration

```json
{
  "apiKey": "retell_abc123..."
}
```

### Database Providers

#### MongoDB
```json
{
  "connectionString": "mongodb+srv://user:pass@cluster.mongodb.net/db",
  "database": "echosensei"
}
```

#### Supabase
```json
{
  "url": "https://abc.supabase.co",
  "anonKey": "eyJhbG...",
  "serviceKey": "eyJhbG..."
}
```

## Benefits

### For Users
✅ **Freedom of choice** - Use any provider you prefer
✅ **Cost optimization** - Compare and choose cost-effective providers
✅ **Redundancy** - Configure multiple providers as fallbacks
✅ **Provider-specific features** - Access unique features of different platforms
✅ **Easy migration** - Switch providers without rebuilding

### For Developers
✅ **Clean abstraction** - Provider logic separated from business logic
✅ **Easy to extend** - Add new providers with minimal code
✅ **Type-safe** - Full TypeScript support
✅ **Testable** - Mock providers for testing
✅ **Usage tracking** - Built-in usage analytics

## Extending with New Providers

To add a new voice platform provider:

1. **Add provider to available list** in `client/src/pages/providers.tsx`:
```typescript
const availableProviders = {
  VOICE_PLATFORM: ["elevenlabs", "vapi", "bland", "retell", "new-provider"],
};
```

2. **Implement provider method** in `server/services/provider-service.ts`:
```typescript
private async createNewProviderAgent(
  provider: ProviderIntegration,
  config: VoiceAgentConfig
): Promise<VoiceAgentResponse> {
  const apiKey = decryptApiKey(provider.credentials.apiKey);

  // Call new provider's API
  const response = await fetch('https://api.newprovider.com/agents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: config.name,
      // ... provider-specific payload
    })
  });

  const data = await response.json();

  // Track usage
  await this.storage.trackProviderUsage({
    organizationId: provider.organizationId,
    providerIntegrationId: provider.id,
    usageType: 'agent_creation',
    quantity: '1',
    metadata: { agentId: data.id, agentName: config.name }
  });

  return {
    agentId: data.id,
    provider: 'new-provider',
    metadata: data
  };
}
```

3. **Add case to createVoiceAgent** switch statement:
```typescript
switch (provider.providerName.toLowerCase()) {
  case 'elevenlabs': return await this.createElevenLabsAgent(provider, config);
  case 'vapi': return await this.createVapiAgent(provider, config);
  case 'bland': return await this.createBlandAgent(provider, config);
  case 'retell': return await this.createRetellAgent(provider, config);
  case 'new-provider': return await this.createNewProviderAgent(provider, config);
  default: throw new Error(`Unsupported provider: ${provider.providerName}`);
}
```

## Testing

### Test Agent Creation with Different Providers

```bash
# Test with primary provider
curl -X POST http://localhost:5000/api/agents/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Agent",
    "firstMessage": "Hello!",
    "systemPrompt": "You are a helpful assistant.",
    "language": "en"
  }'

# Test with specific provider
curl -X POST http://localhost:5000/api/agents/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Agent",
    "firstMessage": "Hello!",
    "systemPrompt": "You are a helpful assistant.",
    "language": "en",
    "providerId": "provider-id-here"
  }'
```

### Test Provider CRUD

```bash
# List providers
curl http://localhost:5000/api/providers

# Get specific provider
curl http://localhost:5000/api/providers/:id

# Create provider
curl -X POST http://localhost:5000/api/providers \
  -H "Content-Type: application/json" \
  -d '{
    "providerType": "VOICE_PLATFORM",
    "providerName": "vapi",
    "displayName": "My Vapi Integration",
    "credentials": {"apiKey": "vapi_123..."},
    "config": {}
  }'

# Set as primary
curl -X POST http://localhost:5000/api/providers/:id/set-primary
```

## Troubleshooting

### Agent Creation Fails

**Error**: "No active voice platform provider configured"

**Solution**:
1. Go to `/providers` page
2. Add a VOICE_PLATFORM provider (ElevenLabs, Vapi, Bland, or Retell)
3. Ensure provider status is ACTIVE
4. Set as primary if desired

### Provider Not Showing in Integrations

**Issue**: Added provider but not visible

**Solution**:
1. Check provider status is ACTIVE
2. Refresh the page
3. Clear browser cache
4. Check browser console for errors

### Legacy Integration Issues

**Issue**: Old ElevenLabs integration not working

**Solution**:
The system should automatically detect and use legacy integrations. If not:
1. Check integration status in database
2. Verify API key is still valid
3. Consider migrating to new provider integration format

## Performance

### Caching
- Provider configurations are cached for 5 minutes
- API keys are decrypted on-demand and not cached (security)

### Usage Tracking
- All provider operations are tracked asynchronously
- No impact on response time
- Useful for billing and analytics

### Indexes
Provider integrations table has indexes on:
- `organization_id`
- `provider_type`
- `organization_id, provider_type` (composite)

## Future Enhancements

### Planned Features
- [ ] Provider health monitoring
- [ ] Automatic failover between providers
- [ ] Cost comparison dashboard
- [ ] Provider recommendation engine
- [ ] Bulk provider migration tool
- [ ] Provider-specific analytics
- [ ] API rate limiting per provider
- [ ] Provider usage alerts and notifications

### Integration Roadmap
- [ ] More TTS providers (PlayHT, Murf, WellSaid)
- [ ] More STT providers (Rev.ai, Speechmatics)
- [ ] More LLM providers (Cohere, AI21, Mistral)
- [ ] Vector databases (Pinecone, Weaviate, Qdrant)
- [ ] Message queues (RabbitMQ, Kafka)
- [ ] Analytics platforms (Mixpanel, Amplitude)

## Conclusion

EchoSenseiX is now **fully platform-agnostic**, giving users complete control over their infrastructure choices. Users can:

✅ Create agents on any supported voice platform
✅ Switch providers without code changes
✅ Use multiple providers simultaneously
✅ Track usage across all providers
✅ Maintain full backward compatibility

The provider abstraction layer is **extensible, type-safe, and production-ready**.
