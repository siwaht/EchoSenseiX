/**
 * Database Factory
 *
 * Creates and manages database adapter instances based on configuration
 * Provides a unified interface for all database operations
 */

import type { DatabaseAdapter, DatabaseConfig } from './database-adapter';
import { PostgreSQLAdapter } from './postgresql-adapter';
import { MongoDBAdapter } from './mongodb-adapter';
import { SupabaseAdapter } from './supabase-adapter';
import { MySQLAdapter } from './mysql-adapter';

export class DatabaseFactory {
  private static instance: DatabaseAdapter | null = null;

  /**
   * Create a database adapter based on configuration
   */
  static createAdapter(config: DatabaseConfig): DatabaseAdapter {
    console.log(`[DB-FACTORY] Creating ${config.provider} adapter...`);

    switch (config.provider) {
      case 'postgresql':
        return new PostgreSQLAdapter(config);

      case 'mongodb':
        return new MongoDBAdapter(config);

      case 'supabase':
        return new SupabaseAdapter(config);

      case 'mysql':
        return new MySQLAdapter(config);

      default:
        throw new Error(`Unsupported database provider: ${config.provider}`);
    }
  }

  /**
   * Get or create a singleton database adapter instance
   */
  static async getInstance(config?: DatabaseConfig): Promise<DatabaseAdapter> {
    if (this.instance && this.instance.isConnected()) {
      return this.instance;
    }

    if (!config) {
      config = this.getConfigFromEnv();
    }

    this.instance = this.createAdapter(config);
    await this.instance.connect();

    return this.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static async reset(): Promise<void> {
    if (this.instance) {
      await this.instance.disconnect();
      this.instance = null;
    }
  }

  /**
   * Get database configuration from environment variables
   */
  static getConfigFromEnv(): DatabaseConfig {
    // Detect provider from environment
    const provider = this.detectProvider();

    const config: DatabaseConfig = {
      provider,
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL !== 'false',
      options: {
        maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '20', 10),
      },
    };

    // Provider-specific configuration
    switch (provider) {
      case 'postgresql':
        config.host = process.env.POSTGRES_HOST || process.env.DB_HOST;
        config.port = parseInt(process.env.POSTGRES_PORT || process.env.DB_PORT || '5432', 10);
        config.database = process.env.POSTGRES_DB || process.env.DB_NAME;
        config.username = process.env.POSTGRES_USER || process.env.DB_USER;
        config.password = process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD;
        break;

      case 'mongodb':
        config.host = process.env.MONGODB_HOST || process.env.DB_HOST;
        config.port = parseInt(process.env.MONGODB_PORT || process.env.DB_PORT || '27017', 10);
        config.database = process.env.MONGODB_DB || process.env.DB_NAME;
        config.username = process.env.MONGODB_USER || process.env.DB_USER;
        config.password = process.env.MONGODB_PASSWORD || process.env.DB_PASSWORD;
        break;

      case 'supabase':
        config.options = {
          ...config.options,
          supabaseUrl: process.env.SUPABASE_URL,
          supabaseKey: process.env.SUPABASE_KEY,
          serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        };
        break;

      case 'mysql':
        config.host = process.env.MYSQL_HOST || process.env.DB_HOST;
        config.port = parseInt(process.env.MYSQL_PORT || process.env.DB_PORT || '3306', 10);
        config.database = process.env.MYSQL_DB || process.env.DB_NAME;
        config.username = process.env.MYSQL_USER || process.env.DB_USER;
        config.password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD;
        break;
    }

    return config;
  }

  /**
   * Detect database provider from environment variables
   */
  private static detectProvider(): DatabaseConfig['provider'] {
    // Explicit provider setting
    const explicitProvider = process.env.DATABASE_PROVIDER?.toLowerCase();
    if (explicitProvider) {
      return explicitProvider as DatabaseConfig['provider'];
    }

    // Detect from connection string
    const connectionString = process.env.DATABASE_URL;
    if (connectionString) {
      if (connectionString.startsWith('mongodb://') || connectionString.startsWith('mongodb+srv://')) {
        return 'mongodb';
      }
      if (connectionString.startsWith('mysql://')) {
        return 'mysql';
      }
      if (connectionString.includes('supabase.co')) {
        return 'supabase';
      }
      // Default to PostgreSQL for postgres:// and generic connection strings
      return 'postgresql';
    }

    // Detect from environment variable prefixes
    if (process.env.MONGODB_HOST || process.env.MONGODB_URL) {
      return 'mongodb';
    }
    if (process.env.MYSQL_HOST) {
      return 'mysql';
    }
    if (process.env.SUPABASE_URL) {
      return 'supabase';
    }

    // Default to PostgreSQL (current default)
    console.warn(
      '[DB-FACTORY] No database provider specified, defaulting to PostgreSQL. ' +
        'Set DATABASE_PROVIDER environment variable to change this.'
    );
    return 'postgresql';
  }

  /**
   * Health check for the current database connection
   */
  static async healthCheck(): Promise<{
    healthy: boolean;
    provider: string;
    message?: string;
  }> {
    try {
      if (!this.instance) {
        return {
          healthy: false,
          provider: 'none',
          message: 'No database connection established',
        };
      }

      const healthy = await this.instance.healthCheck();
      return {
        healthy,
        provider: this.instance.getProviderName(),
        message: healthy ? 'Database connection is healthy' : 'Database connection is unhealthy',
      };
    } catch (error: any) {
      return {
        healthy: false,
        provider: this.instance?.getProviderName() || 'unknown',
        message: error.message,
      };
    }
  }
}

/**
 * Convenience function to get database instance
 */
export async function getDatabase(config?: DatabaseConfig): Promise<DatabaseAdapter> {
  return DatabaseFactory.getInstance(config);
}

/**
 * Graceful shutdown helper
 */
export async function closeDatabaseConnection(): Promise<void> {
  await DatabaseFactory.reset();
}
