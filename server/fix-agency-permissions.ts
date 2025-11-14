import Database from 'better-sqlite3';
import { existsSync } from 'fs';

const dbPath = './dev.db';

if (!existsSync(dbPath)) {
  console.error('Database file does not exist!');
  process.exit(1);
}

const sqlite = new Database(dbPath);

try {
  console.log('[FIX] Adding agency_permissions column to organizations table...');

  // Check if column already exists
  const columns = sqlite.prepare("PRAGMA table_info(organizations)").all();
  const hasColumn = columns.some((col: any) => col.name === 'agency_permissions');

  if (hasColumn) {
    console.log('[FIX] ✅ agency_permissions column already exists');
  } else {
    sqlite.exec(`ALTER TABLE organizations ADD COLUMN agency_permissions TEXT DEFAULT '[]';`);
    console.log('[FIX] ✅ agency_permissions column added successfully');
  }

  // Verify
  const updatedColumns = sqlite.prepare("PRAGMA table_info(organizations)").all();
  console.log('[FIX] Organizations table columns:', updatedColumns.map((c: any) => c.name).join(', '));

} catch (error) {
  console.error('[FIX] Error:', error);
  process.exit(1);
} finally {
  sqlite.close();
}

console.log('[FIX] ✅ Database fix completed');
