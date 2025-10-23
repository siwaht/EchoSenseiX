import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function initializeMongoDB() {
  let client: MongoClient | null = null;
  
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error(
        "MONGODB_URI must be set. Please add your MongoDB connection string to environment variables."
      );
    }

    console.log('[MongoDB Init] Connecting to MongoDB...');
    
    // Create MongoDB client
    client = new MongoClient(process.env.MONGODB_URI);
    
    // Connect to MongoDB
    await client.connect();
    console.log('[MongoDB Init] Connected to MongoDB successfully');
    
    // Get the database instance
    const db = client.db('mediumx');
    
    // Create some initial collections (optional)
    const collections = [
      'users',
      'documents', 
      'conversations',
      'agents',
      'organizations'
    ];
    
    console.log('[MongoDB Init] Creating collections...');
    
    for (const collectionName of collections) {
      try {
        await db.createCollection(collectionName);
        console.log(`[MongoDB Init] Created collection: ${collectionName}`);
      } catch (error: any) {
        if (error.code === 48) { // Collection already exists
          console.log(`[MongoDB Init] Collection ${collectionName} already exists`);
        } else {
          console.error(`[MongoDB Init] Error creating collection ${collectionName}:`, error.message);
        }
      }
    }
    
    // Create some indexes for better performance
    console.log('[MongoDB Init] Creating indexes...');
    
    try {
      // Users collection indexes
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
      await db.collection('users').createIndex({ organizationId: 1 });
      console.log('[MongoDB Init] Created indexes for users collection');
    } catch (error: any) {
      console.log('[MongoDB Init] Index creation info:', error.message);
    }
    
    try {
      // Documents collection indexes
      await db.collection('documents').createIndex({ organizationId: 1 });
      await db.collection('documents').createIndex({ createdAt: -1 });
      console.log('[MongoDB Init] Created indexes for documents collection');
    } catch (error: any) {
      console.log('[MongoDB Init] Index creation info:', error.message);
    }
    
    try {
      // Conversations collection indexes
      await db.collection('conversations').createIndex({ organizationId: 1 });
      await db.collection('conversations').createIndex({ userId: 1 });
      await db.collection('conversations').createIndex({ createdAt: -1 });
      console.log('[MongoDB Init] Created indexes for conversations collection');
    } catch (error: any) {
      console.log('[MongoDB Init] Index creation info:', error.message);
    }
    
    console.log('[MongoDB Init] Database "mediumx" initialized successfully!');
    console.log('[MongoDB Init] Collections created:', collections);
    
  } catch (error) {
    console.error('[MongoDB Init] Error initializing MongoDB:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('[MongoDB Init] MongoDB connection closed');
    }
  }
}

// Run the initialization
initializeMongoDB();
