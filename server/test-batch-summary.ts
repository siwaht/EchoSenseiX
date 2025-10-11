// Test script to trigger batch summary generation directly
import { storage } from './storage';
import SummaryService from './services/summary-service';

async function triggerBatchSummaryGeneration() {
  try {
    // Get admin user for testing
    const adminUser = await storage.getUserByEmail('cc@siwaht.com');
    if (!adminUser) {
      console.error('Admin user not found');
      return;
    }

    console.log('[BATCH-SUMMARY] Starting batch summary generation for organization:', adminUser.organizationId);
    
    // Get all call logs for the organization
    const allCallLogs = await storage.getCallLogs(adminUser.organizationId);
    
    // Extract data from paginated response
    const callLogsData = allCallLogs.data || allCallLogs;
    
    // Filter to only those needing summaries
    const callLogsNeedingSummary = callLogsData.filter((log: any) => 
      log.transcript && (!log.summary || log.summaryStatus === 'failed')
    );
    
    console.log(`[BATCH-SUMMARY] Found ${callLogsNeedingSummary.length} calls needing summaries`);
    
    if (callLogsNeedingSummary.length === 0) {
      console.log('No calls need summary generation');
      return;
    }
    
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];
    
    // Process in batches to avoid overwhelming the system
    const batchSize = 5;
    for (let i = 0; i < callLogsNeedingSummary.length; i += batchSize) {
      const batch = callLogsNeedingSummary.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (callLog: any) => {
        try {
          console.log(`[BATCH-SUMMARY] Generating summary for call: ${callLog.id}`);
          
          const result = await SummaryService.generateCallSummary(callLog);
          
          if (result.status === 'success' && result.summary) {
            await storage.updateCallLogSummary(
              callLog.id,
              adminUser.organizationId,
              result.summary,
              result.status,
              result.metadata
            );
            successful++;
            console.log(`[BATCH-SUMMARY] Successfully generated summary for call: ${callLog.id}`);
          } else {
            failed++;
            errors.push(`Call ${callLog.id}: ${result.error || 'Unknown error'}`);
            console.error(`[BATCH-SUMMARY] Failed to generate summary for call: ${callLog.id}`, result.error);
          }
        } catch (error: any) {
          failed++;
          errors.push(`Call ${callLog.id}: ${error.message}`);
          console.error(`[BATCH-SUMMARY] Error processing call ${callLog.id}:`, error);
        }
      }));
      
      console.log(`[BATCH-SUMMARY] Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(callLogsNeedingSummary.length / batchSize)}`);
    }
    
    console.log('\n================================');
    console.log('[BATCH-SUMMARY] ✅ Batch summary generation completed:');
    console.log(`📊 Total Processed: ${callLogsNeedingSummary.length} calls`);
    console.log(`✅ Successful: ${successful} summaries`);
    console.log(`❌ Failed: ${failed} summaries`);
    
    if (errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      errors.forEach(error => console.log(`  - ${error}`));
    }
    
    console.log('\n🎉 Batch summary generation completed successfully!');
    
    // Exit successfully
    process.exit(0);
  } catch (error: any) {
    console.error('[BATCH-SUMMARY] Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the batch summary generation
triggerBatchSummaryGeneration();