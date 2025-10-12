# EchoSensei - Voice AI Agent Management Platform

## Overview

EchoSensei is a comprehensive voice AI agent management platform built on top of ElevenLabs' conversational AI infrastructure. The application provides a professional dashboard for managing voice agents, monitoring calls, analyzing performance, tracking costs, and configuring multilingual voice interactions. It supports both direct customer use and white-label agency deployments with custom branding and multi-tenant architecture.

**Core Technologies:**
- Frontend: React with TypeScript, Vite, TailwindCSS, shadcn/ui components
- Backend: Express.js with TypeScript
- Database: PostgreSQL (Neon serverless) with Drizzle ORM
- Voice AI: ElevenLabs API integration
- Real-time: WebSocket for live updates
- Authentication: Passport.js with session management

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Component Structure:**
- Modern React with lazy loading for performance optimization
- Context-based state management (AgentContext, WhitelabelContext, ThemeProvider)
- Suspense boundaries with elegant loading states
- Comprehensive error boundaries for graceful error handling
- Mobile-responsive design with shadcn/ui component library

**Key Design Patterns:**
- Route-based code splitting to reduce initial bundle size
- Shared query client (TanStack Query) for server state management
- Theme provider supporting light/dark modes
- Permission-based UI rendering with PermissionGuard components
- Agency subdomain routing for white-label deployments

### Backend Architecture

**API Layer:**
- RESTful API design with Express.js
- Comprehensive authentication middleware using Passport Local Strategy
- Permission-based access control with role templates
- Rate limiting on sensitive endpoints (auth, uploads, writes)
- WebSocket endpoints for real-time synchronization

**Service Layer:**
- `ElevenLabsService`: Core integration with ElevenLabs API, handles voice operations
- `SyncService`: Deduplication-aware synchronization of call logs and agent data
- `RealtimeSyncService`: WebSocket-based live updates for dashboard
- `KnowledgeBaseService`: Document processing and AI-powered knowledge retrieval
- `MultilingualService`: 20+ language support with translation capabilities
- `DocumentProcessingService`: PDF, DOCX, TXT, RTF file processing

**Database Schema:**
- Multi-tenant organization model with role-based permissions
- Agent management with ElevenLabs integration tracking
- Call logs with deduplication by `elevenLabsConversationId`
- Billing system supporting credit packs, subscriptions, and agency commissions
- Whitelabel configurations for custom branding
- Integration tracking with encrypted API keys (AES-256-CBC)

### Data Synchronization

**Sync Strategy:**
- Lazy database connection initialization for optimal resource usage
- Deduplication logic prevents duplicate call logs
- ElevenLabs agent ID mapping to local database UUIDs for relational integrity
- Retry mechanism for transient API failures
- Comprehensive error logging with structured results
- Real-time WebSocket broadcasts for live dashboard updates

**Recent Fixes (Oct 2025):**
- Fixed call log sync to properly map ElevenLabs agent IDs to local database UUIDs
- Call logs now correctly reference agents table via local UUID instead of ElevenLabs IDs
- SQL UPDATE corrected 100 existing orphaned call logs
- **Call Summaries (Oct 11, 2025):**
  - Switched to Mistral Tiny model for 8x faster and cheaper summaries ($0.00025 vs $0.002 per 1K tokens)
  - Added batch summary generation: POST /api/jobs/generate-all-summaries
  - Summaries auto-generate during sync for new calls
  - UI displays summary previews in History table with status badges
