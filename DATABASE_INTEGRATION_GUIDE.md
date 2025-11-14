# Database Integration Guide

EchoSenseiX now supports multiple database providers, making it easy to deploy on your preferred database platform. This guide covers all supported databases and their configuration.

## Supported Database Providers

- **PostgreSQL** (Default) - Including Neon, AWS RDS, Google Cloud SQL, Azure
- **MongoDB** - Including MongoDB Atlas, Self-hosted, AWS DocumentDB
- **Supabase** - PostgreSQL with additional features (Auth, Storage, Real-time)
- **MySQL** - Including MySQL 5.7+, MySQL 8.0+, MariaDB, PlanetScale

## Quick Start

### 1. PostgreSQL (Default - Neon)

**Best for:** Serverless deployments, Vercel, Replit

```bash
# .env
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
# Or explicitly set provider
DATABASE_PROVIDER=postgresql
```

**Connection string examples:**
```bash
# Neon (current default)
DATABASE_URL=postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require

# AWS RDS PostgreSQL
DATABASE_URL=postgresql://username:password@mydb.123456.us-east-1.rds.amazonaws.com:5432/mydb

# Google Cloud SQL
DATABASE_URL=postgresql://username:password@/dbname?host=/cloudsql/project:region:instance

# Azure Database for PostgreSQL
DATABASE_URL=postgresql://username:password@myserver.postgres.database.azure.com:5432/mydb?ssl=true
```

**Install dependencies:**
```bash
npm install @neondatabase/serverless drizzle-orm ws
```

---

### 2. MongoDB

**Best for:** Document-based data, flexible schemas, high scalability

```bash
# .env
DATABASE_PROVIDER=mongodb
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority

# Or individual settings
MONGODB_HOST=cluster.mongodb.net
MONGODB_DB=mydatabase
MONGODB_USER=username
MONGODB_PASSWORD=password
```

**Connection string examples:**
```bash
# MongoDB Atlas
DATABASE_URL=mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/mydb?retryWrites=true&w=majority

# Self-hosted MongoDB
DATABASE_URL=mongodb://localhost:27017/mydb

# AWS DocumentDB
DATABASE_URL=mongodb://username:password@docdb-cluster.cluster-xxxxx.us-east-1.docdb.amazonaws.com:27017/mydb?tls=true&replicaSet=rs0
```

**Install dependencies:**
```bash
npm install mongodb
```

**Features:**
- Automatic collection creation
- Index management
- Document-based storage
- Flexible schema

---

### 3. Supabase

**Best for:** Full-stack applications with auth, storage, and real-time features

```bash
# .env
DATABASE_PROVIDER=supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Direct PostgreSQL connection
DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres
```

**Install dependencies:**
```bash
npm install @supabase/supabase-js pg
```

**Additional features:**
- Built-in authentication
- Row-level security
- Real-time subscriptions
- File storage
- Auto-generated REST APIs

**Accessing Supabase features:**
```typescript
import { getDatabase } from './database/database-factory';

const adapter = await getDatabase();
const supabase = adapter.getClient(); // Get Supabase client

// Use Supabase features
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('email', 'user@example.com');
```

---

### 4. MySQL

**Best for:** Traditional SQL databases, existing MySQL infrastructure

```bash
# .env
DATABASE_PROVIDER=mysql
DATABASE_URL=mysql://username:password@host:3306/database

# Or individual settings
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DB=mydatabase
MYSQL_USER=username
MYSQL_PASSWORD=password
```

**Connection string examples:**
```bash
# Local MySQL
DATABASE_URL=mysql://root:password@localhost:3306/mydb

# AWS RDS MySQL
DATABASE_URL=mysql://admin:password@mydb.123456.us-east-1.rds.amazonaws.com:3306/mydb

# Google Cloud SQL MySQL
DATABASE_URL=mysql://root:password@localhost:3306/mydb?socketPath=/cloudsql/project:region:instance

# PlanetScale
DATABASE_URL=mysql://username:password@aws.connect.psdb.cloud/database?ssl={"rejectUnauthorized":true}
```

**Install dependencies:**
```bash
npm install mysql2
```

**Features:**
- Automatic table creation
- Transaction support
- Connection pooling
- Full SQL support

---

## Environment Variables Reference

### Common Variables (All Providers)

```bash
# Database Provider (auto-detected from DATABASE_URL if not set)
DATABASE_PROVIDER=postgresql|mongodb|supabase|mysql

# Connection string (recommended method)
DATABASE_URL=your-connection-string

# SSL/TLS Configuration
DATABASE_SSL=true  # Default: true in production, auto-detected in dev

# Connection Pool Size
DATABASE_MAX_CONNECTIONS=20  # Default: 20
```

### Provider-Specific Variables

