import type { Queue } from 'bullmq';
import type { Express } from 'express';
import { pyQueue, otherQueue, pyQueueEvents, otherQueueEvents, connection } from './queue';
import { validateStartupAuthConfig } from './auth/startup';
import { env } from './config';
import {
  validateApiHardenedConfig,
  validateExecutionProfilePolicy,
  validateSandboxBackendPolicy,
  validateWorkerHardenedConfig,
} from './secure-startup';
import logger from './logger';
import { shutdownTelemetry } from './telemetry';
import { configureExecutionProfileMetrics } from './metrics';
import { operationalErrorMeta } from './operational-log';

let isShuttingDown = false;
let isStartingUp = true;

function configureProfileMetrics(): void {
  configureExecutionProfileMetrics({
    profile: env.EXECUTION_PROFILE,
    sandboxBackend: env.SANDBOX_BACKEND,
    runtimeSessionMode: env.RUNTIME_SESSION_MODE,
  });
}

async function shutdownTracing(): Promise<void> {
  try {
    await shutdownTelemetry();
    logger.info('OpenTelemetry shutdown completed');
  } catch (error) {
    logger.warn('OpenTelemetry shutdown failed', operationalErrorMeta(error));
  }
}

async function validateLifecycleAuthConfig(): Promise<void> {
  await validateStartupAuthConfig();
}

// Flag to track if this process runs workers
let hasWorkers = false;

/**
 * Register that this process has workers running.
 * Called by worker entry points to enable worker-specific shutdown behavior.
 */
export function registerWorkers(): void {
  hasWorkers = true;
}

/**
 * Set up queue event listeners for monitoring
 */
function setupQueueListeners(queue: Queue, queueClass: 'python' | 'other'): void {
  queue.on('error', (error: Error) => {
    logger.error('Queue error', { queueClass, ...operationalErrorMeta(error) });
  });

  queue.on('waiting', () => {
    logger.debug('Queue job waiting', { queueClass });
  });

  queue.on('progress', () => {
    logger.debug('Queue job progressed', { queueClass });
  });

  queue.on('paused', () => {
    logger.info('Queue paused', { queueClass });
  });

  queue.on('resumed', () => {
    logger.info('Queue resumed', { queueClass });
  });

  queue.on('removed', () => {
    logger.debug('Queue job removed', { queueClass });
  });

  queue.on('cleaned', (jobs) => {
    logger.info('Queue jobs cleaned', { queueClass, jobCount: jobs.length });
  });
}

/**
 * Startup for API-only mode (no workers)
 * Just validates authentication and sets up queue connections for job submission
 */
export async function startupApiOnly(): Promise<void> {
  logger.info('Starting API service (no workers)...');
  validateApiHardenedConfig();
  validateExecutionProfilePolicy({ requireBackendMatch: false });
  /* No validateSandboxBackendPolicy() here: an API-only pod authenticates and
   * enqueues jobs, it never constructs the Lambda backend or checkpoint store.
   * Validating that policy would force worker-only config (LAMBDA_MICROVM_* and
   * the MINIO_* checkpoint creds) into API pods just to boot. The worker and
   * combined startups own that validation. */
  await validateLifecycleAuthConfig();
  configureProfileMetrics();

  // Set up queue listeners for monitoring (optional, for observability)
  setupQueueListeners(pyQueue, 'python');
  setupQueueListeners(otherQueue, 'other');

  isStartingUp = false;
  logger.info('API service startup complete');
}

/**
 * Startup for Worker-only mode
 * Imports workers and validates they're running
 */
export async function startupWorkerOnly(): Promise<void> {
  logger.info('Starting Worker service...');
  validateWorkerHardenedConfig();
  validateExecutionProfilePolicy();
  validateSandboxBackendPolicy();
  configureProfileMetrics();

  // Dynamically import workers to start them
  const { pyWorker, otherWorker } = await import('./workers');

  registerWorkers();

  // Verify workers are running
  const checkWorkers = (): void => {
    const isPyWorkerRunning = pyWorker.isRunning();
    const isOtherWorkerRunning = otherWorker.isRunning();

    if (!isPyWorkerRunning) {
      throw new Error('Python worker is not running');
    }
    if (!isOtherWorkerRunning) {
      throw new Error('Other worker is not running');
    }
    logger.info('Workers health check passed');
  };

  checkWorkers();
  isStartingUp = false;
  logger.info('Worker service startup complete');
}

/**
 * Combined startup for backward compatibility (API + Workers in same process)
 * This is the legacy mode used by service-api.ts
 */
