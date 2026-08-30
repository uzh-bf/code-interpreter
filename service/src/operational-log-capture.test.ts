import { createHash } from 'node:crypto';
import { Writable } from 'node:stream';
import { afterEach, describe, expect, test } from 'bun:test';
import type { AuthenticatedRequest } from './types';
import { createLogger, format, transports } from 'winston';
import { buildAuthLogMeta } from './middleware/auth-log';
import { buildRequestErrorLogMeta } from './middleware/request-error-logger';
import { operationalErrorMeta } from './operational-log';
import { summarizeSandboxResponse } from './execution-log';

const SENTINEL = 'PRIVATE_capture_9dQm2V7x';
const originalProvider = process.env.CODEAPI_AUTH_PROVIDER;

afterEach(() => {
  if (originalProvider == null) {
    delete process.env.CODEAPI_AUTH_PROVIDER;
  } else {
    process.env.CODEAPI_AUTH_PROVIDER = originalProvider;
  }
});

function sentinelRequest(): AuthenticatedRequest {
  return {
    method: `CUSTOM-${SENTINEL}`,
    originalUrl: `/private/${SENTINEL}`,
    path: `/private/${SENTINEL}`,
    url: `/private/${SENTINEL}`,
    ip: SENTINEL,
    header: (name: string) => {
      const headers: Record<string, string> = {
        authorization: `Bearer ${SENTINEL}`,
        'user-agent': SENTINEL,
        'x-api-key': SENTINEL,
        'x-request-id': SENTINEL,
      };
      return headers[name.toLowerCase()];
    },
    codeApiAuthContext: {
      userId: SENTINEL,
      tenantId: SENTINEL,
      authContextHash: SENTINEL,
    },
    codeApiPrincipal: {
      userId: SENTINEL,
      tenantId: SENTINEL,
      principalSource: SENTINEL,
      authContextHash: SENTINEL,
    },
  } as unknown as AuthenticatedRequest;
}

describe('Winston operational log capture', () => {
  test('does not serialize client values or nested error details', async () => {
    process.env.CODEAPI_AUTH_PROVIDER = 'librechat-jwt';
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      },
    });
    const captureLogger = createLogger({
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json(),
      ),
      transports: [new transports.Stream({ stream })],
    });
    const error = {
      name: 'AxiosError',
      message: `failed for ${SENTINEL}`,
      stack: `Error: ${SENTINEL}`,
      code: SENTINEL,
      filename: `${SENTINEL}.csv`,
      output: SENTINEL,
      nested: { response: { data: SENTINEL } },
    };
    const req = sentinelRequest();

    captureLogger.warn(
      'Synthetic auth rejection',
      buildAuthLogMeta(req, {
        error,
        mode: SENTINEL,
        reason: SENTINEL,
        reasonSource: 'jwt',
      }),
    );
    captureLogger.error(
      'Synthetic request failure',
      buildRequestErrorLogMeta(error, req),
    );
    captureLogger.error('Synthetic execution failure', {
      route: 'v1.exec.programmatic',
      status: 500,
      durationMs: 12,
      fileCount: 1,
      bytes: 128,
      ...operationalErrorMeta(error),
    });
    captureLogger.info(
      'Synthetic sandbox response',
      summarizeSandboxResponse({
        session_id: SENTINEL,
        language: SENTINEL,
        version: SENTINEL,
        files: [{ id: SENTINEL, name: `${SENTINEL}.csv` }],
        run: {
          code: 0,
          message: SENTINEL,
          stdout: SENTINEL,
          stderr: SENTINEL,
          output: SENTINEL,
          wall_time: 12,
        },
      }),
    );
    captureLogger.end();
    await new Promise<void>(resolve => captureLogger.on('finish', resolve));

    const captured = chunks.join('');
    expect(captured).toContain('v1.exec.programmatic');
    expect(captured).toContain('durationMs');
    expect(captured).toContain('fileCount');
    expect(captured).toContain('languageClass');
    expect(captured).toContain('stdout');
    expect(captured).toContain('upstream_http');
    for (const variant of [
      SENTINEL,
      encodeURIComponent(SENTINEL),
      Buffer.from(SENTINEL).toString('base64'),
      createHash('sha256').update(SENTINEL).digest('hex'),
    ]) {
      expect(captured).not.toContain(variant);
    }
  });
});
