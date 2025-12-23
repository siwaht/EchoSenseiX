import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
// @ts-ignore
import Database from 'better-sqlite3';
import ws from "ws";
import * as crypto from "crypto";
import * as schema from "@shared/schema";

// Note: Logger imported after to avoid circular dependencies
// Using console for critical startup messages that must happen before logger is available

import { drizzle as drizzleD1 } from 'drizzle-orm/d1';

neonConfig.webSocketConstructor = ws;

let pool: Pool | null = null;
let database: ReturnType<typeof drizzle> | ReturnType<typeof drizzleSqlite> | ReturnType<typeof drizzleD1> | null = null;

function getDatabaseConnection() {
  if (database) return database;

  // 1. Check for Postgres (Production/Cloud)
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    // Use console.log for startup messages (logger may not be initialized yet)
    console.log('[DB] Initializing PostgreSQL connection...');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '10', 10),
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 60000,
      allowExitOnIdle: true,
    });

    pool.on('error', (err) => {
      console.error('[DB] Unexpected pool error:', err.message);
      if (err.message.includes('Connection terminated') || err.message.includes('ECONNREFUSED')) {
        database = null;
        pool = null;
      }
    });

    pool.on('connect', () => {
      console.log('[DB] New client connected to pool');
    });

    database = drizzle({ client: pool, schema });
  }
  // 2. Fallback to SQLite (Local/Dev/Plug & Play)
  else {
    console.log('[DB] No valid DATABASE_URL found. Using local SQLite (plug-and-play mode).');
    const sqlite = new Database('local.db');

    // Register gen_random_uuid function for Postgres compatibility
    try {
      sqlite.function('gen_random_uuid', () => crypto.randomUUID());
      sqlite.function('now', () => new Date().toISOString());
    } catch (e) {
      console.warn('[DB] Failed to register compatibility functions:', e);
    }

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
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[DB] Error closing database pool:', message);
    }
    pool = null;
    database = null;
  }
};
