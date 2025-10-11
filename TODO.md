# ElevenLabs Integration Fix - TODO

Context:
- Issue: App unable to retrieve relevant data from ElevenLabs due to API key handling and route/storage mismatches.
- Goal: Ensure real-time sync and data fetch from ElevenLabs works reliably with the provided API key.

Plan and Status:
1. Key handling robustness
   - [x] Add backward-compatible decryptApiKey that accepts both plaintext and encrypted keys.
   - [x] Add encryptApiKey helper (AES-256-CBC) for secure storage.
   - [x] Ensure ElevenLabs client sanitizes and uses key consistently.

2. Routes and persistence fixes
   - [x] Update routes to store encrypted key using storage.upsertIntegration (provider: "elevenlabs").
   - [x] Store apiKeyLast4 and update lastTested on success.
   - [x] Replace non-existent fields (e.g., lastSync) with integrations.lastTested in status responses.
   - [x] Remove calls to non-existent storage methods (createIntegration, updateIntegration) and use upsertIntegration.
   - [x] Replace getOrganizations with getAllOrganizations for admin force-sync update path.

3. Realtime sync service adjustments
   - [x] Make syncCreditsData/syncDashboardData/syncCallsData/syncAnalyticsData public for route usage.
   - [x] Fix call log creation payload to match schema (remove createdAt from insert).
   - [x] Fix metrics aggregation to use storage.getCallLogs signature ({ data, total }).
   - [x] Fix types in analytics insights (hourlyUsage typing and arrays).

4. Test endpoints
   - [ ] Run POST /api/realtime-sync/setup with plaintext API key to persist encrypted key.
   - [ ] Check GET /api/realtime-sync/status to validate key and connectivity.
   - [ ] Run GET /api/realtime-sync/test-api to fetch sample user/agents/conversations.
   - [ ] Optionally run POST /api/realtime-sync/all to perform full sync.

Environment Notes:
- ENCRYPTION_KEY is optional; if not set, a default is used. For production, set a strong ENCRYPTION_KEY in env.
- All changes made under EchoSensei/server/services and EchoSensei/server/routes-realtime-sync.ts.

Verification Checklist:
- [ ] Setup route returns success and persists integration with status ACTIVE, lastTested set.
- [ ] Status route returns apiKeyValid: true.
- [ ] Test API route returns success for user and at least attempts agents/conversations.
- [ ] Dashboard pages/populated data reflect synced agents/calls.
