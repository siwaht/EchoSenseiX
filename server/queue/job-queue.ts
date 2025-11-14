/**
 * Background Job Queue Service
 *
 * Uses BullMQ for distributed job processing
 *
 * Benefits:
 * - Offload heavy tasks from API requests
 * - Automatic retries with exponential backoff
 * - Job prioritization
 * - Progress tracking
 * - Failed job handling
 */

import { Queue, Worker, type Job, type QueueOptions, type WorkerOptions } from 'bullmq';
import { cache } from '../cache/redis-cache';

// Job types supported by the system
export enum JobType {
  DOCUMENT_PROCESSING = 'document-processing',
  AUDIO_PROCESSING = 'audio-processing',
  EMAIL_NOTIFICATION = 'email-notification',
  WEBHOOK_DELIVERY = 'webhook-delivery',
  ANALYTICS_AGGREGATION = 'analytics-aggregation',
  PROVIDER_SYNC = 'provider-sync',
  BILLING_CALCULATION = 'billing-calculation',
  KNOWLEDGE_BASE_SYNC = 'knowledge-base-sync',
  BATCH_CALL_PROCESSING = 'batch-call-processing',
}

// Job data interfaces
export interface DocumentProcessingJob {
  organizationId: string;
  userId: string;
  documentPath: string;
  originalName: string;
}

export interface AudioProcessingJob {
  organizationId: string;
  callId: string;
  audioUrl: string;
}

export interface EmailNotificationJob {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
}

export interface WebhookDeliveryJob {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  secret?: string;
  retries?: number;
}

export interface AnalyticsAggregationJob {
  organizationId: string;
  startDate: Date;
  endDate: Date;
  metrics: string[];
}

export interface ProviderSyncJob {
  organizationId: string;
  providerIntegrationId: string;
  syncType: 'agents' | 'voices' | 'phone_numbers' | 'calls';
}

export interface BillingCalculationJob {
  organizationId: string;
  startDate: Date;
  endDate: Date;
}

type JobData =
  | DocumentProcessingJob
  | AudioProcessingJob
  | EmailNotificationJob
  | WebhookDeliveryJob
  | AnalyticsAggregationJob
  | ProviderSyncJob
  | BillingCalculationJob;

class JobQueue {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private isInitialized: boolean = false;

  /**
   * Initialize job queues and workers
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      console.warn('[QUEUE] Redis URL not configured. Background jobs disabled.');
      return;
    }

    try {
      const connection = {
        host: new URL(redisUrl).hostname,
        port: parseInt(new URL(redisUrl).port) || 6379,
        password: new URL(redisUrl).password || undefined,
      };

      // Create queues for each job type
      for (const jobType of Object.values(JobType)) {
        const queue = new Queue(jobType, {
          connection,
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
            removeOnComplete: {
              count: 100, // Keep last 100 completed jobs
              age: 3600,  // Remove after 1 hour
            },
            removeOnFail: {
              count: 500, // Keep last 500 failed jobs for debugging
              age: 86400, // Remove after 24 hours
            },
          },
        });

        this.queues.set(jobType, queue);
        console.log(`[QUEUE] Created queue: ${jobType}`);
      }

      this.isInitialized = true;
      console.log('[QUEUE] Job queues initialized successfully');

    } catch (error) {
      console.error('[QUEUE] Failed to initialize job queues:', error);
    }
  }

  /**
   * Add a job to the queue
   */
  async addJob(
    jobType: JobType,
    data: JobData,
    options?: {
      priority?: number;  // Lower numbers = higher priority
      delay?: number;     // Delay in milliseconds
      jobId?: string;     // Custom job ID (for deduplication)
    }
  ): Promise<Job | null> {
    const queue = this.queues.get(jobType);

    if (!queue) {
      console.warn(`[QUEUE] Queue not found for job type: ${jobType}`);
      return null;
    }

    try {
      const job = await queue.add(jobType, data, {
        priority: options?.priority,
        delay: options?.delay,
        jobId: options?.jobId,
      });

      console.log(`[QUEUE] Job added: ${jobType} #${job.id}`);
      return job;

    } catch (error) {
      console.error(`[QUEUE] Failed to add job: ${jobType}`, error);
      return null;
    }
  }

  /**
   * Process jobs with a worker
   */
  registerWorker(
    jobType: JobType,
    processor: (job: Job<JobData>) => Promise<any>,
    options?: {
      concurrency?: number;  // Number of concurrent jobs (default: 4)
      limiter?: {
        max: number;       // Max jobs per duration
        duration: number;  // Duration in milliseconds
      };
    }
  ): void {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      return;
    }

