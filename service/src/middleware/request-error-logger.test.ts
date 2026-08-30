import { afterEach, describe, expect, test } from 'bun:test';
import type { Request } from 'express';
import type { AuthenticatedRequest } from '../types';
import { SessionKeyResolutionError } from '../session-key';
import { CodeApiJwtAuthError } from '../auth/librechat-jwt';
import { buildRequestErrorLogMeta, buildRequestNotFoundLogMeta } from './request-error-logger';

const originalProvider = process.env.CODEAPI_AUTH_PROVIDER;

function request(): Request {
  return {
    method: 'POST',
    originalUrl: '/v1/exec',
    path: '/exec',
    url: '/exec',
    ip: '127.0.0.1',
    header: (name: string) => {
      const headers: Record<string, string> = {
        'x-request-id': 'req_123',
        'user-agent': 'unit-test',
      };
      return headers[name.toLowerCase()];
    },
    codeApiAuthContext: {
      userId: 'user_123',
      tenantId: 'tenant_abc',
      authContextHash: 'hash_123',
    },
    codeApiPrincipal: {
      userId: 'user_123',
      tenantId: 'tenant_abc',
      principalSource: 'librechat_jwt',
      authContextHash: 'hash_123',
    },
  } as unknown as Request;
}

afterEach(() => {
  if (originalProvider === undefined) {
    delete process.env.CODEAPI_AUTH_PROVIDER;
  } else {
    process.env.CODEAPI_AUTH_PROVIDER = originalProvider;
  }
});

describe('buildRequestErrorLogMeta', () => {
  test('keeps only values-free request classes for session-key failures', () => {
    process.env.CODEAPI_AUTH_PROVIDER = 'librechat-jwt';

    const meta = buildRequestErrorLogMeta(
      new SessionKeyResolutionError(500, 'tenantId missing from auth context'),
      request(),
    );

    expect(meta).toMatchObject({
      status: 500,
      method: 'POST',
      route: 'v1.exec',
      authProvider: 'librechat-jwt',
      principalSource: 'librechat_jwt',
      errorClass: 'session_key',
    });
    expect(JSON.stringify(meta)).not.toContain('user_123');
    expect(JSON.stringify(meta)).not.toContain('tenant_abc');
    expect(JSON.stringify(meta)).not.toContain('hash_123');
  });

  test('classifies JWT failures without retaining their messages', () => {
    const meta = buildRequestErrorLogMeta(
      new CodeApiJwtAuthError('malformed_claims', 'tenant_id is required'),
      request() as AuthenticatedRequest,
    );

    expect(meta.status).toBe(401);
    expect(meta.errorClass).toBe('authentication');
    expect(JSON.stringify(meta)).not.toContain('tenant_id is required');
  });
});

describe('buildRequestNotFoundLogMeta', () => {
  test('classifies routes and keeps only auth-header presence', () => {
    const meta = buildRequestNotFoundLogMeta(request());

    expect(meta).toMatchObject({
      status: 404,
      method: 'POST',
      route: 'v1.exec',
      hasBearerToken: false,
      hasApiKeyHeader: false,
      hasSyntheticToken: false,
    });
  });
});
