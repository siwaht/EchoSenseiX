# EchoSensei - Voice AI Agent Management Platform

## Overview
EchoSensei is a comprehensive voice AI agent management platform built on ElevenLabs' conversational AI. It provides a professional dashboard for managing voice agents, monitoring calls, analyzing performance, tracking costs, and configuring multilingual voice interactions. The platform supports direct customer use and white-label agency deployments with custom branding and multi-tenant architecture. Its core capabilities include voice agent management, real-time call monitoring, performance analytics, cost tracking, and multilingual support.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend uses React with TypeScript, Vite, TailwindCSS, and shadcn/ui for a modern, responsive interface. It features lazy loading, context-based state management, suspense boundaries, and error boundaries for performance and reliability. Key patterns include route-based code splitting, shared query client (TanStack Query), theme provider for light/dark modes, and permission-based UI rendering. Agency subdomain routing supports white-label deployments.

### Backend Architecture
The backend is built with Express.js and TypeScript, featuring a RESTful API with comprehensive authentication (Passport.js) and permission-based access control. Core services include `ElevenLabsService` for voice operations, `SyncService` for data synchronization, `RealtimeSyncService` for WebSocket updates, `KnowledgeBaseService` for AI-powered knowledge retrieval, and `MultilingualService` for language support. The PostgreSQL database (Neon serverless with Drizzle ORM) supports a multi-tenant organization model, agent management, call logging, billing, and whitelabel configurations. Data synchronization includes deduplication, retry mechanisms, and real-time WebSocket broadcasts. The system automatically handles ElevenLabs API key changes by wiping and resyncing data.

### Data Synchronization
The platform employs a robust data synchronization strategy featuring lazy database connection initialization, deduplication logic for call logs, and mapping of ElevenLabs agent IDs to local database UUIDs. It includes retry mechanisms for API failures, comprehensive error logging, and real-time WebSocket broadcasts for live dashboard updates. Call summaries are generated using Mistral Tiny, and call recordings are fetched and stored with a 3-tier fallback system. Transcripts and call durations are also synced and extracted from ElevenLabs responses. Authenticated audio playback is handled by fetching with credentials and converting to blob URLs.

### Authentication & Authorization
Authentication is session-based using Passport.js with a PostgreSQL session store and scrypt for password hashing. Authorization features a granular permission system with over 30 permissions, role templates (admin, agency, user), organization-level inheritance, and route-based checks.

### White-Label & Multi-Tenancy
The system is designed for multi-tenancy with organization-based data isolation, subdomain routing for branded experiences, and support for custom domains. Each organization can have custom whitelabel configurations (logo, colors, app name), and the platform tracks agency commissions.

### Payment & Billing
A unified payment system supports multiple processors, including Stripe Connect for agency payment splits. It offers credit-based and subscription-based billing models, automatic platform fee calculation, and usage tracking.

### Knowledge Base Integration
The knowledge base supports multi-format document processing (PDF, DOCX, TXT, RTF), automatic text extraction, and chunking. It integrates with ElevenLabs AI for semantic search, natural language query processing, and context-aware conversations, supporting multi-language knowledge bases.

## External Dependencies

### Third-Party APIs
- **ElevenLabs API:** Voice synthesis, conversational AI, agent management, call transcription, recording, analytics, webhooks.
- **Payment Processors:** Stripe API (for payments and Connect for splits), PayPal Server SDK.
- **Cloud Services:** Google Cloud Storage (for file uploads), Neon serverless PostgreSQL, WebSocket server.

### Core Libraries
- **Backend:** `drizzle-orm`, `@neondatabase/serverless`, `passport`, `express-session`, `connect-pg-simple`, `multer`, `pdf-parse`, `mammoth`, `ws`, `crypto`, `compression`.
- **Frontend:** `@tanstack/react-query`, `wouter`, `react-hook-form`, `zod`, `recharts`, `@radix-ui/*`, `lucide-react`.

### Environment Configuration
- **Required:** `DATABASE_URL`, `ELEVENLABS_API_KEY`, `STRIPE_SECRET_KEY`, `ENCRYPTION_KEY`, `SESSION_SECRET`.
- **Optional:** `BASE_DOMAIN`, `GOOGLE_CLOUD_PROJECT`, `SENDGRID_API_KEY`, `NODE_ENV`.