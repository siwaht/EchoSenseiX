# EchoSenseiX - Comprehensive Testing & Verification Plan

## Overview
This document outlines the complete testing strategy to ensure all components of EchoSenseiX are functioning correctly.

## Test Scripts Available

### 1. Critical Path Tests
**File:** `server/tests/critical-path-tests.ts`
**Command:** `npm run test:critical`

Tests the most important user flows and system functionality:
- ✅ Authentication & Authorization
- ✅ Agent Management
- ✅ Webhook Integration
- ✅ Call Logging
- ✅ Real-time Sync
- ✅ Integrations
- ✅ Storage & Media
- ✅ Database Connectivity

### 2. Health Check
**File:** `server/tests/health-check.ts`
**Command:** `npm run test:health`

Comprehensive system health validation:
- ✅ Environment Configuration
- ✅ Database Connectivity
- ✅ External Service Integrations
- ✅ File System & Storage
- ✅ Security Configuration
- ✅ Performance & Resources

### 3. Webhook Integration Tests
**File:** `server/test-webhook-integration.ts`
**Command:** `npm run test:webhooks`

Validates ElevenLabs webhook integration:
- ✅ Webhook endpoint accessibility
- ✅ Agent creation with webhook configuration
- ✅ Summary endpoints behavior
- ✅ Post-call webhook processing

## Testing Checklist

### Phase 1: Pre-Deployment Checks

#### Environment Setup
- [ ] All required environment variables are set
  - [ ] `DATABASE_URL`
  - [ ] `SESSION_SECRET` (min 32 characters)
  - [ ] `ENCRYPTION_KEY` (min 32 characters)
  - [ ] `PUBLIC_URL` (for webhooks)
  - [ ] `ELEVENLABS_API_KEY` (optional but recommended)
  - [ ] Storage provider configuration (S3/GCS/Azure/Local)

#### Database
- [ ] Run migrations: `npm run db:push`
- [ ] Verify database connection
- [ ] Check all tables are created
- [ ] Verify indexes are in place

#### Dependencies
- [ ] Install all dependencies: `npm install`
- [ ] Check for security vulnerabilities: `npm audit`
- [ ] Verify Node.js version (20+ recommended)

### Phase 2: Automated Testing

#### Run All Test Suites
```bash
# Health check (must pass before proceeding)
npm run test:health

# Critical path tests
npm run test:critical

# Webhook integration tests
npm run test:webhooks
```

#### Expected Results
- **Health Check:** All critical checks should pass, warnings are acceptable
- **Critical Path:** Core functionality tests should pass
- **Webhooks:** Webhook endpoints should be accessible

### Phase 3: Manual Testing

#### Authentication Flow
- [ ] User registration works
- [ ] User login works
- [ ] Session persistence works
- [ ] Logout works
- [ ] Password reset works (if implemented)

#### Agent Management
- [ ] Create new agent
- [ ] List all agents
- [ ] View agent details
- [ ] Update agent configuration
- [ ] Delete agent
- [ ] Verify webhook configuration is auto-set

#### Call Handling
- [ ] Initiate test call
- [ ] Verify call is logged
- [ ] Check transcript is captured
- [ ] Verify summary is generated via webhook
- [ ] Test audio recording retrieval
- [ ] Verify audio playback works

#### User Management
- [ ] Create new user
- [ ] Assign permissions
- [ ] Assign agents to user
- [ ] Update user role
- [ ] Delete user

#### Billing & Payments (if applicable)
- [ ] View billing plans
- [ ] Subscribe to plan
- [ ] Process payment
- [ ] View payment history
- [ ] Cancel subscription

#### Real-time Sync
- [ ] Trigger manual sync
- [ ] Verify agents sync from ElevenLabs
- [ ] Verify call logs sync
- [ ] Check sync status

### Phase 4: Integration Testing

#### ElevenLabs Integration
- [ ] API key validation works
- [ ] Agent creation in ElevenLabs
- [ ] Agent updates sync correctly
- [ ] Call data retrieval works
- [ ] Webhook delivery works
- [ ] Audio recording download works

#### Payment Integration
- [ ] Stripe test mode works (if configured)
- [ ] PayPal test mode works (if configured)
- [ ] Payment webhooks are received
- [ ] Commission calculations are correct

#### Storage Integration
- [ ] File upload works
- [ ] File retrieval works
- [ ] File deletion works
- [ ] Signed URLs work (for cloud storage)

### Phase 5: Performance Testing

#### Load Testing
- [ ] Test with 10 concurrent users
- [ ] Test with 50 concurrent users
- [ ] Test with 100 concurrent users
- [ ] Monitor response times
- [ ] Check memory usage
- [ ] Verify no memory leaks

