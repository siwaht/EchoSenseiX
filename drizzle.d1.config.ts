import { defineConfig } from "drizzle-kit";

export default defineConfig({
    out: "./migrations",
    schema: "./shared/schema.ts",
    dialect: "sqlite",
    driver: "d1-http",
    dbCredentials: {
        accountId: "2c5abfb2148e3357e4f16c1db45c2926",
        databaseId: "9d996182-1b5e-4845-977d-8ad1b7f1f562",
        token: process.env.CLOUDFLARE_API_TOKEN!,
    },
});
