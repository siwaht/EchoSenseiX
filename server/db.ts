import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

let pool: Pool | null = null;
let database: ReturnType<typeof drizzle> | null = null;

function getDatabaseConnection() {
  if (database) return database;

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

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

  database = drizzle(pool, { schema });
  return database;
}

export const db = getDatabaseConnection();

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
