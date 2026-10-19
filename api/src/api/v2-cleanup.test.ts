import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test';
import express from 'express';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import type { Server } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { config } from '../config';
import { Job } from '../job';
import { loadPackage } from '../runtime';
import { ValidationError } from '../validation';
import {
  EXECUTION_MANIFEST_HEADER,
  EXECUTION_MANIFEST_VERSION,
  executionManifestBodySha256,
  signExecutionManifest,
} from '../execution-manifest';
import router from './v2';

let server: Server;
let url: string;
let directory: string;
const language = 'cleanup-order-test';
const originalPrime = Job.prototype.prime;
const originalExecute = Job.prototype.execute;
const originalUpload = Job.prototype.uploadGeneratedFiles;
const originalCleanup = Job.prototype.cleanup;
const requireManifest = config.require_execution_manifest;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'cleanup-order-'));
  await writeFile(
    join(directory, 'pkg-info.json'),
    JSON.stringify({ language, version: '1.0.0', aliases: [] })
  );
  loadPackage(directory);
  const app = express();
  app.use(router);
  await new Promise<void>(resolve => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  url = `http://127.0.0.1:${
    typeof address === 'object' && address ? address.port : 0
  }/execute`;
});
afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await rm(directory, { recursive: true, force: true });
});
afterEach(() => {
  Job.prototype.prime = originalPrime;
  Job.prototype.execute = originalExecute;
  Job.prototype.uploadGeneratedFiles = originalUpload;
  Job.prototype.cleanup = originalCleanup;
  config.require_execution_manifest = requireManifest;
});

for (const outcome of [
  'success',
  'prime_failure',
  'execution_failure',
  'validation_failure',
] as const) {
  test(`${outcome} waits for cleanup before sending a response and cleans exactly once`, async () => {
    config.require_execution_manifest = false;
    const events: string[] = [];
    let releaseCleanup!: () => void;
    const cleanupGate = new Promise<void>(resolve => {
      releaseCleanup = resolve;
    });
    let markCleanupStarted!: () => void;
    const cleanupStarted = new Promise<void>(resolve => {
      markCleanupStarted = resolve;
    });
    Job.prototype.prime = async function () {
      events.push('prime');
      if (outcome === 'prime_failure')
        throw new Error('scripted prime failure');
    };
    Job.prototype.execute = async function () {
      events.push('execute');
      if (outcome === 'execution_failure')
        throw new Error('scripted execution failure');
      if (outcome === 'validation_failure')
        throw new ValidationError('scripted validation failure');
      return { files: [{ id: 'artifact', name: 'result.txt' }] } as Awaited<
        ReturnType<Job['execute']>
      >;
    };
    Job.prototype.uploadGeneratedFiles = async function () {
      events.push('upload');
      return new Set(['artifact']);
    };
    Job.prototype.cleanup = async function () {
      events.push('cleanup-start');
      markCleanupStarted();
      await cleanupGate;
      events.push('cleanup-end');
    };
    let responseArrived = false;
    const pending = fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language,
        version: '1.0.0',
        files: [{ name: 'main.txt', content: 'test' }],
      }),
    }).then(response => {
      responseArrived = true;
      return response;
    });
    try {
      await Promise.race([
        cleanupStarted,
        pending.then(response => {
          throw new Error(`Response preceded cleanup: ${response.status}`);
        }),
      ]);
      // Give an incorrectly early res.json() time to reach the client.
      await new Promise(resolve => setTimeout(resolve, 30));
      expect(responseArrived).toBe(false);
    } finally {
      releaseCleanup();
      const response = await pending;
      expect(response.status).toBe(
        outcome === 'success'
          ? 200
          : outcome === 'validation_failure'
          ? 400
          : 500
      );
      await response.text();
    }
    expect(events.filter(event => event === 'cleanup-start')).toHaveLength(1);
    expect(events[events.length - 1]).toBe('cleanup-end');
    if (outcome === 'success')
      expect(events).toEqual([
        'prime',
        'execute',
        'upload',
        'cleanup-start',
        'cleanup-end',
      ]);
  });
}

test('client disconnect does not clean a workspace while execution is still running', async () => {
  config.require_execution_manifest = false;
  let releaseExecution!: () => void;
  const executionGate = new Promise<void>(resolve => {
    releaseExecution = resolve;
  });
  let markExecuting!: () => void;
  const executing = new Promise<void>(resolve => {
    markExecuting = resolve;
  });
  let markCleaned!: () => void;
  const cleaned = new Promise<void>(resolve => {
    markCleaned = resolve;
  });
  let cleanupCount = 0;
  Job.prototype.prime = async function () {};
  Job.prototype.execute = async function () {
    markExecuting();
    await executionGate;
    return {} as Awaited<ReturnType<Job['execute']>>;
  };
  Job.prototype.cleanup = async function () {
    cleanupCount++;
    markCleaned();
  };
  const controller = new AbortController();
  const pending = fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      language,
      version: '1.0.0',
      files: [{ name: 'main.txt', content: 'test' }],
    }),
  }).catch(() => undefined);
  try {
    await executing;
    controller.abort();
    await pending;
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(cleanupCount).toBe(0);
  } finally {
    releaseExecution();
    await cleaned;
  }
  expect(cleanupCount).toBe(1);
});


