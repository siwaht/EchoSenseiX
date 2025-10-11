import { promises as fs } from 'fs';
import path from 'path';

export interface AudioMetadata {
  conversationId: string;
  callId?: string;
  organizationId?: string;
  agentId?: string;
  uploadedAt: string;
  fileSize: number;
  duration?: number;
  format?: string;
}

class AudioStorageService {
  private storageDir: string;

  constructor(storageDir: string = 'audio-storage') {
    this.storageDir = storageDir;
    this.ensureStorageDirectory();
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.access(this.storageDir);
    } catch {
      await fs.mkdir(this.storageDir, { recursive: true });
      console.log(`Created audio storage directory: ${this.storageDir}`);
    }
  }

  private sanitizeFileName(filename: string): string {
    // Remove any path traversal attempts and keep only safe characters
    return filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  }

  private generateStorageKey(conversationId: string): string {
    const timestamp = Date.now();
    const sanitizedId = this.sanitizeFileName(conversationId);
    return `${sanitizedId}_${timestamp}.mp3`;
  }

  private getFilePath(storageKey: string): string {
    const sanitizedKey = this.sanitizeFileName(storageKey);
    return path.join(this.storageDir, sanitizedKey);
  }

  private getMetadataPath(storageKey: string): string {
    return `${this.getFilePath(storageKey)}.meta.json`;
  }

  /**
   * Upload audio file to storage
   */
  async uploadAudio(
    conversationId: string,
    audioBuffer: Buffer,
    metadata: Partial<AudioMetadata> = {}
  ): Promise<{ storageKey: string; filePath: string }> {
    await this.ensureStorageDirectory();

    const storageKey = this.generateStorageKey(conversationId);
    const filePath = this.getFilePath(storageKey);

    // Write audio file
    await fs.writeFile(filePath, audioBuffer);
    console.log(`Audio uploaded: ${filePath} (${audioBuffer.length} bytes)`);

    // Write metadata
    const fullMetadata: AudioMetadata = {
      conversationId,
      uploadedAt: new Date().toISOString(),
      fileSize: audioBuffer.length,
      ...metadata,
    };

    await fs.writeFile(
      this.getMetadataPath(storageKey),
      JSON.stringify(fullMetadata, null, 2)
    );

    return { storageKey, filePath };
  }

  /**
   * Get public URL for audio file
   */
  getSignedUrl(storageKey: string): string {
    const sanitizedKey = this.sanitizeFileName(storageKey);
    return `/api/audio/${sanitizedKey}`;
  }

  /**
   * Check if audio file exists
   */
  async audioExists(storageKey: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(storageKey);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Download audio file
   */
  async downloadAudio(storageKey: string): Promise<Buffer> {
    const filePath = this.getFilePath(storageKey);
    return await fs.readFile(filePath);
  }

  /**
   * Delete audio file and its metadata
   */
  async deleteAudio(storageKey: string): Promise<void> {
    const filePath = this.getFilePath(storageKey);
    const metadataPath = this.getMetadataPath(storageKey);

    try {
      await fs.unlink(filePath);
      console.log(`Deleted audio file: ${filePath}`);
    } catch (error) {
      console.error(`Failed to delete audio file: ${filePath}`, error);
    }

    try {
      await fs.unlink(metadataPath);
      console.log(`Deleted metadata file: ${metadataPath}`);
    } catch (error) {
      // Metadata file might not exist, which is fine
    }
  }

  /**
   * Get audio metadata
   */
  async getAudioMetadata(storageKey: string): Promise<AudioMetadata | null> {
    try {
      const metadataPath = this.getMetadataPath(storageKey);
      const data = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * List all audio files in storage
   */
  async listAudioFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.storageDir);
      return files.filter(file => file.endsWith('.mp3'));
    } catch {
      return [];
    }
  }
}

export default AudioStorageService;
