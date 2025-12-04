/**
 * Comprehensive Health Check Script for EchoSenseiX
 * 
 * Validates:
 * 1. Environment Configuration
 * 2. Database Connectivity
 * 3. External Service Integrations
 * 4. File System & Storage
 * 5. Security Configuration
 * 6. Performance Metrics
 */

import { config } from 'dotenv';
import { existsSync, accessSync, constants } from 'fs';
import { join } from 'path';

config();

interface HealthCheckResult {
  category: string;
  check: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

const results: HealthCheckResult[] = [];

function logResult(category: string, check: string, status: 'pass' | 'fail' | 'warning', message: string, details?: any) {
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
  results.push({ category, check, status, message, details });
  console.log(`${icon} [${category}] ${check}: ${message}`);
  if (details) {
    console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
  }
}

// ============================================================================
// 1. ENVIRONMENT CONFIGURATION CHECKS
// ============================================================================

function checkEnvironmentVariables() {
  console.log('\n📋 Category 1: Environment Configuration\n');

  // Required variables
  const required = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'ENCRYPTION_KEY'
  ];

  required.forEach(varName => {
    const value = process.env[varName];
    if (!value) {
      logResult('Environment', varName, 'fail', 'Missing required environment variable');
    } else if (varName === 'SESSION_SECRET' && value.length < 32) {
      logResult('Environment', varName, 'warning', 'Session secret should be at least 32 characters', { length: value.length });
    } else if (varName === 'ENCRYPTION_KEY' && value.length < 32) {
      logResult('Environment', varName, 'warning', 'Encryption key should be at least 32 characters', { length: value.length });
    } else {
      logResult('Environment', varName, 'pass', 'Configured', { length: value.length });
    }
  });

  // Optional but recommended
  const recommended = [
    'ELEVENLABS_API_KEY',
    'PUBLIC_URL',
    'NODE_ENV'
  ];

  recommended.forEach(varName => {
    const value = process.env[varName];
    if (!value) {
      logResult('Environment', varName, 'warning', 'Optional variable not set');
    } else {
      logResult('Environment', varName, 'pass', 'Configured');
    }
  });

  // Storage configuration
  const storageProvider = process.env.STORAGE_PROVIDER || 'local';
  logResult('Environment', 'STORAGE_PROVIDER', 'pass', `Using ${storageProvider} storage`);

  if (storageProvider === 's3') {
    const s3Required = ['S3_BUCKET', 'S3_REGION'];
    s3Required.forEach(varName => {
      const value = process.env[varName];
      logResult('Environment', varName, value ? 'pass' : 'fail', value ? 'Configured' : 'Missing for S3 storage');
    });
  } else if (storageProvider === 'gcs') {
    const gcsRequired = ['GCS_BUCKET', 'GCS_PROJECT_ID'];
    gcsRequired.forEach(varName => {
      const value = process.env[varName];
      logResult('Environment', varName, value ? 'pass' : 'fail', value ? 'Configured' : 'Missing for GCS storage');
    });
  } else if (storageProvider === 'azure') {
    const azureRequired = ['AZURE_STORAGE_ACCOUNT_NAME', 'AZURE_STORAGE_CONTAINER_NAME'];
    azureRequired.forEach(varName => {
      const value = process.env[varName];
      logResult('Environment', varName, value ? 'pass' : 'fail', value ? 'Configured' : 'Missing for Azure storage');
    });
  }

  // Node environment
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv === 'production') {
    logResult('Environment', 'NODE_ENV', 'pass', 'Running in production mode');
  } else {
    logResult('Environment', 'NODE_ENV', 'warning', `Running in ${nodeEnv} mode`);
  }
}

