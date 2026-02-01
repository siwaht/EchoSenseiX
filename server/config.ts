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
    url: string;
    ssl: boolean;
    maxConnections: number;
    minConnections: number;
  };
  
  // Security & Auth
  security: {
    sessionSecret: string;
    encryptionKey: string;
    trustProxy: boolean;
  };
  
  // External Services
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
      // Use console.warn here as logger may not be initialized yet
      console.warn('[CONFIG] Using insecure default SESSION_SECRET in development');
      return 'dev-session-secret-change-in-production-minimum-32-chars';
    }
    throw new Error('SESSION_SECRET is required');
  })();

  const encryptionKey = requiredSecrets.encryptionKey || (() => {
    if (isDevelopment) {
      console.warn('[CONFIG] Using insecure default ENCRYPTION_KEY in development');
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
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const database = {
    url: databaseUrl,
    ssl: process.env.DATABASE_SSL === 'true' || isProduction,
    maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '50', 10),
    minConnections: parseInt(process.env.DATABASE_MIN_CONNECTIONS || '5', 10),
  };

  // Security configuration
  const security = {
    sessionSecret,
    encryptionKey,
    trustProxy: process.env.TRUST_PROXY === 'true' || isProduction,
  };

  // External integrations (optional, can be configured later)
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
  console.log('[CONFIG] Database:', databaseUrl.split('@')[1] || 'configured');
  console.log('[CONFIG] Storage provider:', storageProvider);
  
  if (integrations.elevenlabs.apiKey) {
    console.log('[CONFIG] ✓ ElevenLabs API key configured');
  }
  if (integrations.stripe.secretKey) {
    console.log('[CONFIG] ✓ Stripe configured');
  }

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
    integrations,
    storage,
  };
}

// Export singleton configuration
export const config = loadConfig();

// Export type for use in other modules
export type AppConfig = typeof config;
