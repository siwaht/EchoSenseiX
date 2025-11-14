# Multi-Provider Architecture

## Overview

EchoSenseiX has been refactored to support multiple voice AI providers, making it platform-agnostic and flexible. The system now supports:

- **ElevenLabs** (legacy default)
- **LiveKit**
- **Vapi**
- **Retell AI**
- **Cartesian**
- **Deepgram**
- **Bland AI**
- **Vocode**
- And any other provider through the extensible platform field

## Key Changes

### 1. Database Schema Updates

#### Agents Table
```sql
-- New fields added:
platform VARCHAR DEFAULT 'elevenlabs' NOT NULL
  → Specifies which provider hosts this agent (elevenlabs, livekit, vapi, etc.)

external_agent_id VARCHAR
  → Provider's agent ID (replaces provider-specific IDs)

provider_config JSON
  → Provider-specific configuration for custom features

knowledge_base_ids JSON DEFAULT '[]'
  → Array of knowledge base entry IDs (platform-agnostic)

-- Modified fields:
eleven_labs_agent_id VARCHAR
  → Now nullable (deprecated, use external_agent_id + platform instead)
```

#### Call Logs Table
```sql
-- New fields added:
platform VARCHAR DEFAULT 'elevenlabs' NOT NULL
  → Which provider handled this call

external_call_id VARCHAR NOT NULL
  → Provider's call/conversation ID

-- Modified fields:
conversation_id VARCHAR
  → Now nullable (deprecated, use external_call_id + platform instead)
```

### 2. Multi-Provider Support

#### How It Works

**Agent Creation:**
1. Select platform (ElevenLabs, LiveKit, Vapi, etc.)
2. Configure agent with platform-specific settings
3. Agent is stored with `platform` field identifying the provider
4. `externalAgentId` stores the provider's agent ID
5. `providerConfig` stores any provider-specific configuration

**Provider Selection per Service:**
Each agent can independently select providers for:
- **LLM**: OpenAI, Anthropic, Mistral, Groq, Cohere, Together AI, etc.
- **TTS**: ElevenLabs, Deepgram, Play.ht, Resemble AI, Murf AI, etc.
- **STT**: Deepgram, AssemblyAI, Whisper, Rev AI, Gladia, etc.
- **VAD**: Silero VAD, WebRTC VAD, Picovoice Cobra, Deepgram Endpointing
- **Telephony**: Twilio, Vonage, Plivo

This is configured in the `providers` JSON field:
```json
{
  "llm": "openai",
  "tts": "elevenlabs",
  "stt": "deepgram",
  "vad": "silero-vad",
  "telephony": "twilio"
}
```

### 3. Knowledge Base Independence

**Platform-Agnostic Knowledge Management:**

The knowledge base is completely independent of any specific provider:

- **Organization-Scoped**: Knowledge entries belong to the organization, not individual providers
- **Agent Association**: Agents reference knowledge base entries via `knowledgeBaseIds` array
- **Multi-Agent Sharing**: Multiple agents can use the same knowledge base entries
- **Provider Flexibility**: Switch providers without losing knowledge base data

**Database Structure:**
```sql
-- Knowledge Base Entries Table
knowledge_base_entries (
  id VARCHAR PRIMARY KEY,
  organization_id VARCHAR NOT NULL,  -- Organization-scoped
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100),
  tags JSONB DEFAULT '[]',
  metadata JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Agents reference knowledge base via JSON array
agents.knowledge_base_ids JSON DEFAULT '[]'
  → ["kb-entry-1", "kb-entry-2", "kb-entry-3"]
```

### 4. Migration Path

**Running the Migration:**

```bash
# Connect to your PostgreSQL database
psql -U your_username -d your_database -f migrations/001_add_multi_provider_support.sql
```

**What the Migration Does:**

1. Adds new `platform`, `external_agent_id`, `provider_config`, `knowledge_base_ids` columns to agents
2. Makes `eleven_labs_agent_id` nullable
3. Migrates existing ElevenLabs agents to new format
4. Adds `platform` and `external_call_id` to call_logs
5. Migrates existing call data
6. Creates indexes for performance
7. Adds documentation comments

**Backward Compatibility:**

- Legacy `elevenLabsAgentId` and `conversationId` fields are preserved
- Existing ElevenLabs integrations continue to work
- Migration automatically converts existing data to new format
- System defaults to 'elevenlabs' platform for existing agents

### 5. Provider Configuration Examples

