import { config } from '../config';
import type { StorageAdapter } from './storage-adapter';
import { LocalStorageAdapter } from './local-storage-adapter';

/**
 * Storage Factory
 * 
 * Creates and returns the appropriate storage adapter based on configuration.
 * Supports lazy loading of cloud SDKs to avoid bundling unnecessary dependencies.
 */
export class StorageFactory {
  private static instance: StorageAdapter | null = null;

  /**
   * Get the configured storage adapter (singleton)
   */
  static getAdapter(): StorageAdapter {
    if (this.instance) {
      return this.instance;
    }

    const { storage } = config;

    switch (storage.provider) {
      case 'local':
        console.log('[STORAGE] Using local filesystem storage');
        this.instance = new LocalStorageAdapter(storage.local.audioDir);
        break;

      case 's3':
        if (!storage.s3) {
          throw new Error('S3 configuration is missing');
        }
        console.log('[STORAGE] Using AWS S3 storage');
        this.instance = this.createS3Adapter(storage.s3);
        break;

      case 'gcs':
        if (!storage.gcs) {
          throw new Error('GCS configuration is missing');
        }
        console.log('[STORAGE] Using Google Cloud Storage');
        this.instance = this.createGCSAdapter(storage.gcs);
        break;

      case 'azure':
        if (!storage.azure) {
          throw new Error('Azure configuration is missing');
        }
        console.log('[STORAGE] Using Azure Blob Storage');
        this.instance = this.createAzureAdapter(storage.azure);
        break;

      default:
        throw new Error(`Unknown storage provider: ${storage.provider}`);
    }

    return this.instance;
  }

  private static createS3Adapter(config: NonNullable<typeof config.storage.s3>): StorageAdapter {
    const { S3StorageAdapter } = require('./s3-storage-adapter');
    return new S3StorageAdapter(config);
  }

  private static createGCSAdapter(config: NonNullable<typeof config.storage.gcs>): StorageAdapter {
    const { GCSStorageAdapter } = require('./gcs-storage-adapter');
    return new GCSStorageAdapter(config);
  }

  private static createAzureAdapter(config: NonNullable<typeof config.storage.azure>): StorageAdapter {
    const { AzureStorageAdapter } = require('./azure-storage-adapter');
    return new AzureStorageAdapter(config);
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static reset(): void {
    this.instance = null;
  }
}

/**
 * Get the configured storage adapter
 */
export function getStorageAdapter(): StorageAdapter {
  return StorageFactory.getAdapter();
}
