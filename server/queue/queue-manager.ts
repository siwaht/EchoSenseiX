/**
 * Job Queue Manager for Async Processing
 *
 * Handles background jobs and async tasks for scalability
 * Supports: In-memory queue, Redis/Bull queue
 */

export interface Job {
  id: string;
  type: string;
  data: any;
  priority?: number;
  attempts?: number;
  maxAttempts?: number;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
}

export interface JobHandler {
  (job: Job): Promise<void>;
}

export interface QueueConfig {
  provider: 'memory' | 'redis' | 'bull';
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
  concurrency?: number;
  maxRetries?: number;
}

export abstract class BaseQueueManager {
  protected config: QueueConfig;
  protected handlers = new Map<string, JobHandler>();

  constructor(config: QueueConfig) {
    this.config = config;
  }

  abstract initialize(): Promise<void>;
  abstract addJob(type: string, data: any, options?: { priority?: number; delay?: number }): Promise<string>;
  abstract getJob(jobId: string): Promise<Job | null>;
  abstract process(): Promise<void>;
  abstract getStats(): Promise<{ pending: number; processing: number; completed: number; failed: number }>;

  /**
   * Register a job handler
   */
  registerHandler(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Get handler for job type
   */
  protected getHandler(type: string): JobHandler | undefined {
    return this.handlers.get(type);
  }
}

/**
 * In-Memory Queue (for development/single instance)
 */
export class MemoryQueueManager extends BaseQueueManager {
  private jobs = new Map<string, Job>();
  private pendingJobs: Job[] = [];
  private processingJobs = new Set<string>();
  private completedJobs = new Set<string>();
  private failedJobs = new Set<string>();
  private processing = false;

  async initialize(): Promise<void> {
    console.log('[QUEUE] Initialized in-memory queue manager');
    this.startProcessing();
  }

  async addJob(type: string, data: any, options?: { priority?: number; delay?: number }): Promise<string> {
    const job: Job = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      priority: options?.priority || 0,
      attempts: 0,
      maxAttempts: this.config.maxRetries || 3,
      createdAt: new Date(),
    };

    this.jobs.set(job.id, job);

    if (options?.delay) {
      setTimeout(() => {
        this.pendingJobs.push(job);
        this.sortPendingJobs();
      }, options.delay);
    } else {
      this.pendingJobs.push(job);
      this.sortPendingJobs();
    }

    return job.id;
  }

  async getJob(jobId: string): Promise<Job | null> {
    return this.jobs.get(jobId) || null;
  }

  async process(): Promise<void> {
    // Automatically processed by startProcessing()
  }

  async getStats() {
    return {
      pending: this.pendingJobs.length,
      processing: this.processingJobs.size,
      completed: this.completedJobs.size,
      failed: this.failedJobs.size,
    };
  }

  private sortPendingJobs(): void {
    this.pendingJobs.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  private async startProcessing(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    const concurrency = this.config.concurrency || 5;

    const processNext = async () => {
      while (this.pendingJobs.length > 0 && this.processingJobs.size < concurrency) {
        const job = this.pendingJobs.shift();
        if (!job) continue;

        this.processingJobs.add(job.id);
        job.processedAt = new Date();

        this.processJob(job)
          .then(() => {
            this.processingJobs.delete(job.id);
            this.completedJobs.add(job.id);
            job.completedAt = new Date();
          })
          .catch((error) => {
            this.processingJobs.delete(job.id);
            this.handleJobFailure(job, error);
          });
      }

      setTimeout(processNext, 100);
    };

    processNext();
  }

  private async processJob(job: Job): Promise<void> {
    const handler = this.getHandler(job.type);
    if (!handler) {
      throw new Error(`No handler registered for job type: ${job.type}`);
    }

    await handler(job);
  }

  private handleJobFailure(job: Job, error: Error): void {
    job.attempts = (job.attempts || 0) + 1;
    job.error = error.message;

    if (job.attempts < (job.maxAttempts || 3)) {
      console.log(`[QUEUE] Retrying job ${job.id} (attempt ${job.attempts}/${job.maxAttempts})`);
      // Re-queue with exponential backoff
      const delay = Math.pow(2, job.attempts) * 1000;
      setTimeout(() => {
        this.pendingJobs.push(job);
      }, delay);
    } else {
      console.error(`[QUEUE] Job ${job.id} failed after ${job.attempts} attempts:`, error);
      job.failedAt = new Date();
      this.failedJobs.add(job.id);
    }
  }
}

/**
 * Redis Queue Manager (for distributed systems)
 */
export class RedisQueueManager extends BaseQueueManager {
  private redis: any;
  private bullQueue: any;

