/**
 * MongoDB Database Adapter
 *
 * Supports:
 * - MongoDB Atlas
 * - Self-hosted MongoDB
 * - MongoDB Compass (local development)
 * - AWS DocumentDB (MongoDB-compatible)
 */

import { BaseDatabaseAdapter, type DatabaseConfig } from './database-adapter';

export class MongoDBAdapter extends BaseDatabaseAdapter {
  private mongoClient: any = null;
  private database: any = null;

  constructor(config: DatabaseConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    try {
      this.log('Connecting to MongoDB database...');

      // Dynamically import MongoDB to avoid bundling it if not used
      const { MongoClient } = await import('mongodb');

      const connectionString = this.config.connectionString || this.buildConnectionString();

      if (!connectionString) {
        throw new Error('MongoDB connection string is required');
      }

      // Create MongoDB client
      this.mongoClient = new MongoClient(connectionString, {
        maxPoolSize: this.config.options?.maxConnections || 50,
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        ...(this.config.options || {}),
      });

      // Connect to MongoDB
      await this.mongoClient.connect();

      // Get database instance
      const dbName = this.config.database || this.extractDbNameFromConnectionString(connectionString);
      this.database = this.mongoClient.db(dbName);
      this.client = this.database;
      this.connected = true;

      this.log(`Successfully connected to MongoDB database: ${dbName}`);
    } catch (error: any) {
      this.log(`Failed to connect to MongoDB: ${error.message}`, 'error');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.mongoClient) {
        await this.mongoClient.close();
        this.log('MongoDB connection closed');
      }
      this.mongoClient = null;
      this.database = null;
      this.client = null;
      this.connected = false;
    } catch (error: any) {
      this.log(`Error closing MongoDB connection: ${error.message}`, 'error');
      throw error;
    }
  }

  async query(operation: string, params?: any[]): Promise<any> {
    if (!this.database) {
      throw new Error('Database not connected');
    }

    try {
      // MongoDB uses operations instead of SQL queries
      // This is a simplified implementation
      // In practice, you would use the MongoDB driver methods directly
      this.log(`Executing operation: ${operation}`);
      return { success: true, message: 'Use MongoDB driver methods directly via getClient()' };
    } catch (error: any) {
      this.log(`Operation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async migrate(): Promise<void> {
    this.log('MongoDB migrations...');
    // MongoDB is schemaless, but you might want to:
    // 1. Create indexes
    // 2. Set up collections
    // 3. Run data migrations

    try {
      // Example: Create indexes for common collections
      const collections = [
        { name: 'users', indexes: [{ key: { email: 1 }, unique: true }] },
        { name: 'organizations', indexes: [{ key: { name: 1 } }] },
        { name: 'agents', indexes: [{ key: { organizationId: 1 } }] },
        { name: 'callLogs', indexes: [{ key: { timestamp: -1 } }] },
        { name: 'knowledgeBase', indexes: [{ key: { organizationId: 1, category: 1 } }] },
      ];

      for (const collectionInfo of collections) {
        const collection = this.database.collection(collectionInfo.name);

        // Create collection if it doesn't exist
        const collections = await this.database.listCollections({ name: collectionInfo.name }).toArray();
        if (collections.length === 0) {
          await this.database.createCollection(collectionInfo.name);
          this.log(`Created collection: ${collectionInfo.name}`);
        }

        // Create indexes
        if (collectionInfo.indexes) {
          for (const index of collectionInfo.indexes) {
            await collection.createIndex(index.key, { unique: index.unique || false });
            this.log(`Created index on ${collectionInfo.name}: ${JSON.stringify(index.key)}`);
          }
        }
      }

      this.log('MongoDB migrations completed successfully');
    } catch (error: any) {
      this.log(`Migration failed: ${error.message}`, 'error');
      throw error;
    }
  }

  getProviderName(): string {
    return 'mongodb';
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.connected || !this.mongoClient) {
        return false;
      }

      // Ping the database
      await this.database.admin().ping();
      return true;
    } catch (error: any) {
      this.log(`Health check failed: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Get a specific collection
   */
  getCollection(name: string): any {
    if (!this.database) {
      throw new Error('Database not connected');
    }
    return this.database.collection(name);
  }

  /**
   * Build connection string from individual config options
   */
  private buildConnectionString(): string {
    const { host, port, database, username, password, ssl } = this.config;

    if (!host || !database) {
      throw new Error('MongoDB requires host and database name');
    }

    const portStr = port || 27017;
    const credentials = username && password ? `${username}:${password}@` : '';
    const sslParam = ssl !== false ? '&ssl=true' : '';

    return `mongodb://${credentials}${host}:${portStr}/${database}?retryWrites=true&w=majority${sslParam}`;
  }

  /**
   * Extract database name from MongoDB connection string
   */
  private extractDbNameFromConnectionString(connectionString: string): string {
    try {
      // Handle both mongodb:// and mongodb+srv:// formats
      const match = connectionString.match(/\/([^/?]+)(\?|$)/);
      if (match && match[1]) {
        return match[1];
      }
      throw new Error('Could not extract database name from connection string');
    } catch (error) {
      throw new Error('Invalid MongoDB connection string format');
    }
  }
}
