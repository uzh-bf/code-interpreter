process.env.CODEAPI_FILE_SERVER_AUTOSTART = 'false';

import { afterEach, describe, expect, test } from 'bun:test';
import express from 'express';
import { createServer, type Server } from 'http';

const { createHealthRouter } = await import('./file-server');

type FileServerHealthDependencies = Parameters<typeof createHealthRouter>[0];

let server: Server | undefined;

afterEach(() => {
  server?.close();
  server = undefined;
});

function fakeDependencies(
  overrides: Partial<FileServerHealthDependencies> = {},
): FileServerHealthDependencies {
  return {
    pingRedis: async () => 'PONG',
    bucketExists: async () => true,
    isStorageInitialized: () => true,
    ...overrides,
  };
}

async function startHealthServer(
  deps: FileServerHealthDependencies,
): Promise<string> {
  const app = express();
  app.use(createHealthRouter(deps));
  server = createServer(app);
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address == null || typeof address === 'string') {
    throw new Error('Expected TCP listener');
  }
  return `http://127.0.0.1:${address.port}`;
}

describe('file server liveness and readiness', () => {
  test('reports ready when Redis and the bucket are available', async () => {
    const baseUrl = await startHealthServer(fakeDependencies());

    const response = await fetch(`${baseUrl}/ready`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ready',
      checks: { redis: 'ok', s3: 'ok' },
    });
  });

  test('fails readiness when the bucket is missing', async () => {
    const baseUrl = await startHealthServer(
      fakeDependencies({ bucketExists: async () => false }),
    );

    const response = await fetch(`${baseUrl}/ready`);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: 'not ready',
      checks: { redis: 'ok', s3: 'missing' },
    });
  });

  test('fails readiness when the S3 probe throws', async () => {
    const baseUrl = await startHealthServer(
      fakeDependencies({
        bucketExists: async () => {
          throw new Error('S3 unavailable');
        },
      }),
    );

    const response = await fetch(`${baseUrl}/ready`);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: 'not ready',
      checks: { redis: 'ok', s3: 'error' },
    });
  });

  test('fails readiness when Redis ping fails', async () => {
    const baseUrl = await startHealthServer(
      fakeDependencies({
        pingRedis: async () => {
          throw new Error('Redis unavailable');
        },
      }),
    );

    const response = await fetch(`${baseUrl}/ready`);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: 'not ready',
      checks: { redis: 'error', s3: 'ok' },
    });
  });

  test('keeps liveness 200 while dependencies fail', async () => {
    const baseUrl = await startHealthServer(
      fakeDependencies({
        pingRedis: async () => {
          throw new Error('Redis unavailable');
        },
        bucketExists: async () => {
          throw new Error('S3 unavailable');
        },
      }),
    );

    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toEqual({ status: 'ok' });

    const ready = await fetch(`${baseUrl}/ready`);
    expect(ready.status).toBe(503);
  });
});
