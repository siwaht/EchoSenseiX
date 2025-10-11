import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

let db: Database.Database | null = null;
let drizzleDb: any = null;

export function getSQLiteConnection() {
  if (!db) {
    const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './dev.db';
    db = new Database(dbPath);
    drizzleDb = drizzle(db);
    console.log('[DB] SQLite database connected');
  }
  return drizzleDb;
}

// Simple query methods for development
export const sqliteDb = {
  select: () => ({ from: (table: any) => ({ where: (condition: any) => ({ execute: () => [] }) }) }),
  insert: (table: any) => ({ values: (data: any) => ({ execute: () => [data] }) }),
  update: (table: any) => ({ set: (data: any) => ({ where: (condition: any) => ({ execute: () => [] }) }) }),
  delete: (table: any) => ({ where: (condition: any) => ({ execute: () => [] }) }),
  run: (query: any) => {
    if (db) {
      return db.prepare(query.query).run();
    }
    return { changes: 0, lastInsertRowid: 0 };
  }
};
