import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

let pool: Pool | null = null;
let database: any = null;

function getDatabaseConnection() {
  if (database) return database;

  // 1. Check for Postgres (Production/Cloud)
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    console.log('[DB] Initializing PostgreSQL connection...');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 50, // Optimized for high concurrency
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      allowExitOnIdle: false,
    });

    pool.on('error', (err) => {
      console.error('[DB] Unexpected pool error:', err);
      if (err.message.includes('Connection terminated') || err.message.includes('ECONNREFUSED')) {
        database = null;
        pool = null;
      }
    });

    database = drizzle({ client: pool, schema });
  }
  // 2. Fallback to SQLite (Local/Dev/Plug & Play)
  else {
    console.log('[DB] No valid DATABASE_URL found. Using local SQLite (plug-and-play mode).');
    // Ensure the data directory exists or use root
    const sqlite = new Database('local.db');
    database = drizzleSqlite(sqlite, { schema });
  }

  return database;
}

// Export a function that returns the database instance
export const db = getDatabaseConnection();

// Cleanup function for graceful shutdown
export const closeDatabase = async () => {
  if (pool) {
    try {
      await pool.end();
      console.log('[DB] Database connection pool closed');
    } catch (error) {
      console.error('[DB] Error closing database pool:', error);
    }
    pool = null;
    database = null;
  }
};

process.on('SIGINT', closeDatabase);
process.on('SIGTERM', closeDatabase);
