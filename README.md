# EchoSensei - Voice AI Agent Management Platform

> **Platform-Agnostic** | Voice AI | Multi-Cloud | Production-Ready

EchoSensei is a comprehensive voice AI agent management platform built on ElevenLabs' conversational AI. Deploy anywhere - AWS, Azure, Google Cloud, Kubernetes, or Replit.

## ✨ Features

- 🎙️ **Voice Agent Management** - Create, configure, and manage AI voice agents
- 📊 **Real-time Analytics** - Monitor calls, performance metrics, and costs
- 🌍 **Multilingual Support** - Multi-language voice interactions and knowledge bases
- 🏷️ **White-Label Ready** - Custom branding, subdomains, and agency deployments
- 🔄 **Auto-Sync** - Real-time data synchronization with ElevenLabs
- 📝 **Call Transcripts** - Automatic transcription and AI-powered summaries
- 🎵 **Audio Playback** - Secure recording storage and playback
- 💳 **Payment Integration** - Stripe support with agency commission tracking
- 🔐 **Enterprise Security** - Session-based auth, encryption, granular permissions
- 📦 **Multi-Cloud Storage** - AWS S3, Google Cloud Storage, Azure Blob, or local

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- MongoDB Atlas (optional, for additional data storage)
- Docker (optional but recommended)

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/echosensei.git
cd echosensei

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure your .env file with:
# - DATABASE_URL (PostgreSQL connection string)
# - MONGODB_URI (MongoDB Atlas connection string, optional)
# - SESSION_SECRET (min 32 characters)
# - ENCRYPTION_KEY (min 32 characters)
# - ELEVENLABS_API_KEY (optional)
# - MISTRAL_API_KEY (optional)

# Run database migrations
npm run db:push

# Initialize MongoDB (optional)
npm run mongodb:init

# Start development server
npm run dev

# Visit http://localhost:5000
```

### Docker Quick Start

```bash
# Start with Docker Compose (includes PostgreSQL)
docker-compose up -d

# Check health
curl http://localhost:5000/health
```

## 🌍 Deploy Anywhere

EchoSensei is **platform-agnostic** and runs on any cloud provider:

### Supported Platforms

| Platform | Deployment Type | Guide |
|----------|----------------|-------|
| **Replit** | Autoscale | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| **AWS** | ECS Fargate, Elastic Beanstalk, Lambda | [DEPLOYMENT-PLATFORMS.md](./DEPLOYMENT-PLATFORMS.md#aws-deployment) |
| **Google Cloud** | Cloud Run, GKE, App Engine | [DEPLOYMENT-PLATFORMS.md](./DEPLOYMENT-PLATFORMS.md#google-cloud-deployment) |
| **Azure** | App Service, Container Instances, AKS | [DEPLOYMENT-PLATFORMS.md](./DEPLOYMENT-PLATFORMS.md#azure-deployment) |
| **Kubernetes** | Any K8s cluster (EKS, GKE, AKS) | [DEPLOYMENT-PLATFORMS.md](./DEPLOYMENT-PLATFORMS.md#kubernetes-deployment) |
| **Docker** | Standalone or Docker Compose | [DEPLOYMENT-PLATFORMS.md](./DEPLOYMENT-PLATFORMS.md#docker-deployment) |

### 🔧 Deployment Troubleshooting

Having deployment issues? See **[DEPLOYMENT-TROUBLESHOOTING.md](./DEPLOYMENT-TROUBLESHOOTING.md)** for common issues and solutions.

**Common Issues:**
- ❌ Missing secrets in production → Configure secrets in deployment settings
- ❌ Crash loop detected → Check environment variables are set
- ❌ Port configuration errors → Ensure only ONE external port for Autoscale

### One-Command Deployments

**AWS ECS:**
```bash
aws ecs update-service --cluster echosensei-cluster --service echosensei-service --force-new-deployment
```

**Google Cloud Run:**
```bash
gcloud run deploy echosensei --image gcr.io/PROJECT_ID/echosensei --platform managed
```

**Azure App Service:**
```bash
az webapp restart --name echosensei --resource-group echosensei-rg
```

**Kubernetes:**
```bash
kubectl apply -f k8s/
```

## 🔧 Configuration

### Environment Variables

All deployments use the same environment variables:

```bash
# Database (Required)
DATABASE_URL=postgresql://user:pass@host:port/db

# MongoDB (Optional - for additional data storage)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?appName=yourapp

# Security (Required)
SESSION_SECRET=min-32-characters-random-string
ENCRYPTION_KEY=min-32-characters-random-string

# Storage Provider (choose one)
STORAGE_PROVIDER=local  # local, s3, gcs, or azure

# AWS S3 (if using S3)
S3_BUCKET=your-bucket
S3_REGION=us-east-1

