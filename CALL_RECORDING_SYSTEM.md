# Call Recording Retrieval and Storage System - Implementation Complete

## Overview
Successfully implemented a complete 3-tier call recording retrieval and storage system with automatic fallback for optimal performance and reliability.

## Architecture

### 3-Tier Priority Fallback System:
1. **Local Storage (Tier 1)** - Fastest, check if already stored locally in `audio-storage/`
2. **ElevenLabs API (Tier 2)** - On-demand fetch from ElevenLabs and store locally
3. **Legacy Files (Tier 3)** - Fallback to old recordings via audioUrl

## Implemented Components

### 1. Database Schema Updates ✅
**File:** `shared/schema.ts`

Added to callLogs table:
- `audioStorageKey` - Path to stored audio file (e.g., `conversationId_timestamp.mp3`)
- `audioFetchStatus` - Status: 'pending' | 'available' | 'failed' | 'unavailable' | null
- `audioFetchedAt` - Timestamp of last fetch attempt
- `recordingUrl` - Public URL for playback (e.g., `/api/audio/filename.mp3`)

**Migration:** Successfully pushed with `npm run db:push --force`

### 2. Audio Storage Service ✅
**File:** `server/services/audio-storage-service.ts`

**Features:**
- Automatic storage directory creation
- Filename sanitization for security (prevents path traversal)
- File naming pattern: `{conversationId}_{timestamp}.mp3`
- Metadata storage: `{conversationId}_{timestamp}.mp3.meta.json`

**Methods:**
- `uploadAudio(conversationId, audioBuffer, metadata)` - Store MP3 with metadata
- `getSignedUrl(storageKey)` - Generate public URL
- `audioExists(storageKey)` - Check file existence
- `downloadAudio(storageKey)` - Retrieve audio buffer
- `deleteAudio(storageKey)` - Remove file and metadata
- `getAudioMetadata(storageKey)` - Read metadata JSON
- `listAudioFiles()` - List all stored recordings

### 3. ElevenLabs Audio Methods ✅
**File:** `server/services/elevenlabs.ts`

**New Methods:**
1. `hasConversationAudio(conversationId)` 
   - Checks if recording is available in ElevenLabs
   - Returns boolean

2. `getConversationAudio(conversationId)` 
   - Fetches MP3 from ElevenLabs API
   - Returns Buffer or null
   - Endpoint: `GET /v1/convai/conversations/{id}/audio`

3. `fetchAndStoreAudio(conversationId, callId, audioStorage, storage, organizationId)`
   - Orchestrates: check → fetch → store → update DB
   - Returns: `{ success, storageKey?, recordingUrl?, error? }`
   - Handles all error cases and updates database status

### 4. Storage Interface Updates ✅
**File:** `server/storage.ts`

**Added Method:**
```typescript
updateCallAudioStatus(
  callId: string, 
  organizationId: string, 
  updates: {
    audioStorageKey?: string;
    audioFetchStatus?: string;
    recordingUrl?: string;
    audioFetchedAt?: Date;
  }
): Promise<CallLog>
```

### 5. API Endpoints ✅
**File:** `server/routes.ts`

#### Main Recording Endpoint with 3-Tier Fallback
**`GET /api/recordings/:callId/audio`**
- Permissions: Requires authentication + 'view_call_history'
- Flow:
  1. Check local storage (audioStorageKey)
  2. If not found, fetch from ElevenLabs API and store
  3. If fails, try legacy audioUrl
  4. Return 404 if all tiers fail
- Response: Audio MP3 buffer with proper headers

#### Audio File Serving
**`GET /api/audio/:fileName`**
- Permissions: Requires authentication
- Serves files from `audio-storage/` directory
- Includes caching headers (24-hour cache)
- Secure filename sanitization

#### Recording Availability Status
**`GET /api/calls/:callId/recording/availability`**
- Permissions: Requires authentication + 'view_call_history'
- Returns:
  ```json
  {
    "available": true/false,
    "status": "pending|available|failed|unavailable",
    "recordingUrl": "/api/audio/filename.mp3",
    "lastFetchedAt": "2025-10-11T15:30:00Z"
  }
  ```
- Used for polling recording status

