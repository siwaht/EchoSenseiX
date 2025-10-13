# Platform-Agnostic Deployment Guide

EchoSensei is designed to run on **any cloud platform** or hosting environment. This guide covers deployment strategies for AWS, Azure, Google Cloud, Kubernetes, and other platforms.

## Table of Contents

- [Quick Start](#quick-start)
- [Platform-Specific Guides](#platform-specific-guides)
  - [AWS Deployment](#aws-deployment)
  - [Google Cloud Deployment](#google-cloud-deployment)
  - [Azure Deployment](#azure-deployment)
  - [Kubernetes Deployment](#kubernetes-deployment)
  - [Docker Deployment](#docker-deployment)
  - [Replit Deployment](#replit-deployment)
- [Configuration](#configuration)
- [Storage Options](#storage-options)
- [Database Setup](#database-setup)
- [CI/CD Setup](#cicd-setup)
- [Monitoring & Scaling](#monitoring--scaling)

---

## Quick Start

### Prerequisites

1. **Docker** installed locally
2. **PostgreSQL** database (managed service or self-hosted)
3. **Environment variables** configured (see `.env.example`)

### Local Testing with Docker

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env

# Build and run with Docker Compose
docker-compose up -d

# Check health
curl http://localhost:5000/health
```

---

## Platform-Specific Guides

### AWS Deployment

#### Option 1: AWS ECS Fargate (Recommended)

**Architecture:**
- ECS Fargate for container orchestration
- Application Load Balancer (ALB)
- RDS PostgreSQL for database
- S3 for file storage
- Secrets Manager for secrets

**Deployment Steps:**

1. **Build and push Docker image to ECR:**
   ```bash
   # Login to ECR
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

   # Build and tag image
   docker build -t echosensei .
   docker tag echosensei:latest ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/echosensei:latest

   # Push to ECR
   docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/echosensei:latest
   ```

2. **Create secrets in AWS Secrets Manager:**
   ```bash
   aws secretsmanager create-secret --name echosensei/database-url --secret-string "postgresql://..."
   aws secretsmanager create-secret --name echosensei/session-secret --secret-string "your-secret"
   aws secretsmanager create-secret --name echosensei/encryption-key --secret-string "your-key"
   ```

3. **Create S3 bucket:**
   ```bash
   aws s3 mb s3://echosensei-storage
   ```

4. **Deploy using ECS task definition:**
   ```bash
   aws ecs register-task-definition --cli-input-json file://deployment/aws/ecs-task-definition.json
   aws ecs create-service --cluster echosensei-cluster --service-name echosensei-service --task-definition echosensei:1 --desired-count 2
   ```

**Environment Variables:**
- `STORAGE_PROVIDER=s3`
- `S3_BUCKET=echosensei-storage`
- `S3_REGION=us-east-1`
- `TRUST_PROXY=true`

#### Option 2: Elastic Beanstalk

```bash
# Install EB CLI
pip install awsebcli

# Initialize EB application
eb init -p docker echosensei

# Create environment
eb create echosensei-prod

# Deploy
eb deploy
```

#### Option 3: Lambda with API Gateway (Serverless)

Use AWS Lambda for serverless deployment (requires adaptation for cold starts).

---

### Google Cloud Deployment

#### Option 1: Cloud Run (Recommended)

**Architecture:**
- Cloud Run for container deployment
- Cloud SQL for PostgreSQL
- Cloud Storage for files
- Secret Manager for secrets

**Deployment Steps:**

1. **Build and push to GCR:**
   ```bash
   # Configure Docker for GCR
   gcloud auth configure-docker

   # Build and push
   docker build -t gcr.io/PROJECT_ID/echosensei .
   docker push gcr.io/PROJECT_ID/echosensei
   ```

2. **Create secrets:**
   ```bash
   echo -n "postgresql://..." | gcloud secrets create database-url --data-file=-
   echo -n "session-secret" | gcloud secrets create session-secret --data-file=-
   echo -n "encryption-key" | gcloud secrets create encryption-key --data-file=-
   ```

3. **Deploy to Cloud Run:**
   ```bash
   gcloud run deploy echosensei \
     --image gcr.io/PROJECT_ID/echosensei \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --memory 2Gi \
     --cpu 1 \
     --min-instances 1 \
     --max-instances 10 \
     --set-env-vars STORAGE_PROVIDER=gcs,GCS_BUCKET=echosensei-storage \
     --set-secrets DATABASE_URL=database-url:latest,SESSION_SECRET=session-secret:latest,ENCRYPTION_KEY=encryption-key:latest
   ```

**Environment Variables:**
- `STORAGE_PROVIDER=gcs`
- `GCS_BUCKET=echosensei-storage`
- `GCS_PROJECT_ID=your-project-id`
- `TRUST_PROXY=true`

#### Option 2: GKE (Google Kubernetes Engine)

Use Kubernetes manifests from `k8s/` directory (see [Kubernetes Deployment](#kubernetes-deployment)).

---

### Azure Deployment

#### Option 1: Azure App Service (Recommended)

**Architecture:**
- App Service for container hosting
- Azure Database for PostgreSQL
- Azure Blob Storage for files
- Key Vault for secrets

**Deployment Steps:**

1. **Create Azure resources:**
   ```bash
   # Create resource group
   az group create --name echosensei-rg --location eastus

   # Create container registry
   az acr create --resource-group echosensei-rg --name echosenseiregistry --sku Basic

   # Build and push image
   az acr build --registry echosenseiregistry --image echosensei:latest .
   ```

2. **Create secrets in Key Vault:**
   ```bash
   az keyvault create --name echosensei-vault --resource-group echosensei-rg
   az keyvault secret set --vault-name echosensei-vault --name database-url --value "postgresql://..."
   az keyvault secret set --vault-name echosensei-vault --name session-secret --value "your-secret"
   ```

3. **Deploy App Service:**
   ```bash
   az deployment group create \
     --resource-group echosensei-rg \
     --template-file deployment/azure/app-service.json
   ```

4. **Configure secrets from Key Vault:**
   ```bash
   az webapp config appsettings set \
     --name echosensei \
     --resource-group echosensei-rg \
     --settings \
       DATABASE_URL="@Microsoft.KeyVault(SecretUri=https://echosensei-vault.vault.azure.net/secrets/database-url/)" \
       SESSION_SECRET="@Microsoft.KeyVault(SecretUri=https://echosensei-vault.vault.azure.net/secrets/session-secret/)"
   ```

**Environment Variables:**
- `STORAGE_PROVIDER=azure`
- `AZURE_STORAGE_ACCOUNT_NAME=your-account`
- `AZURE_STORAGE_CONTAINER_NAME=echosensei-storage`
- `TRUST_PROXY=true`

#### Option 2: Azure Container Instances

Simple containerized deployment without orchestration.

---

### Kubernetes Deployment

Works on **any Kubernetes cluster** (EKS, GKE, AKS, or self-hosted).

**Deployment Steps:**

1. **Build and push image to registry:**
   ```bash
   docker build -t your-registry/echosensei:latest .
   docker push your-registry/echosensei:latest
   ```

2. **Create secrets:**
   ```bash
   kubectl create secret generic echosensei-secrets \
     --from-literal=database-url='postgresql://...' \
     --from-literal=session-secret='your-secret' \
     --from-literal=encryption-key='your-key'
   ```

3. **Update ConfigMap:**
   ```bash
   # Edit k8s/configmap.yaml with your values
   kubectl apply -f k8s/configmap.yaml
   ```

4. **Deploy application:**
   ```bash
   kubectl apply -f k8s/deployment.yaml
   kubectl apply -f k8s/service.yaml
   kubectl apply -f k8s/ingress.yaml
   kubectl apply -f k8s/hpa.yaml
   ```

5. **Check status:**
   ```bash
   kubectl get pods
   kubectl get services
   kubectl logs -f deployment/echosensei
   ```

---

### Docker Deployment

#### Standalone Docker

```bash
docker run -d \
  -p 5000:5000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgresql://... \
  -e SESSION_SECRET=your-secret \
  -e ENCRYPTION_KEY=your-key \
  -e STORAGE_PROVIDER=local \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/audio-storage:/app/audio-storage \
  --name echosensei \
  echosensei:latest
```

#### Docker Compose (Recommended for local/small deployments)

```bash
# Edit docker-compose.yml with your configuration
docker-compose up -d

# View logs
docker-compose logs -f app

# Scale up
docker-compose up -d --scale app=3
```

---

### Replit Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Replit-specific deployment instructions using Autoscale Deployments.

---

## Configuration

### Environment Variables

All platforms use the same environment variables. See `.env.example` for a complete list.

#### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# Security
SESSION_SECRET=min-32-characters-random-string
ENCRYPTION_KEY=min-32-characters-random-string

# Server
NODE_ENV=production
PORT=5000
HOST=0.0.0.0
```

#### Storage Configuration

Choose storage provider based on your platform:

**AWS:**
```bash
STORAGE_PROVIDER=s3
S3_BUCKET=your-bucket
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your-key
S3_SECRET_ACCESS_KEY=your-secret
```

**Google Cloud:**
```bash
STORAGE_PROVIDER=gcs
GCS_BUCKET=your-bucket
GCS_PROJECT_ID=your-project
GCS_KEY_FILE_PATH=/path/to/key.json
```

**Azure:**
```bash
STORAGE_PROVIDER=azure
AZURE_STORAGE_ACCOUNT_NAME=your-account
AZURE_STORAGE_ACCOUNT_KEY=your-key
AZURE_STORAGE_CONTAINER_NAME=your-container
```

---

## Storage Options

### Local Storage (Development Only)

- **Use Case:** Local development, single-server deployments
- **Pros:** Simple, no external dependencies
- **Cons:** Not scalable, no redundancy
- **Config:** `STORAGE_PROVIDER=local`

### AWS S3 (Production - AWS)

- **Use Case:** AWS deployments
- **Pros:** Scalable, highly available, cheap
- **Cons:** AWS-specific
- **Config:** `STORAGE_PROVIDER=s3`

### Google Cloud Storage (Production - GCP)

- **Use Case:** Google Cloud deployments
- **Pros:** Scalable, highly available, integrated with GCP
- **Cons:** GCP-specific
- **Config:** `STORAGE_PROVIDER=gcs`

### Azure Blob Storage (Production - Azure)

- **Use Case:** Azure deployments
- **Pros:** Scalable, highly available, integrated with Azure
- **Cons:** Azure-specific
- **Config:** `STORAGE_PROVIDER=azure`

---

## Database Setup

### Managed PostgreSQL Services

#### AWS RDS
```bash
aws rds create-db-instance \
  --db-instance-identifier echosensei-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --master-username admin \
  --master-user-password your-password \
  --allocated-storage 20
```

#### Google Cloud SQL
```bash
gcloud sql instances create echosensei-db \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-7680 \
  --region=us-central1
```

#### Azure Database for PostgreSQL
```bash
az postgres server create \
  --resource-group echosensei-rg \
  --name echosensei-db \
  --location eastus \
  --admin-user admin \
  --admin-password your-password \
  --sku-name GP_Gen5_2
```

#### Self-Hosted PostgreSQL

Use Docker Compose:
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: echosensei
      POSTGRES_PASSWORD: your-password
      POSTGRES_DB: echosensei
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

---

## CI/CD Setup

### GitHub Actions

See `.github/workflows/deploy.yml` for complete CI/CD pipeline.

**Setup:**
1. Add secrets to GitHub repository settings
2. Configure deployment targets
3. Push to `main` or `production` branch

### GitLab CI/CD

See `.gitlab-ci.yml` for complete CI/CD pipeline.

**Setup:**
1. Add variables to GitLab CI/CD settings
2. Configure runners
3. Push to trigger pipeline

### Custom CI/CD

Basic deployment script:
```bash
#!/bin/bash

# Build
docker build -t echosensei:$VERSION .

# Push to registry
docker push your-registry/echosensei:$VERSION

# Deploy (platform-specific)
# ... deployment commands ...
```

---

## Monitoring & Scaling

### Health Checks

All platforms should monitor: `GET /health`

**Response (healthy):**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-13T15:00:00.000Z",
  "uptime": 3600,
  "environment": "production"
}
```

### Autoscaling

#### AWS ECS
- Configure in ECS service auto scaling
- Scale based on CPU/memory metrics

#### Google Cloud Run
- Automatic scaling built-in
- Configure min/max instances

#### Azure App Service
- Configure in App Service plan
- Scale based on rules

#### Kubernetes (HPA)
- See `k8s/hpa.yaml`
- Scales based on CPU/memory

### Logging

All platforms log to stdout/stderr. Configure log aggregation:

- **AWS:** CloudWatch Logs
- **Google Cloud:** Cloud Logging
- **Azure:** Application Insights
- **Kubernetes:** FluentD/ELK stack

### Metrics

Monitor:
- Request rate
- Response time
- Error rate
- Database connections
- Memory/CPU usage

---

## Platform Comparison

| Feature | AWS | GCP | Azure | Kubernetes | Docker |
|---------|-----|-----|-------|------------|--------|
| **Ease of Setup** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Scalability** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Cost** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Flexibility** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Managed Services** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐ |

---

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check `DATABASE_URL` format
   - Verify network connectivity
   - Enable SSL if required

2. **Storage Access Errors**
   - Verify credentials
   - Check bucket/container exists
   - Verify permissions/IAM roles

3. **Container Won't Start**
   - Check environment variables
   - Review logs: `docker logs container-name`
   - Verify health check endpoint

4. **High Memory Usage**
   - Increase container memory limits
   - Check for memory leaks in logs
   - Scale horizontally

---

## Security Best Practices

1. **Always use HTTPS** in production
2. **Store secrets** in platform secret managers (not env files)
3. **Enable database SSL** in production
4. **Use IAM roles/managed identities** instead of access keys when possible
5. **Keep dependencies updated** regularly
6. **Enable monitoring and alerts**
7. **Implement rate limiting** (already configured)
8. **Regular security audits**

---

## Support

For platform-specific issues:
- **AWS:** [AWS Support](https://aws.amazon.com/support/)
- **Google Cloud:** [GCP Support](https://cloud.google.com/support)
- **Azure:** [Azure Support](https://azure.microsoft.com/support/)
- **Kubernetes:** [Kubernetes Docs](https://kubernetes.io/docs/)

For application issues, check:
- [GitHub Issues](https://github.com/yourusername/echosensei/issues)
- Application logs
- Health check endpoint
