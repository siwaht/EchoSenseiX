import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../shared/schema';

const dbPath = './dev.db';
const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema });

console.log('[INIT] Initializing SQLite database...');
console.log('[INIT] Creating schema from Drizzle ORM...');

// Create all tables using SQL
const tables = [
  `CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    organization_id TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    role TEXT DEFAULT 'user',
    permissions TEXT DEFAULT '[]',
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
  )`,
  `CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    organization_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    api_key TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING_APPROVAL',
    last_tested INTEGER,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    UNIQUE(organization_id, provider)
  )`,
  `CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
  )`
];

try {
  for (const sql of tables) {
    sqlite.exec(sql);
  }
  console.log('[INIT] ✅ Database schema created successfully');
  console.log('[INIT] Database ready at:', dbPath);
} catch (error) {
  console.error('[INIT] Error creating schema:', error);
  process.exit(1);
} finally {
  sqlite.close();
}