#### Batch Audio Fetch Job
**`POST /api/jobs/fetch-missing-audio`**
- Permissions: Requires authentication
- Fetches all missing recordings for organization
- Processes in parallel batches (5 at a time)
- Returns:
  ```json
  {
    "message": "Batch fetch completed",
    "results": {
      "total": 100,
      "success": 85,
      "failed": 10,
      "unavailable": 5
    }
  }
  ```

## Security Features

1. **Filename Sanitization** - Prevents path traversal attacks
2. **Permission Checks** - Users can only access their organization's recordings
3. **Automatic Directory Creation** - Creates `audio-storage/` on first use
4. **Error Handling** - Graceful fallbacks with proper error logging

## Usage Example

### Fetch a Recording
```typescript
// Frontend: Play a call recording
const response = await fetch(`/api/recordings/${callId}/audio`, {
  headers: { Authorization: `Bearer ${token}` }
});

if (response.ok) {
  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);
  audioPlayer.src = audioUrl;
  audioPlayer.play();
}
```

### Check Availability (Polling)
```typescript
const checkRecording = async (callId) => {
  const response = await fetch(`/api/calls/${callId}/recording/availability`);
  const { available, status } = await response.json();
  
  if (available) {
    // Recording ready to play
    playRecording(callId);
  } else if (status === 'failed') {
    // Show error message
  } else {
    // Keep polling
    setTimeout(() => checkRecording(callId), 3000);
  }
};
```

### Batch Fetch Missing Recordings
```typescript
// Admin: Fetch all missing recordings
const response = await fetch('/api/jobs/fetch-missing-audio', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` }
});

const { results } = await response.json();
console.log(`Fetched ${results.success}/${results.total} recordings`);
```

## Testing Instructions

### Manual Test:
1. Find a call with a conversationId in the database
2. Make request: `GET /api/recordings/{callId}/audio`
3. Verify:
   - Audio file downloaded and played
   - File stored in `audio-storage/` directory
   - Database updated with audioStorageKey and status
   - Subsequent requests serve from local storage (faster)

### Automated Test:
```bash
# Get a call ID
curl -X GET http://localhost:5000/api/call-logs \
  -H "Authorization: Bearer YOUR_TOKEN"

# Fetch recording (triggers 3-tier fallback)
curl -X GET http://localhost:5000/api/recordings/CALL_ID/audio \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --output recording.mp3

# Check if stored locally
ls -la audio-storage/

# Verify database updated
# Check callLogs table for audioStorageKey, audioFetchStatus fields
```

## Error Handling

- **404 Not Found** - Call doesn't exist or recording unavailable
- **401 Unauthorized** - Not authenticated
- **403 Forbidden** - No permission to access recording
- **500 Server Error** - Internal error during fetch/storage

All errors are logged for debugging.

## Performance Optimizations

1. **Local Storage First** - Fastest response for cached recordings
2. **Automatic Caching** - First fetch stores locally for future requests
3. **Parallel Batch Processing** - Processes 5 recordings at a time
4. **24-Hour Browser Cache** - Static audio files cached in browser

## File Structure

```
audio-storage/
├── conversationId_1234567890.mp3
├── conversationId_1234567890.mp3.meta.json
├── conversationId_9876543210.mp3
└── conversationId_9876543210.mp3.meta.json
```

## Maintenance

### Clean up old recordings:
```typescript
const audioStorage = new AudioStorageService();
const files = await audioStorage.listAudioFiles();

// Delete files older than 30 days
for (const file of files) {
  const metadata = await audioStorage.getAudioMetadata(file);
  const age = Date.now() - new Date(metadata.uploadedAt).getTime();
  
  if (age > 30 * 24 * 60 * 60 * 1000) {
    await audioStorage.deleteAudio(file);
  }
}
```

## Status: ✅ Complete

All components implemented, tested, and running successfully:
- ✅ Database schema updated
- ✅ Audio storage service created
- ✅ ElevenLabs methods added
- ✅ Storage interface updated
- ✅ API endpoints implemented
- ✅ 3-tier fallback logic working
- ✅ Security features in place
- ✅ Error handling complete
- ✅ System running without errors

The call recording system is ready for production use!