#### Example 1: ElevenLabs Agent (Legacy)
```json
{
  "platform": "elevenlabs",
  "externalAgentId": "21m00Tcm4TlvDq8ikWAM",
  "providers": {
    "llm": "openai",
    "tts": "elevenlabs",
    "stt": "deepgram"
  },
  "knowledgeBaseIds": ["kb-1", "kb-2"]
}
```

#### Example 2: LiveKit Agent with Mixed Providers
```json
{
  "platform": "livekit",
  "externalAgentId": "lk_agent_abc123",
  "providers": {
    "llm": "anthropic",
    "tts": "cartesian",
    "stt": "assemblyai",
    "vad": "webrtc-vad"
  },
  "providerConfig": {
    "livekit": {
      "roomName": "support-room",
      "maxParticipants": 10
    }
  },
  "knowledgeBaseIds": ["kb-1", "kb-3", "kb-5"]
}
```

#### Example 3: Vapi Agent with Custom Configuration
```json
{
  "platform": "vapi",
  "externalAgentId": "vapi_550e8400",
  "providers": {
    "llm": "groq",
    "tts": "play-ht",
    "stt": "deepgram",
    "vad": "picovoice-cobra",
    "telephony": "twilio"
  },
  "providerConfig": {
    "vapi": {
      "model": "mixtral-8x7b",
      "voiceModel": "jennifer",
      "transcriptionModel": "nova-2"
    }
  },
  "knowledgeBaseIds": ["kb-2", "kb-4", "kb-6", "kb-7"]
}
```

### 6. API Changes

#### Agent Creation
```typescript
POST /api/agents
{
  "platform": "livekit",  // NEW: Required platform selection
  "externalAgentId": "lk_agent_123",  // NEW: Provider's agent ID
  "name": "Customer Support Agent",
  "systemPrompt": "You are a helpful support agent...",
  "providers": {  // NEW: Per-service provider selection
    "llm": "openai",
    "tts": "elevenlabs",
    "stt": "deepgram",
    "vad": "silero-vad"
  },
  "knowledgeBaseIds": ["kb-1", "kb-2"],  // NEW: Knowledge base references
  "providerConfig": {  // NEW: Platform-specific config
    "livekit": {
      "roomName": "support"
    }
  }
}
```

#### Call Logs Creation
```typescript
POST /api/call-logs
{
  "platform": "vapi",  // NEW: Required platform
  "externalCallId": "call_abc123",  // NEW: Provider's call ID
  "agentId": "agent_xyz",
  "duration": 120,
  "transcript": [...],
  // ... other fields
}
```

### 7. Benefits

**Flexibility:**
- Use best-in-class providers for each service type
- Switch providers without data loss
- Mix and match providers per agent

**Scalability:**
- Support multiple platforms simultaneously
- Easy to add new providers
- No vendor lock-in

**Cost Optimization:**
- Use cheaper providers where appropriate
- Optimize per service type
- Easy A/B testing of providers

**Knowledge Management:**
- Centralized knowledge base
- Share knowledge across agents
- Independent of voice platform

### 8. Future Enhancements

**Planned Features:**
- Provider health monitoring
- Automatic provider failover
- Cost tracking per provider
- Provider performance analytics
- Multi-provider load balancing
- Provider-specific feature flags

### 9. Developer Guide

**Adding a New Provider:**

1. Update the `platform` enum in schema.ts
2. Add provider metadata to `voice-ai-providers.ts`
3. Implement provider-specific adapter in `server/adapters/`
4. Update UI to show provider in selection dropdown
5. Add provider-specific configuration UI if needed
6. Update documentation

**Testing with Multiple Providers:**

```typescript
// Create agents with different providers
const elevenLabsAgent = await createAgent({ platform: 'elevenlabs', ... });
const livekitAgent = await createAgent({ platform: 'livekit', ... });
const vapiAgent = await createAgent({ platform: 'vapi', ... });

// Share knowledge base across all agents
const knowledgeBase = await createKnowledgeBase({ organizationId });
await linkKnowledgeBase(elevenLabsAgent.id, knowledgeBase.id);
await linkKnowledgeBase(livekitAgent.id, knowledgeBase.id);
await linkKnowledgeBase(vapiAgent.id, knowledgeBase.id);
```

## Summary

The system is now **platform-agnostic** and **provider-flexible**:

✅ **Agents** can be created on any supported platform
✅ **Providers** can be mixed and matched per service type
✅ **Knowledge Base** is independent and shareable
✅ **Call Logs** track platform and external IDs
✅ **Backward Compatible** with existing ElevenLabs integrations
✅ **Extensible** for adding new providers easily

The architecture promotes flexibility, prevents vendor lock-in, and enables cost optimization while maintaining a unified management interface.