- **Call Recordings (Oct 11, 2025):**
  - **CRITICAL FIX:** Removed unreliable `hasConversationAudio()` pre-check that was causing all recordings to be marked as unavailable
  - **Root Cause:** ElevenLabs API doesn't return `recording_enabled` or `has_recording` fields, causing false negatives
  - **Solution:** Direct audio fetch from `/v1/convai/conversations/{id}/audio` endpoint with proper error handling
  - **Automatic Recording Sync:** Recordings now fetch automatically during sync for all new and updated calls
  - Sync process checks for missing audioStorageKey and fetches from ElevenLabs API
  - Non-blocking async fetch with comprehensive error logging (doesn't fail sync if recording unavailable)
  - Recording player now always visible with "Fetch Recording" button when empty
  - Added batch audio fetch: POST /api/jobs/fetch-missing-audio  
  - UI buttons in History page for bulk operations
  - Fixed permissions to use view_call_history for batch endpoints
- **Transcript Sync (Oct 11, 2025):**
  - Successfully synced transcripts for all 100 call logs (avg 5-19KB each)
  - Successfully synced call durations (avg 55 seconds)
  - Fixed transcript extraction: transcripts are in main API response, not separate endpoint
  - Fixed duration path: conversation_initiation_client_data.dynamic_variables.system__call_duration_secs
- **AI Call Summaries (Oct 11, 2025):**
  - Implemented Mistral AI-powered call summarization
  - Generates structured summaries: outcome, intent, topics, actions, sentiment
  - Token optimization: uses first 3 + last 2 conversation turns
  - Idempotent caching with cost/metadata tracking
  - API endpoint: POST /api/call-logs/:id/summary
- **Call Recording Retrieval (Oct 11, 2025):**
  - Implemented 3-tier fallback system: local storage → ElevenLabs API → legacy
  - Audio storage service for local MP3 file management
  - On-demand fetching from ElevenLabs API endpoint
  - Multi-tenant security with organization validation
  - API endpoints: GET /api/recordings/:callId/audio, POST /api/jobs/fetch-missing-audio
  - Database fields: audioStorageKey, audioFetchStatus, recordingUrl, audioFetchedAt
- Added agent lookup in sync service to prevent future data integrity issues
- **API Key Account Switching (Oct 12, 2025):**
  - **Automatic account switching** when ELEVENLABS_API_KEY environment variable changes
  - **Smart detection** using SHA-256 hash comparison (stores hash, not plaintext key)
  - **Complete data wipe** removes all old account data: call logs, agents, recordings
  - **Auto-sync** triggers after successful wipe to fetch new account data
  - **Retry logic** if wipe fails, prevents data corruption by retrying on next request
  - **First-time setup** handled gracefully without triggering wipe
  - Database field: `elevenLabsApiKeyHash` in organizations table
  - Middleware runs on all authenticated API requests for instant detection

**Performance Optimizations:**
- LRU cache for frequently accessed data
- Connection pooling (max 20 connections) for high concurrency
- Gzip compression for API responses
- Code splitting and lazy loading on frontend
- Conditional rate limiting per endpoint type

### Authentication & Authorization

**Authentication:**
- Session-based auth with PostgreSQL session store
- Password hashing using scrypt with salts
- Admin user seeding with secure defaults
- Support for social auth (infrastructure in place)

**Authorization:**
- Granular permission system with 30+ permissions
- Role templates (admin, agency, user, manager, viewer)
- Organization-level permission inheritance
- Route-based permission checks
- Agency-specific permissions for white-label features

### White-Label & Multi-Tenancy

**Multi-Tenant Design:**
- Organization-based data isolation
- Subdomain routing (`/agency/:subdomain`) for branded experiences
- Custom domain support with middleware detection
- Per-organization whitelabel configurations (logo, colors, app name)
- Agency commission tracking and payment splits

**White-Label Features:**
- Custom branding (logo, favicon, colors, app name)
- Remove platform branding option
- Subdomain or custom domain deployment
- Agency-specific billing and payment processors
- Invitation system for agency user management

### Payment & Billing

**Payment Architecture:**
- Unified payment system supporting multiple processors
- Stripe Connect for agency payment splits
- Credit-based and subscription-based billing models
- Automatic platform fee calculation
- Agency margin and commission tracking
- PayPal SDK integration (infrastructure ready)

**Billing Models:**
- Credit packs (one-time purchases)
- Monthly/annual subscriptions
- Free trial plans for customers and agencies
- Tiered pricing with feature limits
- Usage tracking and alerts

### Knowledge Base Integration

**Document Processing:**
- Multi-format support (PDF, DOCX, TXT, RTF)
- Automatic text extraction and chunking
- Integration with ElevenLabs AI models for semantic search
- Category-based organization
- Source citation in responses
- File upload with 10MB limit

**AI-Powered Retrieval:**
- Natural language query processing
- Confidence scoring for answers
- Follow-up question generation
- Context-aware conversations
- Multi-language knowledge base support

## External Dependencies

### Third-Party APIs

**ElevenLabs API (Primary Integration):**
- Voice synthesis and conversational AI
- Agent management and configuration
- Call transcription and recording
- Analytics and usage tracking
- Webhook support for real-time events
- Multi-voice and multilingual capabilities

**Payment Processors:**
- Stripe API for payment processing and Connect for splits
- PayPal Server SDK (infrastructure configured)

**Cloud Services:**
- Google Cloud Storage for file uploads
- Neon serverless PostgreSQL for database
- WebSocket server for real-time updates

### Core Libraries

**Backend:**
- `drizzle-orm`: Type-safe SQL query builder
- `@neondatabase/serverless`: PostgreSQL driver for Neon
- `passport`: Authentication middleware
- `express-session`: Session management
- `connect-pg-simple`: PostgreSQL session store
- `multer`: File upload handling
- `pdf-parse`, `mammoth`: Document processing
- `ws`: WebSocket implementation

**Frontend:**
- `@tanstack/react-query`: Server state management
- `wouter`: Lightweight routing
- `react-hook-form` + `zod`: Form validation
- `recharts`: Data visualization
- `@radix-ui/*`: Headless UI components
- `lucide-react`: Icon library

**Security & Utilities:**
- `crypto`: API key encryption (AES-256-CBC)
- `compression`: Response compression
- `helmet`: Security headers (implied usage)
- `nanoid`: Unique ID generation

### Environment Configuration

**Required Variables:**
- `DATABASE_URL`: Neon PostgreSQL connection string
- `ELEVENLABS_API_KEY`: ElevenLabs API authentication
- `STRIPE_SECRET_KEY`: Stripe payment processing
- `ENCRYPTION_KEY`: API key encryption (optional, defaults available)
- `SESSION_SECRET`: Express session encryption

**Optional Variables:**
- `BASE_DOMAIN`: Custom domain configuration
- `GOOGLE_CLOUD_PROJECT`: GCS project ID
- `SENDGRID_API_KEY`: Email notifications
- `NODE_ENV`: Environment mode (development/production)