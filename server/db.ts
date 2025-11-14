import { drizzle as drizzleBetterSqlite } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import Database from 'better-sqlite3';
import ws from 'ws';
import * as schema from "@shared/schema";
import { config } from "./config";

let database: any = null;
let connection: any = null;

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

      default:
        throw new Error("Unsupported database provider: " + provider);
    }
  } catch (error) {
    console.error("[DB] Failed to connect to " + provider + ":", error);
    throw error;
  }

  return database;
}

// Export a function that returns the database instance
export const db = () => getDatabaseConnection();

// Cleanup function for graceful shutdown
export const closeDatabase = async () => {
  if (connection) {
    try {
      if (config.database.provider === 'postgresql') {
        await connection.end();
      } else if (config.database.provider === 'sqlite') {
        connection.close();
      }
      console.log('[DB] Database connection closed');
    } catch (error) {
      console.error('[DB] Error closing database:', error);
    }
    connection = null;
    database = null;
  }
};

// Handle process termination
process.on('SIGINT', closeDatabase);
process.on('SIGTERM', closeDatabase);
