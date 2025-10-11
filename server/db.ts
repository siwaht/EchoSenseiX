import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleSQLite } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

let pool: Pool | null = null;
let sqliteDb: Database.Database | null = null;
let database: ReturnType<typeof drizzle> | ReturnType<typeof drizzleSQLite> | null = null;

function getDatabaseConnection() {
  if (!database) {
    // Check if we're in development mode and DATABASE_URL is not a real connection
    const isDevelopment = process.env.NODE_ENV === 'development' && 
                         (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('username:password'));
    
    if (isDevelopment) {
      console.log('[DB] Using SQLite for development');
      // Use SQLite for development
      sqliteDb = new Database('./dev.db');
      database = drizzleSQLite(sqliteDb, { schema });
    } else {
      if (!process.env.DATABASE_URL) {
        throw new Error(
          "DATABASE_URL must be set. Did you forget to provision a database?",
        );
      }

      // Configure the connection pool optimized for high concurrency
      pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        max: 20, // Increased for handling 100s of concurrent users
        connectionTimeoutMillis: 5000, // 5 seconds connection timeout (faster fail)
        idleTimeoutMillis: 10000, // 10 seconds idle timeout (more aggressive cleanup)
        allowExitOnIdle: true
      });

      database = drizzle({ client: pool, schema });
    }
  }
  
  return database;
}

// Export the function that lazy-loads the database connection
export const db = getDatabaseConnection;