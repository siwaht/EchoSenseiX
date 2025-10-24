# Testing Quick Start Guide

## 🚀 Quick Commands

### Run All Tests
```bash
npm run test:all
```

### Individual Test Suites

#### 1. Health Check (Recommended First)
```bash
npm run test:health
```
Validates environment, database, security, and system configuration.

#### 2. Critical Path Tests
```bash
npm run test:critical
```
Tests authentication, agents, webhooks, calls, and integrations.

#### 3. Webhook Integration Tests
```bash
npm run test:webhooks
```
Validates ElevenLabs webhook endpoints and configuration.

#### 4. Quick Health Check
```bash
npm run test:quick
```
Alias for `test:health` - fastest way to verify system status.

## 📋 Pre-Test Checklist

Before running tests, ensure:

1. **Environment Variables Set**
   ```bash
   # Required
   DATABASE_URL=your_database_url
   SESSION_SECRET=your_secret_min_32_chars
   ENCRYPTION_KEY=your_key_min_32_chars
   
   # Recommended
   PUBLIC_URL=http://localhost:5000
   ELEVENLABS_API_KEY=your_api_key
   ```

2. **Database Ready**
   ```bash
   npm run db:push
   ```

3. **Dependencies Installed**
   ```bash
   npm install
   ```

4. **Server Running** (for critical path tests)
   ```bash
   npm run dev
   # In another terminal, run tests
   ```

## 📊 Understanding Test Results

### Health Check Output
```
✅ Pass - Check succeeded
⚠️  Warning - Non-critical issue
❌ Fail - Critical issue requiring attention
```

### Success Criteria
- **Health Check:** All critical checks pass (warnings acceptable)
- **Critical Path:** Core functionality tests pass
- **Webhooks:** Endpoints accessible and responding

## 🔧 Common Issues & Solutions

### Issue: Database Connection Failed
```bash
# Solution: Check DATABASE_URL and run migrations
echo $DATABASE_URL
npm run db:push
```

### Issue: Tests Timeout
```bash
# Solution: Ensure server is running
npm run dev
# Then run tests in another terminal
```

### Issue: Webhook Tests Fail
```bash
# Solution: Set PUBLIC_URL
export PUBLIC_URL=http://localhost:5000
npm run test:webhooks
```

### Issue: Permission Errors
```bash
# Solution: Check file permissions
chmod +x server/tests/*.ts
```

## 📈 Test Coverage

### What's Tested

#### Health Check
- ✅ Environment variables
- ✅ Database connectivity
- ✅ File system access
- ✅ Security configuration
- ✅ External services
- ✅ Performance metrics

#### Critical Path
- ✅ User authentication
- ✅ Agent CRUD operations
- ✅ Webhook endpoints
- ✅ Call logging
- ✅ Real-time sync
- ✅ Integrations
- ✅ Storage operations
- ✅ Database queries

#### Webhook Integration
- ✅ Post-call webhook
- ✅ Conversation init webhook
- ✅ Events webhook
- ✅ Webhook URL configuration
- ✅ Agent webhook setup

## 🎯 Testing Workflow

### Development Workflow
```bash
# 1. Make changes to code
# 2. Run quick health check
npm run test:quick

# 3. If health check passes, run critical tests
npm run test:critical

# 4. If all pass, commit changes
git commit -m "Your changes"
```

### Pre-Deployment Workflow
```bash
# 1. Run all tests
npm run test:all

# 2. Run TypeScript check
npm run check

# 3. Build application
npm run build

# 4. Deploy if all pass
```

### CI/CD Integration
```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: |
    npm run test:health
    npm run test:critical
    npm run test:webhooks
```

## 📝 Test Reports

### Viewing Results
Tests output results to console with:
- Summary statistics
- Category breakdowns
- Failed test details
- Recommendations

### Example Output
```
🧪 Starting Critical Path Test Suite

✅ [Auth] Health check endpoint
✅ [Auth] User login
✅ [Agents] List agents
✅ [Webhooks] Post-call webhook endpoint

📊 Test Summary
Total Tests: 45
✅ Passed: 43
❌ Failed: 2
Success Rate: 95.6%
```

## 🔄 Continuous Testing

### Daily
```bash
npm run test:quick
```

### Before Commits
```bash
npm run test:all
```

### Before Deployment
```bash
npm run test:all && npm run check && npm run build
```

## 📚 Additional Resources

- [Full Testing Plan](./TESTING_PLAN.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Troubleshooting](./DEPLOYMENT-TROUBLESHOOTING.md)
- [Webhook Migration](./WEBHOOK_MIGRATION_SUMMARY.md)

## 🆘 Getting Help

If tests fail:
1. Check error messages carefully
2. Review [TESTING_PLAN.md](./TESTING_PLAN.md) troubleshooting section
3. Verify environment configuration
4. Check server logs
5. Ensure all dependencies are installed

## ✨ Best Practices

1. **Always run health check first** - It's the fastest way to catch configuration issues
2. **Run tests before committing** - Catch issues early
3. **Keep tests updated** - Add tests for new features
4. **Monitor test performance** - Slow tests indicate problems
5. **Fix failing tests immediately** - Don't let them accumulate

---

**Quick Reference Card**

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run test:quick` | Fast health check | Before starting work |
| `npm run test:health` | Full health check | After config changes |
| `npm run test:critical` | Core functionality | Before commits |
| `npm run test:webhooks` | Webhook validation | After webhook changes |
| `npm run test:all` | Complete test suite | Before deployment |

---

**Last Updated:** 2024-01-15