async function gracefulStartup(): Promise<void> {
  logger.info('Starting up service (combined API + Workers)...');
  validateApiHardenedConfig();
  validateWorkerHardenedConfig();
  validateExecutionProfilePolicy();
  validateSandboxBackendPolicy();
  await validateLifecycleAuthConfig();
  configureProfileMetrics();

  try {
    logger.info('Setting up queues...');

    // Import workers (this starts them)
    const { pyWorker, otherWorker } = await import('./workers');

    registerWorkers();

    // Set up queue event listeners
    setupQueueListeners(pyQueue, 'python');
    setupQueueListeners(otherQueue, 'other');

    // Verify workers are running
    const checkWorkers = (): void => {
      const isPyWorkerRunning = pyWorker.isRunning();
      const isOtherWorkerRunning = otherWorker.isRunning();

      if (!isPyWorkerRunning) {
        throw new Error('Python worker is not running');
      }
      if (!isOtherWorkerRunning) {
        throw new Error('Other worker is not running');
      }
      logger.info('Workers health check passed');
    };

    checkWorkers();

    // Resume queues (in case they were paused)
    await Promise.all([
      pyQueue.resume(),
      otherQueue.resume()
    ]);

    isStartingUp = false;
    logger.info('Service startup complete');
  } catch (error) {
    logger.error('Error during startup', operationalErrorMeta(error));
    throw error;
  }
}

/**
 * Graceful shutdown - handles both API-only and Worker modes
 *
 * Key changes for scalability:
 * - Does NOT drain or clean shared queues (other workers may be processing)
 * - Only closes this instance's workers gracefully
 * - Waits for active jobs to complete before closing workers
 */
export async function gracefulShutdown(): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info('Initiating graceful shutdown...');

  const shutdownTimeout = setTimeout(() => {
    logger.error('Shutdown timeout reached, forcing exit');
    process.exit(1);
  }, 30000);

  try {
    if (hasWorkers) {
      // Worker shutdown: close workers gracefully
      const { pyWorker, otherWorker } = await import('./workers');

      // Pause workers and wait for active jobs to complete
      // Note: We pause workers, NOT queues (queues are shared)
      // pause(false) = wait for active jobs to finish before resolving (doNotWaitActive=false)
      // pause(true) = return immediately without waiting for active jobs
      const pauseAndDrain = async (
        worker: typeof pyWorker,
        workerClass: 'python' | 'other',
      ): Promise<void> => {
        logger.info('Pausing worker and waiting for active jobs to drain', { workerClass });
        try {
          // doNotWaitActive=false means wait for active jobs to complete
          await worker.pause(false);
          logger.info('Worker drained successfully', { workerClass });
        } catch (error) {
          logger.warn('Worker pause failed', {
            workerClass,
            ...operationalErrorMeta(error),
          });
        }
      };

      await Promise.all([
        pauseAndDrain(pyWorker, 'python'),
        pauseAndDrain(otherWorker, 'other')
      ]);

      // Close workers
      await Promise.all([
        pyWorker.close(),
        otherWorker.close()
      ]);
      logger.info('Workers closed');
    }

    // Close queue connections (both API and Worker need this)
    await Promise.all([
      pyQueue.close(),
      otherQueue.close(),
      pyQueueEvents.close(),
      otherQueueEvents.close()
    ]);
    logger.info('Queue connections closed');

    // Only disconnect Redis if explicitly requested
    if (process.env.FORCE_REDIS_DISCONNECT === 'true') {
      connection.disconnect();
      logger.info('Redis connection closed');
    }

    await shutdownTracing();

    clearTimeout(shutdownTimeout);
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', operationalErrorMeta(error));
    await shutdownTracing();
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

export function checkServiceStartUp(): boolean {
  return isStartingUp;
}

export function setStartupComplete(): void {
  isStartingUp = false;
}

export function checkServiceShutDown(): boolean {
  return isShuttingDown;
}

/**
 * Start combined server (API + Workers) - for backward compatibility
 */
export async function startServer(app: Express, callback?: () => Promise<void>): Promise<void> {
  try {
    await gracefulStartup();
    app.listen(env.PORT, () => {
      logger.info('Combined API and worker service started');
    });

    if (callback != null) {
      await callback();
    }
  } catch (error) {
    logger.error('Failed to start server', operationalErrorMeta(error));
    process.exit(1);
  }
}

/**
 * Start API-only server (no workers)
 */
export async function startApiServer(app: Express, callback?: () => Promise<void>): Promise<void> {
  try {
    await startupApiOnly();
    app.listen(env.PORT, () => {
      logger.info('API service started');
    });

    if (callback != null) {
      await callback();
    }
  } catch (error) {
    logger.error('Failed to start API server', operationalErrorMeta(error));
    process.exit(1);
  }
}

/**
 * Start Worker-only server (no HTTP)
 */
export async function startWorkerServer(callback?: () => Promise<void>): Promise<void> {
  try {
    await startupWorkerOnly();
    logger.info('Worker service started');

    if (callback != null) {
      await callback();
    }
  } catch (error) {
    logger.error('Failed to start worker server', operationalErrorMeta(error));
    process.exit(1);
  }
}
