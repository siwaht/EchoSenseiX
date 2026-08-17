import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { IStorage } from "../storage";
import DataCleanupService from "../services/data-cleanup-service";
import AudioStorageService from "../services/audio-storage-service";
import { db } from "../db";
import { organizations } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Hashes an API key for comparison
 */
function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Middleware that detects ElevenLabs API key changes and automatically wipes old data
 * This ensures when a user switches to a different ElevenLabs account, all old data is cleared
 */
export async function detectApiKeyChange(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    // Only check for authenticated users with an organization
    if (!req.user || !req.user.organizationId) {
      return next();
    }

    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!elevenLabsApiKey) {
      // No API keys configured, skip check
      return next();
    }

    // Get the organization
    const [org] = await (db as any)
      .select()
      .from(organizations)
      .where(eq(organizations.id, req.user.organizationId));

    if (!org) {
      return next();
    }

    const elevenLabsChanged = !org.elevenLabsApiKeyHash || org.elevenLabsApiKeyHash !== hashApiKey(elevenLabsApiKey);

    // If the configured ElevenLabs key has changed
    if (elevenLabsChanged) {
      console.log(`[API-KEY-CHANGE] Detected ElevenLabs API key change for organization ${org.id}`);

      // Only wipe data if there was a previous key for the one that changed (not first time setup)
      const shouldWipe = elevenLabsChanged && org.elevenLabsApiKeyHash;

      if (shouldWipe) {
        console.log(`[API-KEY-CHANGE] Wiping old data for organization ${org.id}`);

        const storage = req.app.locals.storage as IStorage;
        const audioStorage = new AudioStorageService();
        const cleanupService = new DataCleanupService(storage, audioStorage);

        const result = await cleanupService.wipeOrganizationData(org.id);

        if (!result.success) {
          console.error(`[API-KEY-CHANGE] ❌ Data wipe failed, will retry on next request:`, result.error);
          return next();
        }

        console.log(`[API-KEY-CHANGE] ✅ Successfully wiped data:`, result.deleted);
      }

      // Update the stored API key hashes
      const updateData: any = {};
      updateData.elevenLabsApiKeyHash = hashApiKey(elevenLabsApiKey);

      await (db as any)
        .update(organizations)
        .set(updateData)
        .where(eq(organizations.id, org.id));

      console.log(`[API-KEY-CHANGE] Updated API key hashes for organization ${org.id}`);

      // Update integrations
      const storage = req.app.locals.storage as IStorage;

      if (storage && storage.upsertIntegration) {
        if (elevenLabsChanged) {
          console.log(`[API-KEY-CHANGE] Upserting ElevenLabs integration`);
          await storage.upsertIntegration({
            organizationId: org.id,
            provider: "elevenlabs",
            apiKey: elevenLabsApiKey!,
            status: "ACTIVE",
          });
        }

      }

      // Trigger auto-sync in the background
      if (shouldWipe) {
        setImmediate(async () => {
          try {
            const { SyncService } = await import("../services/sync-service");
            console.log(`[API-KEY-CHANGE] Starting auto-sync for organization ${org.id}`);
            await SyncService.syncAgents(org.id);
            await SyncService.syncCallLogs({ organizationId: org.id, includeTranscripts: true });
            console.log(`[API-KEY-CHANGE] Auto-sync completed for organization ${org.id}`);
          } catch (error) {
            console.error(`[API-KEY-CHANGE] Auto-sync failed:`, error);
          }
        });
      }
    }

    next();
  } catch (error) {
    console.error("[API-KEY-CHANGE] Error in API key change detection:", error);
    // Don't block the request on error
    next();
  }
}
