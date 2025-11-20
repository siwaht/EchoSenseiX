import 'dotenv/config';
import { storage } from "../storage";
import { encryptApiKey, decryptApiKey } from "../utils/encryption";
import process from "process";

async function migrate() {
    console.log("Starting encryption migration...");
    try {
        const integrations = await storage.getAllIntegrations();
        console.log(`Found ${integrations.length} integrations.`);

        let migratedCount = 0;
        let errorCount = 0;
        let skippedCount = 0;

        for (const integration of integrations) {
            try {
                // Check if apiKey needs migration (doesn't have IV prefix)
                if (integration.apiKey && !integration.apiKey.includes(':')) {
                    console.log(`Migrating API key for integration ${integration.id} (${integration.provider})...`);

                    // Decrypt with legacy method (handled automatically by decryptApiKey)
                    const decryptedKey = decryptApiKey(integration.apiKey);

                    // Re-encrypt with new method
                    const reEncryptedKey = encryptApiKey(decryptedKey);

                    // Update in DB
                    await storage.updateIntegration(integration.id, { apiKey: reEncryptedKey });
                    migratedCount++;
                    console.log(`Successfully migrated integration ${integration.id}`);
                } else {
                    skippedCount++;
                }
            } catch (err) {
                console.error(`Failed to migrate integration ${integration.id}:`, err);
                errorCount++;
            }
        }

        console.log(`Migration completed.`);
        console.log(`Migrated: ${migratedCount}`);
        console.log(`Skipped (already secure or no key): ${skippedCount}`);
        console.log(`Errors: ${errorCount}`);
    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        process.exit(0);
    }
}

migrate();
