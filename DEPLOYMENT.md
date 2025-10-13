# EchoSensei - Deployment Guide

## Overview
This guide explains how to deploy EchoSensei to production on Replit using Autoscale Deployments.

## Prerequisites

### Required Environment Variables
Before deploying, ensure the following secrets are configured in your Replit workspace:

1. **Database** (Required)
   - `DATABASE_URL` - PostgreSQL connection string (automatically configured by Replit)

2. **Authentication & Security** (Required)
   - `SESSION_SECRET` - Secret key for session encryption (min 32 characters)
   - `ENCRYPTION_KEY` - Key for encrypting sensitive data (min 32 characters)

3. **Core Features** (Optional but recommended)
   - `ELEVENLABS_API_KEY` - ElevenLabs API key for voice AI features
   - `MISTRAL_API_KEY` - Mistral AI API key for automatic call summaries

4. **Payment & Communication** (Optional)
   - `STRIPE_SECRET_KEY` - Stripe payment processing
   - `STRIPE_WEBHOOK_SECRET` - Stripe webhook signature verification
   - `SENDGRID_API_KEY` - SendGrid email service

5. **Advanced Configuration** (Optional)
   - `GOOGLE_CLOUD_PROJECT` - Google Cloud project ID for GCS storage
   - `BASE_DOMAIN` - Custom domain for white-label deployments

### Adding Secrets
1. Open your Replit workspace
2. Click on "Secrets" in the left sidebar (under "Tools")
3. Add each required secret with its value
4. Secrets are automatically synced to deployments

## Deployment Configuration

The deployment is configured in `.replit` file:

```toml
[deployment]
deploymentTarget = "autoscale"
run = ["npm", "run", "start"]
build = ["npm", "run", "build"]
```

### Build Process
The build command runs:
1. `vite build` - Compiles the frontend React application
2. `esbuild server/index.ts` - Bundles the backend Express server

Build artifacts are created in the `dist/` directory:
- `dist/index.js` - Bundled server application
- `dist/public/` - Static frontend assets

### Production Start
The start command runs:
```bash
NODE_ENV=production node dist/index.js
```

This starts the Express server which:
- Serves static files from `dist/public/`
- Handles API requests
- Runs WebSocket server for real-time updates
- Connects to PostgreSQL database

## Deployment Steps

### 1. Prepare for Deployment
```bash
# Test the build locally
npm run build

# Verify build output
ls -lh dist/
ls -lh dist/public/
```

### 2. Deploy to Production
1. Click "Publish" in the Replit workspace header
2. Select "Autoscale" deployment
3. Configure deployment settings:
   - **Machine**: Default (1vCPU, 2 GiB RAM) or adjust based on needs
   - **Max machines**: Default (3) or adjust for scaling
   - **Secrets**: Verify all required secrets are listed
4. Click "Publish" to deploy

### 3. Monitor Deployment
- Check deployment logs for any errors
- Visit the deployment URL to verify the app is running
- Test the health check endpoint: `https://your-app.replit.app/health`

## Health Checks

The application provides health check endpoints for monitoring:

### Main Health Check
```bash
GET /health
```

Response (healthy):
```json
{
  "status": "healthy",
  "timestamp": "2025-10-13T15:00:00.000Z",
  "uptime": 3600,
  "environment": "production"
}
```

Response (unhealthy):
```json
{
  "status": "unhealthy",
  "error": "Database connection failed",
  "timestamp": "2025-10-13T15:00:00.000Z"
}
```

### Sync Service Health Check
```bash
GET /api/sync/health
```

## Environment-Specific Behavior

The application automatically adjusts based on `NODE_ENV`:

### Development Mode (`NODE_ENV=development`)
- Uses Vite dev server with HMR
- Detailed error logging
- Request/response logging
- Development database

### Production Mode (`NODE_ENV=production`)
- Serves pre-built static files
- Minimal logging
- Optimized error handling
- Production database
- Gzip compression enabled
- Session security hardened

## Storage Considerations

### Persistent Storage
Autoscale deployments do NOT have persistent file storage. The following data is stored persistently:

✅ **Persisted** (in PostgreSQL database):
- User accounts and organizations
- Voice agents and configurations
- Call logs and transcripts
- Billing and payment records
- Knowledge base content

