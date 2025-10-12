import type { StorageAdapter, StorageMetadata } from './storage-adapter';

/**
 * AWS S3 Storage Adapter
 * 
 * Stores files in Amazon S3. Suitable for:
 * - Production deployments on AWS
 * - Multi-server/containerized environments
 * - High-availability systems
 * - Serverless architectures (Lambda, ECS, Fargate)
 * 
 * Requires AWS SDK to be installed: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 */
export class S3StorageAdapter implements StorageAdapter {
  private s3Client: any;
  private bucket: string;

  constructor(config: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  }) {
    this.bucket = config.bucket;
    
    // Lazy load AWS SDK (only if using S3)
    this.initializeS3Client(config);
  }

  private async initializeS3Client(config: any) {
    try {
      const { S3Client } = await import('@aws-sdk/client-s3');
      
      this.s3Client = new S3Client({
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
      
      console.log(`[S3-STORAGE] Initialized S3 client for bucket: ${this.bucket}`);
    } catch (error) {
      throw new Error(
        'AWS SDK not installed. Run: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner'
      );
    }
  }

  async save(key: string, buffer: Buffer, metadata?: StorageMetadata): Promise<string> {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: metadata?.contentType || 'application/octet-stream',
      CacheControl: metadata?.cacheControl,
      Metadata: metadata?.metadata,
    });

    await this.s3Client.send(command);
    return key;
  }

  async get(key: string): Promise<Buffer> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    const chunks: Uint8Array[] = [];
    
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  async exists(key: string): Promise<boolean> {
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
    
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      
      await this.s3Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  getPublicUrl(key: string): string | null {
    // Return the standard S3 URL (works if bucket is public)
    const region = this.s3Client.config.region;
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string | null> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }
}
