
import Database from 'better-sqlite3';

const db = new Database('local.db');

try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables in local.db:', tables);
} catch (e) {
    console.error('Error listing tables:', e);
}
