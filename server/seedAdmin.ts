import { storage } from "./storage";
import { hashPassword } from "./auth";

export async function seedAdminUser() {
  try {
    console.log("[SEED] Starting admin user seeding process...");
    
    // Check if admin user already exists
    const existingUser = await storage.getUserByEmail("cc@siwaht.com");
    
    if (existingUser) {
      console.log("[SEED] Admin user already exists");
      
      // Sync ElevenLabs API key from environment to database
      await syncElevenLabsApiKey(existingUser.organizationId);
      return;
    }
    
    // Create admin user with properly hashed password
    const hashedPassword = await hashPassword("Hola173!");
    const adminUser = await storage.createUser({
      email: "cc@siwaht.com",
      password: hashedPassword,
      firstName: "Admin",
      lastName: "User",
      isAdmin: true,
    });
    
    console.log("[SEED] Admin user created successfully:", adminUser.email);
    
    // Sync ElevenLabs API key from environment to database
    await syncElevenLabsApiKey(adminUser.organizationId);
  } catch (error) {
    console.error("[SEED] Error seeding admin user:", error);
    // Don't throw the error to prevent server startup failure
  }
}

/**
 * Syncs ELEVENLABS_API_KEY from environment variable to database integrations table
 * This ensures the API key used for all requests matches the environment variable
 */
async function syncElevenLabsApiKey(organizationId: string) {
  try {
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!elevenLabsApiKey) {
      console.log("[SEED] No ELEVENLABS_API_KEY in environment, skipping sync");
      return;
    }
    
    // Show last 4 characters for verification
    const keyLast4 = elevenLabsApiKey.slice(-4);
    console.log(`[SEED] Syncing ElevenLabs API key from environment (***${keyLast4}) to database...`);
    
    // Upsert the integration with the current API key
    await storage.upsertIntegration({
      organizationId,
      provider: "elevenlabs",
      apiKey: elevenLabsApiKey,
      status: "ACTIVE",
    });
    
    console.log(`[SEED] ✅ ElevenLabs integration synced successfully (***${keyLast4})`);
    
    // Verify by reading back
    const integration = await storage.getIntegration(organizationId, "elevenlabs");
    if (integration) {
      const storedKeyLast4 = integration.apiKey.slice(-4);
      console.log(`[SEED] ✅ Verified: Database has key ending in ***${storedKeyLast4}`);
    }
  } catch (error) {
    console.error("[SEED] Error syncing ElevenLabs API key:", error);
  }
}