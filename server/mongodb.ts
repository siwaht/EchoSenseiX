import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let database: Db | null = null;

function getMongoDBConnection() {
  if (!database) {
    if (!process.env.MONGODB_URI) {
      throw new Error(
        "MONGODB_URI must be set. Please add your MongoDB connection string to environment variables.",
      );
    }

    console.log('[MongoDB] Connecting to MongoDB...');
    
    // Create MongoDB client
    client = new MongoClient(process.env.MONGODB_URI, {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferMaxEntries: 0, // Disable mongoose buffering
      bufferCommands: false, // Disable mongoose buffering
    });

    // Connect to MongoDB
    client.connect().then(() => {
      console.log('[MongoDB] Connected to MongoDB successfully');
    }).catch((err) => {
      console.error('[MongoDB] Failed to connect to MongoDB:', err);
      throw err;
    });

    // Get the database instance
    database = client.db('mediumx');
  }
  
  return database;
}

// Export a function that returns the MongoDB database instance
export const mongoDb = () => getMongoDBConnection();

// Export the client for advanced operations
export const mongoClient = () => {
  if (!client) {
    getMongoDBConnection();
  }
  return client!;
};

// Cleanup function for graceful shutdown
export const closeMongoDB = async () => {
  if (client) {
    try {
      await client.close();
      console.log('[MongoDB] MongoDB connection closed');
    } catch (error) {
      console.error('[MongoDB] Error closing MongoDB connection:', error);
    }
    client = null;
    database = null;
  }
};

// Handle process termination
process.on('SIGINT', closeMongoDB);
process.on('SIGTERM', closeMongoDB);
