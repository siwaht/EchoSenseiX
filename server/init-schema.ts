import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from "@shared/schema";

async function initializeSchema() {
  console.log('[SCHEMA] Initializing database schema...');
  
  const sqlite = new Database('./dev.db');
  const db = drizzle(sqlite, { schema });

  try {
    // Create users table
    await sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        email TEXT UNIQUE NOT NULL,
        password TEXT,
        first_name TEXT,
        last_name TEXT,
        profile_image_url TEXT,
        organization_id TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0,
        role TEXT DEFAULT 'user',
        role_template TEXT,
        status TEXT DEFAULT 'active',
        permissions TEXT DEFAULT '[]',
        metadata TEXT,
        last_login_at DATETIME,
        invited_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create organizations table
    await sqlite.exec(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name TEXT NOT NULL,
        subdomain TEXT UNIQUE,
        custom_domain TEXT,
        parent_organization_id TEXT,
        organization_type TEXT DEFAULT 'end_customer',
        billing_package TEXT DEFAULT 'starter',
        per_call_rate REAL DEFAULT 0.30,
        per_minute_rate REAL DEFAULT 0.30,
        monthly_credits INTEGER DEFAULT 0,
        used_credits INTEGER DEFAULT 0,
        credit_balance REAL DEFAULT 0,
        commission_rate REAL DEFAULT 30,
        credit_reset_date DATETIME,
        custom_rate_enabled INTEGER DEFAULT 0,
        max_agents INTEGER DEFAULT 5,
        max_users INTEGER DEFAULT 10,
        stripe_customer_id TEXT,
        stripe_connect_account_id TEXT,
        subscription_id TEXT,
        billing_status TEXT DEFAULT 'inactive',
        credit_alert_status TEXT DEFAULT 'normal',
        last_alert_sent_at DATETIME,
        service_paused_at DATETIME,
        last_payment_date DATETIME,
        metadata TEXT,
        settings TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create agents table
    await sqlite.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        organization_id TEXT NOT NULL,
        eleven_labs_agent_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        first_message TEXT,
        system_prompt TEXT,
        language TEXT DEFAULT 'en',
        voice_id TEXT,
        voice_settings TEXT,
        multi_voice_config TEXT,
        llm_settings TEXT,
        tools TEXT,
        turn_taking_settings TEXT,
        privacy_settings TEXT,
        authentication_settings TEXT,
        webhook_settings TEXT,
        knowledge_base_settings TEXT,
        is_active INTEGER DEFAULT 1,
        last_synced DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create call_logs table
    await sqlite.exec(`
      CREATE TABLE IF NOT EXISTS call_logs (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        organization_id TEXT NOT NULL,
        agent_id TEXT,
        eleven_labs_call_id TEXT,
        conversation_id TEXT NOT NULL,
        phone_number TEXT,
        duration INTEGER,
        transcript TEXT,
        audio_url TEXT,
        cost REAL,
        status TEXT,
        start_time DATETIME,
        end_time DATETIME,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create integrations table
    await sqlite.exec(`
      CREATE TABLE IF NOT EXISTS integrations (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        organization_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        api_key TEXT,
        config TEXT,
        is_active INTEGER DEFAULT 1,
        last_synced DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(organization_id, provider)
      );
    `);

    // Create knowledge_base_entries table
    await sqlite.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_base_entries (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        organization_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT DEFAULT 'General',
        tags TEXT DEFAULT '[]',
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create documents table
    await sqlite.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        organization_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER,
        content TEXT,
        processing_status TEXT DEFAULT 'pending',
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create multilingual_configs table
    await sqlite.exec(`
      CREATE TABLE IF NOT EXISTS multilingual_configs (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        agent_id TEXT NOT NULL,
        language_code TEXT NOT NULL,
        first_message TEXT,
        system_prompt TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(agent_id, language_code)
      );
    `);

    console.log('[SCHEMA] Database schema initialized successfully');
  } catch (error) {
    console.error('[SCHEMA] Error initializing schema:', error);
    throw error;
  } finally {
    sqlite.close();
  }
}

// Run initialization if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeSchema().catch(console.error);
}

export { initializeSchema };
