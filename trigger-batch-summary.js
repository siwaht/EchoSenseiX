// Script to trigger batch summary generation for all calls
const fetch = require('node-fetch');

async function triggerBatchSummaryGeneration() {
  try {
    console.log('[TRIGGER] Starting batch summary generation...');
    
    // First, login to get authenticated session
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'cc@siwaht.com',
        password: 'password123'
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    
    const loginData = await loginResponse.json();
    console.log('[TRIGGER] Logged in successfully');
    
    // Extract cookies from login response
    const cookies = loginResponse.headers.get('set-cookie');
    
    // Now trigger the batch summary generation
    const summaryResponse = await fetch('http://localhost:5000/api/jobs/generate-all-summaries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies || ''
      }
    });
    
    if (!summaryResponse.ok) {
      const errorText = await summaryResponse.text();
      throw new Error(`Summary generation failed: ${summaryResponse.status} - ${errorText}`);
    }
    
    const result = await summaryResponse.json();
    console.log('[TRIGGER] Batch summary generation completed:');
    console.log(`- Processed: ${result.processed || 0} calls`);
    console.log(`- Successful: ${result.successful || 0} summaries`);
    console.log(`- Failed: ${result.failed || 0} summaries`);
    
    if (result.errors && result.errors.length > 0) {
      console.log('[TRIGGER] Errors encountered:');
      result.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    console.log('[TRIGGER] Batch summary generation task completed!');
    
  } catch (error) {
    console.error('[TRIGGER] Error:', error.message);
    process.exit(1);
  }
}

// Run the trigger
triggerBatchSummaryGeneration();