// ============================================================================
async function checkDatabase() {
  console.log('\n📋 Category 2: Database Connectivity\n');

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    logResult('Database', 'Connection String', 'fail', 'DATABASE_URL not configured');
    return;
  }

  // Parse database URL
  try {
    const url = new URL(databaseUrl);
    logResult('Database', 'Connection String', 'pass', 'Valid database URL format', {
      protocol: url.protocol,
      host: url.hostname,
      port: url.port || 'default',
      database: url.pathname.slice(1)
    });
  } catch (error: any) {
    logResult('Database', 'Connection String', 'fail', 'Invalid database URL format', { error: error.message });
    return;
  }

  // Test database connection
  try {
    const { storage } = await import('../storage');

    // Try to get all organizations (this will test DB connection)
    try {
      const orgs = await storage.getAllOrganizations();
      logResult('Database', 'Connection Test', 'pass', 'Successfully connected to database');
      logResult('Database', 'Schema Validation', 'pass', 'Database schema accessible', {
        organizationCount: orgs.length
      });
    } catch (error: any) {
      logResult('Database', 'Connection Test', 'fail', 'Failed to query database', {
        error: error.message,
        note: 'Run migrations with: npm run db:push'
      });
    }
  } catch (error: any) {
    logResult('Database', 'Connection Test', 'fail', 'Failed to connect to database', { error: error.message });
  }
}

// ============================================================================
// 3. FILE SYSTEM & STORAGE CHECKS
// ============================================================================

function checkFileSystem() {
  console.log('\n📋 Category 3: File System & Storage\n');

  const cwd = process.cwd();
  logResult('FileSystem', 'Working Directory', 'pass', 'Current working directory', { path: cwd });

  // Check critical directories
  const criticalDirs = [
    'server',
    'client',
    'shared',
    'audio-storage'
  ];

  criticalDirs.forEach(dir => {
    const dirPath = join(cwd, dir);
    const exists = existsSync(dirPath);

    if (exists) {
      try {
        accessSync(dirPath, constants.R_OK | constants.W_OK);
        logResult('FileSystem', `Directory: ${dir}`, 'pass', 'Exists and writable', { path: dirPath });
      } catch (error) {
        logResult('FileSystem', `Directory: ${dir}`, 'warning', 'Exists but not writable', { path: dirPath });
      }
    } else {
      const severity = dir === 'audio-storage' ? 'warning' : 'fail';
      logResult('FileSystem', `Directory: ${dir}`, severity, 'Directory not found', {
        path: dirPath,
        note: dir === 'audio-storage' ? 'Will be created automatically' : 'Required directory missing'
      });
    }
  });

  // Check critical files
  const criticalFiles = [
    'package.json',
    'server/index.ts',
    'server/routes.ts',
    'server/db.ts',
    'shared/schema.ts'
  ];

  criticalFiles.forEach(file => {
    const filePath = join(cwd, file);
    const exists = existsSync(filePath);
    logResult('FileSystem', `File: ${file}`, exists ? 'pass' : 'fail', exists ? 'Found' : 'Missing', { path: filePath });
  });

  // Check uploads directory
  const uploadsDir = join(cwd, 'uploads');
  if (existsSync(uploadsDir)) {
    try {
      accessSync(uploadsDir, constants.R_OK | constants.W_OK);
      logResult('FileSystem', 'Uploads Directory', 'pass', 'Exists and writable', { path: uploadsDir });
    } catch (error) {
      logResult('FileSystem', 'Uploads Directory', 'warning', 'Exists but not writable', { path: uploadsDir });
    }
  } else {
    logResult('FileSystem', 'Uploads Directory', 'warning', 'Not found (will be created)', { path: uploadsDir });
  }
}

// ============================================================================
// 4. SECURITY CONFIGURATION CHECKS
// ============================================================================

