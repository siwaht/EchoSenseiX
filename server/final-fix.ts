import Database from 'better-sqlite3';

const sqlite = new Database('./dev.db');
console.log('[FINAL-FIX] Adding tier_limits column...');

try {
  sqlite.exec('ALTER TABLE organizations ADD COLUMN tier_limits TEXT;');
  console.log('[FINAL-FIX] ✅ Added tier_limits column');
} catch (e: any) {
  if (e.message.includes('duplicate column')) {
    console.log('[FINAL-FIX] ⏭️  tier_limits already exists');
  } else {
    console.log('[FINAL-FIX] ❌ Error:', e.message);
  }
}

sqlite.close();
console.log('[FINAL-FIX] Database fully configured!');
