import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../shared/schema';
import { unlinkSync, existsSync } from 'fs';

const dbPath = './dev.db';

console.log('[DB-INIT] Initializing SQLite database with full schema...');

// Remove old db if exists
if (existsSync(dbPath)) {
  unlinkSync(dbPath);
  console.log('[DB-INIT] Removed old database file');
}

const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema });

// Enable foreign keys
sqlite.exec('PRAGMA foreign_keys = ON;');

console.log('[DB-INIT] Creating tables from schema...');

try {
  // Organizations table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subdomain TEXT UNIQUE,
      custom_domain TEXT,
      whitelabel_enabled INTEGER DEFAULT 0,
      billing_status TEXT DEFAULT 'trial',
      subscription_tier TEXT DEFAULT 'free',
      credit_balance TEXT DEFAULT '0',
      credit_alert_threshold TEXT DEFAULT '100',
      credit_alert_status TEXT DEFAULT 'normal',
      last_payment_date INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Users table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      organization_id TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      role TEXT DEFAULT 'user',
      permissions TEXT DEFAULT '[]',
      profile_image_url TEXT,
      phone_number TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );
  `);

  // Integrations table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS integrations (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      api_key TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING_APPROVAL',
      last_tested INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      UNIQUE(organization_id, provider)
    );
  `);

  // Provider Integrations table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS provider_integrations (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      provider_type TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      display_name TEXT,
      credentials TEXT NOT NULL,
      config TEXT,
      metadata TEXT,
      status TEXT DEFAULT 'ACTIVE',
      is_primary INTEGER DEFAULT 0,
      last_tested INTEGER,
      last_used INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );
  `);

  // Provider Usage table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS provider_usage (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      provider_integration_id TEXT NOT NULL,
      usage_type TEXT NOT NULL,
      quantity TEXT NOT NULL,
      cost TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (provider_integration_id) REFERENCES provider_integrations(id) ON DELETE CASCADE
    );
  `);

  // Agents table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      eleven_labs_agent_id TEXT,
      platform TEXT DEFAULT 'elevenlabs',
      external_agent_id TEXT,
      config TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );
  `);

  // User Agents table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user_agents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      UNIQUE(user_id, agent_id)
    );
  `);

  // Call Logs table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS call_logs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      agent_id TEXT,
      call_id TEXT,
      duration INTEGER,
      cost TEXT,
      transcript TEXT,
      recording_url TEXT,
      status TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
    );
  `);

  // Phone Numbers table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS phone_numbers (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      phone_number TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      capabilities TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );
  `);

  // Knowledge Base Entries table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_base_entries (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      file_url TEXT,
      file_type TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );
  `);

  console.log('[DB-INIT] ✅ Core tables created successfully');
  console.log('[DB-INIT] Database initialized at:', dbPath);
  console.log('[DB-INIT] Tables: organizations, users, integrations, provider_integrations, provider_usage, agents, user_agents, call_logs, phone_numbers, knowledge_base_entries');
  
} catch (error) {
  console.error('[DB-INIT] Error creating schema:', error);
  process.exit(1);
} finally {
  sqlite.close();
}

// Fix: Add missing columns to users table
import Database from 'better-sqlite3';

const dbPath = './dev.db';
const sqlite = new Database(dbPath);

console.log('[DB-FIX] Adding missing columns to users table...');

try {
  sqlite.exec(`
    ALTER TABLE users ADD COLUMN role_template TEXT;
  `);
  console.log('[DB-FIX] ✅ Added role_template column');
} catch (e: any) {
  if (!e.message.includes('duplicate column')) console.log('[DB-FIX] role_template:', e.message);
}

try {
  sqlite.exec(`
    ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';
  `);
  console.log('[DB-FIX] ✅ Added status column');
} catch (e: any) {
  if (!e.message.includes('duplicate column')) console.log('[DB-FIX] status:', e.message);
}

try {
  sqlite.exec(`
    ALTER TABLE users ADD COLUMN metadata TEXT;
  `);
  console.log('[DB-FIX] ✅ Added metadata column');
} catch (e: any) {
  if (!e.message.includes('duplicate column')) console.log('[DB-FIX] metadata:', e.message);
}

try {
  sqlite.exec(`
    ALTER TABLE users ADD COLUMN last_login_at INTEGER;
  `);
  console.log('[DB-FIX] ✅ Added last_login_at column');
} catch (e: any) {
  if (!e.message.includes('duplicate column')) console.log('[DB-FIX] last_login_at:', e.message);
}

try {
  sqlite.exec(`
    ALTER TABLE users ADD COLUMN invited_by TEXT;
  `);
  console.log('[DB-FIX] ✅ Added invited_by column');
} catch (e: any) {
  if (!e.message.includes('duplicate column')) console.log('[DB-FIX] invited_by:', e.message);
}

sqlite.close();
console.log('[DB-FIX] Database schema updated');