❌ **Not Persisted** (local file system):
- Uploaded documents (should use Object Storage)
- Audio recordings (fetched from ElevenLabs API on demand)

### Audio Storage Strategy
Audio recordings are:
1. Fetched from ElevenLabs API when needed
2. Cached locally during the deployment session
3. Re-fetched if missing (using resync script)

To manually resync missing audio:
```bash
tsx server/scripts/resync-missing-audio.ts
```

## Performance Optimization

### Autoscaling
- Scales automatically based on traffic
- Spins down when no requests (0 cost)
- Spins up on first request (slight cold start)
- Multiple instances for high traffic

### Caching
- Gzip compression for all responses
- Static assets served efficiently
- Query result caching (LRU cache)

## Troubleshooting

### Common Issues

#### 1. Build Fails
**Symptom**: Deployment fails during build phase

**Solution**:
```bash
# Test build locally
npm run build

# Check for TypeScript errors
npm run check

# Verify dependencies
npm install
```

#### 2. Database Connection Errors
**Symptom**: Health check returns unhealthy, database errors in logs

**Solution**:
- Verify `DATABASE_URL` is configured
- Check database is accessible
- Verify SSL settings in production

#### 3. Missing API Keys
**Symptom**: Integration features not working

**Solution**:
- Verify all required secrets are added
- Check secret names match exactly
- Secrets sync automatically, but may need to redeploy

#### 4. Static Files Not Loading
**Symptom**: Frontend shows blank page or 404 errors

**Solution**:
- Verify build completed successfully
- Check `dist/public/` contains files
- Verify production server serves from correct path

#### 5. Audio Playback Issues
**Symptom**: Call recordings not playing

**Solution**:
```bash
# Run the resync script to recover missing audio
tsx server/scripts/resync-missing-audio.ts
```

### Viewing Logs
1. Open your deployment in Replit
2. Click on "Deployments" tab
3. Select your active deployment
4. View real-time logs

### Rolling Back
If deployment has issues:
1. Click "Deployments" in Replit
2. Select a previous stable deployment
3. Click "Promote to Production"

## Cost Optimization

Autoscale deployments are billed based on:
- **Compute Units**: CPU and RAM usage over time
- **Requests**: Number of API requests

To minimize costs:
1. Optimize code for efficiency
2. Enable compression (already configured)
3. Use appropriate machine size
4. Set max machines based on expected traffic
5. Let autoscaling handle demand

## Security Best Practices

1. **Environment Variables**
   - Never commit secrets to code
   - Use Replit Secrets for all sensitive data
   - Rotate API keys regularly

2. **Database Security**
   - Use SSL for database connections (enabled by default)
   - Keep DATABASE_URL secret
   - Use connection pooling (configured)

3. **Session Security**
   - Strong SESSION_SECRET (32+ characters)
   - Secure cookies in production
   - Trust proxy enabled for HTTPS

4. **API Security**
   - Rate limiting enabled
   - Permission-based access control
   - Input validation on all routes

## Monitoring & Maintenance

### Regular Checks
- Monitor health check endpoint
- Review deployment logs for errors
- Check database performance
- Monitor API usage and costs

### Maintenance Tasks
- Update dependencies regularly
- Review and optimize database queries
- Clean up old logs and unused data
- Monitor storage usage

### Scaling Considerations
As your app grows:
1. Increase max machines for higher traffic
2. Upgrade machine size if needed
3. Consider dedicated database for production
4. Implement CDN for static assets
5. Add monitoring and alerting tools

## Production Checklist

Before deploying to production:

- [ ] All required secrets configured
- [ ] Build completes successfully
- [ ] Health checks pass
- [ ] Database migrations applied
- [ ] Admin user created
- [ ] ElevenLabs integration configured
- [ ] Payment processor setup (if using payments)
- [ ] Domain configured (if using custom domain)
- [ ] SSL/HTTPS enabled
- [ ] Monitoring configured
- [ ] Backup strategy in place

## Support

For deployment issues:
1. Check deployment logs in Replit
2. Verify all secrets are configured
3. Test build locally
4. Check health endpoints
5. Review this troubleshooting guide

For platform-specific issues, contact Replit support.
