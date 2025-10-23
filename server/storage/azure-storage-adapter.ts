import { StorageAdapter, StorageMetadata } from './storage-adapter';

/**
 * Azure Blob Storage adapter implementation
 */
export class AzureStorageAdapter implements StorageAdapter {
  private blobServiceClient: any;
  private containerClient: any;
  private containerName: string;

  constructor(config: {
    accountName: string;
    accountKey: string;
    containerName: string;
  }) {
    this.containerName = config.containerName;
    
    try {
      const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');
      
      const sharedKeyCredential = new StorageSharedKeyCredential(
        config.accountName,
        config.accountKey
      );
      
      this.blobServiceClient = new BlobServiceClient(
        `https://${config.accountName}.blob.core.windows.net`,
        sharedKeyCredential
      );
      
      this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      
      console.log(`[AZURE-STORAGE] Initialized Azure Blob Storage client for container: ${this.containerName}`);
      console.log('[AZURE-STORAGE] Note: Ensure the container exists before use');
    } catch (error) {
      throw new Error(
        'Azure Storage SDK not installed. Run: npm install @azure/storage-blob'
      );
    }
  }

  async save(key: string, buffer: Buffer, metadata?: StorageMetadata): Promise<string> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(key);
    
    await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: {
        blobContentType: metadata?.contentType || 'application/octet-stream',
        blobCacheControl: metadata?.cacheControl || 'public, max-age=31536000',
      },
      metadata: metadata?.metadata,
    });

    return key;
  }

  async get(key: string): Promise<Buffer> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(key);
    const downloadResponse = await blockBlobClient.download(0);
    
    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download blob');
    }

    const chunks: Buffer[] = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(Buffer.from(chunk));
    }
    
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(key);
    await blockBlobClient.delete();
  }

  async exists(key: string): Promise<boolean> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(key);
    return await blockBlobClient.exists();
  }

  getPublicUrl(key: string): string | null {
    const blockBlobClient = this.containerClient.getBlockBlobClient(key);
    return blockBlobClient.url;
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string | null> {
    const { BlobSASPermissions, generateBlobSASQueryParameters, StorageSharedKeyCredential } = await import('@azure/storage-blob');
    
    const blockBlobClient = this.containerClient.getBlockBlobClient(key);
    
    const sasOptions = {
      containerName: this.containerName,
      blobName: key,
      permissions: BlobSASPermissions.parse('r'),
      startsOn: new Date(),
      expiresOn: new Date(Date.now() + expiresIn * 1000),
    };

    // Note: This requires the credential from initialization
    // For production, consider using managed identity or SAS token delegation
    const sasToken = generateBlobSASQueryParameters(
      sasOptions,
      this.blobServiceClient.credential
    ).toString();

    return `${blockBlobClient.url}?${sasToken}`;
  }
}
