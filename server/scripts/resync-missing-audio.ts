import { config as dotenvConfig } from 'dotenv';
import { join } from 'path';
import { existsSync } from 'fs';

dotenvConfig();

import { storage } from '../storage';
import { createElevenLabsClient } from '../services/elevenlabs';

async function resyncMissingAudio() {
  console.log('[RESYNC-AUDIO] Starting missing audio resync process...\n');

  const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenlabsApiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is required');
  }

  const elevenlabsClient = createElevenLabsClient(elevenlabsApiKey);
  const { default: AudioStorageService } = await import('../services/audio-storage-service');
  const audioStorage = new AudioStorageService();

  // Get all call logs from the admin organization
  const adminOrg = process.env.ADMIN_ORG_ID || '35377501-0723-442c-b569-b7b930023e0e';
  const result = await storage.getCallLogs(adminOrg);
  const callLogs = result.data;
  
  let total = 0;
  let missing = 0;
  let resynced = 0;
  let failed = 0;
  let unavailable = 0;

  for (const log of callLogs) {
    if (log.audioFetchStatus === 'available' && log.audioStorageKey) {
      total++;
      const audioPath = join(process.cwd(), 'audio-storage', log.audioStorageKey);
      
      if (!existsSync(audioPath)) {
        missing++;
        console.log(`[RESYNC-AUDIO] Missing file for call ${log.id}: ${log.audioStorageKey}`);
        
        if (!log.conversationId) {
          console.log(`[RESYNC-AUDIO]   ❌ No conversation ID, marking as failed`);
          await storage.updateCallAudioStatus(log.id, log.organizationId, {
            audioFetchStatus: 'failed',
            audioFetchedAt: new Date(),
          });
          failed++;
          continue;
        }

        try {
          console.log(`[RESYNC-AUDIO]   ⬇️  Attempting to re-download from ElevenLabs...`);
          const result = await elevenlabsClient.fetchAndStoreAudio(
            log.conversationId,
            log.id,
            audioStorage,
            storage,
            log.organizationId
          );

          if (result.success) {
            console.log(`[RESYNC-AUDIO]   ✅ Successfully resynced: ${result.storageKey}\n`);
            resynced++;
          } else if (result.error?.includes('not available')) {
            console.log(`[RESYNC-AUDIO]   ⚠️  Audio not available from ElevenLabs (404)\n`);
            unavailable++;
          } else {
            console.log(`[RESYNC-AUDIO]   ❌ Failed: ${result.error}\n`);
            failed++;
          }
        } catch (error: any) {
          console.log(`[RESYNC-AUDIO]   ❌ Error: ${error.message}\n`);
          failed++;
        }
      }
    }
  }

  console.log('\n[RESYNC-AUDIO] Summary:');
  console.log(`  Total calls marked 'available': ${total}`);
  console.log(`  Missing files found: ${missing}`);
  console.log(`  Successfully resynced: ${resynced}`);
  console.log(`  Unavailable (404): ${unavailable}`);
  console.log(`  Failed: ${failed}`);
  console.log('\n[RESYNC-AUDIO] Resync complete!');

  process.exit(0);
}

resyncMissingAudio().catch((error) => {
  console.error('[RESYNC-AUDIO] Fatal error:', error);
  process.exit(1);
});