  async initialize(): Promise<void> {
    console.log('[QUEUE] Initializing Redis queue manager...');

    try {
      // Dynamically import Bull
      const Bull = (await import('bull')).default;

      this.bullQueue = new Bull('echosenseix-jobs', {
        redis: {
          host: this.config.redis?.host || 'localhost',
          port: this.config.redis?.port || 6379,
          password: this.config.redis?.password,
        },
        defaultJobOptions: {
          attempts: this.config.maxRetries || 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      });

      // Process jobs
      this.bullQueue.process(this.config.concurrency || 5, async (bullJob: any) => {
        const job: Job = {
          id: bullJob.id,
          type: bullJob.data.type,
          data: bullJob.data.payload,
          attempts: bullJob.attemptsMade,
          createdAt: new Date(bullJob.timestamp),
          processedAt: new Date(),
        };

        const handler = this.getHandler(job.type);
        if (!handler) {
          throw new Error(`No handler registered for job type: ${job.type}`);
        }

        await handler(job);
      });

      console.log('[QUEUE] Redis queue manager initialized');
    } catch (error: any) {
      console.error('[QUEUE] Failed to initialize Redis queue:', error.message);
      throw error;
    }
  }

  async addJob(type: string, data: any, options?: { priority?: number; delay?: number }): Promise<string> {
    const bullJob = await this.bullQueue.add(
      { type, payload: data },
      {
        priority: options?.priority,
        delay: options?.delay,
      }
    );

    return bullJob.id;
  }

  async getJob(jobId: string): Promise<Job | null> {
    const bullJob = await this.bullQueue.getJob(jobId);
    if (!bullJob) return null;

    return {
      id: bullJob.id,
      type: bullJob.data.type,
      data: bullJob.data.payload,
      attempts: bullJob.attemptsMade,
      createdAt: new Date(bullJob.timestamp),
      processedAt: bullJob.processedOn ? new Date(bullJob.processedOn) : undefined,
      completedAt: bullJob.finishedOn ? new Date(bullJob.finishedOn) : undefined,
      failedAt: bullJob.failedReason ? new Date(bullJob.failedOn) : undefined,
      error: bullJob.failedReason,
    };
  }

  async process(): Promise<void> {
    // Automatically processed by Bull
  }

  async getStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.bullQueue.getWaitingCount(),
      this.bullQueue.getActiveCount(),
      this.bullQueue.getCompletedCount(),
      this.bullQueue.getFailedCount(),
    ]);

    return {
      pending: waiting,
      processing: active,
      completed,
      failed,
    };
  }
}

/**
 * Queue Factory
 */
export class QueueFactory {
  private static instance: BaseQueueManager | null = null;

  static async getInstance(config?: QueueConfig): Promise<BaseQueueManager> {
    if (this.instance) {
      return this.instance;
    }

    if (!config) {
      config = this.getConfigFromEnv();
    }

    this.instance = this.createQueue(config);
    await this.instance.initialize();

    return this.instance;
  }

  private static createQueue(config: QueueConfig): BaseQueueManager {
    switch (config.provider) {
      case 'redis':
      case 'bull':
        return new RedisQueueManager(config);
      case 'memory':
      default:
        return new MemoryQueueManager(config);
    }
  }

  private static getConfigFromEnv(): QueueConfig {
    const provider = (process.env.QUEUE_PROVIDER || 'memory') as QueueConfig['provider'];

    return {
      provider,
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
      },
      concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '10', 10),
      maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES || '3', 10),
    };
  }
}

export async function getQueue(config?: QueueConfig): Promise<BaseQueueManager> {
  return QueueFactory.getInstance(config);
}
