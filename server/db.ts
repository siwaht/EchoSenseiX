import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

let pool: Pool | null = null;
let database: any = null;

function getDatabaseConnection() {
  if (!database) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?",
      );
    }

    console.log('[DB] Using PostgreSQL database');
    
    // Configure the connection pool optimized for high concurrency
    pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      max: 50, // Increased from 20 for better concurrency
      connectionTimeoutMillis: 3000, // 3 seconds connection timeout (faster fail)
      idleTimeoutMillis: 30000, // 30 seconds idle timeout (keep connections warm)
      allowExitOnIdle: false, // Keep pool alive
    });

    // Add error handling for pool
    pool.on('error', (err) => {
      console.error('[DB] Unexpected pool error:', err);
      // Reset connection on critical errors
      if (err.message.includes('Connection terminated') || err.message.includes('ECONNREFUSED')) {
        database = null;
        pool = null;
      }
    });

    database = drizzle({ client: pool, schema });
  }
  
  return database;
}

// Export a function that returns the database instance
// This ensures the connection is lazy-loaded and properly cached
export const db = () => getDatabaseConnection();

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

// Handle process termination
process.on('SIGINT', closeDatabase);
process.on('SIGTERM', closeDatabase);
