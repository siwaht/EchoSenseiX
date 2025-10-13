# EchoSensei - Voice AI Agent Management Platform

## Overview
EchoSensei is a comprehensive voice AI agent management platform built on ElevenLabs' conversational AI. It provides a professional dashboard for managing voice agents, monitoring calls, analyzing performance, tracking costs, and configuring multilingual voice interactions. The platform supports direct customer use and white-label agency deployments with custom branding and multi-tenant architecture. Its core capabilities include voice agent management, real-time call monitoring, performance analytics, cost tracking, and multilingual support.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend uses React with TypeScript, Vite, TailwindCSS, and shadcn/ui. It features lazy loading, context-based state management, suspense boundaries, error boundaries, route-based code splitting, shared query client (TanStack Query), and a theme provider. It supports permission-based UI rendering and agency subdomain routing for white-label deployments.

### Backend Architecture
The backend is built with Express.js and TypeScript, providing a RESTful API with session-based authentication (Passport.js) and granular permission-based access control. Core services include `ElevenLabsService` for voice operations, `SyncService` for data synchronization, `RealtimeSyncService` for WebSocket updates, `KnowledgeBaseService` for AI-powered knowledge retrieval, and `MultilingualService` for language support. Data synchronization includes deduplication, retry mechanisms, and real-time WebSocket broadcasts, specifically fetching transcripts from ElevenLabs API's `getConversationTranscript` endpoint. Call summaries are generated using Mistral Tiny.

### Data Model
The PostgreSQL database (Neon serverless with Drizzle ORM) supports a multi-tenant organization model, agent management, call logging, billing, and whitelabel configurations.

### Authentication & Authorization
Authentication is session-based using Passport.js with a PostgreSQL session store. Authorization utilizes a granular permission system with role templates (admin, agency, user) and organization-level inheritance.

### White-Label & Multi-Tenancy
The system is designed for multi-tenancy with organization-based data isolation, subdomain routing, custom domains, and custom whitelabel configurations (logo, colors, app name). It also tracks agency commissions.

### Payment & Billing
A unified payment system supports multiple processors (e.g., Stripe Connect for agency splits), offering credit-based and subscription-based billing models, automatic platform fee calculation, and usage tracking.

### Knowledge Base Integration
The knowledge base supports multi-format document processing (PDF, DOCX, TXT, RTF), automatic text extraction, chunking, and integrates with ElevenLabs AI for semantic search, natural language query processing, and context-aware, multi-language conversations.

### Platform-Agnostic Configuration
The application uses a centralized configuration system (`server/config.ts`) that validates environment variables. It includes flexible HOST and PORT configuration, `PUBLIC_URL` for webhooks, database SSL/connection pooling settings, trust proxy configuration, and a storage abstraction layer with adapters for various cloud providers.

### Deployment
The platform is **platform-agnostic** and can be deployed on any cloud provider or hosting environment. It supports:

**Deployment Platforms:**
- **Replit** - Autoscale Deployments (see `DEPLOYMENT.md`)
- **AWS** - ECS Fargate, Elastic Beanstalk, Lambda
- **Google Cloud** - Cloud Run, GKE, App Engine
- **Azure** - App Service, Container Instances, AKS
- **Kubernetes** - Any K8s cluster (EKS, GKE, AKS, self-hosted)
- **Docker** - Standalone or Docker Compose

**Build & Runtime:**
- **Build Process**: Vite for frontend compilation and esbuild for backend bundling to `dist/` directory
- **Production Server**: Serves static files from `dist/public/` and handles API requests with compression
- **Health Monitoring**: Endpoints at `/health` and `/api/sync/health` for deployment health checks
- **Environment Detection**: Automatically adjusts behavior based on `NODE_ENV` (development vs production)
- **Containerization**: Production-ready Dockerfile with multi-stage builds

**Storage Flexibility:**
- **Local** - File system (development/single-server)
- **AWS S3** - Scalable object storage for AWS deployments
- **Google Cloud Storage** - Scalable storage for GCP deployments
- **Azure Blob Storage** - Scalable storage for Azure deployments

**Documentation:**
- `DEPLOYMENT.md` - Replit-specific deployment guide
- `DEPLOYMENT-PLATFORMS.md` - Comprehensive multi-cloud deployment guide
- Platform-specific configs in `deployment/` directory
- Kubernetes manifests in `k8s/` directory
- CI/CD templates for GitHub Actions and GitLab CI

## External Dependencies

### Third-Party APIs
- **ElevenLabs API:** Voice synthesis, conversational AI, agent management, call transcription, recording, analytics, webhooks.
- **Payment Processors:** Stripe API (for payments and Connect), PayPal Server SDK.
- **Cloud Services:** Google Cloud Storage, Neon serverless PostgreSQL, WebSocket server.
- **Mistral AI:** For call summary generation.

### Core Libraries
- **Backend:** `drizzle-orm`, `@neondatabase/serverless`, `passport`, `express-session`, `connect-pg-simple`, `multer`, `pdf-parse`, `mammoth`, `ws`, `crypto`, `compression`.
- **Frontend:** `@tanstack/react-query`, `wouter`, `react-hook-form`, `zod`, `recharts`, `@radix-ui/*`, `lucide-react`.

### Environment Configuration
- **Required:** `DATABASE_URL`, `ELEVENLABS_API_KEY`, `STRIPE_SECRET_KEY`, `ENCRYPTION_KEY`, `SESSION_SECRET`, `MISTRAL_API_KEY`.
- **Optional:** `BASE_DOMAIN`, `GOOGLE_CLOUD_PROJECT`, `SENDGRID_API_KEY`, `NODE_ENV`.