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

  console.log('[DB] Initializing PostgreSQL connection pool...');
  
  // Scalable connection pool settings for concurrent users
  const maxConnections = parseInt(process.env.DATABASE_MAX_CONNECTIONS || '50', 10);
  const minConnections = parseInt(process.env.DATABASE_MIN_CONNECTIONS || '5', 10);
  
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: maxConnections,                    // Max connections for high concurrency
    min: minConnections,                    // Keep minimum connections warm
    connectionTimeoutMillis: 15000,         // 15s connection timeout
    idleTimeoutMillis: 30000,               // 30s idle timeout (faster recycling)
    allowExitOnIdle: false,                 // Keep pool alive
    maxUses: 7500,                          // Recycle connections after 7500 uses
    statement_timeout: 30000,               // 30s query timeout
  });

  pool.on('error', (err) => {
    console.error('[DB] Pool error:', err.message);
    // Don't reset on transient errors
    if (err.message.includes('Connection terminated unexpectedly')) {
      console.log('[DB] Connection terminated, pool will auto-recover');
    }
  });

  pool.on('connect', (client) => {
    // Set session-level optimizations
    client.query('SET statement_timeout = 30000');
  });

  // Log pool stats periodically in production
  if (process.env.NODE_ENV === 'production') {
    setInterval(() => {
      console.log(`[DB] Pool stats: total=${pool?.totalCount}, idle=${pool?.idleCount}, waiting=${pool?.waitingCount}`);
    }, 60000);
  }

  database = drizzle(pool, { schema });
  console.log(`[DB] Connection pool initialized (max: ${maxConnections}, min: ${minConnections})`);
  return database;
}

export const db = getDatabaseConnection();

// Health check for database
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    if (!pool) return false;
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch {
    return false;
  }
};

// Get pool statistics
export const getPoolStats = () => {
  if (!pool) return null;
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
};

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
