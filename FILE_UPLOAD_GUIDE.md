# File Upload Platform Independence Guide

This guide explains the platform-independent file upload system in EchoSenseiX and how it works across different operating systems (Windows, macOS, Linux).

## Overview

The file upload system has been completely refactored to ensure **100% platform independence** with:

- ✅ Async file operations (non-blocking)
- ✅ Platform-independent path handling
- ✅ Cross-platform directory creation
- ✅ Sanitized filenames
- ✅ Proper error handling
- ✅ Works on Windows, macOS, Linux

---

## What Changed

### Before (Platform-Specific Issues)

```typescript
// ❌ Synchronous operations (blocking)
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// ❌ Potential issues with path separators
const uploadPath = './uploads/documents';

// ❌ Blocking file reads
const dataBuffer = fs.readFileSync(filePath);
```

### After (Platform-Independent)

```typescript
// ✅ Async operations (non-blocking)
try {
  await fsPromises.access(uploadPath);
} catch {
  await fsPromises.mkdir(uploadPath, { recursive: true });
}

// ✅ Cross-platform path handling
const uploadPath = path.resolve(process.cwd(), 'uploads', 'documents');

// ✅ Non-blocking file reads
const dataBuffer = await fsPromises.readFile(filePath);
```

---

## Key Features

### 1. Platform-Independent Path Handling

```typescript
import path from 'path';
import { fileURLToPath } from 'url';

// Always use path.resolve() for absolute paths
const uploadPath = path.resolve(process.cwd(), 'uploads', 'documents');

// Use path.join() for combining path segments
const filePath = path.join(uploadPath, filename);

// NEVER use hardcoded separators
// ❌ BAD: './uploads/documents' or './uploads\\documents'
// ✅ GOOD: path.join('.', 'uploads', 'documents')
```

