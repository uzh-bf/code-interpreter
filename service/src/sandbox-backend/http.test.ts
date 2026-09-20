import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import axios from 'axios';
import { env } from '../config';
import { HttpSandboxBackend } from './http';
import type { SandboxExecuteContext, SandboxTransportRequest } from './types';
import type * as t from '../types';

type CapturedRequest = {
  method: string;
  path: string;
  rawBody: string;
  headers: Record<string, string>;
};

type DispatchAttempt = {
  url: string;
};

/** Endpoint every test starts from, plus any endpoint a test starts itself. */
const servers: ReturnType<typeof Bun.serve>[] = [];
let defaultPort = 0;
let captured: CapturedRequest[] = [];
let nextResponse: { status: number; body: unknown; delayMs?: number } = { status: 200, body: {} };
let nextResponseHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
/** Dispatch attempts and connection refusals for the endpoint under test. */
let dispatchAttempts: DispatchAttempt[] = [];
let refusalCount = 0;
let targetPort = 0;
/** Test hook: while set, the endpoint starts listening once this many
 *  connection attempts were refused, so later attempts meet a listening
 *  process exactly like a scaled-from-zero sandbox that finished starting up.
 *  Two refusals prove the retry repeats rather than firing once. */
const REFUSALS_BEFORE_ENDPOINT_STARTS = 2;
let startEndpointAfterRefusals = false;

const interceptor = axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) recordRefusal(error, error.config?.url ?? '');
    return Promise.reject(error);
  },
);

const requestInterceptor = axios.interceptors.request.use((config) => {
  const url = config.url ?? '';
  if (!url.includes(`:${targetPort}/`)) return config;
  dispatchAttempts.push({ url });
  if (startEndpointAfterRefusals && refusalCount >= REFUSALS_BEFORE_ENDPOINT_STARTS) {
    startEndpointAfterRefusals = false;
    spawnServer(targetPort);
  }
  return config;
});

function recordRefusal(error: unknown, url: string): void {
  if (!axios.isAxiosError(error)) return;
  if (error.response !== undefined || error.code !== 'ECONNREFUSED') return;
  if (!url.includes(`:${targetPort}/`)) return;
  refusalCount += 1;
}

const savedEndpoint = env.SANDBOX_ENDPOINT;

/** Start an endpoint that records requests into captured and replies with
 *  nextResponse. */
function spawnServer(port: number): ReturnType<typeof Bun.serve> {
  const served = Bun.serve({
    port,
    /* Bun closes a connection whose handler is still running once the socket
     * looks idle; the slow-response cases below need it to stay open. */
    idleTimeout: 120,
    async fetch(req) {
      captured.push({
        method: req.method,
        path: new URL(req.url).pathname,
        rawBody: await req.text(),
        headers: Object.fromEntries(req.headers.entries()),
      });
      if (nextResponse.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, nextResponse.delayMs));
      }
      return new Response(JSON.stringify(nextResponse.body), {
        status: nextResponse.status,
        headers: nextResponseHeaders,
      });
    },
  });
  servers.push(served);
  return served;
}

/** Reserve a port and release it again, so connecting to it is refused. */
async function refusedPort(): Promise<number> {
  const reserved = Bun.serve({ port: 0, fetch: () => new Response('') });
  const port = reserved.port;
  await reserved.stop(true);
  if (port === undefined) throw new Error('TCP listener has no port');
  return port;
}

function useEndpoint(port: number): string {
  targetPort = port;
  env.SANDBOX_ENDPOINT = `http://localhost:${port}/api/v2`;
  return `http://localhost:${port}/api/v2/execute`;
}

beforeAll(() => {
  const port = spawnServer(0).port;
  if (port === undefined) throw new Error('TCP listener has no port');
  defaultPort = port;
  useEndpoint(defaultPort);
});

afterAll(() => {
  axios.interceptors.response.eject(interceptor);
  axios.interceptors.request.eject(requestInterceptor);
  env.SANDBOX_ENDPOINT = savedEndpoint;
  for (const served of servers) served.stop(true);
});

afterEach(() => {
  captured = [];
  nextResponse = { status: 200, body: {} };
  nextResponseHeaders = { 'Content-Type': 'application/json' };
  dispatchAttempts = [];
  refusalCount = 0;
  startEndpointAfterRefusals = false;
  for (const served of servers.splice(1)) served.stop(true);
  useEndpoint(defaultPort);
});

