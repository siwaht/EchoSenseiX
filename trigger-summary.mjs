// Script to trigger batch summary generation using Express test client
import express from 'express';
import session from 'express-session';
import passport from 'passport';

async function callAPI() {
  try {
    console.log('[TRIGGER] Starting batch summary generation...');
    
    // Step 1: Login
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'cc@siwaht.com',
        password: 'password123'
      }),
      credentials: 'include'
    });

    // Check if login was successful
    if (loginRes.status === 200) {
      // Get the cookies from the response
      const cookies = loginRes.headers.get('set-cookie');
      console.log('[TRIGGER] Login successful');
      
      // Step 2: Trigger batch summary generation with the session cookie
      const summaryRes = await fetch('http://localhost:5000/api/jobs/generate-all-summaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookies || ''
        }
      });
      
      const summaryText = await summaryRes.text();
      
      // Try to parse as JSON, if not show raw text
      try {
        const result = JSON.parse(summaryText);
        console.log('\n[TRIGGER] ✅ Batch summary generation completed:');
        console.log('================================');
        console.log(`📝 Message: ${result.message || 'Processing complete'}`);
        console.log(`📊 Total Processed: ${result.processed || 0} calls`);
        console.log(`✅ Successful: ${result.successful || 0} summaries`);
        console.log(`❌ Failed: ${result.failed || 0} summaries`);
        
        if (result.errors && result.errors.length > 0) {
          console.log('\n[TRIGGER] ⚠️ Errors encountered:');
          result.errors.forEach(error => console.log(`  - ${error}`));
        }
      } catch (e) {
        console.log('[TRIGGER] Response:', summaryText);
      }
      
      console.log('\n[TRIGGER] 🎉 Task completed!');
    } else {
      const text = await loginRes.text();
      console.error('[TRIGGER] Login failed:', text);
    }
    
  } catch (error) {
    console.error('[TRIGGER] Error:', error.message);
  }
}

callAPI();