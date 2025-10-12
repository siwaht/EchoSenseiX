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

### Platform-Agnostic Configuration
The application uses a centralized configuration system (`server/config.ts`) that validates all environment variables and enforces required secrets. It supports:
- Flexible HOST and PORT configuration
- PUBLIC_URL for webhooks and external links
- Database SSL and connection pooling settings
- Trust proxy configuration for load balancers
- Storage abstraction layer with adapters for local filesystem, AWS S3, Google Cloud Storage, and Azure Blob Storage
- Health check endpoint at `/health` for monitoring

## Deployment Guides

### AWS Deployment (ECS/Fargate)

**Prerequisites:**
- AWS account with ECS, RDS, and S3 access
- Docker installed locally
- AWS CLI configured

**Steps:**

1. **Create RDS PostgreSQL Database**
   ```bash
   # Via AWS Console or CLI
   aws rds create-db-instance \
     --db-instance-identifier echosensei-db \
     --db-instance-class db.t3.micro \
     --engine postgres \
     --master-username admin \
     --master-user-password <password> \
     --allocated-storage 20
   ```

2. **Create S3 Bucket for Storage**
   ```bash
   aws s3api create-bucket \
     --bucket echosensei-storage \
     --region us-east-1
   ```

3. **Create Secrets in AWS Secrets Manager**
   ```bash
   aws secretsmanager create-secret \
     --name echosensei-secrets \
     --secret-string '{
       "DATABASE_URL": "postgresql://...",
       "ENCRYPTION_KEY": "...",
       "SESSION_SECRET": "...",
       "ELEVENLABS_API_KEY": "..."
     }'
   ```

4. **Build and Push Docker Image**
   ```dockerfile
   # Dockerfile
   FROM node:20-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   RUN npm run build
   EXPOSE 5000
   CMD ["npm", "start"]
   ```

   ```bash
   docker build -t echosensei .
   aws ecr create-repository --repository-name echosensei
   docker tag echosensei:latest <account>.dkr.ecr.us-east-1.amazonaws.com/echosensei:latest
   docker push <account>.dkr.ecr.us-east-1.amazonaws.com/echosensei:latest
   ```

5. **Create ECS Task Definition**
   - Set environment variables:
     ```
     NODE_ENV=production
     HOST=0.0.0.0
     PORT=5000
     STORAGE_PROVIDER=s3
     S3_BUCKET=echosensei-storage
     S3_REGION=us-east-1
     DATABASE_SSL=true
     TRUST_PROXY=true
     ```
   - Use IAM role for S3 access (recommended over access keys)
   - Reference Secrets Manager for sensitive values

6. **Create Application Load Balancer**
   - Configure health check path: `/health`
   - Target port: 5000
   - Enable HTTPS with ACM certificate

7. **Deploy ECS Service**
   ```bash
   aws ecs create-service \
     --cluster echosensei-cluster \
     --service-name echosensei \
     --task-definition echosensei:1 \
     --desired-count 2 \
     --load-balancers targetGroupArn=<arn>,containerName=echosensei,containerPort=5000
   ```

---

### Google Cloud Platform Deployment (Cloud Run)

**Prerequisites:**
- GCP account with Cloud Run, Cloud SQL, and Cloud Storage access
- gcloud CLI installed and configured

**Steps:**

1. **Create Cloud SQL PostgreSQL Instance**
   ```bash
   gcloud sql instances create echosensei-db \
     --database-version=POSTGRES_14 \
     --tier=db-f1-micro \
     --region=us-central1
   
   gcloud sql databases create echosensei --instance=echosensei-db
   ```

2. **Create Cloud Storage Bucket**
   ```bash
   gsutil mb -l us-central1 gs://echosensei-storage
   ```

3. **Create Service Account**
   ```bash
   gcloud iam service-accounts create echosensei-sa \
     --display-name="EchoSensei Service Account"
   
   # Grant Storage permissions
   gsutil iam ch serviceAccount:echosensei-sa@<project>.iam.gserviceaccount.com:objectAdmin \
     gs://echosensei-storage
   ```

4. **Build and Deploy to Cloud Run**
   ```bash
   # Build container
   gcloud builds submit --tag gcr.io/<project>/echosensei
   
   # Deploy to Cloud Run
   gcloud run deploy echosensei \
     --image gcr.io/<project>/echosensei \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --add-cloudsql-instances <project>:us-central1:echosensei-db \
     --set-env-vars "NODE_ENV=production,STORAGE_PROVIDER=gcs,GCS_BUCKET=echosensei-storage,DATABASE_SSL=true,TRUST_PROXY=true" \
     --set-secrets "DATABASE_URL=DATABASE_URL:latest,ENCRYPTION_KEY=ENCRYPTION_KEY:latest,SESSION_SECRET=SESSION_SECRET:latest,ELEVENLABS_API_KEY=ELEVENLABS_API_KEY:latest" \
     --service-account echosensei-sa@<project>.iam.gserviceaccount.com
   ```

