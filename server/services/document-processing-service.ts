/**
 * Document Processing Service
 * 
 * Handles document uploads, text extraction, and integration with ElevenLabs
 * Supports PDF, DOCX, TXT, and other document formats
 */

import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { storage } from '../storage';
import { createElevenLabsClient } from './elevenlabs';
import { KnowledgeBaseService } from './knowledge-base-service';

export interface DocumentUpload {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  organizationId: string;
  uploadedBy: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  extractedText?: string;
  knowledgeEntries?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class DocumentProcessingService {
  private static uploadPath = path.resolve('./uploads/documents');

  /**
   * Configure multer for document uploads
   */
  static getUploadMiddleware() {
    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
    }

    return multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          cb(null, this.uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname);
        }
      }),
      fileFilter: (req, file, cb) => {
        // Allow common document formats
        const allowedTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'text/markdown',
          'application/rtf'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Unsupported file type. Please upload PDF, DOCX, TXT, or RTF files.'));
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
      }
    });
  }

  /**
   * Process uploaded document and extract text
   */
  static async processDocument(
    organizationId: string,
    uploadedBy: string,
    filePath: string,
    originalName: string
  ): Promise<DocumentUpload> {
    try {
      console.log(`[DOCUMENT-PROCESSING] Processing document: ${originalName}`);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Get file stats
      const fileStats = fs.statSync(filePath);
      
      const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const document: DocumentUpload = {
        id: documentId,
        filename: filePath,
        originalName,
        mimeType: this.getMimeType(originalName),
        size: fileStats.size,
        organizationId,
        uploadedBy,
        status: 'processing',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Extract text based on file type
      let extractedText = '';
      const mimeType = document.mimeType;

      if (mimeType === 'application/pdf') {
        extractedText = await this.extractTextFromPDF(filePath);
      } else if (mimeType.includes('word') || mimeType.includes('document')) {
        extractedText = await this.extractTextFromDOCX(filePath);
      } else if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
        extractedText = await this.extractTextFromTXT(filePath);
      } else {
        throw new Error(`Unsupported file type: ${mimeType}`);
      }

      document.extractedText = extractedText;
      document.status = 'completed';

      // Split text into knowledge base entries
      const knowledgeEntries = await this.splitTextIntoEntries(extractedText, originalName);
      document.knowledgeEntries = knowledgeEntries;

      // Add entries to knowledge base
      for (const entry of knowledgeEntries) {
        await KnowledgeBaseService.addKnowledgeEntry(organizationId, {
          title: entry.title,
          content: entry.content,
          category: 'Uploaded Documents',
          tags: ['document-upload', 'auto-generated', originalName.replace(/\.[^/.]+$/, "")]
        });
      }

      console.log(`[DOCUMENT-PROCESSING] Processed ${knowledgeEntries.length} knowledge entries from ${originalName}`);
      
      return document;

    } catch (error: any) {
      console.error(`[DOCUMENT-PROCESSING] Failed to process document:`, error);
      throw new Error(`Document processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from PDF files
   */
  private static async extractTextFromPDF(filePath: string): Promise<string> {
    try {
      // Using pdf-parse library for PDF text extraction
      const pdfParseModule = await import('pdf-parse');
      const pdfParse = pdfParseModule.default || pdfParseModule;
      
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      
      return data.text || '';
    } catch (error: any) {
      console.error('[DOCUMENT-PROCESSING] PDF extraction failed:', error);
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }

  /**
   * Extract text from DOCX files
   */
  private static async extractTextFromDOCX(filePath: string): Promise<string> {
    try {
      // Using mammoth library for DOCX text extraction
      const mammoth = await import('mammoth');
      
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || '';
    } catch (error) {
      console.error('[DOCUMENT-PROCESSING] DOCX extraction failed:', error);
      throw new Error(`Failed to extract text from DOCX: ${error.message}`);
    }
  }

  /**
   * Extract text from TXT/Markdown files
   */
  private static async extractTextFromTXT(filePath: string): Promise<string> {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      console.error('[DOCUMENT-PROCESSING] TXT extraction failed:', error);
      throw new Error(`Failed to extract text from file: ${error.message}`);
    }
  }

  /**
   * Split extracted text into meaningful knowledge base entries
   */
  private static async splitTextIntoEntries(text: string, originalName: string): Promise<Array<{title: string, content: string}>> {
    try {
      // Use ElevenLabs AI to intelligently split document into knowledge entries
      // For now, implement a simple splitting strategy
      
      const entries: Array<{title: string, content: string}> = [];
      
      // Split by common document structures
      const sections = text.split(/\n\s*(?=[A-Z][^a-z]*\n|#{1,6}\s|\d+\.\s)/);
      
      sections.forEach((section, index) => {
        const trimmedSection = section.trim();
        if (trimmedSection.length > 100) { // Only include substantial sections
          const title = this.extractTitle(trimmedSection, originalName, index);
          entries.push({
            title,
            content: trimmedSection
          });
        }
      });

      // If no clear sections found, create one entry per page/chunk
      if (entries.length === 0) {
        const chunks = this.chunkText(text, 2000); // 2000 character chunks
        chunks.forEach((chunk, index) => {
          entries.push({
            title: `${originalName} - Section ${index + 1}`,
            content: chunk
          });
        });
      }

      return entries;
    } catch (error) {
      console.error('[DOCUMENT-PROCESSING] Text splitting failed:', error);
      // Fallback: create single entry
      return [{
        title: originalName.replace(/\.[^/.]+$/, ""),
        content: text.substring(0, 5000) // Limit content length
      }];
    }
  }

  /**
   * Extract title from text section
   */
  private static extractTitle(text: string, originalName: string, index: number): string {
    // Try to find a title in the first few lines
    const lines = text.split('\n').slice(0, 3);
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 10 && trimmed.length < 100 && !trimmed.match(/^\d+\./)) {
        return trimmed;
      }
    }
    
    return `${originalName.replace(/\.[^/.]+$/, "")} - Section ${index + 1}`;
  }

  /**
   * Split text into chunks
   */
  private static chunkText(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      let end = start + chunkSize;
      
      // Try to break at sentence boundary
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end);
        const lastNewline = text.lastIndexOf('\n', end);
        const breakPoint = Math.max(lastPeriod, lastNewline);
        
        if (breakPoint > start + chunkSize * 0.5) {
          end = breakPoint + 1;
        }
      }
      
      chunks.push(text.slice(start, end).trim());
      start = end;
    }
    
    return chunks.filter(chunk => chunk.length > 50);
  }

  /**
   * Get MIME type from filename
   */
  private static getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    
    switch (ext) {
      case 'pdf': return 'application/pdf';
      case 'doc': return 'application/msword';
      case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'txt': return 'text/plain';
      case 'md': return 'text/markdown';
      case 'rtf': return 'application/rtf';
      default: return 'application/octet-stream';
    }
  }

  /**
   * Upload document to ElevenLabs (if they support document storage)
   */
  static async uploadToElevenLabs(
    organizationId: string,
    document: DocumentUpload
  ): Promise<boolean> {
    try {
      console.log(`[DOCUMENT-PROCESSING] Attempting to upload to ElevenLabs: ${document.originalName}`);
      
      // Note: ElevenLabs doesn't currently have a direct document upload API
      // This is a placeholder for future implementation
      // For now, we process the text content and use it in conversations
      
      const integration = await storage.getIntegration(organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        throw new Error("ElevenLabs integration not configured");
      }

      const client = createElevenLabsClient(integration.apiKey);
      
      // Since ElevenLabs doesn't support direct document upload,
      // we enhance the agent with the extracted knowledge
      console.log(`[DOCUMENT-PROCESSING] Document content integrated with ElevenLabs via knowledge base`);
      
      return true;
    } catch (error: any) {
      console.error(`[DOCUMENT-PROCESSING] ElevenLabs upload failed:`, error);
      return false;
    }
  }

  /**
   * Get processing status
   */
  static async getProcessingStatus(documentId: string): Promise<DocumentUpload | null> {
    try {
      // TODO: Implement database storage for document processing status
      // For now, return a mock status
      return null;
    } catch (error) {
      console.error(`[DOCUMENT-PROCESSING] Failed to get status:`, error);
      return null;
    }
  }
}

export default DocumentProcessingService;
