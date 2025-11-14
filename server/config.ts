import { config as loadEnv } from 'dotenv';

// Load environment variables from .env file
loadEnv();

interface Config {
  // Environment
  nodeEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;
  
  // Server
  host: string;
  port: number;
  publicUrl: string;
  baseDomain: string | null;
  
  // Database
  database: {
    provider: 'postgresql' | 'mongodb' | 'supabase' | 'mysql' | 'sqlite';
    url: string;
    ssl: boolean;
    maxConnections: number;
    // Provider-specific options
    host?: string;
    port?: number;
    name?: string;
    username?: string;
    password?: string;
  };
  
  // Security & Auth
  security: {
    sessionSecret: string;
    encryptionKey: string;
    trustProxy: boolean;
  };

  // Platform-Agnostic Providers
  providers: {
    voice: {
      provider: 'elevenlabs' | 'openai' | 'google' | 'azure' | 'aws-polly';
      apiKey: string | null;
    };
    payment: {
      provider: 'stripe' | 'paypal' | 'square';
      secretKey: string | null;
      webhookSecret: string | null;
    };
    llm: {
      provider: 'openai' | 'anthropic' | 'mistral';
      apiKey: string | null;
      model: string | null;
    };
    email: {
      provider: 'sendgrid' | 'mailgun' | 'smtp';
      apiKey: string | null;
    };
  };

  // Legacy External Services (backward compatibility)
  integrations: {
    elevenlabs: {
      apiKey: string | null;
    };
    stripe: {
      secretKey: string | null;
      webhookSecret: string | null;
    };
    sendgrid: {
      apiKey: string | null;
    };
    google: {
      projectId: string | null;
      credentialsPath: string | null;
    };
  };
  
  // Storage
  storage: {
    provider: 'local' | 's3' | 'gcs' | 'azure';
    local: {
      uploadDir: string;
      audioDir: string;
    };
    s3?: {
      bucket: string;
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
    };
    gcs?: {
      bucket: string;
      projectId: string;
      keyFilePath: string;
    };
    azure?: {
      accountName: string;
      accountKey: string;
      containerName: string;
    };
  };
}

/**
 * Validate and load application configuration from environment variables
 */