#### PostgreSQL
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mydatabase
DB_USER=username
DB_PASSWORD=password
```

#### MongoDB
```bash
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_DB=mydatabase
MONGODB_USER=username
MONGODB_PASSWORD=password
```

#### Supabase
```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# Optional: Direct PostgreSQL connection
DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres
```

#### MySQL
```bash
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DB=mydatabase
MYSQL_USER=username
MYSQL_PASSWORD=password
```

---

## Migration Guide

### From PostgreSQL (Neon) to MongoDB

1. **Install MongoDB dependencies:**
   ```bash
   npm install mongodb
   ```

2. **Update environment variables:**
   ```bash
   DATABASE_PROVIDER=mongodb
   DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/mydb
   ```

3. **Run the application** - The adapter will automatically create collections and indexes

### From PostgreSQL to Supabase

1. **Create a Supabase project** at https://supabase.com

2. **Get credentials from Supabase dashboard:**
   - Project URL
   - Service role key
   - PostgreSQL connection string

3. **Update environment variables:**
   ```bash
   DATABASE_PROVIDER=supabase
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-key
   DATABASE_URL=postgresql://postgres:pass@db.xxxxx.supabase.co:5432/postgres
   ```

4. **Install dependencies:**
   ```bash
   npm install @supabase/supabase-js
   ```

### From PostgreSQL to MySQL

1. **Install MySQL dependencies:**
   ```bash
   npm install mysql2
   ```

2. **Update environment variables:**
   ```bash
   DATABASE_PROVIDER=mysql
   DATABASE_URL=mysql://user:pass@host:3306/database
   ```

3. **Run migrations** - Tables will be automatically created

---

## Database Adapter API

### Using the Database Factory

```typescript
import { getDatabase } from './database/database-factory';

// Get database instance (singleton)
const db = await getDatabase();

// Check provider
console.log(db.getProviderName()); // 'postgresql', 'mongodb', 'supabase', 'mysql'

// Health check
const healthy = await db.healthCheck();

// Execute raw queries (provider-specific)
const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// Get underlying client for provider-specific operations
const client = db.getClient();
```

### Provider-Specific Client Access

#### PostgreSQL
```typescript
const drizzle = db.getClient(); // Drizzle ORM instance
```

#### MongoDB
```typescript
const mongoDb = db.getClient(); // MongoDB Database instance
const usersCollection = db.getCollection('users');

const users = await usersCollection.find({}).toArray();
```

#### Supabase
```typescript
const supabase = db.getSupabaseClient();

const { data, error } = await supabase
  .from('users')
  .select('*');
```

#### MySQL
```typescript
const pool = db.getPool();

// Use transactions
await db.transaction(async (connection) => {
  await connection.execute('INSERT INTO users VALUES (?, ?)', [id, name]);
  await connection.execute('UPDATE stats SET count = count + 1');
});
```

---

## Performance Optimization

### PostgreSQL
- Use connection pooling (default: 50 connections)
- Enable SSL for production
- Use prepared statements
- Create appropriate indexes

### MongoDB
- Create indexes on frequently queried fields
- Use projection to limit returned fields
- Implement sharding for large datasets
- Enable compression

### Supabase
- Use row-level security policies
- Enable real-time only for needed tables
- Cache frequently accessed data
- Use Supabase Edge Functions for complex logic

### MySQL
- Optimize query performance with EXPLAIN
- Use proper indexing strategy
- Enable query cache
- Use InnoDB for transactional tables

---

## Troubleshooting

### Connection Issues

**PostgreSQL:**
```bash
# Check SSL mode
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# For self-signed certificates
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require&sslaccept=accept_invalid_certs
```

**MongoDB:**
```bash
# Increase timeout for slow connections
DATABASE_URL=mongodb://host/db?serverSelectionTimeoutMS=5000

# Specify read preference
DATABASE_URL=mongodb://host/db?readPreference=primary
```

**MySQL:**
```bash
# Enable SSL
DATABASE_URL=mysql://user:pass@host:3306/db?ssl=true

# For local development without SSL
DATABASE_SSL=false
```

### Migration Errors

1. **Check database version compatibility**
2. **Ensure proper permissions** for the database user
3. **Review migration logs** in console output
4. **Manually create database** if auto-creation fails

### Performance Issues

1. **Increase connection pool size:**
   ```bash
   DATABASE_MAX_CONNECTIONS=50
   ```

2. **Enable connection pooling** (enabled by default)

3. **Monitor connection usage** with health checks

4. **Use database-specific monitoring tools**

---

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use environment variables** for all sensitive data
3. **Enable SSL/TLS** in production
4. **Limit database user permissions** to required operations
5. **Rotate credentials** regularly
6. **Use connection pooling** to prevent connection exhaustion
7. **Implement rate limiting** on API endpoints
8. **Enable database audit logging** in production

---

## Next Steps

- [File Upload Platform Independence Guide](./FILE_UPLOAD_GUIDE.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [API Documentation](./API.md)

## Support

For issues or questions:
- Check the [Troubleshooting](#troubleshooting) section
- Review provider-specific documentation
- Open an issue on GitHub
