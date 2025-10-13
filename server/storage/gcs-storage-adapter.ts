import { StorageAdapter, StorageMetadata } from './storage-adapter';

/**
 * Google Cloud Storage adapter implementation
 */
export class GCSStorageAdapter implements StorageAdapter {
  private storage: any;
  private bucket: any;
  private bucketName: string;

  constructor(config: {
    bucket: string;
    projectId: string;
    keyFilePath: string;
  }) {
    this.bucketName = config.bucket;
    
    try {
      const { Storage } = require('@google-cloud/storage');
      
      this.storage = new Storage({
        projectId: config.projectId,
        keyFilename: config.keyFilePath,
      });
      
      this.bucket = this.storage.bucket(this.bucketName);
      
      console.log(`[GCS-STORAGE] Initialized GCS client for bucket: ${this.bucketName}`);
    } catch (error) {
      throw new Error(
        'Google Cloud Storage SDK not installed. Run: npm install @google-cloud/storage'
      );
    }
  }

  async save(key: string, buffer: Buffer, metadata?: StorageMetadata): Promise<string> {
    const file = this.bucket.file(key);
    
    await file.save(buffer, {
      metadata: {
        contentType: metadata?.contentType || 'application/octet-stream',
        cacheControl: metadata?.cacheControl || 'public, max-age=31536000',
        metadata: metadata?.metadata,
      },
      resumable: false,
    });

    return key;
  }

  async get(key: string): Promise<Buffer> {
    const file = this.bucket.file(key);
    const [contents] = await file.download();
    return contents;
  }

  async delete(key: string): Promise<void> {
    const file = this.bucket.file(key);
    await file.delete();
  }

  async exists(key: string): Promise<boolean> {
    const file = this.bucket.file(key);
    const [exists] = await file.exists();
    return exists;
  }

  getPublicUrl(key: string): string | null {
    // Return public URL if bucket is public
    return `https://storage.googleapis.com/${this.bucketName}/${key}`;
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string | null> {
    const file = this.bucket.file(key);
    
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresIn * 1000,
    });

    return url;
  }
}