function loadConfig(): Config {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isDevelopment = nodeEnv === 'development';
  const isProduction = nodeEnv === 'production';

  // Required secrets - must be provided (no defaults for security)
  const requiredSecrets = {
    sessionSecret: process.env.SESSION_SECRET,
    encryptionKey: process.env.ENCRYPTION_KEY,
  };

  // Validate required secrets in production
  if (isProduction) {
    const missingSecrets: string[] = [];
    
    if (!requiredSecrets.sessionSecret || requiredSecrets.sessionSecret.length < 32) {
      missingSecrets.push('SESSION_SECRET (must be at least 32 characters)');
    }
    
    if (!requiredSecrets.encryptionKey || requiredSecrets.encryptionKey.length < 32) {
      missingSecrets.push('ENCRYPTION_KEY (must be at least 32 characters)');
    }

    if (missingSecrets.length > 0) {
      throw new Error(
        `Missing or invalid required secrets in production:\n${missingSecrets.map(s => `  - ${s}`).join('\n')}\n\n` +
        'Please set these environment variables before starting the application.'
      );
    }
  }

  // Use secure defaults for development, but warn
  const sessionSecret = requiredSecrets.sessionSecret || (() => {
    if (isDevelopment) {
      console.warn('[CONFIG] ⚠️  Using insecure default SESSION_SECRET in development');
      return 'dev-session-secret-change-in-production-minimum-32-chars';
    }
    throw new Error('SESSION_SECRET is required');
  })();

  const encryptionKey = requiredSecrets.encryptionKey || (() => {
    if (isDevelopment) {
      console.warn('[CONFIG] ⚠️  Using insecure default ENCRYPTION_KEY in development');
      return 'dev-encryption-key-change-in-production-min-32-chars';
    }
    throw new Error('ENCRYPTION_KEY is required');
  })();

  // Server configuration
  const host = process.env.HOST || '0.0.0.0';
  const port = parseInt(process.env.PORT || '5000', 10);
  
  // Public URL for external links and webhooks
  const publicUrl = process.env.PUBLIC_URL || 
    (isDevelopment ? `http://localhost:${port}` : `http://${host}:${port}`);
  
  const baseDomain = process.env.BASE_DOMAIN || null;

  // Database configuration
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl && !process.env.DATABASE_PROVIDER) {
    throw new Error('DATABASE_URL or DATABASE_PROVIDER is required');
  }

  // Detect database provider
  const detectProvider = (): Config['database']['provider'] => {
    const explicitProvider = process.env.DATABASE_PROVIDER?.toLowerCase();
    if (explicitProvider) {
      return explicitProvider as Config['database']['provider'];
    }

    if (databaseUrl) {
      if (databaseUrl.startsWith('mongodb://') || databaseUrl.startsWith('mongodb+srv://')) {
        return 'mongodb';
      }
      if (databaseUrl.startsWith('mysql://')) {
        return 'mysql';
      }
      if (databaseUrl.includes('supabase.co')) {
        return 'supabase';
      }
      // Default to PostgreSQL
      return 'postgresql';
    }

    // Check for provider-specific env vars
    if (process.env.MONGODB_HOST) return 'mongodb';
    if (process.env.MYSQL_HOST) return 'mysql';
    if (process.env.SUPABASE_URL) return 'supabase';

    return 'postgresql'; // Default
  };

  const databaseProvider = detectProvider();

  const database: Config['database'] = {
    provider: databaseProvider,
    url: databaseUrl || '',
    ssl: process.env.DATABASE_SSL !== 'false',
    maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '20', 10),
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
    name: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };

  // Security configuration
  const security = {
    sessionSecret,
    encryptionKey,
    trustProxy: process.env.TRUST_PROXY === 'true' || isProduction,
  };

  // Platform-Agnostic Providers
  const providers = {
    voice: {
      provider: (process.env.VOICE_PROVIDER || 'elevenlabs') as Config['providers']['voice']['provider'],
      apiKey: process.env.ELEVENLABS_API_KEY || process.env.OPENAI_API_KEY || process.env.VOICE_API_KEY || null,
    },
    payment: {
      provider: (process.env.PAYMENT_PROVIDER || 'stripe') as Config['providers']['payment']['provider'],
      secretKey: process.env.STRIPE_SECRET_KEY || process.env.PAYMENT_SECRET_KEY || null,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || process.env.PAYMENT_WEBHOOK_SECRET || null,
    },
    llm: {
      provider: (process.env.LLM_PROVIDER || 'openai') as Config['providers']['llm']['provider'],
      apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.LLM_API_KEY || null,
      model: process.env.LLM_MODEL || 'gpt-4',
    },
    email: {
      provider: (process.env.EMAIL_PROVIDER || 'sendgrid') as Config['providers']['email']['provider'],
      apiKey: process.env.SENDGRID_API_KEY || process.env.MAILGUN_API_KEY || process.env.EMAIL_API_KEY || null,
    },
  };

  // Legacy integrations (backward compatibility)
  const integrations = {
    elevenlabs: {
      apiKey: process.env.ELEVENLABS_API_KEY || null,
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || null,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || null,
    },
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY || null,
    },
    google: {
      projectId: process.env.GOOGLE_CLOUD_PROJECT || null,
      credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || null,
    },
  };

  // Storage configuration
  const storageProvider = (process.env.STORAGE_PROVIDER || 'local') as Config['storage']['provider'];
  
  const storage: Config['storage'] = {
    provider: storageProvider,
    local: {
      uploadDir: process.env.UPLOAD_DIR || 'uploads',
      audioDir: process.env.AUDIO_DIR || 'audio-storage',
    },
  };

  // S3 storage configuration
  if (storageProvider === 's3') {
    const s3Bucket = process.env.S3_BUCKET;
    const s3Region = process.env.S3_REGION || 'us-east-1';
    const s3AccessKeyId = process.env.S3_ACCESS_KEY_ID;
    const s3SecretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

    if (!s3Bucket || !s3AccessKeyId || !s3SecretAccessKey) {
      throw new Error(
        'S3 storage requires: S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY'
      );
    }

    storage.s3 = {
      bucket: s3Bucket,
      region: s3Region,
      accessKeyId: s3AccessKeyId,
      secretAccessKey: s3SecretAccessKey,
    };
  }

  // Google Cloud Storage configuration
  if (storageProvider === 'gcs') {
    const gcsBucket = process.env.GCS_BUCKET;
    const gcsProjectId = process.env.GCS_PROJECT_ID;
    const gcsKeyFilePath = process.env.GCS_KEY_FILE_PATH;

    if (!gcsBucket || !gcsProjectId || !gcsKeyFilePath) {
      throw new Error(
        'GCS storage requires: GCS_BUCKET, GCS_PROJECT_ID, GCS_KEY_FILE_PATH'
      );
    }

    storage.gcs = {
      bucket: gcsBucket,
      projectId: gcsProjectId,
      keyFilePath: gcsKeyFilePath,
    };
  }

  // Azure Blob Storage configuration
  if (storageProvider === 'azure') {
    const azureAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    const azureAccountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
    const azureContainerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

    if (!azureAccountName || !azureAccountKey || !azureContainerName) {
      throw new Error(
        'Azure storage requires: AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY, AZURE_STORAGE_CONTAINER_NAME'
      );
    }

    storage.azure = {
      accountName: azureAccountName,
      accountKey: azureAccountKey,
      containerName: azureContainerName,
    };
  }

  // Log configuration status (without sensitive values)
  console.log('[CONFIG] Environment:', nodeEnv);
  console.log('[CONFIG] Server:', `${host}:${port}`);
  console.log('[CONFIG] Public URL:', publicUrl);
  console.log('[CONFIG]');
  console.log('[CONFIG] ╔══════════════════════════════════════════╗');
  console.log('[CONFIG] ║   Platform-Agnostic Providers Status    ║');
  console.log('[CONFIG] ╠══════════════════════════════════════════╣');
  console.log(`[CONFIG] ║ Voice    : ${providers.voice.provider.padEnd(15)} ${providers.voice.apiKey ? '✓' : '✗'} ║`);
  console.log(`[CONFIG] ║ Payment  : ${providers.payment.provider.padEnd(15)} ${providers.payment.secretKey ? '✓' : '✗'} ║`);
  console.log(`[CONFIG] ║ LLM      : ${providers.llm.provider.padEnd(15)} ${providers.llm.apiKey ? '✓' : '✗'} ║`);
  console.log(`[CONFIG] ║ Email    : ${providers.email.provider.padEnd(15)} ${providers.email.apiKey ? '✓' : '✗'} ║`);
  console.log(`[CONFIG] ║ Database : ${databaseProvider.padEnd(15)} ✓ ║`);
  console.log(`[CONFIG] ║ Storage  : ${storageProvider.padEnd(15)} ✓ ║`);
  console.log('[CONFIG] ╚══════════════════════════════════════════╝');

  return {
    nodeEnv,
    isDevelopment,
    isProduction,
    host,
    port,
    publicUrl,
    baseDomain,
    database,
    security,
    providers,
    integrations, // Legacy support
    storage,
  };
}

// Export singleton configuration
export const config = loadConfig();

// Export type for use in other modules
export type AppConfig = typeof config;
