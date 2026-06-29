import type { Job, Queue, QueueEvents } from 'bullmq';

const JOB_RESULT_POLL_INTERVAL_MS = 250;

class TerminalJobError extends Error {}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted || ms <= 0) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const done = () => {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
      signal?.removeEventListener('abort', done);
      resolve();
    };
    timeout = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}

function throwIfAborted(jobId: string, signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error(`Job wait aborted before finishing (id=${jobId})`);
  }
}

function waitForJobEvent<TData, TReturn, TName extends string>(
  jobId: string,
  queue: Queue<TData, TReturn, TName>,
  queueEvents: QueueEvents,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<TReturn> {
  return new Promise((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let settled = false;

    const cleanup = () => {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
      queueEvents.off('completed', onCompleted);
      queueEvents.off('failed', onFailed);
      signal?.removeEventListener('abort', onAbort);
    };

    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    const settleWith = (promise: Promise<TReturn>) => {
      if (settled) return;
      settled = true;
      cleanup();
      void promise.then(resolve, reject);
    };

    const onCompleted = (event: { jobId: string }) => {
      if (event.jobId !== jobId) {
        return;
      }
      settleWith((async () => {
        const currentJob = await queue.getJob(jobId);
        if (!currentJob) {
          throw new Error(`Job ${jobId} no longer exists after completion event`);
        }
        return currentJob.returnvalue;
      })());
    };
    const onFailed = (event: { jobId: string; failedReason?: string }) => {
      if (event.jobId === jobId) {
        settle(() => reject(new Error(event.failedReason || `Job ${jobId} failed`)));
      }
    };
    const onAbort = () => {
      settle(() => reject(new Error(`Job event wait aborted before finishing (id=${jobId})`)));
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }

    timeout = setTimeout(() => {
      settle(() => reject(new Error(`Job wait execute timed out before receiving a finish event after ${timeoutMs}ms (id=${jobId})`)));
    }, timeoutMs);
    queueEvents.on('completed', onCompleted);
    queueEvents.on('failed', onFailed);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function pollJobUntilFinished<TData, TReturn, TName extends string>(
  job: Job<TData, TReturn, TName>,
  queue: Queue<TData, TReturn, TName>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<TReturn> {
  const jobId = job.id;
  if (!jobId) {
    throw new Error('Cannot poll BullMQ job without an id');
  }

  const deadline = Date.now() + timeoutMs;
  let lastState = 'unknown';
  let lastError: unknown;

  while (Date.now() < deadline) {
    throwIfAborted(jobId, signal);

    try {
      const currentJob = await queue.getJob(jobId);
      if (!currentJob) {
        lastState = 'missing';
        throw new TerminalJobError(`Job ${jobId} no longer exists before reaching a terminal state`);
      }
      lastState = await currentJob.getState();
      if (lastState === 'completed') {
        return currentJob.returnvalue;
      }
      if (lastState === 'failed') {
        throw new TerminalJobError(currentJob.failedReason || `Job ${jobId} failed`);
      }
    } catch (error) {
      if (error instanceof TerminalJobError) {
        throw error;
      }
      lastError = error;
      await wait(Math.min(JOB_RESULT_POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())), signal);
      continue;
    }

    await wait(Math.min(JOB_RESULT_POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())), signal);
  }

  throwIfAborted(jobId, signal);

  const suffix = lastError instanceof Error ? `; last poll error: ${lastError.message}` : '';
  throw new Error(
    `Job wait execute timed out before finishing, no terminal state observed after ${timeoutMs}ms (id=${jobId}, lastState=${lastState})${suffix}`,
  );
}

async function waitForJobFinished<TData, TReturn, TName extends string>(
  job: Job<TData, TReturn, TName>,
  queue: Queue<TData, TReturn, TName>,
  queueEvents: QueueEvents,
  timeoutMs: number,
): Promise<TReturn> {
  const pollAbortController = new AbortController();
  const eventAbortController = new AbortController();
  const jobId = job.id;
  if (!jobId) {
    throw new Error('Cannot wait for BullMQ job without an id');
  }

  const eventWait = waitForJobEvent<TData, TReturn, TName>(
    jobId,
    queue,
    queueEvents,
    timeoutMs,
    eventAbortController.signal,
  );
  void eventWait.catch(() => undefined);
  const pollWait = pollJobUntilFinished(job, queue, timeoutMs, pollAbortController.signal);
  void pollWait.catch(() => undefined);

  try {
    return await Promise.race([
      eventWait,
      pollWait,
    ]);
  } finally {
    pollAbortController.abort();
    eventAbortController.abort();
  }
}

export { waitForJobFinished };
