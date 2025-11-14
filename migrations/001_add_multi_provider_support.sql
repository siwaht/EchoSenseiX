-- Migration: Add Multi-Provider Support
-- This migration makes the system provider-agnostic by adding platform fields
-- and making ElevenLabs-specific fields optional

-- Step 1: Add new columns to agents table
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS platform VARCHAR DEFAULT 'elevenlabs' NOT NULL,
  ADD COLUMN IF NOT EXISTS external_agent_id VARCHAR,
  ADD COLUMN IF NOT EXISTS provider_config JSON,
  ADD COLUMN IF NOT EXISTS knowledge_base_ids JSON DEFAULT '[]'::json;

-- Step 2: Make ElevenLabs-specific fields nullable
ALTER TABLE agents
  ALTER COLUMN eleven_labs_agent_id DROP NOT NULL;

-- Step 3: Migrate existing ElevenLabs agents
UPDATE agents
SET
  external_agent_id = eleven_labs_agent_id,
  platform = 'elevenlabs'
WHERE eleven_labs_agent_id IS NOT NULL
  AND external_agent_id IS NULL;

-- Step 4: Add new columns to call_logs table
ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS platform VARCHAR DEFAULT 'elevenlabs' NOT NULL,
  ADD COLUMN IF NOT EXISTS external_call_id VARCHAR;

-- Step 5: Make conversation_id nullable (was NOT NULL before)
ALTER TABLE call_logs
  ALTER COLUMN conversation_id DROP NOT NULL;

-- Step 6: Migrate existing call data to use new fields
UPDATE call_logs
SET
  external_call_id = COALESCE(eleven_labs_call_id, conversation_id),
  platform = 'elevenlabs'
WHERE external_call_id IS NULL;

-- Step 7: Now make external_call_id NOT NULL (after migration)
ALTER TABLE call_logs
  ALTER COLUMN external_call_id SET NOT NULL;

-- Step 8: Add indexes for new columns
CREATE INDEX IF NOT EXISTS agents_platform_idx ON agents(platform);
CREATE INDEX IF NOT EXISTS agents_external_agent_id_idx ON agents(external_agent_id);
CREATE INDEX IF NOT EXISTS call_logs_platform_idx ON call_logs(platform);
CREATE INDEX IF NOT EXISTS call_logs_external_call_id_idx ON call_logs(external_call_id);

-- Step 9: Add comments for documentation
COMMENT ON COLUMN agents.platform IS 'Platform hosting this agent: elevenlabs, livekit, vapi, retell, cartesian, deepgram, etc.';
COMMENT ON COLUMN agents.external_agent_id IS 'Provider-specific agent ID (e.g., ElevenLabs agent ID, Vapi agent ID)';
COMMENT ON COLUMN agents.provider_config IS 'Provider-specific configuration for features not covered by standard fields';
COMMENT ON COLUMN agents.knowledge_base_ids IS 'Array of knowledge base entry IDs associated with this agent (platform-agnostic)';
COMMENT ON COLUMN agents.eleven_labs_agent_id IS 'DEPRECATED: Use external_agent_id + platform instead';

COMMENT ON COLUMN call_logs.platform IS 'Platform that handled this call: elevenlabs, livekit, vapi, retell, etc.';
COMMENT ON COLUMN call_logs.external_call_id IS 'Provider-specific call/conversation ID';
COMMENT ON COLUMN call_logs.conversation_id IS 'DEPRECATED: ElevenLabs conversation ID, use external_call_id + platform instead';
COMMENT ON COLUMN call_logs.eleven_labs_call_id IS 'DEPRECATED: Use external_call_id + platform instead';