function checkSecurity() {
  console.log('\n📋 Category 4: Security Configuration\n');

  // Check session secret strength
  const sessionSecret = process.env.SESSION_SECRET;
  if (sessionSecret) {
    if (sessionSecret.length >= 64) {
      logResult('Security', 'Session Secret Strength', 'pass', 'Strong session secret', { length: sessionSecret.length });
    } else if (sessionSecret.length >= 32) {
      logResult('Security', 'Session Secret Strength', 'warning', 'Adequate session secret', {
        length: sessionSecret.length,
        recommendation: 'Consider using 64+ characters'
      });
    } else {
      logResult('Security', 'Session Secret Strength', 'fail', 'Weak session secret', {
        length: sessionSecret.length,
        requirement: 'Minimum 32 characters'
      });
    }
  }

  // Check encryption key strength
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (encryptionKey) {
    if (encryptionKey.length >= 64) {
      logResult('Security', 'Encryption Key Strength', 'pass', 'Strong encryption key', { length: encryptionKey.length });
    } else if (encryptionKey.length >= 32) {
      logResult('Security', 'Encryption Key Strength', 'warning', 'Adequate encryption key', {
        length: encryptionKey.length,
        recommendation: 'Consider using 64+ characters'
      });
    } else {
      logResult('Security', 'Encryption Key Strength', 'fail', 'Weak encryption key', {
        length: encryptionKey.length,
        requirement: 'Minimum 32 characters'
      });
    }
  }

  // Check if running in production with proper security
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'production') {
    const httpsEnabled = process.env.FORCE_HTTPS === 'true';
    logResult('Security', 'HTTPS Enforcement', httpsEnabled ? 'pass' : 'warning',
      httpsEnabled ? 'HTTPS enforced' : 'HTTPS not enforced', {
      recommendation: 'Set FORCE_HTTPS=true in production'
    });
  }

  // Check webhook secret
  const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (webhookSecret) {
    logResult('Security', 'Webhook Secret', 'pass', 'Webhook signature verification enabled');
  } else {
    logResult('Security', 'Webhook Secret', 'warning', 'Webhook signature verification not configured', {
      recommendation: 'Set ELEVENLABS_WEBHOOK_SECRET for production'
    });
  }
}

// ============================================================================
// 5. EXTERNAL SERVICE CHECKS
// ============================================================================

async function checkExternalServices() {
  console.log('\n📋 Category 5: External Services\n');

  // Check ElevenLabs API key
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
  if (elevenLabsKey) {
    logResult('Services', 'ElevenLabs API Key', 'pass', 'Configured', {
      keyPrefix: elevenLabsKey.substring(0, 8) + '...'
    });
  } else {
    logResult('Services', 'ElevenLabs API Key', 'warning', 'Not configured', {
      note: 'Required for voice agent functionality'
    });
  }

  // Check Stripe configuration
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey) {
    const isTestKey = stripeKey.startsWith('sk_test_');
    logResult('Services', 'Stripe Configuration', 'pass', isTestKey ? 'Test mode' : 'Live mode', {
      mode: isTestKey ? 'test' : 'live'
    });
  } else {
    logResult('Services', 'Stripe Configuration', 'warning', 'Not configured', {
      note: 'Required for payment processing'
    });
  }

  // Check PayPal configuration
  const paypalClientId = process.env.PAYPAL_CLIENT_ID;
  if (paypalClientId) {
    logResult('Services', 'PayPal Configuration', 'pass', 'Configured');
  } else {
    logResult('Services', 'PayPal Configuration', 'warning', 'Not configured', {
      note: 'Optional payment method'
    });
  }

  // Check SendGrid configuration
  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (sendgridKey) {
    logResult('Services', 'SendGrid Configuration', 'pass', 'Configured');
  } else {
    logResult('Services', 'SendGrid Configuration', 'warning', 'Not configured', {
      note: 'Required for email notifications'
    });
  }

  // Check public URL
  const publicUrl = process.env.PUBLIC_URL;
  if (publicUrl) {
    try {
      new URL(publicUrl);
      logResult('Services', 'Public URL', 'pass', 'Valid URL format', { url: publicUrl });
    } catch (error) {
      logResult('Services', 'Public URL', 'warning', 'Invalid URL format', { url: publicUrl });
    }
  } else {
    logResult('Services', 'Public URL', 'warning', 'Not configured', {
      note: 'Required for webhook callbacks',
      default: 'http://localhost:5000'
    });
  }
}

// ============================================================================
// 6. PERFORMANCE & RESOURCE CHECKS
// ============================================================================

