/**
 * Database Adapter Interface
 *
 * Provides a unified interface for different database providers
 * Supports: PostgreSQL (Neon), MongoDB, Supabase, MySQL, and more
 */

export interface DatabaseConfig {
  provider: 'postgresql' | 'mongodb' | 'supabase' | 'mysql' | 'sqlite';
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  options?: Record<string, any>;
}

export interface DatabaseAdapter {
  /**
   * Initialize and connect to the database
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the database
   */
  disconnect(): Promise<void>;

  /**
   * Check if the database connection is active
   */
  isConnected(): boolean;

  /**
   * Execute a raw query (provider-specific)
   */
  query(sql: string, params?: any[]): Promise<any>;

  /**
   * Get the underlying database client/connection
   * This allows using provider-specific features when needed
   */
  getClient(): any;

  /**
   * Run database migrations
   */
  migrate(): Promise<void>;

  /**
   * Get database provider name
   */
  getProviderName(): string;

  /**
   * Health check
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Base Database Adapter with common functionality
 */
export abstract class BaseDatabaseAdapter implements DatabaseAdapter {
  protected config: DatabaseConfig;
  protected client: any;
  protected connected: boolean = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract query(sql: string, params?: any[]): Promise<any>;
  abstract migrate(): Promise<void>;
  abstract getProviderName(): string;

  isConnected(): boolean {
    return this.connected;
  }

  getClient(): any {
    return this.client;
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.connected) {
        return false;
      }
      // Override this in specific adapters for provider-specific health checks
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Log database operations
   */
  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const prefix = `[DB:${this.getProviderName().toUpperCase()}]`;
    const fullMessage = `${prefix} ${message}`;

    switch (level) {
      case 'info':
        console.log(fullMessage);
        break;
      case 'warn':
        console.warn(fullMessage);
        break;
      case 'error':
        console.error(fullMessage);
        break;
    }
  }
}
