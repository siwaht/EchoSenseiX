import { config as dotenvConfig } from 'dotenv';
import { join } from 'path';
import { existsSync } from 'fs';

dotenvConfig();

import { storage } from '../storage';
import { createElevenLabsClient } from '../services/elevenlabs';

const BATCH_SIZE = 10; // Process in batches to avoid timeout
const RETRY_DELAY = 2000; // 2 seconds between retries

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function resyncMissingAudio(batchSize: number = BATCH_SIZE): Promise<{
  total: number;
  missing: number;
  resynced: number;
  failed: number;
  unavailable: number;
  skipped: number;
}> {
  console.log('[RESYNC-AUDIO] Starting missing audio resync process...\n');

  const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenlabsApiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is required');
  }

  const elevenlabsClient = createElevenLabsClient(elevenlabsApiKey);
  const { default: AudioStorageService } = await import('../services/audio-storage-service');
  const audioStorage = new AudioStorageService();

  // Get ALL call logs from the database (across all organizations)
  const { db: getDb } = await import('../db');
  const { callLogs: callLogsTable } = await import('../../shared/schema');
  const database = getDb();
  const callLogs = await database.select().from(callLogsTable);
  
  let total = 0;
  let missing = 0;
  let resynced = 0;
  let failed = 0;
  let unavailable = 0;
  let skipped = 0;

  console.log(`[RESYNC-AUDIO] Found ${callLogs.length} total call logs`);
  console.log(`[RESYNC-AUDIO] Processing in batches of ${batchSize}...\n`);

  // Process in batches to avoid timeout
  for (let i = 0; i < callLogs.length; i += batchSize) {
    const batch = callLogs.slice(i, i + batchSize);
    console.log(`[RESYNC-AUDIO] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(callLogs.length / batchSize)} (calls ${i + 1}-${Math.min(i + batchSize, callLogs.length)})`);
    
    for (const log of batch) {
      // Check if call has audio that should be available
      if (!log.conversationId) {
        skipped++;
        continue;
      }

      // Check if file is missing (for any status except 'unavailable')
      const shouldHaveAudio = log.audioFetchStatus && log.audioFetchStatus !== 'unavailable';
      const hasStorageKey = !!log.audioStorageKey;
      
      if (shouldHaveAudio || hasStorageKey) {
        total++;
        
        const audioPath = log.audioStorageKey 
          ? join(process.cwd(), 'audio-storage', log.audioStorageKey)
          : null;
        
        const fileExists = audioPath && existsSync(audioPath);
        
        if (!fileExists && log.conversationId) {
          missing++;
          console.log(`[RESYNC-AUDIO]   Missing: ${log.id} (status: ${log.audioFetchStatus})`);
          
          let retries = 0;
          const maxRetries = 3;
          let success = false;
          
          while (retries < maxRetries && !success) {
            try {
              if (retries > 0) {
                console.log(`[RESYNC-AUDIO]     Retry ${retries}/${maxRetries}...`);
                await sleep(RETRY_DELAY * retries); // Exponential backoff
              }
              
              const result = await elevenlabsClient.fetchAndStoreAudio(
                log.conversationId,
                log.id,
                audioStorage,
                storage,
                log.organizationId
              );

              if (result.success) {
                console.log(`[RESYNC-AUDIO]     ✅ Resynced: ${result.storageKey}`);
                resynced++;
                success = true;
              } else if (result.error?.includes('not available')) {
                console.log(`[RESYNC-AUDIO]     ⚠️  Not available (404)`);
                unavailable++;
                success = true; // Don't retry 404s
              } else {
                console.log(`[RESYNC-AUDIO]     ❌ Failed: ${result.error}`);
                retries++;
              }
            } catch (error: any) {
              console.log(`[RESYNC-AUDIO]     ❌ Error: ${error.message}`);
              retries++;
            }
          }
          
          if (!success && retries >= maxRetries) {
            failed++;
          }
        }
      }
    }
    
    // Small delay between batches
    if (i + batchSize < callLogs.length) {
      await sleep(500);
    }
  }

  const results = {
    total,
    missing,
    resynced,
    failed,
    unavailable,
    skipped
  };

  console.log('\n[RESYNC-AUDIO] Summary:');
  console.log(`  Total calls checked: ${total}`);
  console.log(`  Missing files found: ${missing}`);
  console.log(`  Successfully resynced: ${resynced}`);
  console.log(`  Unavailable (404): ${unavailable}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Skipped (no conversation ID): ${skipped}`);
  console.log('\n[RESYNC-AUDIO] Resync complete!');

  return results;
}

export { resyncMissingAudio };

// Run if called directly
const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  resyncMissingAudio()
    .then((results) => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('[RESYNC-AUDIO] Fatal error:', error);
      process.exit(1);
    });
}
