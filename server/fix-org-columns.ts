import Database from 'better-sqlite3';

const dbPath = './dev.db';
const sqlite = new Database(dbPath);

console.log('[DB-FIX] Adding remaining missing columns...');

const orgColumns = [
  'billing_package TEXT DEFAULT "starter"',
  'per_call_rate TEXT DEFAULT "0.30"',
  'per_minute_rate TEXT DEFAULT "0.30"',
  'monthly_credits INTEGER DEFAULT 0',
  'used_credits INTEGER DEFAULT 0',
  'commission_rate TEXT DEFAULT "30"',
  'credit_reset_date INTEGER',
  'custom_rate_enabled INTEGER DEFAULT 0',
  'max_agents INTEGER DEFAULT 5',
  'max_users INTEGER DEFAULT 10',
  'stripe_connect_account_id TEXT',
  'subscription_id TEXT',
  'last_alert_sent_at INTEGER',
  'service_paused_at INTEGER',
  'subscription_tier TEXT DEFAULT "free"',
];

for (const col of orgColumns) {
  const colName = col.split(' ')[0];
  try {
    sqlite.exec(`ALTER TABLE organizations ADD COLUMN ${col};`);
    console.log(`[DB-FIX] ✅ Added ${colName}`);
  } catch (e: any) {
    if (e.message.includes('duplicate column')) {
      console.log(`[DB-FIX] ⏭️  ${colName} exists`);
    } else {
      console.log(`[DB-FIX] ❌ ${colName}: ${e.message}`);
    }
  }
}

sqlite.close();
console.log('[DB-FIX] Complete!');
