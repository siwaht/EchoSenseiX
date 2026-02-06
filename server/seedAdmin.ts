import { storage } from "./storage";
import { hashPassword } from "./auth";
import logger from "./utils/logger";

// Get admin credentials from environment variables
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

export async function seedAdminUser() {
  try {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      logger.debug('ADMIN_EMAIL or ADMIN_PASSWORD not set, skipping admin seeding');
      return;
    }

    logger.info('Starting admin user seeding process...');

    // Check if admin user already exists
    const existingUser = await storage.getUserByEmail(ADMIN_EMAIL);
    const hashedPassword = await hashPassword(ADMIN_PASSWORD);

    if (existingUser) {
      logger.debug('Admin user already exists, updating credentials', { email: ADMIN_EMAIL });

      // Update password and ensure admin status
      await storage.updateUser(existingUser.id, {
        password: hashedPassword,
        isAdmin: true,
      });

      // Sync ElevenLabs API key from environment to database
      await syncElevenLabsApiKey(existingUser.organizationId);
      return;
    }

    // Create admin user with properly hashed password
    const adminUser = await storage.createUser({
      email: ADMIN_EMAIL,
      password: hashedPassword,
      firstName: "Admin",
      lastName: "User",
      isAdmin: true,
    });

    logger.info('Admin user created successfully', { email: adminUser.email });

    // Sync ElevenLabs API key from environment to database
    await syncElevenLabsApiKey(adminUser.organizationId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error seeding admin user', { error: message });
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
      logger.debug('No ELEVENLABS_API_KEY in environment, skipping sync');
      return;
    }

    // Show last 4 characters for verification (safe to log)
    const keyLast4 = elevenLabsApiKey.slice(-4);
    logger.info('Syncing ElevenLabs API key from environment', { keyLast4 });

    // Upsert the integration with the current API key
    await storage.upsertIntegration({
      organizationId,
      provider: "elevenlabs",
      apiKey: elevenLabsApiKey,
      status: "ACTIVE",
    });

    logger.info('ElevenLabs integration synced successfully', { keyLast4 });

    // Verify by reading back
    const integration = await storage.getIntegration(organizationId, "elevenlabs");
    if (integration) {
      const storedKeyLast4 = integration.apiKey?.slice(-4) || 'N/A';
      logger.debug('Verified database has synced key', { storedKeyLast4 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error syncing ElevenLabs API key', { error: message });
  }
}