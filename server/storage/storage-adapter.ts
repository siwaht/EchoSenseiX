/**
 * Storage Adapter Interface
 * 
 * Platform-agnostic storage abstraction for audio files and uploads.
 * Supports local filesystem, AWS S3, Google Cloud Storage, and Azure Blob Storage.
 */

export interface StorageMetadata {
  contentType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
}

export interface StorageAdapter {
  /**
   * Save a file to storage
   * @param key - Unique identifier for the file
   * @param buffer - File content as Buffer
   * @param metadata - Optional metadata for the file
   * @returns The storage key (path or URL)
   */
  save(key: string, buffer: Buffer, metadata?: StorageMetadata): Promise<string>;

  /**
   * Retrieve a file from storage
   * @param key - Unique identifier for the file
   * @returns File content as Buffer
   */
  get(key: string): Promise<Buffer>;

  /**
   * Delete a file from storage
   * @param key - Unique identifier for the file
   */
  delete(key: string): Promise<void>;

  /**
   * Check if a file exists in storage
   * @param key - Unique identifier for the file
   * @returns True if file exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get a public URL for a file (if supported)
   * @param key - Unique identifier for the file
   * @returns Public URL or null if not supported
   */
  getPublicUrl(key: string): string | null;

  /**
   * Get a signed/temporary URL for a file (if supported)
   * @param key - Unique identifier for the file
   * @param expiresIn - Expiration time in seconds
   * @returns Signed URL or null if not supported
   */
  getSignedUrl(key: string, expiresIn?: number): Promise<string | null>;
}