test('disconnect signals running execution, joins it, and never uploads its late result', async () => {
  config.require_execution_manifest = false;
  let started!: () => void;
  let aborted!: () => void;
  let finish!: () => void;
  let cleaned!: () => void;
  const executing = new Promise<void>(resolve => { started = resolve; });
  const cancelled = new Promise<void>(resolve => { aborted = resolve; });
  const exiting = new Promise<void>(resolve => { finish = resolve; });
  const cleanup = new Promise<void>(resolve => { cleaned = resolve; });
  let uploads = 0;
  let cleanupCount = 0;
  Job.prototype.prime = async () => {};
  Job.prototype.execute = async function (signal) {
    signal!.addEventListener('abort', () => aborted(), { once: true });
    started();
    await exiting;
    return { files: [{ name: 'late.csv', id: 'late' }] } as Awaited<ReturnType<Job['execute']>>;
  };
  Job.prototype.uploadGeneratedFiles = async () => { uploads++; return new Set(['late']); };
  Job.prototype.cleanup = async () => { cleanupCount++; cleaned(); };
  const controller = new AbortController();
  const request = fetch(url, { method: 'POST', signal: controller.signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, version: '1.0.0', files: [{ name: 'main.txt', content: 'test' }] }),
  });
  void request.catch(() => undefined);
  try {
    await executing;
    controller.abort();
    await expect(request).rejects.toBeDefined();
    await cancelled;
    expect(cleanupCount).toBe(0);
  } finally {
    finish();
    await cleanup;
  }
  expect(cleanupCount).toBe(1);
  expect(uploads).toBe(0);
});

test('executes ordinarily when a signed manifest carries no lifecycle metadata', async () => {
  config.require_execution_manifest = true;
  const previousSecret = config.execution_manifest_secret;
  const previousPublicKey = config.execution_manifest_public_key;
  config.execution_manifest_secret = 'test-manifest-secret';
  config.execution_manifest_public_key = '';
  const events: string[] = [];
  Job.prototype.prime = async function () { events.push('prime'); };
  Job.prototype.execute = async function () {
    events.push('execute');
    return {} as Awaited<ReturnType<Job['execute']>>;
  };
  Job.prototype.cleanup = async function () { events.push('cleanup'); };
  try {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const body = {
      session_id: 'sess_cleanup_output',
      language,
      version: '1.0.0',
      files: [{ name: 'main.txt', content: 'test' }],
    };
    const token = signExecutionManifest({
      v: EXECUTION_MANIFEST_VERSION,
      exec_id: 'exec_cleanup',
      tenant_id: 'tenant_cleanup',
      user_id: 'user_cleanup',
      session_key: 'tenant:tenant_cleanup:user:user_cleanup',
      input_files: [],
      read_sessions: [],
      output_session_id: body.session_id,
      max_upload_bytes: 1024,
      max_output_files: 10,
      max_requests: 10,
      iat: nowSeconds - 10,
      exp: nowSeconds + 300,
      execute_body_sha256: executionManifestBodySha256(body),
    }, 'test-manifest-secret');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [EXECUTION_MANIFEST_HEADER]: token,
      },
      body: JSON.stringify({ ...body, execution_manifest: token }),
    });

    expect(response.status).toBe(200);
    await response.text();
    expect(events).toEqual(['prime', 'execute', 'cleanup']);
  } finally {
    config.execution_manifest_secret = previousSecret;
    config.execution_manifest_public_key = previousPublicKey;
  }
});

test('rejects an unsigned lifecycle binding injected into a signed request body', async () => {
  config.require_execution_manifest = true;
  const previousSecret = config.execution_manifest_secret;
  const previousPublicKey = config.execution_manifest_public_key;
  config.execution_manifest_secret = 'test-manifest-secret';
  config.execution_manifest_public_key = '';
  const events: string[] = [];
  Job.prototype.prime = async function () { events.push('prime'); };
  Job.prototype.execute = async function () {
    events.push('execute');
    return {} as Awaited<ReturnType<Job['execute']>>;
  };
  Job.prototype.cleanup = async function () { events.push('cleanup'); };
  try {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const body = {
      session_id: 'sess_cleanup_output',
      language,
      version: '1.0.0',
      files: [{ name: 'main.txt', content: 'test' }],
    };
    const token = signExecutionManifest({
      v: EXECUTION_MANIFEST_VERSION,
      exec_id: 'exec_cleanup',
      tenant_id: 'tenant_cleanup',
      user_id: 'user_cleanup',
      session_key: 'tenant:tenant_cleanup:user:user_cleanup',
      input_files: [],
      read_sessions: [],
      output_session_id: body.session_id,
      max_upload_bytes: 1024,
      max_output_files: 10,
      max_requests: 10,
      iat: nowSeconds - 10,
      exp: nowSeconds + 300,
      execute_body_sha256: executionManifestBodySha256(body),
    }, 'test-manifest-secret');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [EXECUTION_MANIFEST_HEADER]: token,
      },
      body: JSON.stringify({
        ...body,
        execution_manifest: token,
        e2e_lifecycle_binding: {
          case_id: 'case_0123456789abcdef',
          program_sha256: 'b'.repeat(64),
          output_session_id: 'abcdefghijklmnopqrstu',
        },
      }),
    });

    expect(response.status).toBe(403);
    await response.text();
    expect(events).toEqual([]);
  } finally {
    config.execution_manifest_secret = previousSecret;
    config.execution_manifest_public_key = previousPublicKey;
  }
});