    try {
      const connection = {
        host: new URL(redisUrl).hostname,
        port: parseInt(new URL(redisUrl).port) || 6379,
        password: new URL(redisUrl).password || undefined,
      };

      const worker = new Worker(
        jobType,
        async (job: Job<JobData>) => {
          console.log(`[QUEUE] Processing job: ${jobType} #${job.id}`);

          try {
            const result = await processor(job);
            console.log(`[QUEUE] Job completed: ${jobType} #${job.id}`);
            return result;

          } catch (error: any) {
            console.error(`[QUEUE] Job failed: ${jobType} #${job.id}`, error);
            throw error;
          }
        },
        {
          connection,
          concurrency: options?.concurrency || 4,
          limiter: options?.limiter,
        }
      );

      worker.on('completed', (job) => {
        console.log(`[QUEUE] ✓ Job completed: ${jobType} #${job.id}`);
      });

      worker.on('failed', (job, error) => {
        console.error(`[QUEUE] ✗ Job failed: ${jobType} #${job?.id}`, error.message);
      });

      worker.on('error', (error) => {
        console.error(`[QUEUE] Worker error for ${jobType}:`, error);
      });

      this.workers.set(jobType, worker);
      console.log(`[QUEUE] Worker registered for: ${jobType} (concurrency: ${options?.concurrency || 4})`);

    } catch (error) {
      console.error(`[QUEUE] Failed to register worker for ${jobType}:`, error);
    }
  }

  /**
   * Get job by ID
   */
  async getJob(jobType: JobType, jobId: string): Promise<Job | null> {
    const queue = this.queues.get(jobType);

    if (!queue) {
      return null;
    }

    try {
      return await queue.getJob(jobId);
    } catch (error) {
      console.error(`[QUEUE] Failed to get job ${jobId}:`, error);
      return null;
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(jobType: JobType): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  } | null> {
    const queue = this.queues.get(jobType);

    if (!queue) {
      return null;
    }

    try {
      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
      ]);

      return { waiting, active, completed, failed };

    } catch (error) {
      console.error(`[QUEUE] Failed to get stats for ${jobType}:`, error);
      return null;
    }
  }

  /**
   * Get all queue statistics
   */
  async getAllStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};

    for (const jobType of Object.values(JobType)) {
      stats[jobType] = await this.getStats(jobType);
    }

    return stats;
  }

  /**
   * Pause a queue
   */
  async pauseQueue(jobType: JobType): Promise<void> {
    const queue = this.queues.get(jobType);
    if (queue) {
      await queue.pause();
      console.log(`[QUEUE] Queue paused: ${jobType}`);
    }
  }

  /**
   * Resume a queue
   */
  async resumeQueue(jobType: JobType): Promise<void> {
    const queue = this.queues.get(jobType);
    if (queue) {
      await queue.resume();
      console.log(`[QUEUE] Queue resumed: ${jobType}`);
    }
  }

  /**
   * Clean completed/failed jobs
   */
  async cleanQueue(
    jobType: JobType,
    grace: number = 3600000, // 1 hour in milliseconds
    limit: number = 1000
  ): Promise<void> {
    const queue = this.queues.get(jobType);

    if (!queue) {
      return;
    }

    try {
      await queue.clean(grace, limit, 'completed');
      await queue.clean(grace, limit, 'failed');
      console.log(`[QUEUE] Cleaned queue: ${jobType}`);

    } catch (error) {
      console.error(`[QUEUE] Failed to clean queue ${jobType}:`, error);
    }
  }

  /**
   * Close all queues and workers
   */
  async closeAll(): Promise<void> {
    console.log('[QUEUE] Closing all queues and workers...');

    // Close all workers
    for (const [jobType, worker] of this.workers.entries()) {
      try {
        await worker.close();
        console.log(`[QUEUE] Worker closed: ${jobType}`);
      } catch (error) {
        console.error(`[QUEUE] Error closing worker ${jobType}:`, error);
      }
    }

    // Close all queues
    for (const [jobType, queue] of this.queues.entries()) {
      try {
        await queue.close();
        console.log(`[QUEUE] Queue closed: ${jobType}`);
      } catch (error) {
        console.error(`[QUEUE] Error closing queue ${jobType}:`, error);
      }
    }

    this.queues.clear();
    this.workers.clear();
    this.isInitialized = false;

    console.log('[QUEUE] All queues and workers closed');
  }
}

// Export singleton instance
export const jobQueue = new JobQueue();

// Initialize queue on import (in production)
if (process.env.NODE_ENV !== 'test') {
  jobQueue.initialize().catch(console.error);
}

// Graceful shutdown
process.on('SIGINT', () => jobQueue.closeAll());
process.on('SIGTERM', () => jobQueue.closeAll());