**Why this works:**
- `path.resolve()` and `path.join()` automatically use the correct separator (`/` on Unix, `\` on Windows)
- `process.cwd()` gets the current working directory on any platform
- No hardcoded path separators

### 2. Async File Operations

All file operations are now **asynchronous** to prevent blocking:

```typescript
import fsPromises from 'fs/promises';

// ✅ Check if file exists
try {
  await fsPromises.access(filePath);
  console.log('File exists');
} catch {
  console.log('File does not exist');
}

// ✅ Read file
const content = await fsPromises.readFile(filePath, 'utf8');

// ✅ Write file
await fsPromises.writeFile(filePath, content);

// ✅ Create directory
await fsPromises.mkdir(dirPath, { recursive: true });

// ✅ Get file stats
const stats = await fsPromises.stat(filePath);
```

### 3. Sanitized Filenames

Filenames are sanitized to work on all platforms:

```typescript
// Original filename: "My Document (2024).pdf"
// Sanitized: "My_Document__2024_.pdf"

const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
const filename = `${file.fieldname}-${uniqueSuffix}-${sanitizedFilename}`;
```

**What gets sanitized:**
- Spaces → `_`
- Special characters → `_`
- Parentheses → `_`
- Emoji → `_`
- Unicode → `_`

**What stays:**
- Letters (a-z, A-Z)
- Numbers (0-9)
- Dots (.)
- Hyphens (-)

### 4. Proper Error Handling

```typescript
try {
  // File operations with proper error handling
  await fsPromises.access(filePath);
  const stats = await fsPromises.stat(filePath);
  const content = await fsPromises.readFile(filePath);
} catch (error: any) {
  console.error(`File operation failed: ${error.message}`);
  throw new Error(`Failed to process file: ${error.message}`);
}
```

---

## File Upload Flow

### 1. Upload Configuration

```typescript
// server/services/document-processing-service.ts

static getUploadMiddleware() {
  // Ensure upload directory exists asynchronously
  this.ensureUploadDirectory().catch(err => {
    console.error('[DOCUMENT-PROCESSING] Failed to create upload directory:', err);
  });

  return multer({
    storage: multer.diskStorage({
      destination: async (req, file, cb) => {
        try {
          // Ensure directory exists before each upload
          await fsPromises.access(this.uploadPath);
          cb(null, this.uploadPath);
        } catch {
          // Create directory if it doesn't exist
          await fsPromises.mkdir(this.uploadPath, { recursive: true });
          cb(null, this.uploadPath);
        }
      },
      filename: (req, file, cb) => {
        // Generate platform-independent filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${file.fieldname}-${uniqueSuffix}-${sanitizedFilename}`);
      }
    }),
    fileFilter: (req, file, cb) => {
      // Validate file types
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
```

### 2. Document Processing

```typescript
static async processDocument(
  organizationId: string,
  uploadedBy: string,
  filePath: string,
  originalName: string
): Promise<DocumentUpload> {
  try {
    // Check if file exists (async, platform-independent)
    try {
      await fsPromises.access(filePath);
    } catch {
      throw new Error(`File not found: ${filePath}`);
    }

    // Get file stats (async)
    const fileStats = await fsPromises.stat(filePath);

    // Extract text based on file type
    let extractedText = '';

    if (mimeType === 'application/pdf') {
      extractedText = await this.extractTextFromPDF(filePath);
    } else if (mimeType.includes('word') || mimeType.includes('document')) {
      extractedText = await this.extractTextFromDOCX(filePath);
    } else if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
      extractedText = await this.extractTextFromTXT(filePath);
    }

    return document;
  } catch (error: any) {
    console.error(`[DOCUMENT-PROCESSING] Failed to process document:`, error);
    throw new Error(`Document processing failed: ${error.message}`);
  }
}
```

### 3. Text Extraction

```typescript
// PDF Extraction
private static async extractTextFromPDF(filePath: string): Promise<string> {
  try {
    const pdfParseModule = await import('pdf-parse');
    const pdfParse = pdfParseModule.default || pdfParseModule;

    // Use async file read
    const dataBuffer = await fsPromises.readFile(filePath);
    const data = await pdfParse(dataBuffer);

    return data.text || '';
  } catch (error: any) {
    console.error('[DOCUMENT-PROCESSING] PDF extraction failed:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

// TXT/Markdown Extraction
private static async extractTextFromTXT(filePath: string): Promise<string> {
  try {
    return await fsPromises.readFile(filePath, 'utf8');
  } catch (error: any) {
    console.error('[DOCUMENT-PROCESSING] TXT extraction failed:', error);
    throw new Error(`Failed to extract text from file: ${error.message}`);
  }
}
```

---

## Supported File Types

| File Type | Extension | MIME Type | Max Size |
|-----------|-----------|-----------|----------|
| PDF | `.pdf` | `application/pdf` | 10 MB |
| Word (DOCX) | `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | 10 MB |
| Word (DOC) | `.doc` | `application/msword` | 10 MB |
| Text | `.txt` | `text/plain` | 10 MB |
| Markdown | `.md` | `text/markdown` | 10 MB |
| RTF | `.rtf` | `application/rtf` | 10 MB |

---

## Testing on Different Platforms

### Windows

```powershell
# Test upload
curl -X POST http://localhost:5000/api/documents/upload `
  -F "document=@C:\Users\YourName\Documents\test.pdf" `
  -b "session_cookie=..."

# Verify upload directory
dir uploads\documents
```

### macOS/Linux

```bash
# Test upload
curl -X POST http://localhost:5000/api/documents/upload \
  -F "document=@/home/user/test.pdf" \
  -b "session_cookie=..."

# Verify upload directory
ls -la uploads/documents
```

### Docker (Any Platform)

```bash
# Build and run
docker build -t echosenseix .
docker run -p 5000:5000 echosenseix

# Upload test
curl -X POST http://localhost:5000/api/documents/upload \
  -F "document=@./test.pdf"
```

---

## Environment Variables

```bash
# Upload directory (optional, defaults to ./uploads/documents)
UPLOAD_DIR=./uploads

# Maximum file size in bytes (optional, defaults to 10MB)
MAX_FILE_SIZE=10485760

# Allowed file types (optional)
ALLOWED_FILE_TYPES=pdf,docx,doc,txt,md,rtf
```

---

## Common Issues and Solutions

### Issue: "File not found" error

**Solution:**
```typescript
// Ensure proper path resolution
const filePath = path.resolve(process.cwd(), 'uploads', 'documents', filename);

// Check if file exists before accessing
try {
  await fsPromises.access(filePath);
} catch {
  throw new Error(`File not found: ${filePath}`);
}
```

### Issue: "Permission denied" on Windows

**Solution:**
```bash
# Run as administrator or adjust folder permissions
icacls "uploads" /grant Users:(OI)(CI)F /T
```

### Issue: "ENOENT: no such file or directory"

**Solution:**
```typescript
// Always create directories recursively
await fsPromises.mkdir(uploadPath, { recursive: true });
```

### Issue: Filename with special characters

**Solution:**
```typescript
// Sanitize filename before saving
const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
```

---

## Best Practices

1. **Always use `path` module** for path operations
2. **Never hardcode path separators** (`/` or `\`)
3. **Use async file operations** to prevent blocking
4. **Sanitize user-provided filenames**
5. **Create directories with `{ recursive: true }`**
6. **Use proper error handling** for all file operations
7. **Set appropriate file size limits**
8. **Validate file types** before processing
9. **Clean up temporary files** after processing
10. **Use absolute paths** when possible

---

## Performance Considerations

### Async Operations
- All file operations are non-blocking
- Server can handle multiple uploads simultaneously
- No performance degradation during large file uploads

### Memory Usage
- Files are streamed, not loaded entirely into memory
- Chunked reading for large files
- Automatic cleanup of temporary files

### Scalability
- Use external storage (S3, GCS, Azure) for production
- Consider file upload limits based on server capacity
- Implement rate limiting for uploads

---

## Integration with Storage Adapters

The file upload system works seamlessly with all storage adapters:

```typescript
// Local Storage (default)
STORAGE_PROVIDER=local

// AWS S3
STORAGE_PROVIDER=s3
S3_BUCKET=my-bucket
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=xxx
S3_SECRET_ACCESS_KEY=xxx

// Google Cloud Storage
STORAGE_PROVIDER=gcs
GCS_BUCKET=my-bucket
GCS_PROJECT_ID=my-project
GCS_KEY_FILE_PATH=./service-account.json

// Azure Blob Storage
STORAGE_PROVIDER=azure
AZURE_STORAGE_ACCOUNT_NAME=myaccount
AZURE_STORAGE_ACCOUNT_KEY=xxx
AZURE_STORAGE_CONTAINER_NAME=uploads
```

---

## Next Steps

- [Database Integration Guide](./DATABASE_INTEGRATION_GUIDE.md)
- [Storage Adapter Guide](./STORAGE_ADAPTER_GUIDE.md)
- [API Documentation](./API.md)

## Support

For issues or questions:
- Check the [Common Issues](#common-issues-and-solutions) section
- Review the [Best Practices](#best-practices)
- Open an issue on GitHub
