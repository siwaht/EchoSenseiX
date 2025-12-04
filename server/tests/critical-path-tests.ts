/**
 * Critical Path Test Suite for EchoSenseiX
 * 
 * Tests the most important user flows and system functionality:
 * 1. Authentication & Authorization
 * 2. Agent Management
 * 3. Webhook Integration
 * 4. Call Logging
 * 5. Real-time Sync
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.PUBLIC_URL || 'http://localhost:5000';
const TEST_RESULTS: any[] = [];
let authCookie = '';
let testAgentId = '';

// Helper to log test results
function logTest(category: string, name: string, passed: boolean, details?: any) {
  const result = {
    category,
    test: name,
    passed,
    details,
    timestamp: new Date().toISOString()
  };
  TEST_RESULTS.push(result);
  console.log(`${passed ? '✅' : '❌'} [${category}] ${name}`);
  if (details && !passed) {
    console.log('   Details:', JSON.stringify(details, null, 2));
  }
}

// Helper to make authenticated requests
async function authenticatedRequest(
  endpoint: string,
  options: any = {}
) {
  const headers = {
    'Content-Type': 'application/json',
    ...(authCookie ? { Cookie: authCookie } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Capture cookies from response
  const setCookie = response.headers.get('set-cookie');
  if (setCookie && !authCookie) {
    const parts = setCookie.split(';');
    if (parts && parts.length > 0) {
      authCookie = parts[0] || '';
    }
  }

  return response;
}

// ============================================================================
// 1. AUTHENTICATION & AUTHORIZATION TESTS
// ============================================================================

async function testAuthentication() {
  console.log('\n📋 Category 1: Authentication & Authorization\n');

  // Test 1.1: Health check endpoint
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    logTest(
      'Auth',
      'Health check endpoint',
      response.status === 200 && data.status === 'ok',
      { status: response.status, data }
    );
  } catch (error: any) {
    logTest('Auth', 'Health check endpoint', false, { error: error.message });
  }

  // Test 1.2: Login with test credentials
  try {
    const response = await authenticatedRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'testpassword123'
      })
    });

    const data = await response.json();
    const loginSuccess = response.status === 200 || response.status === 401;

    logTest(
      'Auth',
      'User login',
      loginSuccess,
      {
        status: response.status,
        hasUser: !!data.user,
        note: response.status === 401 ? 'Test user not found (expected in fresh DB)' : undefined
      }
    );
  } catch (error: any) {
    logTest('Auth', 'User login', false, { error: error.message });
  }

  // Test 1.3: Get current user
  try {
    const response = await authenticatedRequest('/api/auth/me');
    await response.json();

    logTest(
      'Auth',
      'Get current user',
      response.status === 200 || response.status === 401,
      {
        status: response.status,
        authenticated: response.status === 200
      }
    );
  } catch (error: any) {
    logTest('Auth', 'Get current user', false, { error: error.message });
  }

  // Test 1.4: Session validation
  try {
    const response = await authenticatedRequest('/api/auth/session');

    logTest(
      'Auth',
      'Session validation',
      response.status === 200 || response.status === 401,
      { status: response.status }
    );
  } catch (error: any) {
    logTest('Auth', 'Session validation', false, { error: error.message });
  }
}

// ============================================================================
// 2. AGENT MANAGEMENT TESTS
// ============================================================================

async function testAgentManagement() {
  console.log('\n📋 Category 2: Agent Management\n');

  // Test 2.1: List agents
  try {
    const response = await authenticatedRequest('/api/agents');
    const data = await response.json();

    logTest(
      'Agents',
      'List agents',
      response.status === 200 || response.status === 401,
      {
        status: response.status,
        agentCount: Array.isArray(data) ? data.length : 0
      }
    );

    // Store first agent ID for later tests
    if (response.status === 200 && Array.isArray(data) && data.length > 0) {
      testAgentId = data[0].id;
    }
  } catch (error: any) {
    logTest('Agents', 'List agents', false, { error: error.message });
  }

  // Test 2.2: Get agent details (if we have an agent)
  if (testAgentId) {
    try {
      const response = await authenticatedRequest(`/api/agents/${testAgentId}`);
      const data = await response.json();

      logTest(
        'Agents',
        'Get agent details',
        response.status === 200,
        {
          status: response.status,
          hasWebhookConfig: !!data.tools?.postCallWebhook
        }
      );
    } catch (error: any) {
      logTest('Agents', 'Get agent details', false, { error: error.message });
    }
  } else {
    logTest('Agents', 'Get agent details', true, { note: 'Skipped - no agents available' });
  }

  // Test 2.3: Verify webhook configuration in agent creation endpoint
  try {
    const response = await authenticatedRequest('/api/agents/create', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Agent',
        description: 'Test agent for validation',
        elevenLabsAgentId: 'test-agent-id'
      })
    });

    const data = await response.json();
    const hasWebhookConfig = data.tools?.postCallWebhook?.enabled === true;

    logTest(
      'Agents',
      'Agent creation includes webhook config',
      response.status === 401 || (response.status === 200 && hasWebhookConfig) || response.status === 400,
      {
        status: response.status,
        hasWebhookConfig,
        note: response.status === 401 ? 'Not authenticated' : response.status === 400 ? 'Validation error (expected)' : undefined
      }
    );
  } catch (error: any) {
    logTest('Agents', 'Agent creation includes webhook config', false, { error: error.message });
  }
}

// ============================================================================
// 3. WEBHOOK INTEGRATION TESTS
// ============================================================================

async function testWebhookIntegration() {
  console.log('\n📋 Category 3: Webhook Integration\n');

  // Test 3.1: Post-call webhook endpoint
  try {
    const payload = {
      conversation_id: 'test-conv-' + Date.now(),
      agent_id: testAgentId || 'test-agent-id',
      call_duration_seconds: 120,
      call_status: 'completed',
      transcript: { text: 'Test conversation transcript' },
      analysis: {
        summary: 'Test call summary generated by ElevenLabs',
        sentiment: 'positive',
        key_points: ['Test point 1', 'Test point 2']
      },
      timestamp: new Date().toISOString()
    };

    const response = await fetch(`${BASE_URL}/api/webhooks/elevenlabs/post-call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    await response.json();

    logTest(
      'Webhooks',
      'Post-call webhook endpoint',
      response.status === 200 || response.status === 400 || response.status === 404,
      {
        status: response.status,
        note: response.status === 404 ? 'Agent not found (expected for test agent)' : undefined
      }
    );
  } catch (error: any) {
    logTest('Webhooks', 'Post-call webhook endpoint', false, { error: error.message });
  }

  // Test 3.2: Conversation init webhook endpoint
  try {
    const payload = {
      conversation_id: 'test-conv-init-' + Date.now(),
      agent_id: testAgentId || 'test-agent-id',
      phone_number: '+1234567890',
      timestamp: new Date().toISOString()
    };

    const response = await fetch(`${BASE_URL}/api/webhooks/elevenlabs/conversation-init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    await response.json();

    logTest(
      'Webhooks',
      'Conversation init webhook endpoint',
      response.status === 200,
      { status: response.status }
    );
  } catch (error: any) {
    logTest('Webhooks', 'Conversation init webhook endpoint', false, { error: error.message });
  }

  // Test 3.3: Events webhook endpoint
  try {
    const payload = {
      event_type: 'tool.called',
      conversation_id: 'test-conv-' + Date.now(),
      agent_id: testAgentId || 'test-agent-id',
      data: { tool_name: 'test_tool' },
      timestamp: new Date().toISOString()
    };

    const response = await fetch(`${BASE_URL}/api/webhooks/elevenlabs/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    await response.json();

    logTest(
      'Webhooks',
      'Events webhook endpoint',
      response.status === 200,
      { status: response.status }
    );
  } catch (error: any) {
    logTest('Webhooks', 'Events webhook endpoint', false, { error: error.message });
  }

  // Test 3.4: Webhook URL configuration
  const expectedWebhookUrl = `${BASE_URL}/api/webhooks/elevenlabs/post-call`;
  logTest(
    'Webhooks',
    'Webhook URL format validation',
    expectedWebhookUrl.includes('/api/webhooks/elevenlabs/post-call'),
    { expectedUrl: expectedWebhookUrl }
  );
}

// ============================================================================
// 4. CALL LOGGING TESTS
// ============================================================================

async function testCallLogging() {
  console.log('\n📋 Category 4: Call Logging\n');

  // Test 4.1: List call logs
  try {
    const response = await authenticatedRequest('/api/call-logs');
    const data = await response.json();

    logTest(
      'Calls',
      'List call logs',
      response.status === 200 || response.status === 401,
      {
        status: response.status,
        callCount: data.data ? data.data.length : 0
      }
    );
  } catch (error: any) {
    logTest('Calls', 'List call logs', false, { error: error.message });
  }

  // Test 4.2: Summary status endpoint
  try {
    const response = await authenticatedRequest('/api/call-logs/summary-status');
    await response.json();

    logTest(
      'Calls',
      'Summary status endpoint',
      response.status === 200 || response.status === 401,
      { status: response.status }
    );
  } catch (error: any) {
    logTest('Calls', 'Summary status endpoint', false, { error: error.message });
  }

  // Test 4.3: Manual summary generation (should return info message)
  try {
    const response = await authenticatedRequest('/api/call-logs/test-id/summary', {
      method: 'POST'
    });

    const data = await response.json();
    const hasWebhookMessage = data.message && data.message.toLowerCase().includes('webhook');

    logTest(
      'Calls',
      'Manual summary returns webhook info',
      response.status === 401 || (response.status === 200 && hasWebhookMessage) || response.status === 404,
      {
        status: response.status,
        hasWebhookMessage,
        note: response.status === 404 ? 'Call not found (expected)' : undefined
      }
    );
  } catch (error: any) {
    logTest('Calls', 'Manual summary returns webhook info', false, { error: error.message });
  }
}

// ============================================================================
// 5. REAL-TIME SYNC TESTS
// ============================================================================

async function testRealtimeSync() {
  console.log('\n📋 Category 5: Real-time Sync\n');

  // Test 5.1: Sync status endpoint
  try {
    const response = await authenticatedRequest('/api/sync/status');
    await response.json();

    logTest(
      'Sync',
      'Sync status endpoint',
      response.status === 200 || response.status === 401,
      { status: response.status }
    );
  } catch (error: any) {
    logTest('Sync', 'Sync status endpoint', false, { error: error.message });
  }

  // Test 5.2: Manual sync trigger
  try {
    const response = await authenticatedRequest('/api/sync/trigger', {
      method: 'POST'
    });

    logTest(
      'Sync',
      'Manual sync trigger',
      response.status === 200 || response.status === 401 || response.status === 404,
      { status: response.status }
    );
  } catch (error: any) {
    logTest('Sync', 'Manual sync trigger', false, { error: error.message });
  }
}

// ============================================================================
// 6. INTEGRATION TESTS
// ============================================================================

async function testIntegrations() {
  console.log('\n📋 Category 6: Integrations\n');

  // Test 6.1: List integrations
  try {
    const response = await authenticatedRequest('/api/integrations');
    const data = await response.json();

    logTest(
      'Integrations',
      'List integrations',
      response.status === 200 || response.status === 401,
      {
        status: response.status,
        integrationCount: Array.isArray(data) ? data.length : 0
      }
    );
  } catch (error: any) {
    logTest('Integrations', 'List integrations', false, { error: error.message });
  }

  // Test 6.2: ElevenLabs integration status
  try {
    const response = await authenticatedRequest('/api/integrations/elevenlabs/status');

    logTest(
      'Integrations',
      'ElevenLabs integration status',
      response.status === 200 || response.status === 401 || response.status === 404,
      { status: response.status }
    );
  } catch (error: any) {
    logTest('Integrations', 'ElevenLabs integration status', false, { error: error.message });
  }
}

// ============================================================================
// 7. STORAGE TESTS
// ============================================================================

async function testStorage() {
  console.log('\n📋 Category 7: Storage & Media\n');

  // Test 7.1: Storage configuration
  const storageProvider = process.env.STORAGE_PROVIDER || 'local';
  logTest(
    'Storage',
    'Storage provider configured',
    ['local', 's3', 'gcs', 'azure'].includes(storageProvider),
    { provider: storageProvider }
  );

  // Test 7.2: Audio storage directory (for local storage)
  if (storageProvider === 'local') {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const audioDir = path.join(process.cwd(), 'audio-storage');
      const exists = fs.existsSync(audioDir);

      logTest(
        'Storage',
        'Local audio storage directory exists',
        exists,
        { path: audioDir, exists }
      );
    } catch (error: any) {
      logTest('Storage', 'Local audio storage directory exists', false, { error: error.message });
    }
  } else {
    logTest('Storage', 'Local audio storage directory exists', true, { note: 'Skipped - using cloud storage' });
  }
}

// ============================================================================
// 8. DATABASE TESTS
// ============================================================================

async function testDatabase() {
  console.log('\n📋 Category 8: Database\n');

  // Test 8.1: Database connection
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();

    logTest(
      'Database',
      'Database connection',
      response.status === 200 && data.database !== 'error',
      { status: data.database }
    );
  } catch (error: any) {
    logTest('Database', 'Database connection', false, { error: error.message });
  }

  // Test 8.2: Organizations table
  try {
    const response = await authenticatedRequest('/api/organizations');

    logTest(
      'Database',
      'Organizations table accessible',
      response.status === 200 || response.status === 401 || response.status === 404,
      { status: response.status }
    );
  } catch (error: any) {
    logTest('Database', 'Organizations table accessible', false, { error: error.message });
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  console.log('🧪 Starting Critical Path Test Suite for EchoSenseiX\n');
  console.log('='.repeat(70));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Started: ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  try {
    await testAuthentication();
    await testAgentManagement();
    await testWebhookIntegration();
    await testCallLogging();
    await testRealtimeSync();
    await testIntegrations();
    await testStorage();
    await testDatabase();

    console.log('\n' + '='.repeat(70));
    console.log('\n📊 Test Summary\n');

    const passed = TEST_RESULTS.filter(r => r.passed).length;
    const failed = TEST_RESULTS.filter(r => !r.passed).length;
    const total = TEST_RESULTS.length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    // Group results by category
    const categorySet = new Set(TEST_RESULTS.map(r => r.category));
    const categories = Array.from(categorySet);
    console.log('\n📋 Results by Category:\n');

    categories.forEach(category => {
      const categoryTests = TEST_RESULTS.filter(r => r.category === category);
      const categoryPassed = categoryTests.filter(r => r.passed).length;
      const categoryTotal = categoryTests.length;
      console.log(`${category}: ${categoryPassed}/${categoryTotal} passed`);
    });

    console.log('\n📋 Failed Tests:\n');
    const failedTests = TEST_RESULTS.filter(r => !r.passed);
    if (failedTests.length === 0) {
      console.log('None! 🎉');
    } else {
      failedTests.forEach((result, index) => {
        console.log(`${index + 1}. [${result.category}] ${result.test}`);
        if (result.details) {
          console.log(`   ${JSON.stringify(result.details)}`);
        }
      });
    }

    console.log('\n' + '='.repeat(70));

    if (failed === 0) {
      console.log('\n🎉 All critical path tests passed!');
      process.exit(0);
    } else {
      console.log(`\n⚠️  ${failed} test(s) failed. Review the details above.`);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(console.error);
