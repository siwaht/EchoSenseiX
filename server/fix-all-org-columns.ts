import Database from 'better-sqlite3';
import { existsSync } from 'fs';

const dbPath = './dev.db';

if (!existsSync(dbPath)) {
  console.error('Database file does not exist!');
  process.exit(1);
}

const sqlite = new Database(dbPath);

try {
  console.log('[FIX] Checking organizations table for missing columns...');

  // Get current columns
  const columns = sqlite.prepare("PRAGMA table_info(organizations)").all();
  const existingColumns = columns.map((col: any) => col.name);

  console.log('[FIX] Existing columns:', existingColumns.join(', '));

  // Define all columns that should exist
  const columnsToAdd = [
    { name: 'metadata', sql: 'ALTER TABLE organizations ADD COLUMN metadata TEXT;' },
    { name: 'settings', sql: 'ALTER TABLE organizations ADD COLUMN settings TEXT;' },
    { name: 'agency_role', sql: 'ALTER TABLE organizations ADD COLUMN agency_role TEXT;' },
    { name: 'elevenlabs_api_key_hash', sql: 'ALTER TABLE organizations ADD COLUMN elevenlabs_api_key_hash TEXT;' },
  ];

  // Add missing columns
  for (const column of columnsToAdd) {
    if (!existingColumns.includes(column.name)) {
      console.log(`[FIX] Adding column: ${column.name}`);
      sqlite.exec(column.sql);
      console.log(`[FIX] ✅ ${column.name} added`);
    } else {
      console.log(`[FIX] ✓ ${column.name} already exists`);
    }
  }

  // Verify final state
  const updatedColumns = sqlite.prepare("PRAGMA table_info(organizations)").all();
  console.log('\n[FIX] Final organizations columns:', updatedColumns.map((c: any) => c.name).join(', '));

} catch (error) {
  console.error('[FIX] Error:', error);
  process.exit(1);
} finally {
  sqlite.close();
}

console.log('\n[FIX] ✅ All organization columns fixed');
