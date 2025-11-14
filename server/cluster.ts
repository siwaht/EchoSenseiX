/**
 * Cluster Manager for High Concurrency
 *
 * Implements Node.js clustering to utilize all CPU cores
 * Enables horizontal scaling and high concurrent user support
 */

import cluster from 'cluster';
import os from 'os';
import process from 'process';

const numCPUs = os.cpus().length;

export interface ClusterConfig {
  workers?: number;
  restartDelay?: number;
  maxRestarts?: number;
  gracefulShutdownTimeout?: number;
}

export class ClusterManager {
  private config: ClusterConfig;
  private workerRestarts = new Map<number, number>();

  constructor(config: ClusterConfig = {}) {
    this.config = {
      workers: config.workers || numCPUs,
      restartDelay: config.restartDelay || 1000,
      maxRestarts: config.maxRestarts || 10,
      gracefulShutdownTimeout: config.gracefulShutdownTimeout || 30000,
    };
  }

  /**
   * Start the cluster
   */
  start(workerFunction: () => void): void {
    if (cluster.isPrimary) {
      this.startPrimary();
    } else {
      this.startWorker(workerFunction);
    }
  }

  /**
   * Start primary process (manages workers)
   */
  private startPrimary(): void {
    console.log(`[CLUSTER] Primary process ${process.pid} is running`);
    console.log(`[CLUSTER] Starting ${this.config.workers} workers...`);

    // Fork workers
    for (let i = 0; i < this.config.workers!; i++) {
      this.forkWorker();
    }

    // Handle worker exit
    cluster.on('exit', (worker, code, signal) => {
      console.log(`[CLUSTER] Worker ${worker.process.pid} died (${signal || code})`);

      // Track restarts
      const restarts = this.workerRestarts.get(worker.id) || 0;

      if (restarts < this.config.maxRestarts!) {
        console.log(`[CLUSTER] Restarting worker... (attempt ${restarts + 1}/${this.config.maxRestarts})`);

        setTimeout(() => {
          this.forkWorker();
        }, this.config.restartDelay);

        this.workerRestarts.set(worker.id, restarts + 1);
      } else {
        console.error(`[CLUSTER] Worker ${worker.id} exceeded max restarts. Not restarting.`);
      }
    });

    // Handle worker online
    cluster.on('online', (worker) => {
      console.log(`[CLUSTER] Worker ${worker.process.pid} is online`);
      // Reset restart counter when worker is stable
      setTimeout(() => {
        this.workerRestarts.delete(worker.id);
      }, 60000); // 1 minute of stability
    });

    // Graceful shutdown
    this.setupGracefulShutdown();
  }

  /**
   * Fork a new worker
   */
  private forkWorker(): void {
    const worker = cluster.fork();

    // Send configuration to worker
    worker.on('message', (msg) => {
      if (msg.type === 'REQUEST_CONFIG') {
        worker.send({
          type: 'CONFIG',
          data: {
            workerId: worker.id,
            totalWorkers: this.config.workers,
          },
        });
      }
    });
  }

  /**
   * Start worker process
   */
  private startWorker(workerFunction: () => void): void {
    console.log(`[CLUSTER] Worker ${process.pid} started`);

    // Request config from primary
    if (process.send) {
      process.send({ type: 'REQUEST_CONFIG' });
    }

    // Listen for config
    process.on('message', (msg: any) => {
      if (msg.type === 'CONFIG') {
        console.log(`[CLUSTER] Worker ${msg.data.workerId} of ${msg.data.totalWorkers} configured`);
      }
    });

    // Run the worker function
    workerFunction();

    // Graceful shutdown for worker
    this.setupWorkerShutdown();
  }

  /**
   * Setup graceful shutdown for primary
   */
  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      console.log('[CLUSTER] Primary received shutdown signal');
      console.log('[CLUSTER] Shutting down workers gracefully...');

      const workers = Object.values(cluster.workers || {});
      const timeout = setTimeout(() => {
        console.log('[CLUSTER] Forcing shutdown after timeout');
        process.exit(1);
      }, this.config.gracefulShutdownTimeout);

      // Disconnect all workers
      for (const worker of workers) {
        if (worker) {
          worker.disconnect();
        }
      }

      // Wait for all workers to exit
      await Promise.all(
        workers.map(
          (worker) =>
            new Promise<void>((resolve) => {
              if (!worker) return resolve();
              worker.on('exit', () => resolve());
            })
        )
      );

      clearTimeout(timeout);
      console.log('[CLUSTER] All workers shut down. Exiting primary.');
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  /**
   * Setup graceful shutdown for worker
   */
  private setupWorkerShutdown(): void {
    const shutdown = () => {
      console.log(`[CLUSTER] Worker ${process.pid} received shutdown signal`);

      // Close server gracefully (implemented by the application)
      if (global.server) {
        global.server.close(() => {
          console.log(`[CLUSTER] Worker ${process.pid} server closed`);
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  /**
   * Get cluster info
   */
  static getInfo() {
    return {
      isPrimary: cluster.isPrimary,
      isWorker: cluster.isWorker,
      workerId: cluster.worker?.id,
      pid: process.pid,
      totalWorkers: cluster.isPrimary ? Object.keys(cluster.workers || {}).length : undefined,
    };
  }
}

/**
 * Create and start cluster
 */
export function startCluster(workerFunction: () => void, config?: ClusterConfig): void {
  // Check if clustering is enabled
  const clusterEnabled = process.env.CLUSTER_ENABLED !== 'false';

  if (!clusterEnabled) {
    console.log('[CLUSTER] Clustering disabled, running in single process mode');
    workerFunction();
    return;
  }

  const manager = new ClusterManager(config);
  manager.start(workerFunction);
}

// Make server accessible for graceful shutdown
declare global {
  var server: any;
}
