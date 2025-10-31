import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";

import * as schema from "../shared/schema";

let dbInstance: ReturnType<typeof drizzle> | ReturnType<typeof drizzleSqlite>;

function initializeDb() {
  if (dbInstance) {
    return dbInstance;
  }
  if (process.env.DATABASE_URL!.startsWith("postgres")) {
    const sql = neon(process.env.DATABASE_URL!);
    dbInstance = drizzle(sql, { schema });
  } else {
    const sqlite = new Database(process.env.DATABASE_URL!.replace("file:", ""));
    dbInstance = drizzleSqlite(sqlite, { schema });
  }
  return dbInstance;
}

export const db = () => {
    return initializeDb();
};
