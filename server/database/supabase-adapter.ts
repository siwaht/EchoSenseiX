/**
 * Supabase Database Adapter
 *
 * Supabase is built on PostgreSQL, providing:
 * - Managed PostgreSQL database
 * - Real-time subscriptions
 * - Built-in authentication
 * - Row-level security
 * - Auto-generated APIs
 */

import { BaseDatabaseAdapter, type DatabaseConfig } from './database-adapter';

export interface SupabaseConfig extends DatabaseConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
  serviceRoleKey?: string;
}

export class SupabaseAdapter extends BaseDatabaseAdapter {
  private supabase: any = null;
  private postgresClient: any = null;

  constructor(config: SupabaseConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    try {
      this.log('Connecting to Supabase database...');

      // Dynamically import Supabase to avoid bundling if not used
      const { createClient } = await import('@supabase/supabase-js');

      const supabaseUrl = (this.config as SupabaseConfig).supabaseUrl || process.env.SUPABASE_URL;
      const supabaseKey =
        (this.config as SupabaseConfig).serviceRoleKey ||
        (this.config as SupabaseConfig).supabaseKey ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase URL and service role key are required');
      }

      // Create Supabase client
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: false,
        },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'x-application-name': 'echosenseix',
          },
        },
      });

      this.client = this.supabase;
      this.connected = true;

      // Also connect directly to PostgreSQL if connection string is provided
      if (this.config.connectionString) {
        await this.connectToPostgres();
      }

      this.log('Successfully connected to Supabase');
    } catch (error: any) {
      this.log(`Failed to connect to Supabase: ${error.message}`, 'error');
      throw error;
    }
  }

  private async connectToPostgres(): Promise<void> {
    try {
      this.log('Connecting to Supabase PostgreSQL directly...');

      const { Pool } = await import('pg');

      this.postgresClient = new Pool({
        connectionString: this.config.connectionString,
        max: this.config.options?.maxConnections || 20,
        ssl: this.config.ssl !== false ? { rejectUnauthorized: false } : undefined,
      });

      this.log('Connected to Supabase PostgreSQL');
    } catch (error: any) {
      this.log(`Failed to connect to Supabase PostgreSQL: ${error.message}`, 'warn');
      // Non-fatal error - can still use Supabase client
    }
  }

  async disconnect(): Promise<void> {
    try {
      // Close PostgreSQL connection if exists
      if (this.postgresClient) {
        await this.postgresClient.end();
        this.log('Supabase PostgreSQL connection closed');
      }

      // Supabase client doesn't need explicit disconnection
      this.supabase = null;
      this.postgresClient = null;
      this.client = null;
      this.connected = false;

      this.log('Disconnected from Supabase');
    } catch (error: any) {
      this.log(`Error disconnecting from Supabase: ${error.message}`, 'error');
      throw error;
    }
  }

  async query(sql: string, params?: any[]): Promise<any> {
    // Use direct PostgreSQL connection if available
    if (this.postgresClient) {
      try {
        const result = await this.postgresClient.query(sql, params);
        return result.rows;
      } catch (error: any) {
        this.log(`Query failed: ${error.message}`, 'error');
        throw error;
      }
    }

    // Otherwise use Supabase RPC
    this.log('Direct SQL queries require PostgreSQL connection string', 'warn');
    throw new Error('PostgreSQL connection not available. Use Supabase client methods instead.');
  }

  async migrate(): Promise<void> {
    this.log('Running Supabase migrations...');

    // Supabase migrations are typically managed through:
    // 1. Supabase CLI: supabase db push
    // 2. Supabase Dashboard
    // 3. SQL scripts in migrations folder

    if (this.postgresClient) {
      try {
        // Run any custom migrations here
        this.log('Migrations should be run using Supabase CLI or Dashboard');
        this.log('Run: supabase db push');
      } catch (error: any) {
        this.log(`Migration failed: ${error.message}`, 'error');
        throw error;
      }
    } else {
      this.log('PostgreSQL connection required for migrations', 'warn');
    }
  }

  getProviderName(): string {
    return 'supabase';
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.connected || !this.supabase) {
        return false;
      }

      // Try to query a simple table or use RPC
      const { data, error } = await this.supabase.from('users').select('count').limit(1);

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" which is fine
        this.log(`Health check failed: ${error.message}`, 'error');
        return false;
      }

      return true;
    } catch (error: any) {
      this.log(`Health check failed: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Get the Supabase client for direct access to Supabase features
   */
  getSupabaseClient(): any {
    return this.supabase;
  }

  /**
   * Query using Supabase's table interface
   */
  async table(tableName: string): Promise<any> {
    if (!this.supabase) {
      throw new Error('Database not connected');
    }
    return this.supabase.from(tableName);
  }

  /**
   * Use Supabase RPC (Remote Procedure Call)
   */
  async rpc(functionName: string, params?: any): Promise<any> {
    if (!this.supabase) {
      throw new Error('Database not connected');
    }

    const { data, error } = await this.supabase.rpc(functionName, params);

    if (error) {
      throw new Error(`RPC failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Get PostgreSQL client for raw SQL queries
   */
  getPostgresClient(): any {
    return this.postgresClient;
  }
}
