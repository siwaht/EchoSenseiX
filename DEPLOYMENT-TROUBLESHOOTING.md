# Deployment Troubleshooting Guide

## Common Deployment Issues and Solutions

### Issue: "Missing or invalid required secrets in production"

**Symptoms:**
```
Error: Missing or invalid required secrets in production:
  - ENCRYPTION_KEY (must be at least 32 characters)
```

**Root Cause:**
Replit keeps development secrets and deployment secrets separate. Your development environment has the secrets, but they're not automatically transferred to production deployments.

**Solution:**

#### Step 1: Access Deployment Settings
1. Click the **"Publish"** or **"Deploy"** button in the top-right corner of Replit
2. If you have an existing deployment, click **"Edit"** or **"Configure"**
3. If creating a new deployment, select **"Autoscale"** as the deployment type

#### Step 2: Configure Environment Variables/Secrets
1. In the deployment configuration screen, look for:
   - **"Environment Variables"** tab/section, OR
   - **"Secrets"** section (may be expandable)

2. The deployment tool should automatically detect your Replit App secrets and list them

3. **Enable each required secret** by checking the box or toggling it ON:
   - ✅ `ENCRYPTION_KEY` - Must be at least 32 characters
   - ✅ `SESSION_SECRET` - Session security key
   - ✅ `DATABASE_URL` - Your database connection string
   - ✅ `ELEVENLABS_API_KEY` - For voice AI features
   - ✅ `MISTRAL_API_KEY` - For call summaries

4. **Verify values** by clicking on each secret:
   - Ensure `ENCRYPTION_KEY` has at least 32 characters
   - Verify `DATABASE_URL` points to your production database
   - Check all values match your development environment

#### Step 3: Save and Deploy
1. Click **"Save"** to save the deployment configuration
2. Click **"Deploy"** or **"Redeploy"** to trigger a new deployment
3. Monitor the deployment logs for success

#### Step 4: Verify Deployment
Once deployed, verify the application is running:
- Check the deployment URL
- Visit `/health` endpoint - should return: `{"status":"healthy"}`
- Test basic functionality

---

### Issue: Deployment Crash Loop

**Symptoms:**
```
crash loop detected
The deployment is crash looping. This can happen if the run command fails or exits immediately after starting.
```

**Common Causes:**

1. **Missing Secrets** (see above)
2. **Database Connection Issues**
   - Verify `DATABASE_URL` is correct
   - Ensure database allows connections from deployment IP
   - Check database is running and accessible

3. **Port Configuration Issues**
   - Ensure only ONE external port is configured in `.replit`
   - Should have: `localPort = 5000`, `externalPort = 80`

4. **Build Failures**
   - Check build logs for errors
   - Verify all dependencies are installed
   - Ensure `npm run build` works locally

---

### Issue: Multiple Port Configuration Error

**Symptoms:**
```
Error: Autoscale deployments only support one external port
```

**Solution:**
Edit `.replit` file and remove all port configurations except one:

```toml
[[ports]]
localPort = 5000
externalPort = 80
```

Delete any additional `[[ports]]` blocks.

---

## Deployment Checklist

Before deploying, ensure:

- [ ] All secrets are configured in deployment settings
- [ ] `.replit` has only ONE port configuration
- [ ] `npm run build` completes successfully
- [ ] Health endpoint (`/health`) works in development
- [ ] Database URL is correct for production
- [ ] All environment variables have valid values

---

## Required Secrets Reference

| Secret | Purpose | Required | Min Length |
|--------|---------|----------|------------|
| `ENCRYPTION_KEY` | Data encryption | Yes | 32 characters |
| `SESSION_SECRET` | Session security | Yes | Any |
| `DATABASE_URL` | Database connection | Yes | Valid connection string |
| `ELEVENLABS_API_KEY` | Voice AI features | Recommended | API key format |
| `MISTRAL_API_KEY` | Call summaries | Recommended | API key format |

---

## Getting Help

If issues persist:

1. **Check deployment logs** - Look for specific error messages
2. **Verify secrets** - Ensure all required secrets are configured with valid values
3. **Test locally** - Run `npm run build && npm run start` to test production mode
4. **Review documentation** - See `DEPLOYMENT.md` and `DEPLOYMENT-PLATFORMS.md`

---

## Quick Diagnostic Commands

```bash
# Test production build locally
npm run build

# Test production server locally
NODE_ENV=production node dist/index.js

# Check health endpoint
curl http://localhost:5000/health

# Verify secrets exist (development)
env | grep -E 'ENCRYPTION_KEY|SESSION_SECRET|DATABASE_URL'
```
