/**
 * MySQL Database Adapter
 *
 * Supports:
 * - MySQL 5.7+
 * - MySQL 8.0+
 * - MariaDB
 * - AWS RDS MySQL
 * - Google Cloud SQL MySQL
 * - Azure Database for MySQL
 * - PlanetScale (MySQL-compatible)
 */

import { BaseDatabaseAdapter, type DatabaseConfig } from './database-adapter';

export class MySQLAdapter extends BaseDatabaseAdapter {
  private pool: any = null;
  private connection: any = null;

  constructor(config: DatabaseConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    try {
      this.log('Connecting to MySQL database...');

      // Dynamically import MySQL to avoid bundling if not used
      const mysql = await import('mysql2/promise');

      const connectionConfig = this.config.connectionString
        ? { uri: this.config.connectionString }
        : {
            host: this.config.host,
            port: this.config.port || 3306,
            user: this.config.username,
            password: this.config.password,
            database: this.config.database,
            ssl: this.config.ssl ? { rejectUnauthorized: false } : undefined,
            waitForConnections: true,
            connectionLimit: this.config.options?.maxConnections || 10,
            maxIdle: 10,
            idleTimeout: 60000,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
          };

      // Create connection pool
      this.pool = mysql.createPool(connectionConfig);

      // Test connection
      this.connection = await this.pool.getConnection();
      await this.connection.ping();
      this.connection.release();

      this.client = this.pool;
      this.connected = true;

      this.log('Successfully connected to MySQL database');
    } catch (error: any) {
      this.log(`Failed to connect to MySQL: ${error.message}`, 'error');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.pool) {
        await this.pool.end();
        this.log('MySQL connection pool closed');
      }
      this.pool = null;
      this.connection = null;
      this.client = null;
      this.connected = false;
    } catch (error: any) {
      this.log(`Error closing MySQL connection: ${error.message}`, 'error');
      throw error;
    }
  }

  async query(sql: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    try {
      const [rows] = await this.pool.execute(sql, params);
      return rows;
    } catch (error: any) {
      this.log(`Query failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async migrate(): Promise<void> {
    this.log('Running MySQL migrations...');

    try {
      // Create tables if they don't exist
      await this.createTables();
      this.log('MySQL migrations completed successfully');
    } catch (error: any) {
      this.log(`Migration failed: ${error.message}`, 'error');
      throw error;
    }
  }

  getProviderName(): string {
    return 'mysql';
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.connected || !this.pool) {
        return false;
      }

      // Execute a simple query
      const [rows] = await this.pool.execute('SELECT 1 as health');
      return rows[0]?.health === 1;
    } catch (error: any) {
      this.log(`Health check failed: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Get connection pool
   */
  getPool(): any {
    return this.pool;
  }

  /**
   * Execute a transaction
   */
  async transaction(callback: (connection: any) => Promise<any>): Promise<any> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    const connection = await this.pool.getConnection();
    await connection.beginTransaction();

    try {
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Create basic tables for the application
   */
  private async createTables(): Promise<void> {
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        full_name VARCHAR(255),
        organization_id VARCHAR(36),
        role ENUM('user', 'admin', 'agency_owner', 'agency_member') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_organization (organization_id),
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      `CREATE TABLE IF NOT EXISTS organizations (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE,
        settings JSON,
        credits INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_slug (slug)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      `CREATE TABLE IF NOT EXISTS agents (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        organization_id VARCHAR(36) NOT NULL,
        voice_id VARCHAR(255),
        system_prompt TEXT,
        config JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_organization (organization_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      `CREATE TABLE IF NOT EXISTS knowledge_base_entries (
        id VARCHAR(36) PRIMARY KEY,
        organization_id VARCHAR(36) NOT NULL,
        title VARCHAR(500) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(255),
        tags JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_organization (organization_id),
        INDEX idx_category (category),
        FULLTEXT idx_content (title, content)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      `CREATE TABLE IF NOT EXISTS call_logs (
        id VARCHAR(36) PRIMARY KEY,
        organization_id VARCHAR(36) NOT NULL,
        agent_id VARCHAR(36),
        phone_number VARCHAR(50),
        duration INT,
        status VARCHAR(50),
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_organization (organization_id),
        INDEX idx_agent (agent_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ];

    for (const tableSql of tables) {
      await this.query(tableSql);
    }

    this.log('Database tables created/verified');
  }
}
