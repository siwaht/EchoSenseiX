import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Detect dialect from DATABASE_PROVIDER or URL
const provider = process.env.DATABASE_PROVIDER?.toLowerCase();
let dialect: 'sqlite' | 'postgresql' | 'mysql' = 'postgresql';

if (provider === 'sqlite' || process.env.DATABASE_URL.startsWith('file:')) {
  dialect = 'sqlite';
} else if (provider === 'mysql' || process.env.DATABASE_URL.startsWith('mysql://')) {
  dialect = 'mysql';
} else {
  dialect = 'postgresql';
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: dialect,
  dbCredentials: dialect === 'sqlite' 
    ? { url: process.env.DATABASE_URL.replace(/^file:/, '') }
    : { url: process.env.DATABASE_URL },
});
