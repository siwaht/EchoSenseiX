import { storage } from './storage';
import SummaryService from './services/summary-service';

async function testSummaryGeneration() {
  try {
    console.log('[TEST] Starting summary generation test...');
    
    const adminUser = await storage.getUserByEmail('cc@siwaht.com');
    if (!adminUser) {
      console.error('Admin user not found');
      process.exit(1);
    }

    const callLogsResult = await storage.getCallLogs(adminUser.organizationId!, 10);
    const callWithTranscript = callLogsResult.data.find(log => log.transcript && !log.summary);
    
    if (callWithTranscript) {
      console.log('[TEST] Found call with transcript but no summary:', callWithTranscript.id);
      console.log('[TEST] Generating summary...');
      
      const result = await SummaryService.generateCallSummary(callWithTranscript);
      console.log('[TEST] Summary result:', result.status);
      
      if (result.status === 'success') {
        await storage.updateCallLogSummary(
          callWithTranscript.id,
          adminUser.organizationId!,
          result.summary,
          result.status,
          result.metadata
        );
        console.log('[TEST] ✅ Summary saved successfully');
        console.log('[TEST] Summary preview:', result.summary.substring(0, 200) + '...');
      } else {
        console.log('[TEST] ❌ Summary generation failed:', result.error);
      }
    } else {
      console.log('[TEST] No calls with transcript found (or all already have summaries)');
      
      // Show summary status for all calls
      console.log('\n[TEST] Call summary status:');
      for (const log of callLogsResult.data) {
        const hasTranscript = log.transcript ? '✓' : '✗';
        const hasSummary = log.summary ? '✓' : '✗';
        console.log(`  Call ${log.id}: transcript ${hasTranscript}, summary ${hasSummary}`);
      }
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('[TEST] Error:', error.message);
    process.exit(1);
  }
}

testSummaryGeneration();
