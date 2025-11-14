import Database from 'better-sqlite3';

const dbPath = './dev.db';
const sqlite = new Database(dbPath);

console.log('[DB-FIX] Adding missing columns to users table...');

const columnsToAdd = [
  { name: 'role_template', sql: 'ALTER TABLE users ADD COLUMN role_template TEXT;' },
  { name: 'status', sql: "ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';" },
  { name: 'metadata', sql: 'ALTER TABLE users ADD COLUMN metadata TEXT;' },
  { name: 'last_login_at', sql: 'ALTER TABLE users ADD COLUMN last_login_at INTEGER;' },
  { name: 'invited_by', sql: 'ALTER TABLE users ADD COLUMN invited_by TEXT;' },
];

for (const col of columnsToAdd) {
  try {
    sqlite.exec(col.sql);
    console.log(`[DB-FIX] ✅ Added ${col.name} column`);
  } catch (e: any) {
    if (e.message.includes('duplicate column')) {
      console.log(`[DB-FIX] ⏭️  ${col.name} already exists`);
    } else {
      console.log(`[DB-FIX] ❌ ${col.name}: ${e.message}`);
    }
  }
}

// Add missing columns to organizations table
console.log('[DB-FIX] Adding missing columns to organizations table...');

const orgColumnsToAdd = [
  { name: 'parent_organization_id', sql: 'ALTER TABLE organizations ADD COLUMN parent_organization_id TEXT;' },
  { name: 'organization_type', sql: "ALTER TABLE organizations ADD COLUMN organization_type TEXT DEFAULT 'end_customer';" },
  { name: 'stripe_customer_id', sql: 'ALTER TABLE organizations ADD COLUMN stripe_customer_id TEXT;' },
  { name: 'metadata', sql: 'ALTER TABLE organizations ADD COLUMN metadata TEXT;' },
  { name: 'settings', sql: 'ALTER TABLE organizations ADD COLUMN settings TEXT;' },
  { name: 'whitelabel_enabled', sql: 'ALTER TABLE organizations ADD COLUMN whitelabel_enabled INTEGER DEFAULT 0;' },
];

for (const col of orgColumnsToAdd) {
  try {
    sqlite.exec(col.sql);
    console.log(`[DB-FIX] ✅ Added ${col.name} column to organizations`);
  } catch (e: any) {
    if (e.message.includes('duplicate column')) {
      console.log(`[DB-FIX] ⏭️  ${col.name} already exists in organizations`);
    } else {
      console.log(`[DB-FIX] ❌ ${col.name}: ${e.message}`);
    }
  }
}

sqlite.close();
console.log('[DB-FIX] Database schema update complete');
