import { storage } from './storage';
import { SyncService } from './services/sync-service';

async function testTranscriptSync() {
  try {
    console.log('[TEST] Starting transcript sync test...');
    
    // Get admin user
    const adminUser = await storage.getUserByEmail('cc@siwaht.com');
    if (!adminUser) {
      console.error('Admin user not found');
      process.exit(1);
    }

    console.log(`[TEST] Found admin user: ${adminUser.email}`);
    console.log(`[TEST] Organization ID: ${adminUser.organizationId}`);

    // Trigger sync
    console.log('[TEST] Triggering sync...');
    const result = await SyncService.syncCallLogs({
      organizationId: adminUser.organizationId!,
      limit: 5, // Only sync 5 calls for testing
      includeTranscripts: true
    });

    console.log('[TEST] Sync completed:');
    console.log(`  - Success: ${result.success}`);
    console.log(`  - Synced: ${result.syncedCount}`);
    console.log(`  - Updated: ${result.updatedCount}`);
    console.log(`  - Errors: ${result.errorCount}`);
    console.log(`  - Duration: ${result.duration}ms`);
    
    if (result.errors.length > 0) {
      console.log('[TEST] Errors:', result.errors);
    }

    // Check if transcripts were fetched
    const callLogsResult = await storage.getCallLogs(adminUser.organizationId!, 5);
    const callLogs = callLogsResult.data;
    console.log(`[TEST] Checking ${callLogs.length} call logs for transcripts...`);
    
    let transcriptCount = 0;
    for (const log of callLogs) {
      if (log.transcript) {
        transcriptCount++;
        const transcriptStr = typeof log.transcript === 'string' ? log.transcript : JSON.stringify(log.transcript);
        console.log(`  ✓ Call ${log.id} has transcript (${transcriptStr.length} chars)`);
      } else {
        console.log(`  ✗ Call ${log.id} has NO transcript`);
      }
    }

    console.log(`[TEST] ${transcriptCount}/${callLogs.length} calls have transcripts`);
    
    process.exit(0);
  } catch (error: any) {
    console.error('[TEST] Error:', error.message);
    process.exit(1);
  }
}

testTranscriptSync();
