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
      max: 20, // Increased for handling 100s of concurrent users
      connectionTimeoutMillis: 5000, // 5 seconds connection timeout (faster fail)
      idleTimeoutMillis: 10000, // 10 seconds idle timeout (more aggressive cleanup)
      allowExitOnIdle: true
    });

    database = drizzle({ client: pool, schema });
  }
  
  return database;
}

// Export the function that lazy-loads the database connection
export const db = getDatabaseConnection;