async function checkPerformance() {
  console.log('\n📋 Category 6: Performance & Resources\n');

  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0] || '0');

  if (majorVersion >= 20) {
    logResult('Performance', 'Node.js Version', 'pass', `Running Node.js ${nodeVersion}`);
  } else if (majorVersion >= 18) {
    logResult('Performance', 'Node.js Version', 'warning', `Running Node.js ${nodeVersion}`, {
      recommendation: 'Upgrade to Node.js 20+ for best performance'
    });
  } else {
    logResult('Performance', 'Node.js Version', 'fail', `Running Node.js ${nodeVersion}`, {
      requirement: 'Node.js 18+ required, 20+ recommended'
    });
  }

  // Check memory usage
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

  logResult('Performance', 'Memory Usage', 'pass', `${heapUsedMB}MB / ${heapTotalMB}MB heap`, {
    heapUsed: heapUsedMB + 'MB',
    heapTotal: heapTotalMB + 'MB',
    rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB'
  });

  // Check platform
  const platform = process.platform;
  logResult('Performance', 'Platform', 'pass', `Running on ${platform}`, {
    platform,
    arch: process.arch
  });

  // Check CPU count
  const os = await import('os');
  const cpuCount = os.cpus().length;
  logResult('Performance', 'CPU Cores', 'pass', `${cpuCount} cores available`, { count: cpuCount });
}

// ============================================================================
// MAIN HEALTH CHECK RUNNER
// ============================================================================

async function runHealthCheck() {
  console.log('🏥 EchoSenseiX Health Check\n');
  console.log('='.repeat(70));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Node Version: ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
  console.log('='.repeat(70));

  try {
    checkEnvironmentVariables();
    await checkDatabase();
    checkFileSystem();
    checkSecurity();
    await checkExternalServices();
    await checkPerformance();

    console.log('\n' + '='.repeat(70));
    console.log('\n📊 Health Check Summary\n');

    const passed = results.filter(r => r.status === 'pass').length;
    const warnings = results.filter(r => r.status === 'warning').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const total = results.length;

    console.log(`Total Checks: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log(`❌ Failed: ${failed}`);

    // Group by category
    const categorySet = new Set(results.map(r => r.category));
    const categories = Array.from(categorySet);
    console.log('\n📋 Results by Category:\n');

    categories.forEach(category => {
      const categoryResults = results.filter(r => r.category === category);
      const categoryPassed = categoryResults.filter(r => r.status === 'pass').length;
      const categoryWarnings = categoryResults.filter(r => r.status === 'warning').length;
      const categoryFailed = categoryResults.filter(r => r.status === 'fail').length;

      console.log(`${category}:`);
      console.log(`  ✅ ${categoryPassed} passed`);
      if (categoryWarnings > 0) console.log(`  ⚠️  ${categoryWarnings} warnings`);
      if (categoryFailed > 0) console.log(`  ❌ ${categoryFailed} failed`);
    });

    // Show critical failures
    const criticalFailures = results.filter(r => r.status === 'fail');
    if (criticalFailures.length > 0) {
      console.log('\n❌ Critical Failures:\n');
      criticalFailures.forEach((result, index) => {
        console.log(`${index + 1}. [${result.category}] ${result.check}: ${result.message}`);
        if (result.details) {
          console.log(`   ${JSON.stringify(result.details)}`);
        }
      });
    }

    // Show warnings
    const warningResults = results.filter(r => r.status === 'warning');
    if (warningResults.length > 0) {
      console.log('\n⚠️  Warnings:\n');
      warningResults.forEach((result, index) => {
        console.log(`${index + 1}. [${result.category}] ${result.check}: ${result.message}`);
        if (result.details?.recommendation) {
          console.log(`   Recommendation: ${result.details.recommendation}`);
        }
      });
    }

    console.log('\n' + '='.repeat(70));

    if (failed === 0 && warnings === 0) {
      console.log('\n🎉 All health checks passed! System is ready.');
      process.exit(0);
    } else if (failed === 0) {
      console.log(`\n✅ System is operational with ${warnings} warning(s).`);
      process.exit(0);
    } else {
      console.log(`\n❌ System has ${failed} critical failure(s). Please address before deployment.`);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Health check failed:', error);
    process.exit(1);
  }
}

// Run health check
runHealthCheck().catch(console.error);
