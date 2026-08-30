import { createHash } from 'node:crypto';
import { afterEach, describe, expect, test } from 'bun:test';
import type { AuthenticatedRequest } from '../types';
import { buildAuthLogMeta } from './auth-log';

const SENTINEL = 'PRIVATE_auth_9dQm2V7x';
const originalProvider = process.env.CODEAPI_AUTH_PROVIDER;

afterEach(() => {
  if (originalProvider == null) {
    delete process.env.CODEAPI_AUTH_PROVIDER;
  } else {
    process.env.CODEAPI_AUTH_PROVIDER = originalProvider;
  }
});

describe('buildAuthLogMeta', () => {
  test('keeps auth classes without retaining client values', () => {
    process.env.CODEAPI_AUTH_PROVIDER = 'librechat-jwt';
    const req = {
      method: `CUSTOM-${SENTINEL}`,
      originalUrl: `/private/${SENTINEL}`,
      path: `/private/${SENTINEL}`,
      url: `/private/${SENTINEL}`,
      ip: SENTINEL,
      header: (name: string) => {
        const headers: Record<string, string> = {
          authorization: `Bearer ${SENTINEL}`,
          'x-api-key': SENTINEL,
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

    const serialized = JSON.stringify(
      buildAuthLogMeta(req, {
        error: new Error(SENTINEL),
        mode: SENTINEL,
        reason: SENTINEL,
        reasonSource: 'jwt',
      }),
    );

    expect(JSON.parse(serialized)).toMatchObject({
      method: 'OTHER',
      route: 'unmatched',
      authProvider: 'librechat-jwt',
      hasBearerToken: true,
      hasApiKeyHeader: true,
      principalSource: 'other',
      mode: 'invalid',
      reason: 'other',
      errorClass: 'unexpected',
    });
    for (const variant of [
      SENTINEL,
      encodeURIComponent(SENTINEL),
      Buffer.from(SENTINEL).toString('base64'),
      createHash('sha256').update(SENTINEL).digest('hex'),
    ]) {
      expect(serialized).not.toContain(variant);
    }
  });
});