#### Database Performance
- [ ] Query response times < 100ms
- [ ] No N+1 query problems
- [ ] Indexes are being used
- [ ] Connection pooling works

#### API Performance
- [ ] All endpoints respond < 500ms
- [ ] Rate limiting works
- [ ] Caching is effective
- [ ] Gzip compression is enabled

### Phase 6: Security Testing

#### Authentication & Authorization
- [ ] Password hashing works
- [ ] Session security is enforced
- [ ] HTTPS is enforced (production)
- [ ] CSRF protection works
- [ ] XSS protection works
- [ ] SQL injection protection works

#### API Security
- [ ] Rate limiting prevents abuse
- [ ] API keys are validated
- [ ] Webhook signatures are verified
- [ ] Sensitive data is encrypted
- [ ] Error messages don't leak info

#### Data Security
- [ ] Encryption at rest works
- [ ] Encryption in transit works
- [ ] Secrets are not in logs
- [ ] PII is properly handled

### Phase 7: Browser Testing

#### Desktop Browsers
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

#### Mobile Browsers
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] Responsive design works

#### Features to Test
- [ ] All pages load correctly
- [ ] Forms submit properly
- [ ] Audio playback works
- [ ] Real-time updates work
- [ ] Navigation works
- [ ] Modals/dialogs work

### Phase 8: Deployment Testing

#### Pre-Deployment
- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors: `npm run check`
- [ ] All tests pass
- [ ] Environment variables are set
- [ ] Database migrations are ready

#### Post-Deployment
- [ ] Health check endpoint responds
- [ ] Application loads
- [ ] Database connection works
- [ ] External services are reachable
- [ ] Webhooks are accessible
- [ ] Logs are being generated
- [ ] Monitoring is active

### Phase 9: Monitoring & Alerts

#### Set Up Monitoring
- [ ] Application uptime monitoring
- [ ] Error tracking (e.g., Sentry)
- [ ] Performance monitoring (e.g., New Relic)
- [ ] Log aggregation (e.g., Papertrail)
- [ ] Database monitoring

#### Configure Alerts
- [ ] High error rate alerts
- [ ] Slow response time alerts
- [ ] Database connection alerts
- [ ] Disk space alerts
- [ ] Memory usage alerts

## Continuous Testing

### Daily Checks
- Run health check: `npm run test:health`
- Check error logs
- Monitor performance metrics
- Review user feedback

### Weekly Checks
- Run full test suite
- Review security logs
- Check for dependency updates
- Review performance trends

### Monthly Checks
- Full security audit
- Load testing
- Backup verification
- Disaster recovery test

## Troubleshooting Guide

### Common Issues

#### Database Connection Fails
```bash
# Check DATABASE_URL is set
echo $DATABASE_URL

# Test connection manually
npm run mongodb:test

# Run migrations
npm run db:push
```

#### Webhook Tests Fail
```bash
# Verify PUBLIC_URL is set
echo $PUBLIC_URL

# Check server is running
curl http://localhost:5000/health

# Test webhook endpoint
curl -X POST http://localhost:5000/api/webhooks/elevenlabs/post-call \
  -H "Content-Type: application/json" \
  -d '{"conversation_id":"test","agent_id":"test"}'
```

#### Build Fails
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check TypeScript errors
npm run check

# Try building again
npm run build
```

#### Tests Timeout
```bash
# Increase timeout in test files
# Check database is responsive
# Verify network connectivity
# Check for resource constraints
```

## Test Data Management

### Creating Test Data
```bash
# Create test user
# Create test organization
# Create test agents
# Create test call logs
```

### Cleaning Test Data
```bash
# Remove test users
# Remove test organizations
# Clear test call logs
# Reset database (development only)
```

## Reporting

### Test Results Format
- Total tests run
- Tests passed
- Tests failed
- Success rate
- Execution time
- Failed test details

### Documentation
- Update test results in this document
- Document any issues found
- Track resolution of issues
- Update test cases as needed

## Next Steps

After completing all testing phases:
1. ✅ Document all test results
2. ✅ Fix any critical issues
3. ✅ Address warnings and recommendations
4. ✅ Update deployment documentation
5. ✅ Train team on testing procedures
6. ✅ Set up continuous integration
7. ✅ Schedule regular testing cycles

## Resources

- [Health Check Script](./server/tests/health-check.ts)
- [Critical Path Tests](./server/tests/critical-path-tests.ts)
- [Webhook Tests](./server/test-webhook-integration.ts)
- [Deployment Guide](./DEPLOYMENT.md)
- [Troubleshooting Guide](./DEPLOYMENT-TROUBLESHOOTING.md)

---

**Last Updated:** 2024-01-15
**Version:** 1.0.0
**Status:** Ready for Testing
