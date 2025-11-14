/**
 * Health Check System for Load Balancers
 *
 * Provides endpoints for monitoring service health
 * Used by load balancers, orchestrators, and monitoring systems
 */

import type { Request, Response } from 'express';
import { ClusterManager } from '../cluster';
import { getCache } from '../cache/distributed-cache';
import { getQueue } from '../queue/queue-manager';
import { getDatabase } from '../database/database-factory';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version?: string;
  checks: {
    [key: string]: {
      status: 'pass' | 'fail' | 'warn';
      message?: string;
      responseTime?: number;
    };
  };
}

export class HealthCheckService {
  private startTime = Date.now();

  /**
   * Liveness probe - is the service running?
   */
  async liveness(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks: {
        process: {
          status: 'pass',
          message: `Process ${process.pid} is alive`,
        },
      },
    };
  }

  /**
   * Readiness probe - is the service ready to accept traffic?
   */
  async readiness(): Promise<HealthStatus> {
    const checks: HealthStatus['checks'] = {};
    let overallStatus: HealthStatus['status'] = 'healthy';

    // Check database
    try {
      const dbStart = Date.now();
      const db = await getDatabase();
      const dbHealthy = await db.healthCheck();
      const dbTime = Date.now() - dbStart;

      checks.database = {
        status: dbHealthy ? 'pass' : 'fail',
        responseTime: dbTime,
        message: `Database ${db.getProviderName()}`,
      };

      if (!dbHealthy) overallStatus = 'unhealthy';
    } catch (error: any) {
      checks.database = {
        status: 'fail',
        message: error.message,
      };
      overallStatus = 'unhealthy';
    }

    // Check cache
    try {
      const cacheStart = Date.now();
      const cache = await getCache();
      await cache.set('health:check', 'ok', 10);
      const value = await cache.get('health:check');
      const cacheTime = Date.now() - cacheStart;

      checks.cache = {
        status: value === 'ok' ? 'pass' : 'warn',
        responseTime: cacheTime,
      };

      if (value !== 'ok') overallStatus = 'degraded';
    } catch (error: any) {
      checks.cache = {
        status: 'warn',
        message: error.message,
      };
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    }

    // Check queue
    try {
      const queue = await getQueue();
      const stats = await queue.getStats();

      checks.queue = {
        status: 'pass',
        message: `${stats.pending} pending, ${stats.processing} processing`,
      };
    } catch (error: any) {
      checks.queue = {
        status: 'warn',
        message: error.message,
      };
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    checks.memory = {
      status: heapUsedPercent < 90 ? 'pass' : 'warn',
      message: `Heap: ${Math.round(heapUsedPercent)}% used`,
    };

    if (heapUsedPercent > 90 && overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks,
    };
  }

  /**
   * Detailed health check with metrics
   */
  async detailed(): Promise<HealthStatus & { metrics: any }> {
    const readiness = await this.readiness();
    const clusterInfo = ClusterManager.getInfo();

    // Gather metrics
    const metrics = {
      cluster: clusterInfo,
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        cores: require('os').cpus().length,
        freeMemory: require('os').freemem(),
        totalMemory: require('os').totalmem(),
        loadAverage: require('os').loadavg(),
      },
    };

    // Add cache stats
    try {
      const cache = await getCache();
      metrics.cache = await cache.getStats();
    } catch {}

    // Add queue stats
    try {
      const queue = await getQueue();
      metrics.queue = await queue.getStats();
    } catch {}

    return {
      ...readiness,
      metrics,
    };
  }
}

// Singleton instance
const healthCheck = new HealthCheckService();

/**
 * Express middleware for health endpoints
 */
export function setupHealthEndpoints(app: any): void {
  // Liveness probe
  app.get('/health/live', async (req: Request, res: Response) => {
    const status = await healthCheck.liveness();
    res.status(200).json(status);
  });

  // Readiness probe
  app.get('/health/ready', async (req: Request, res: Response) => {
    const status = await healthCheck.readiness();
    const statusCode = status.status === 'healthy' ? 200 : status.status === 'degraded' ? 503 : 503;
    res.status(statusCode).json(status);
  });

  // Detailed health check (authenticated)
  app.get('/health', async (req: Request, res: Response) => {
    const status = await healthCheck.detailed();
    res.status(200).json(status);
  });

  // Metrics endpoint (Prometheus-compatible)
  app.get('/metrics', async (req: Request, res: Response) => {
    const status = await healthCheck.detailed();

    // Convert to Prometheus format
    const lines: string[] = [];

    // Process metrics
    lines.push(`# HELP process_uptime_seconds Process uptime in seconds`);
    lines.push(`# TYPE process_uptime_seconds gauge`);
    lines.push(`process_uptime_seconds ${status.uptime}`);

    lines.push(`# HELP process_memory_heap_used_bytes Process heap memory used`);
    lines.push(`# TYPE process_memory_heap_used_bytes gauge`);
    lines.push(`process_memory_heap_used_bytes ${status.metrics.process.memory.heapUsed}`);

    // Cache metrics
    if (status.metrics.cache) {
      lines.push(`# HELP cache_hits_total Total cache hits`);
      lines.push(`# TYPE cache_hits_total counter`);
      lines.push(`cache_hits_total ${status.metrics.cache.hits}`);

      lines.push(`# HELP cache_misses_total Total cache misses`);
      lines.push(`# TYPE cache_misses_total counter`);
      lines.push(`cache_misses_total ${status.metrics.cache.misses}`);
    }

    // Queue metrics
    if (status.metrics.queue) {
      lines.push(`# HELP queue_pending_total Pending jobs in queue`);
      lines.push(`# TYPE queue_pending_total gauge`);
      lines.push(`queue_pending_total ${status.metrics.queue.pending}`);

      lines.push(`# HELP queue_processing_total Processing jobs`);
      lines.push(`# TYPE queue_processing_total gauge`);
      lines.push(`queue_processing_total ${status.metrics.queue.processing}`);
    }

    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(lines.join('\n'));
  });
}

export { healthCheck };
