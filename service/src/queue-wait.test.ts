import { describe, expect, test } from 'bun:test';
import type { Job, Queue, QueueEvents } from 'bullmq';
import { EventEmitter } from 'events';
import { waitForJobFinished } from './queue-wait';

type TestResult = { ok: true; source: string };

function pending<T>(): Promise<T> {
  return new Promise(() => undefined);
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fakeJob(overrides: Partial<Job<unknown, TestResult, string>>): Job<unknown, TestResult, string> {
  return {
    id: 'job-1',
    waitUntilFinished: () => pending<TestResult>(),
    ...overrides,
  } as Job<unknown, TestResult, string>;
}

function fakeQueue(getJob: Queue<unknown, TestResult, string>['getJob']): Queue<unknown, TestResult, string> {
  return { getJob } as Queue<unknown, TestResult, string>;
}

function fakeQueueEvents(): QueueEvents & EventEmitter {
  return new EventEmitter() as QueueEvents & EventEmitter;
}

describe('waitForJobFinished', () => {
  test('uses the QueueEvents result when it arrives first', async () => {
    const result = { ok: true, source: 'events' } satisfies TestResult;
    const job = fakeJob({});
    const queue = fakeQueue(async () => ({
      returnvalue: result,
    } as Job<unknown, TestResult, string>));
    const queueEvents = fakeQueueEvents();
    const waitForResult = waitForJobFinished(job, queue, queueEvents, 1000);
    queueEvents.emit('completed', { jobId: 'job-1', returnvalue: result });

    await expect(waitForResult).resolves.toEqual(result);
  });

  test('stops polling after the QueueEvents result wins', async () => {
    const result = { ok: true, source: 'events' } satisfies TestResult;
    let getJobCalls = 0;
    const job = fakeJob({});
    const queue = fakeQueue(async () => {
      getJobCalls += 1;
      if (getJobCalls === 1) {
        return {
          getState: async () => 'active',
        } as Job<unknown, TestResult, string>;
      }
      return {
        returnvalue: result,
      } as Job<unknown, TestResult, string>;
    });
    const queueEvents = fakeQueueEvents();
    const waitForResult = waitForJobFinished(job, queue, queueEvents, 1000);
    setTimeout(() => {
      queueEvents.emit('completed', { jobId: 'job-1', returnvalue: result });
    }, 5);

    await expect(waitForResult).resolves.toEqual(result);
    await wait(300);
    expect(getJobCalls).toBe(2);
  });

  test('polls completed jobs when QueueEvents do not arrive', async () => {
    const result = { ok: true, source: 'poll' } satisfies TestResult;
    const job = fakeJob({});
    const queue = fakeQueue(async () => ({
      getState: async () => 'completed',
      returnvalue: result,
    } as Job<unknown, TestResult, string>));
    const queueEvents = fakeQueueEvents();

    await expect(waitForJobFinished(job, queue, queueEvents, 1000)).resolves.toEqual(result);
  });

  test('rejects failed jobs found by polling', async () => {
    const job = fakeJob({});
    const queue = fakeQueue(async () => ({
      getState: async () => 'failed',
      failedReason: 'sandbox failed',
    } as Job<unknown, TestResult, string>));
    const queueEvents = fakeQueueEvents();

    await expect(waitForJobFinished(job, queue, queueEvents, 1000)).rejects.toThrow('sandbox failed');
  });

  test('rejects missing jobs instead of polling until timeout', async () => {
    const job = fakeJob({});
    const queue = fakeQueue(async () => undefined);
    const queueEvents = fakeQueueEvents();

    await expect(waitForJobFinished(job, queue, queueEvents, 1000)).rejects.toThrow(
      'Job job-1 no longer exists before reaching a terminal state',
    );
  });

  test('removes QueueEvents listeners after polling wins', async () => {
    const result = { ok: true, source: 'poll' } satisfies TestResult;
    const job = fakeJob({});
    const queue = fakeQueue(async () => ({
      getState: async () => 'completed',
      returnvalue: result,
    } as Job<unknown, TestResult, string>));
    const queueEvents = fakeQueueEvents();

    await expect(waitForJobFinished(job, queue, queueEvents, 1000)).resolves.toEqual(result);
    expect(queueEvents.listenerCount('completed')).toBe(0);
    expect(queueEvents.listenerCount('failed')).toBe(0);
  });
});
