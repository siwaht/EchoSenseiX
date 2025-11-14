import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { nanoid } from 'nanoid';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const dbPath = './dev.db';

if (!existsSync(dbPath)) {
  console.error('Database file does not exist!');
  process.exit(1);
}

const sqlite = new Database(dbPath);

async function seedAdmin() {
  try {
    console.log('[SEED] Seeding admin user directly...');

    // Check if user exists
    const existing = sqlite.prepare('SELECT * FROM users WHERE email = ?').get('cc@siwaht.com');

    if (existing) {
      console.log('[SEED] Admin user already exists');
      sqlite.close();
      return;
    }

    // Create organization
    const orgId = nanoid();
    const now = Date.now();

    sqlite.prepare(`
      INSERT INTO organizations (id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(orgId, 'EchoSenseiX Admin', now, now);

    console.log('[SEED] Organization created:', orgId);

    // Hash password using scrypt (same as auth.ts)
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync('Hola173!', salt, 64)) as Buffer;
    const hashedPassword = `${buf.toString("hex")}.${salt}`;

    // Create admin user
    const userId = nanoid();
    const permissions = JSON.stringify([
      'manage_users',
      'manage_branding',
      'manage_voices',
      'manage_agents',
      'manage_integrations',
      'access_playground',
      'view_call_history',
      'manage_phone_numbers'
    ]);

    sqlite.prepare(`
      INSERT INTO users (
        id, email, password, first_name, last_name,
        organization_id, is_admin, permissions, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      'cc@siwaht.com',
      hashedPassword,
      'Admin',
      'User',
      orgId,
      1, // is_admin = true
      permissions,
      now,
      now
    );

    console.log('[SEED] ✅ Admin user created successfully: cc@siwaht.com');

  } catch (error) {
    console.error('[SEED] Error:', error);
    process.exit(1);
  } finally {
    sqlite.close();
  }
}

seedAdmin();
