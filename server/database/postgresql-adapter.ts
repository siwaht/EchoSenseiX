/**
 * PostgreSQL Database Adapter
 *
 * Supports:
 * - Neon Serverless PostgreSQL
 * - Standard PostgreSQL
 * - AWS RDS PostgreSQL
 * - Google Cloud SQL PostgreSQL
 * - Azure Database for PostgreSQL
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '@shared/schema';
import { BaseDatabaseAdapter, type DatabaseConfig } from './database-adapter';

export class PostgreSQLAdapter extends BaseDatabaseAdapter {
  private pool: Pool | null = null;
  private db: any = null;

  constructor(config: DatabaseConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    try {
      this.log('Connecting to PostgreSQL database...');

      const connectionString = this.config.connectionString || this.buildConnectionString();

      if (!connectionString) {
        throw new Error('PostgreSQL connection string is required');
      }

      // Configure Neon for WebSocket support (works for both Neon and standard PostgreSQL)
      neonConfig.webSocketConstructor = ws;

      // Create connection pool
      this.pool = new Pool({
        connectionString,
        max: this.config.options?.maxConnections || 50,
        connectionTimeoutMillis: 3000,
        idleTimeoutMillis: 30000,
        allowExitOnIdle: false,
        ssl: this.config.ssl !== false, // Enable SSL by default
      });

      // Add error handling for pool
      this.pool.on('error', (err) => {
        this.log(`Unexpected pool error: ${err.message}`, 'error');
        // Reset connection on critical errors
        if (
          err.message.includes('Connection terminated') ||
          err.message.includes('ECONNREFUSED')
        ) {
          this.connected = false;
          this.pool = null;
          this.db = null;
        }
      });

      // Create Drizzle instance
      this.db = drizzle({ client: this.pool, schema });
      this.client = this.db;
      this.connected = true;

      this.log('Successfully connected to PostgreSQL database');
    } catch (error: any) {
      this.log(`Failed to connect to PostgreSQL: ${error.message}`, 'error');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.pool) {
        await this.pool.end();
        this.log('Database connection pool closed');
      }
      this.pool = null;
      this.db = null;
      this.client = null;
      this.connected = false;
    } catch (error: any) {
      this.log(`Error closing database pool: ${error.message}`, 'error');
      throw error;
    }
  }

  async query(sql: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    try {
      const result = await this.pool.query(sql, params);
      return result.rows;
    } catch (error: any) {
      this.log(`Query failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async migrate(): Promise<void> {
    this.log('Running database migrations...');
    // Migrations are handled by drizzle-kit
    // This method can be used to trigger migrations programmatically
    this.log('Migrations should be run using: npm run db:push or npm run db:migrate');
  }

  getProviderName(): string {
    return 'postgresql';
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.connected || !this.pool) {
        return false;
      }

      // Execute a simple query to check connection
      const result = await this.pool.query('SELECT 1 as health');
      return result.rows[0]?.health === 1;
    } catch (error: any) {
      this.log(`Health check failed: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Get the Drizzle ORM instance
   */
  getDrizzle(): any {
    return this.db;
  }

  /**
   * Build connection string from individual config options
   */
  private buildConnectionString(): string {
    const { host, port, database, username, password, ssl } = this.config;

    if (!host || !database || !username) {
      throw new Error('PostgreSQL requires host, database, and username');
    }

    const portStr = port || 5432;
    const sslParam = ssl !== false ? '?sslmode=require' : '';
    const passwordStr = password ? `:${password}` : '';

    return `postgresql://${username}${passwordStr}@${host}:${portStr}/${database}${sslParam}`;
  }
}