function payloadBody(): t.PayloadBody {
  return {
    language: 'python',
    version: '3.14.4',
    session_id: 'sess_exec_1',
    output_session_id: 'sess_out_1',
    files: [{ id: 'file_1', storage_session_id: 'sess_store_1', name: 'inputs/data.csv' }],
    egress_grant: 'ceg1.iv.ct.tag',
    execution_manifest: 'signed-manifest-token',
    env_vars: { PTC_HISTORY_PATH: '/mnt/data/_ptc_history.json' },
  };
}

function request(): SandboxTransportRequest {
  return { body: payloadBody(), headers: { 'Content-Type': 'application/json' } };
}

function context(overrides: Partial<SandboxExecuteContext> = {}): SandboxExecuteContext {
  return {
    executionId: 'exec_1',
    language: 'python',
    isSynthetic: false,
    signal: new AbortController().signal,
    runtimeSessionMode: 'stateless',
    ...overrides,
  };
}

describe('HttpSandboxBackend', () => {
  test('POSTs the request body byte-identical to SANDBOX_ENDPOINT/execute', async () => {
    const responseBody = {
      session_id: 'sess_exec_1',
      language: 'python',
      version: '3.14.4',
      files: [],
      run: {
        stdout: 'ok', stderr: '', code: 0, signal: null, output: 'ok',
        memory: 1, message: null, status: null, cpu_time: 1, wall_time: 2,
      },
    };
    nextResponse = { status: 200, body: responseBody };

    const backend = new HttpSandboxBackend();
    const req = request();
    const result = await backend.execute(req, context());

    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe('POST');
    expect(captured[0].path).toBe('/api/v2/execute');
    expect(captured[0].rawBody).toBe(JSON.stringify(req.body));
    expect(captured[0].headers['content-type']).toBe('application/json');
    expect(result).toEqual(responseBody);
  });

  test('does not mutate the signed request body', async () => {
    const req = request();
    const before = JSON.stringify(req.body);
    await new HttpSandboxBackend().execute(req, context());
    expect(JSON.stringify(req.body)).toBe(before);
  });

  test('throws "Error from sandbox" on 2xx statuses other than 200', async () => {
    nextResponse = { status: 201, body: { session_id: 'x' } };
    expect(new HttpSandboxBackend().execute(request(), context()))
      .rejects.toThrow('Error from sandbox');
  });

  test('rethrows axios errors untouched on non-2xx statuses', async () => {
    nextResponse = { status: 500, body: { message: 'sandbox exploded' } };
    try {
      await new HttpSandboxBackend().execute(request(), context());
      throw new Error('expected rejection');
    } catch (error) {
      expect(axios.isAxiosError(error)).toBe(true);
      if (axios.isAxiosError(error)) {
        expect(error.response?.status).toBe(500);
        expect(error.response?.data).toEqual({ message: 'sandbox exploded' });
      }
    }
  });

  test('propagates the worker abort signal as an axios cancellation', async () => {
    nextResponse = { status: 200, body: { session_id: 'x' }, delayMs: 5_000 };
    const controller = new AbortController();
    const pending = new HttpSandboxBackend().execute(request(), context({ signal: controller.signal }));
    setTimeout(() => controller.abort(), 20);
    try {
      await pending;
      throw new Error('expected rejection');
    } catch (error) {
      expect(axios.isAxiosError(error)).toBe(true);
      if (axios.isAxiosError(error)) {
        expect(error.code === 'ERR_CANCELED' || error.name === 'AbortError').toBe(true);
      }
    }
  });

  test('keeps retrying refused connections and delivers the signed bytes once', async () => {
    const port = await refusedPort();
    const executeUrl = useEndpoint(port);
    const responseBody = { session_id: 'sess_scaled_from_zero', language: 'python', version: '3.14.4', files: [] };
    nextResponse = { status: 200, body: responseBody };
    startEndpointAfterRefusals = true;
    const backend = new HttpSandboxBackend();
    const req = request();

    const result = await backend.execute(req, context({ deadlineAtMs: Date.now() + 10_000 }));

    expect(result).toEqual(responseBody);
    expect(refusalCount).toBeGreaterThanOrEqual(REFUSALS_BEFORE_ENDPOINT_STARTS);
    expect(dispatchAttempts.length).toBeGreaterThan(refusalCount);
    expect(dispatchAttempts.every((attempt) => attempt.url === executeUrl)).toBe(true);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe('POST');
    expect(captured[0].path).toBe('/api/v2/execute');
    expect(captured[0].rawBody).toBe(JSON.stringify(req.body));
  });

  test('stops retrying refusals at the deadline', async () => {
    const port = await refusedPort();
    useEndpoint(port);
    const startedAt = Date.now();

    try {
      await new HttpSandboxBackend().execute(request(), context({ deadlineAtMs: Date.now() + 900 }));
      throw new Error('expected rejection');
    } catch (error) {
      expect(axios.isAxiosError(error)).toBe(true);
      if (axios.isAxiosError(error)) expect(error.code).toBe('ERR_CANCELED');
    }

    expect(refusalCount).toBeGreaterThan(1);
    expect(Date.now() - startedAt).toBeLessThan(5_000);
    expect(captured).toHaveLength(0);
  });

  test('does not retry after an accepted request is disconnected', async () => {
    const port = await refusedPort();
    useEndpoint(port);
    const dropping = Bun.serve({
      port,
      fetch(req, served) {
        captured.push({ method: req.method, path: new URL(req.url).pathname, rawBody: '', headers: {} });
        /* Drop the accepted request without sending a response. */
        served.stop(true);
        return new Response(null);
      },
    });
    servers.push(dropping);

    try {
      await new HttpSandboxBackend().execute(request(), context({ deadlineAtMs: Date.now() + 10_000 }));
      throw new Error('expected rejection');
    } catch (error) {
      expect(axios.isAxiosError(error)).toBe(true);
    }

    expect(captured).toHaveLength(1);
    expect(dispatchAttempts).toHaveLength(1);
  });

  test('does not retry an HTTP failure response', async () => {
    nextResponse = { status: 503, body: { message: 'sandbox starting' } };

    try {
      await new HttpSandboxBackend().execute(request(), context({ deadlineAtMs: Date.now() + 10_000 }));
      throw new Error('expected rejection');
    } catch (error) {
      expect(axios.isAxiosError(error)).toBe(true);
      if (axios.isAxiosError(error)) expect(error.response?.status).toBe(503);
    }

    expect(dispatchAttempts).toHaveLength(1);
    expect(captured).toHaveLength(1);
  });

  test('does not follow a redirect to a refused port', async () => {
    const redirectTargetPort = await refusedPort();
    nextResponse = { status: 302, body: {} };
    nextResponseHeaders = { Location: `http://localhost:${redirectTargetPort}/api/v2/execute` };

    try {
      await new HttpSandboxBackend().execute(request(), context({ deadlineAtMs: Date.now() + 10_000 }));
      throw new Error('expected rejection');
    } catch (error) {
      expect(axios.isAxiosError(error)).toBe(true);
      if (axios.isAxiosError(error)) expect(error.response?.status).toBe(302);
    }

    expect(captured).toHaveLength(1);
    expect(captured[0].path).toBe('/api/v2/execute');
    expect(dispatchAttempts).toHaveLength(1);
    expect(refusalCount).toBe(0);
  });

  test('does not dispatch an already aborted request', async () => {
    const controller = new AbortController();
    controller.abort('deadline');

    try {
      await new HttpSandboxBackend().execute(
        request(),
        context({ signal: controller.signal, deadlineAtMs: Date.now() + 10_000 }),
      );
      throw new Error('expected rejection');
    } catch (error) {
      expect(axios.isAxiosError(error)).toBe(true);
      if (axios.isAxiosError(error)) expect(error.code).toBe('ERR_CANCELED');
    }

    expect(dispatchAttempts).toHaveLength(0);
    expect(captured).toHaveLength(0);
  });

  test('aborts during the refusal backoff without redispatching', async () => {
    const port = await refusedPort();
    useEndpoint(port);
    const controller = new AbortController();
    const pending = new HttpSandboxBackend().execute(
      request(),
      context({ signal: controller.signal, deadlineAtMs: Date.now() + 10_000 }),
    );
    setTimeout(() => controller.abort('deadline'), 50);

    try {
      await pending;
      throw new Error('expected rejection');
    } catch (error) {
      expect(axios.isAxiosError(error)).toBe(true);
      if (axios.isAxiosError(error)) expect(error.code).toBe('ERR_CANCELED');
    }

    expect(refusalCount).toBe(1);
    expect(dispatchAttempts).toHaveLength(1);
  });

  test('stops at the deadline when the refusal backoff outlasts it', async () => {
    const port = await refusedPort();
    useEndpoint(port);
    const startedAt = Date.now();

    try {
      await new HttpSandboxBackend().execute(request(), context({ deadlineAtMs: Date.now() + 120 }));
      throw new Error('expected rejection');
    } catch (error) {
      expect(axios.isAxiosError(error)).toBe(true);
      if (axios.isAxiosError(error)) expect(error.code).toBe('ERR_CANCELED');
    }

    expect(Date.now() - startedAt).toBeLessThan(500);
    expect(dispatchAttempts).toHaveLength(1);
    expect(captured).toHaveLength(0);
  });

  test('bounds a hanging request with the deadline when the caller never aborts', async () => {
    nextResponse = { status: 200, body: { session_id: 'x' }, delayMs: 30_000 };
    const deadlineAtMs = Date.now() + 200;

    try {
      await new HttpSandboxBackend().execute(request(), context({ deadlineAtMs }));
      throw new Error('expected rejection');
    } catch (error) {
      expect(axios.isAxiosError(error)).toBe(true);
      if (axios.isAxiosError(error)) expect(error.code).toBe('ERR_CANCELED');
    }

    expect(dispatchAttempts).toHaveLength(1);
    expect(captured).toHaveLength(1);
    expect(Date.now()).toBeGreaterThanOrEqual(deadlineAtMs);
  });

  test('falls back to JOB_TIMEOUT from entry time when no deadline is supplied', async () => {
    const savedJobTimeout = env.JOB_TIMEOUT;
    env.JOB_TIMEOUT = 150;
    nextResponse = { status: 200, body: { session_id: 'x' }, delayMs: 2_000 };
    const startedAt = Date.now();

    try {
      await new HttpSandboxBackend().execute(request(), context());
      throw new Error('expected rejection');
    } catch (error) {
      expect(axios.isAxiosError(error)).toBe(true);
      if (axios.isAxiosError(error)) expect(error.code).toBe('ERR_CANCELED');
    } finally {
      env.JOB_TIMEOUT = savedJobTimeout;
    }

    const elapsedMs = Date.now() - startedAt;
    expect(elapsedMs).toBeGreaterThanOrEqual(140);
    expect(elapsedMs).toBeLessThan(1_000);
  });

  test('rejects an invalid supplied deadline before dispatching', async () => {
    const invalid = [Number.NaN, Number.POSITIVE_INFINITY, 0, -1];

    for (const deadlineAtMs of invalid) {
      await expect(new HttpSandboxBackend().execute(request(), context({ deadlineAtMs })))
        .rejects.toThrow();
    }

    expect(dispatchAttempts).toHaveLength(0);
    expect(captured).toHaveLength(0);
  });

  test('does not dispatch when the supplied deadline already passed', async () => {
    try {
      await new HttpSandboxBackend().execute(request(), context({ deadlineAtMs: Date.now() - 1 }));
      throw new Error('expected rejection');
    } catch (error) {
      expect(axios.isAxiosError(error)).toBe(true);
      if (axios.isAxiosError(error)) expect(error.code).toBe('ERR_CANCELED');
    }

    expect(dispatchAttempts).toHaveLength(0);
    expect(captured).toHaveLength(0);
  });

  test('rejects an unusable fallback job timeout before dispatching', async () => {
    const savedJobTimeout = env.JOB_TIMEOUT;
    env.JOB_TIMEOUT = Number.NaN;

    try {
      await expect(new HttpSandboxBackend().execute(request(), context()))
        .rejects.toThrow();
      expect(dispatchAttempts).toHaveLength(0);
      expect(captured).toHaveLength(0);
    } finally {
      env.JOB_TIMEOUT = savedJobTimeout;
    }
  });
});
