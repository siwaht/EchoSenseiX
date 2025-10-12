import { IStorage } from "../storage";
import AudioStorageService from "./audio-storage-service";

export class DataCleanupService {
  constructor(
    private storage: IStorage,
    private audioStorage: AudioStorageService
  ) {}

  /**
   * Completely wipes all data for an organization when switching ElevenLabs accounts
   * This includes: call logs, agents, recordings, and analytics
   */
  async wipeOrganizationData(organizationId: string): Promise<{
    success: boolean;
    deleted: {
      callLogs: number;
      agents: number;
      recordings: number;
    };
    error?: string;
  }> {
    try {
      console.log(`[DATA-CLEANUP] Starting data wipe for organization ${organizationId}`);

      // Step 1: Get all call logs to delete their recordings
      const callLogsResult = await this.storage.getCallLogs(organizationId);
      const callLogs = callLogsResult.data;
      console.log(`[DATA-CLEANUP] Found ${callLogs.length} call logs to delete`);

      // Step 2: Delete all audio recordings from storage
      let recordingsDeleted = 0;
      for (const call of callLogs) {
        if (call.audioStorageKey) {
          try {
            await this.audioStorage.deleteAudio(call.audioStorageKey);
            recordingsDeleted++;
          } catch (error) {
            console.error(`[DATA-CLEANUP] Failed to delete recording ${call.audioStorageKey}:`, error);
            // Continue even if one recording fails to delete
          }
        }
      }
      console.log(`[DATA-CLEANUP] Deleted ${recordingsDeleted} recordings from storage`);

      // Step 3: Delete all call logs from database
      const callLogsDeleted = await this.storage.deleteAllCallLogs(organizationId);
      console.log(`[DATA-CLEANUP] Deleted ${callLogsDeleted} call logs from database`);

      // Step 4: Delete all agents
      const agentsDeleted = await this.storage.deleteAllAgents(organizationId);
      console.log(`[DATA-CLEANUP] Deleted ${agentsDeleted} agents from database`);

      console.log(`[DATA-CLEANUP] ✅ Data wipe complete for organization ${organizationId}`);

      return {
        success: true,
        deleted: {
          callLogs: callLogsDeleted,
          agents: agentsDeleted,
          recordings: recordingsDeleted,
        },
      };
    } catch (error: any) {
      console.error(`[DATA-CLEANUP] ❌ Error wiping organization data:`, error);
      return {
        success: false,
        deleted: {
          callLogs: 0,
          agents: 0,
          recordings: 0,
        },
        error: error.message,
      };
    }
  }
}

export default DataCleanupService;
