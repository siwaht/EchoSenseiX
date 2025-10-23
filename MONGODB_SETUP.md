# MongoDB Setup for EchoSenseiX

This guide explains how to set up MongoDB with the "mediumx" database for your EchoSenseiX application.

## Prerequisites

1. MongoDB installed locally or access to MongoDB Atlas
2. Node.js and npm installed

## Installation

The MongoDB driver has already been installed. You can verify by running:

```bash
npm list mongodb
```

## Configuration

### 1. Set Environment Variable

Add the following environment variable to your `.env` file:

```bash
# For local MongoDB
MONGODB_URI=mongodb://localhost:27017

# For MongoDB Atlas (replace with your actual connection string)
MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/mediumx?retryWrites=true&w=majority

# For MongoDB with authentication
MONGODB_URI=mongodb://your-username:your-password@localhost:27017/mediumx
```

### 2. Initialize the Database

Run the initialization script to create the "mediumx" database and collections:

```bash
# For Windows
npm run mongodb:init

# For Unix/Linux/Mac
NODE_ENV=development tsx server/scripts/init-mongodb.ts
```

This will:
- Connect to MongoDB
- Create the "mediumx" database
- Create initial collections: users, documents, conversations, agents, organizations
- Create useful indexes for better performance

### 3. Test the Connection

Test your MongoDB connection:

```bash
# For Windows
npm run mongodb:test

# For Unix/Linux/Mac
NODE_ENV=development tsx server/scripts/test-mongodb.ts
```

## Usage in Your Application

### Import the MongoDB connection

```typescript
import { mongoDb, mongoClient } from './server/mongodb';

// Get the database instance
const db = mongoDb();

// Get a collection
const users = db.collection('users');

// Perform operations
const user = await users.findOne({ email: 'user@example.com' });
```

### Available Collections

The following collections are created in the "mediumx" database:

- **users**: User accounts and profiles
- **documents**: Document storage and metadata
- **conversations**: Chat conversations and history
- **agents**: AI agents configuration
- **organizations**: Organization/tenant data

## MongoDB Atlas Setup (Cloud)

If you're using MongoDB Atlas:

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free account or sign in
3. Create a new cluster
4. Get your connection string
5. Add it to your `.env` file as `MONGODB_URI`

## Local MongoDB Setup

### Windows
1. Download MongoDB Community Server from [mongodb.com](https://www.mongodb.com/try/download/community)
2. Install and start the MongoDB service
3. Use `mongodb://localhost:27017` as your connection string

### macOS (using Homebrew)
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb/brew/mongodb-community
```

### Ubuntu/Debian
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

## Troubleshooting

### Connection Issues
- Verify your MongoDB service is running
- Check your connection string format
- Ensure network access (for Atlas)
- Verify authentication credentials

### Permission Issues
- Ensure the user has read/write permissions
- Check database access controls (for Atlas)

### Performance
- The initialization script creates useful indexes
- Monitor query performance in MongoDB Compass
- Consider connection pooling for high-traffic applications

## Next Steps

1. Set up your `MONGODB_URI` environment variable
2. Run `npm run mongodb:init` to create the database
3. Run `npm run mongodb:test` to verify everything works
4. Start using MongoDB in your application!

## Files Created

- `server/mongodb.ts` - MongoDB connection configuration
- `server/scripts/init-mongodb.ts` - Database initialization script
- `server/scripts/test-mongodb.ts` - Connection test script
- `MONGODB_SETUP.md` - This documentation file
