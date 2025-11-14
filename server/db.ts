import { drizzle as drizzleBetterSqlite } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import Database from 'better-sqlite3';
import { MongoClient, Db } from 'mongodb';
import ws from 'ws';
import * as schema from "@shared/schema";
import { config } from "./config";

let database: any = null;
let connection: any = null;
let mongoDb: Db | null = null;

function getDatabaseConnection() {
  if (database) {
    return database;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  const provider = config.database.provider;
  console.log("[DB] Using " + provider + " database");

  try {
    switch (provider) {
      case 'sqlite': {
        // Use better-sqlite3 for SQLite
        // Extract file path from DATABASE_URL (file:./dev.db -> ./dev.db)
        const dbPath = process.env.DATABASE_URL.replace(/^file:/, '');
        connection = new Database(dbPath);
        database = drizzleBetterSqlite(connection, { schema });
        console.log("[DB] SQLite connected: " + dbPath);
        break;
      }

      case 'postgresql': {
        // Use Neon for PostgreSQL
        neonConfig.webSocketConstructor = ws;

        connection = new Pool({
          connectionString: process.env.DATABASE_URL,
          max: 50,
          connectionTimeoutMillis: 3000,
          idleTimeoutMillis: 30000,
          allowExitOnIdle: false,
        });

        connection.on('error', (err: Error) => {
          console.error('[DB] Unexpected pool error:', err);
          if (err.message.includes('Connection terminated') || err.message.includes('ECONNREFUSED')) {
            database = null;
            connection = null;
          }
        });

        database = drizzleNeon({ client: connection, schema });
        console.log('[DB] PostgreSQL connected');
        break;
      }

      case 'mongodb': {
        // Use native MongoDB driver
        // MongoDB uses a different pattern - create a promise-based connection
        const client = new MongoClient(process.env.DATABASE_URL, {
          maxPoolSize: 50,
          minPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
        });

        // Store the promise for async connection
        connection = client.connect().then(() => {
          const dbName = process.env.DATABASE_URL.split('/').pop()?.split('?')[0] || 'echosensei';
          mongoDb = client.db(dbName);
          console.log(`[DB] MongoDB connected to database: ${dbName}`);
          return client;
        }).catch((err: Error) => {
          console.error('[DB] MongoDB connection error:', err);
          throw err;
        });

        // For MongoDB, return a wrapper that provides MongoDB-specific methods
        database = {
          _isMongoDB: true,
          _getDb: async () => {
            await connection; // Wait for connection
            return mongoDb;
          },
          _getClient: async () => {
            return await connection;
          }
        };
        break;
      }

      default:
        throw new Error("Unsupported database provider: " + provider);
    }
  } catch (error) {
    console.error("[DB] Failed to connect to " + provider + ":", error);
    throw error;
  }

  return database;
}

// Check if database schema exists (for SQLite)
async function validateDatabaseSchema(): Promise<void> {
  if (config.database.provider !== 'sqlite') {
    return; // Schema validation only needed for SQLite
  }

  try {
    const db = getDatabaseConnection();
    // Try to query the users table to verify schema exists
    await db.select().from(schema.users).limit(1);
    console.log('[DB] ✓ Schema validation passed');
  } catch (error) {
    console.error('[DB] ⚠ Schema validation failed:', error instanceof Error ? error.message : error);
    console.error('[DB] ⚠ Database tables may not exist.');
    console.error('[DB] ⚠ To fix this, run: npm run db:push');
    throw new Error(
      'Database schema not initialized. Please run "npm run db:push" to create tables.'
    );
  }
}

// Export a function that returns the database instance
export const db = () => getDatabaseConnection();

// Validate schema on first use
let schemaValidated = false;
let schemaValidationPromise: Promise<void> | null = null;

export const validateSchema = async (): Promise<void> => {
  if (schemaValidated) {
    return;
  }

  if (!schemaValidationPromise) {
    schemaValidationPromise = validateDatabaseSchema().then(() => {
      schemaValidated = true;
    });
  }

  await schemaValidationPromise;
};

// Cleanup function for graceful shutdown
export const closeDatabase = async () => {
  if (connection) {
    try {
      if (config.database.provider === 'postgresql') {
        await connection.end();
      } else if (config.database.provider === 'sqlite') {
        connection.close();
      } else if (config.database.provider === 'mongodb') {
        const client = await connection;
        await client.close();
      }
      console.log('[DB] Database connection closed');
    } catch (error) {
      console.error('[DB] Error closing database:', error);
    }
    connection = null;
    database = null;
    mongoDb = null;
  }
};

// Helper to get MongoDB database instance
export const getMongoDb = async (): Promise<Db | null> => {
  const db = getDatabaseConnection();
  if (db && db._isMongoDB) {
    return await db._getDb();
  }
  return null;
};

// Handle process termination
process.on('SIGINT', closeDatabase);
process.on('SIGTERM', closeDatabase);
