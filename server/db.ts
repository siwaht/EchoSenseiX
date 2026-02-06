import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import logger from "./utils/logger";

neonConfig.webSocketConstructor = ws;

let pool: Pool | null = null;
let database: ReturnType<typeof drizzle> | null = null;

function getDatabaseConnection() {
  if (database) return database;

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const maxConnections = parseInt(process.env.DATABASE_MAX_CONNECTIONS || '50', 10);
  const minConnections = parseInt(process.env.DATABASE_MIN_CONNECTIONS || '5', 10);

  logger.info('Initializing database connection pool', { maxConnections, minConnections });

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: maxConnections,
    min: minConnections,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
    allowExitOnIdle: false,
    maxUses: 7500,
    statement_timeout: 30000,
  });

  pool.on('error', (err) => {
    logger.error('Database pool error', { error: err.message });
    if (err.message.includes('Connection terminated unexpectedly')) {
      logger.info('Connection terminated, pool will auto-recover');
    }
  });

  pool.on('connect', (client) => {
    client.query('SET statement_timeout = 30000');
  });

  if (process.env.NODE_ENV === 'production') {
    setInterval(() => {
      logger.debug('Database pool stats', {
        total: pool?.totalCount,
        idle: pool?.idleCount,
        waiting: pool?.waitingCount,
      });
    }, 60000);
  }

  database = drizzle(pool, { schema });
  return database;
}

export const db = getDatabaseConnection();

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
      logger.info('Database connection pool closed');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error closing database pool', { error: message });
    }
    pool = null;
    database = null;
  }
};
