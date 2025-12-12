
// @ts-ignore
import Database from 'better-sqlite3';
import { randomBytes, scryptSync, randomUUID } from 'crypto';

const db = new Database('local.db');

function init() {
  console.log('Initializing SQLite database schema...');

  // DROP Tables to ensure schema update
  db.exec('DROP TABLE IF EXISTS users');
  db.exec('DROP TABLE IF EXISTS organizations');
  db.exec('DROP TABLE IF EXISTS integrations');

  // Create Organizations table
  db.exec(`
    CREATE TABLE organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subdomain TEXT,
      custom_domain TEXT,
      parent_organization_id TEXT,
      organization_type TEXT DEFAULT 'end_customer',
      billing_package TEXT DEFAULT 'starter',
      per_call_rate DECIMAL DEFAULT 0.30,
      per_minute_rate DECIMAL DEFAULT 0.30,
      monthly_credits INTEGER DEFAULT 0,
      used_credits INTEGER DEFAULT 0,
      credit_balance DECIMAL DEFAULT 0,
      commission_rate DECIMAL DEFAULT 30,
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
      tier_limits TEXT,
      agency_permissions TEXT,
      agency_role TEXT,
      elevenlabs_api_key_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create Users table
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
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
      permissions TEXT,
      metadata TEXT,
      last_login_at DATETIME,
      invited_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create Integrations table
  db.exec(`
    CREATE TABLE integrations (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_category TEXT,
      api_key TEXT,
      api_key_last4 TEXT,
      credentials TEXT,
      config TEXT,
      status TEXT DEFAULT 'PENDING_APPROVAL',
      last_tested DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Manual Admin Seeding
  const ADMIN_EMAIL = "cc@siwaht.com";
  const ADMIN_PASSWORD = "Hola173!";

  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(ADMIN_PASSWORD, salt, 64);
  const hashedPassword = `${derivedKey.toString('hex')}.${salt}`;

  const adminId = randomUUID();
  const orgId = randomUUID();

  // Create Organization for Admin
  const insertOrg = db.prepare(`
    INSERT INTO organizations (id, name, created_at, updated_at) 
    VALUES (?, ?, ?, ?)
  `);
  insertOrg.run(orgId, 'Admin Organization', new Date().toISOString(), new Date().toISOString());

  // Create Admin User
  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password, first_name, last_name, organization_id, is_admin, role, permissions, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    adminId,
    ADMIN_EMAIL,
    hashedPassword,
    'Admin',
    'User',
    orgId,
    1, // is_admin true
    'admin', // role
    JSON.stringify([
      'manage_users',
      'manage_branding',
      'manage_voices',
      'manage_agents',
      'access_playground',
      'view_call_history',
      'manage_phone_numbers'
    ]),
    new Date().toISOString(),
    new Date().toISOString()
  );

  console.log(`Admin user ${ADMIN_EMAIL} seeded successfully.`);
  console.log('Tables created successfully.');
}

init();
