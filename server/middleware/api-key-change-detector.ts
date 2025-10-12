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
  res: Response,
  next: NextFunction
) {
  try {
    // Only check for authenticated users with an organization
    if (!req.user || !req.user.organizationId) {
      return next();
    }

    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey) {
      // No API key configured, skip check
      return next();
    }

    // Get the organization
    const [org] = await db()
      .select()
      .from(organizations)
      .where(eq(organizations.id, req.user.organizationId));

    if (!org) {
      return next();
    }

    const currentKeyHash = hashApiKey(elevenLabsApiKey);
    const storedKeyHash = org.elevenLabsApiKeyHash;

    // If this is the first time or the key has changed
    if (!storedKeyHash || storedKeyHash !== currentKeyHash) {
      console.log(`[API-KEY-CHANGE] Detected API key change for organization ${org.id}`);
      
      // Only wipe data if there was a previous key (not first time setup)
      if (storedKeyHash) {
        console.log(`[API-KEY-CHANGE] Wiping old data for organization ${org.id}`);
        
        const storage = req.app.locals.storage as IStorage;
        const audioStorage = new AudioStorageService();
        const cleanupService = new DataCleanupService(storage, audioStorage);
        
        const result = await cleanupService.wipeOrganizationData(org.id);
        
        if (!result.success) {
          console.error(`[API-KEY-CHANGE] ❌ Data wipe failed, will retry on next request:`, result.error);
          // Don't update hash or trigger sync - let it retry on next request
          return next();
        }
        
        console.log(`[API-KEY-CHANGE] ✅ Successfully wiped data:`, result.deleted);
      }

      // Update the stored API key hash (only after successful wipe or first-time setup)
      await db()
        .update(organizations)
        .set({ elevenLabsApiKeyHash: currentKeyHash })
        .where(eq(organizations.id, org.id));

      console.log(`[API-KEY-CHANGE] Updated API key hash for organization ${org.id}`);
      
      // Also update or create the ElevenLabs integration with the new API key
      const storage = req.app.locals.storage as IStorage;
      console.log(`[API-KEY-CHANGE] Upserting ElevenLabs integration with new API key`);
      
      await storage.upsertIntegration({
        organizationId: org.id,
        provider: "elevenlabs",
        apiKey: elevenLabsApiKey,
        status: "ACTIVE",
      });
      
      console.log(`[API-KEY-CHANGE] ElevenLabs integration updated successfully`);
      
      // Trigger auto-sync in the background (don't block the request)
      if (storedKeyHash) {
        // Import sync service dynamically to avoid circular dependencies
        setImmediate(async () => {
          try {
            const { SyncService } = await import("../services/sync-service");
            console.log(`[API-KEY-CHANGE] Starting auto-sync for organization ${org.id}`);
            // Sync both agents and call logs for the new account
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