# Google Cloud Storage (if using GCS)
GCS_BUCKET=your-bucket
GCS_PROJECT_ID=your-project

# Azure Blob Storage (if using Azure)
AZURE_STORAGE_ACCOUNT_NAME=your-account
AZURE_STORAGE_CONTAINER_NAME=your-container

# Optional Voice Integrations
ELEVENLABS_API_KEY=your-key
FISH_AUDIO_API_KEY=your-key
FISH_AUDIO_BASE_URL=https://api.fish.audio
DEEPGRAM_API_KEY=your-key
OPENAI_API_KEY=your-key
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token

# Optional Billing Integration
MISTRAL_API_KEY=your-key
STRIPE_SECRET_KEY=your-key
```

See [.env.example](./.env.example) for complete configuration options.

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS + shadcn/ui
- TanStack Query (state management)
- Wouter (routing)

**Backend:**
- Node.js 20 + Express
- TypeScript
- Drizzle ORM + PostgreSQL
- MongoDB (optional, for additional data storage)
- Passport.js (authentication)
- WebSocket (real-time updates)

**Infrastructure:**
- Docker + Kubernetes ready
- Multi-cloud storage adapters
- Health checks + auto-scaling
- CI/CD templates (GitHub Actions, GitLab CI)

### Storage Abstraction

EchoSensei includes a flexible storage layer that works with any cloud provider:

```typescript
// Automatically uses the right storage based on STORAGE_PROVIDER
const storage = getStorageAdapter();

// Same interface for all providers
await storage.save(key, buffer);
const file = await storage.get(key);
await storage.delete(key);
```

**Supported Providers:**
- ✅ Local filesystem (development)
- ✅ AWS S3 (production)
- ✅ Google Cloud Storage (production)
- ✅ Azure Blob Storage (production)

## 📚 Documentation

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Replit deployment guide
- **[DEPLOYMENT-PLATFORMS.md](./DEPLOYMENT-PLATFORMS.md)** - Multi-cloud deployment guide
- **[replit.md](./replit.md)** - Architecture and system overview
- **[k8s/](./k8s/)** - Kubernetes manifests
- **[deployment/](./deployment/)** - Platform-specific configs

## 🔐 Security

- Session-based authentication with secure cookies
- Password hashing with scrypt
- Data encryption at rest
- Granular permission system (30+ permissions)
- Rate limiting on all API routes
- Input validation with Zod
- SQL injection protection (Drizzle ORM)
- HTTPS enforcement in production
- Secret management via platform secret stores

## 📈 Scaling

### Horizontal Scaling

- **Stateless Design** - All state in PostgreSQL, no local dependencies
- **Auto-scaling** - HPA for Kubernetes, auto-scaling for cloud platforms
- **Load Balancing** - Works with ALB, Cloud Load Balancer, Azure LB
- **WebSocket Support** - Sticky sessions or Redis adapter

### Performance

- Gzip compression enabled
- LRU caching for queries
- Lazy loading of cloud SDKs
- Optimized build output (code splitting)
- CDN-ready static assets

## 🛠️ Development

### Project Structure

```
echosensei/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Route pages
│   │   └── lib/         # Utilities
├── server/              # Express backend
│   ├── routes.ts        # API routes
│   ├── services/        # Business logic
│   ├── storage/         # Storage adapters
│   └── middleware/      # Express middleware
├── shared/              # Shared types
│   └── schema.ts        # Database schema
├── k8s/                 # Kubernetes manifests
├── deployment/          # Platform configs
│   ├── aws/
│   ├── gcp/
│   └── azure/
└── dist/                # Build output
```

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run check        # TypeScript type checking
npm run db:push      # Push database schema changes
npm run mongodb:init # Initialize MongoDB collections
npm run mongodb:test # Test MongoDB connection
```

### Adding New Storage Providers

Implement the `StorageAdapter` interface:

```typescript
export class MyStorageAdapter implements StorageAdapter {
  async save(key: string, buffer: Buffer): Promise<string> { }
  async get(key: string): Promise<Buffer> { }
  async delete(key: string): Promise<void> { }
  async exists(key: string): Promise<boolean> { }
  getPublicUrl(key: string): string | null { }
  async getSignedUrl(key: string): Promise<string | null> { }
}
```

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [ElevenLabs](https://elevenlabs.io/) - Voice AI platform
- [Mistral AI](https://mistral.ai/) - Call summary generation
- [Replit](https://replit.com/) - Development and hosting platform

## 📞 Support

- 📧 Email: support@echosensei.com
- 💬 Discord: [Join our community](https://discord.gg/echosensei)
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/echosensei/issues)
- 📖 Docs: [Documentation](https://docs.echosensei.com)

---

Made with ❤️ by the EchoSensei Team
