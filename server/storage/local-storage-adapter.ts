import * as fs from 'fs/promises';
import * as path from 'path';
import type { StorageAdapter, StorageMetadata } from './storage-adapter';

/**
 * Local Filesystem Storage Adapter
 * 
 * Stores files on the local filesystem. Suitable for:
 * - Development environments
 * - Single-server deployments
 * - Testing
 * 
 * Not recommended for:
 * - Multi-server/containerized deployments
 * - Serverless environments
 * - High-availability production systems
 */
export class LocalStorageAdapter implements StorageAdapter {
  constructor(private baseDir: string) {
    // Ensure base directory exists
    this.ensureDirectoryExists(baseDir);
  }

  private async ensureDirectoryExists(dir: string): Promise<void> {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async save(key: string, buffer: Buffer, metadata?: StorageMetadata): Promise<string> {
    const filePath = path.join(this.baseDir, key);
    const dir = path.dirname(filePath);

    // Ensure directory exists
    await this.ensureDirectoryExists(dir);

    // Save file
    await fs.writeFile(filePath, buffer);

    // Save metadata if provided
    if (metadata) {
      const metaPath = `${filePath}.meta.json`;
      await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));
    }

    return key;
  }

  async get(key: string): Promise<Buffer> {
    const filePath = path.join(this.baseDir, key);
    return await fs.readFile(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.baseDir, key);
    const metaPath = `${filePath}.meta.json`;

    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
    }

    try {
      await fs.unlink(metaPath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = path.join(this.baseDir, key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getPublicUrl(key: string): string | null {
    // Local storage doesn't provide public URLs
    // Files must be served through the application
    return `/api/audio/${key}`;
  }

  async getSignedUrl(key: string, _expiresIn: number = 3600): Promise<string | null> {
    // Local storage doesn't support signed URLs
    // Return the same as public URL
    return this.getPublicUrl(key);
  }

  /**
   * Get the absolute file path for a given key
   * Useful for serving files directly with res.sendFile()
   */
  getFilePath(key: string): string {
    return path.join(this.baseDir, key);
  }

  /**
   * Validate that a key is safe (prevents path traversal)
   */
  static isValidKey(key: string): boolean {
    // Prevent path traversal
    const normalizedKey = path.normalize(key);
    return !normalizedKey.includes('..') && !path.isAbsolute(normalizedKey);
  }
}
