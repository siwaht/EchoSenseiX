import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';

const db = new Database('./dev.db');
const drizzleDb = drizzle(db);

// Create essential tables for development
async function initDevDatabase() {
  try {
    console.log('[DB] Initializing development database...');
    
    // Create users table
    await drizzleDb.run(sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
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
        metadata TEXT DEFAULT '{}',
        last_login_at TEXT,
        invited_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create organizations table
    await drizzleDb.run(sql`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        name TEXT NOT NULL,
        subdomain TEXT,
        custom_domain TEXT,
        parent_organization_id TEXT,
        organization_type TEXT DEFAULT 'end_customer',
        billing_package TEXT DEFAULT 'starter',
        per_call_rate TEXT DEFAULT '0.30',
        per_minute_rate TEXT DEFAULT '0.30',
        monthly_credits INTEGER DEFAULT 0,
        used_credits INTEGER DEFAULT 0,
        credit_balance TEXT DEFAULT '0',
        commission_rate TEXT DEFAULT '30',
        credit_reset_date TEXT,
        custom_rate_enabled INTEGER DEFAULT 0,
        max_agents INTEGER DEFAULT 5,
        max_users INTEGER DEFAULT 10,
        stripe_customer_id TEXT,
        stripe_connect_account_id TEXT,
        subscription_id TEXT,
        billing_status TEXT DEFAULT 'inactive',
        credit_alert_status TEXT DEFAULT 'normal',
        last_alert_sent_at TEXT,
        service_paused_at TEXT,
        last_payment_date TEXT,
        metadata TEXT DEFAULT '{}',
        settings TEXT DEFAULT '{}',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create agents table
    await drizzleDb.run(sql`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        organization_id TEXT NOT NULL,
        eleven_labs_agent_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        first_message TEXT,
        system_prompt TEXT,
        language TEXT DEFAULT 'en',
        voice_id TEXT,
        voice_settings TEXT DEFAULT '{}',
        multi_voice_config TEXT DEFAULT '{}',
        llm_settings TEXT DEFAULT '{}',
        tools TEXT DEFAULT '{}',
        is_active INTEGER DEFAULT 1,
        last_synced TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create call_logs table
    await drizzleDb.run(sql`
      CREATE TABLE IF NOT EXISTS call_logs (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        organization_id TEXT NOT NULL,
        agent_id TEXT,
        eleven_labs_call_id TEXT,
        conversation_id TEXT,
        phone_number TEXT,
        duration INTEGER,
        cost TEXT,
        status TEXT,
        transcript TEXT,
        recording_url TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create integrations table
    await drizzleDb.run(sql`
      CREATE TABLE IF NOT EXISTS integrations (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        organization_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        api_key TEXT,
        config TEXT DEFAULT '{}',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create sessions table
    await drizzleDb.run(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expire TEXT NOT NULL
      )
    `);

    console.log('[DB] Development database initialized successfully');
  } catch (error) {
    console.error('[DB] Error initializing development database:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Run initialization if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initDevDatabase().catch(console.error);
}

export { initDevDatabase };