5. **Set up Secret Manager** (for sensitive variables)
   ```bash
   echo -n "your-secret-value" | gcloud secrets create ENCRYPTION_KEY --data-file=-
   ```

6. **Configure Custom Domain** (optional)
   ```bash
   gcloud run domain-mappings create \
     --service echosensei \
     --domain api.yourdomain.com \
     --region us-central1
   ```

---

### Azure Deployment (App Service)

**Prerequisites:**
- Azure account with App Service, Azure Database, and Blob Storage access
- Azure CLI installed

**Steps:**

1. **Create Resource Group**
   ```bash
   az group create --name echosensei-rg --location eastus
   ```

2. **Create Azure Database for PostgreSQL**
   ```bash
   az postgres server create \
     --resource-group echosensei-rg \
     --name echosensei-db \
     --location eastus \
     --admin-user adminuser \
     --admin-password <password> \
     --sku-name B_Gen5_1
   
   az postgres db create \
     --resource-group echosensei-rg \
     --server-name echosensei-db \
     --name echosensei
   ```

3. **Create Storage Account and Container**
   ```bash
   az storage account create \
     --name echosenseistorage \
     --resource-group echosensei-rg \
     --location eastus \
     --sku Standard_LRS
   
   az storage container create \
     --name recordings \
     --account-name echosenseistorage
   ```

4. **Create App Service Plan**
   ```bash
   az appservice plan create \
     --name echosensei-plan \
     --resource-group echosensei-rg \
     --sku B1 \
     --is-linux
   ```

5. **Create Web App**
   ```bash
   az webapp create \
     --resource-group echosensei-rg \
     --plan echosensei-plan \
     --name echosensei-app \
     --runtime "NODE|20-lts"
   ```

6. **Configure App Settings**
   ```bash
   az webapp config appsettings set \
     --resource-group echosensei-rg \
     --name echosensei-app \
     --settings \
       NODE_ENV=production \
       STORAGE_PROVIDER=azure \
       AZURE_STORAGE_ACCOUNT_NAME=echosenseistorage \
       AZURE_STORAGE_CONTAINER_NAME=recordings \
       DATABASE_SSL=true \
       TRUST_PROXY=true \
       HOST=0.0.0.0 \
       PORT=8080
   ```

7. **Store Secrets in Key Vault**
   ```bash
   az keyvault create \
     --name echosensei-vault \
     --resource-group echosensei-rg \
     --location eastus
   
   az keyvault secret set --vault-name echosensei-vault --name ENCRYPTION-KEY --value "..."
   ```

8. **Enable Managed Identity and Grant Access**
   ```bash
   az webapp identity assign \
     --resource-group echosensei-rg \
     --name echosensei-app
   
   az keyvault set-policy \
     --name echosensei-vault \
     --object-id <managed-identity-principal-id> \
     --secret-permissions get list
   ```

9. **Deploy Code**
   ```bash
   # Via Git
   az webapp deployment source config \
     --resource-group echosensei-rg \
     --name echosensei-app \
     --repo-url https://github.com/yourusername/echosensei \
     --branch main \
     --manual-integration
   
   # Or via ZIP
   az webapp deployment source config-zip \
     --resource-group echosensei-rg \
     --name echosensei-app \
     --src ./echosensei.zip
   ```

10. **Configure Health Check**
    ```bash
    az webapp config set \
      --resource-group echosensei-rg \
      --name echosensei-app \
      --health-check-path /health
    ```

---

### Replit Deployment

**Prerequisites:**
- Replit account
- Replit database enabled

**Steps:**

1. **Fork or Import Repository** into Replit

2. **Configure Secrets** (via Replit Secrets tab):
   - `ENCRYPTION_KEY` (generate with: `openssl rand -base64 32`)
   - `SESSION_SECRET` (generate with: `openssl rand -base64 32`)
   - `ELEVENLABS_API_KEY`
   - `MISTRAL_API_KEY`
   - `STRIPE_SECRET_KEY`

3. **Database is Auto-Configured** by Replit

4. **Run the Application**
   - Click "Run" button
   - App starts on port 5000 automatically

5. **Access Your App** at the Replit-provided URL

---

### Environment Variables Reference

For comprehensive environment variable documentation, see `.env.example`. Key variables:

- **NODE_ENV**: `development` | `production` | `staging`
- **HOST**: Server bind address (e.g., `0.0.0.0`, `localhost`)
- **PORT**: Server port (default: `5000`)
- **PUBLIC_URL**: Public-facing URL for webhooks
- **DATABASE_URL**: PostgreSQL connection string
- **STORAGE_PROVIDER**: `local` | `s3` | `gcs` | `azure`
- **TRUST_PROXY**: `true` for production behind load balancer