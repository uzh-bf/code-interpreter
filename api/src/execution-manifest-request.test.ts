import { describe, expect, test } from 'bun:test';
import crypto from 'crypto';
import {
  EXECUTION_MANIFEST_VERSION,
  ExecutionManifestError,
  executionManifestBodySha256,
  type ExecutionManifestClaims,
  type ExecutionManifestErrorReason,
  signExecutionManifest,
  signExecutionManifestWithPrivateKey,
  verifyExecutionManifest,
} from './execution-manifest';
import {
  collectExecuteRequestInputFiles,
  verifyExecuteRequestManifest,
} from './execution-manifest-request';
import {
  LIFECYCLE_CASE_ENV,
  LifecycleCaseRegistry,
} from '../../shared/live-cancellation-registration';
import { prepareSandboxEgress } from '../../service/src/egress-grant';
import { buildSandboxExecuteRequest } from '../../service/src/sandbox-dispatch';
import { resolveVerifiedLifecycleBinding } from './api/v2';

const SECRET = 'test-secret';
const PRIVATE_KEY = 'MC4CAQAwBQYDK2VwBCIEIBoxzSJjQ5jTVyuohHtlD+uDGqv/tZ6hQS2CmxuOg2Wn';
const PUBLIC_KEY = 'MCowBQYDK2VwAyEAeY3PRoTS3adfU6E3gQUB5hSZdrdMSw6OrKkH4UhYh0U=';
const EGRESS_SECRET = 'test-egress-secret-32-bytes-minimum';
const LIFECYCLE_NOW_MS = 1_700_000_000_000;
const LIFECYCLE_NOW_SECONDS = Math.floor(LIFECYCLE_NOW_MS / 1000);
const LIFECYCLE_CASE_ID = 'case_0123456789abcdef';
const LIFECYCLE_PROGRAM = '#!/bin/bash\nprintf start\nsleep 1\n';
const LIFECYCLE_PROGRAM_SHA256 = crypto.createHash('sha256').update(LIFECYCLE_PROGRAM, 'utf8').digest('hex');
const LIFECYCLE_OUTPUT_SESSION = 'abcdefghijklmnopqrstu';

function claims(overrides: Partial<ExecutionManifestClaims> = {}): ExecutionManifestClaims {
  return {
    v: EXECUTION_MANIFEST_VERSION,
    exec_id: 'exec_123',
    tenant_id: 'tenant_abc',
    user_id: 'user_123',
    session_key: 'tenant:tenant_abc:user:user_123',
    input_files: [{ id: 'file_123', session_id: 'sess_input', name: 'inputs/data.csv' }],
    read_sessions: ['sess_input'],
    output_session_id: 'sess_output',
    max_upload_bytes: 1024,
    max_output_files: 10,
    max_requests: 50,
    iat: 100,
    exp: 200,
    principal_source: 'librechat',
    ...overrides,
  };
}

const body = {
  session_id: 'sess_output',
  files: [
    { name: 'main.py', content: 'print(1)' },
    { id: 'file_123', storage_session_id: 'sess_input', name: 'inputs/data.csv' },
  ],
};

function claimsForBody(requestBody: unknown, overrides: Partial<ExecutionManifestClaims> = {}): ExecutionManifestClaims {
  return claims({
    execute_body_sha256: executionManifestBodySha256(requestBody),
    ...overrides,
  });
}

function signedBody<T extends Record<string, unknown>>(
  requestBody: T,
  overrides: Partial<ExecutionManifestClaims> = {},
): { bodyWithManifest: T & { execution_manifest: string }; token: string } {
  const token = signExecutionManifest(claimsForBody(requestBody, overrides), SECRET);
  return {
    bodyWithManifest: { ...requestBody, execution_manifest: token },
    token,
  };
}

function expectManifestError(fn: () => unknown, reason: ExecutionManifestErrorReason): void {
  try {
    fn();
    throw new Error('expected manifest error');
  } catch (error) {
    expect(error).toBeInstanceOf(ExecutionManifestError);
    expect((error as ExecutionManifestError).reason).toBe(reason);
  }
}

function lifecycleRegistration(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    case_id: LIFECYCLE_CASE_ID,
    program_sha256: LIFECYCLE_PROGRAM_SHA256,
    output_basename: 'lifecycle.out',
    horizon_ms: 5_000,
    expires_at_ms: LIFECYCLE_NOW_MS + 60_000,
    ...overrides,
  });
}

function lifecyclePayload() {
  return {
    language: 'bash',
    version: '5.2.0',
    session_id: LIFECYCLE_OUTPUT_SESSION,
    files: [{ name: 'main.sh', content: LIFECYCLE_PROGRAM }],
  };
}

function lifecycleManifestClaims(): ExecutionManifestClaims {
  return claims({
    output_session_id: LIFECYCLE_OUTPUT_SESSION,
    input_files: [],
    read_sessions: [],
    iat: LIFECYCLE_NOW_SECONDS,
    exp: LIFECYCLE_NOW_SECONDS + 300,
  });
}

function withLifecycleRegistration<T>(raw: string | undefined, fn: () => T): T {
  const previous = process.env[LIFECYCLE_CASE_ENV];
  if (raw === undefined) delete process.env[LIFECYCLE_CASE_ENV];
  else process.env[LIFECYCLE_CASE_ENV] = raw;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env[LIFECYCLE_CASE_ENV];
    else process.env[LIFECYCLE_CASE_ENV] = previous;
  }
}

describe('execute request manifest validation', () => {
  test('accepts a signed manifest whose file and output-session scope matches the request', () => {
    const matchingClaims = claimsForBody(body);
    const token = signExecutionManifest(matchingClaims, SECRET);

    expect(collectExecuteRequestInputFiles(body)).toEqual([
      { id: 'file_123', session_id: 'sess_input', name: 'inputs/data.csv' },
    ]);
    expect(verifyExecuteRequestManifest({
      headerValue: token,
      secret: SECRET,
      body,
      nowSeconds: 150,
    })).toEqual(matchingClaims);
  });

  test('accepts an asymmetric manifest with only the public verifier key', () => {
    const matchingClaims = claimsForBody(body);
    const token = signExecutionManifestWithPrivateKey(matchingClaims, PRIVATE_KEY);

    expect(verifyExecuteRequestManifest({
      headerValue: token,
      publicKey: PUBLIC_KEY,
      body,
      nowSeconds: 150,
    })).toEqual(matchingClaims);
  });

  test('preserves the legacy HMAC verifier fallback when no public key is configured', () => {
    const matchingClaims = claimsForBody(body);
    const token = signExecutionManifest(matchingClaims, SECRET);

    expect(verifyExecuteRequestManifest({
      headerValue: token,
      publicKey: '',
      secret: SECRET,
      body,
      nowSeconds: 150,
    })).toEqual(matchingClaims);
  });

  test('falls back to legacy HMAC when both verifier modes are configured during rollout', () => {
    const matchingClaims = claimsForBody(body);
    const token = signExecutionManifest(matchingClaims, SECRET);

    expect(verifyExecuteRequestManifest({
      headerValue: token,
      publicKey: PUBLIC_KEY,
      secret: SECRET,
      body,
      nowSeconds: 150,
    })).toEqual(matchingClaims);
  });

  test('includes id refs that rely on runtime defaults in the signed scope check', () => {
    const bodyWithDefaultedRefs = {
      session_id: 'sess_output',
      files: [
        { name: 'main.py', content: 'print(1)' },
        { id: 'file_same_session', name: 'inputs/current.csv' },
        { id: 'file_default_name' },
      ],
    } as unknown as Parameters<typeof collectExecuteRequestInputFiles>[0];

    expect(collectExecuteRequestInputFiles(bodyWithDefaultedRefs)).toEqual([
      { id: 'file_default_name', session_id: 'sess_output', name: 'file2.code' },
      { id: 'file_same_session', session_id: 'sess_output', name: 'inputs/current.csv' },
    ]);

    expectManifestError(() => verifyExecuteRequestManifest({
      headerValue: signExecutionManifest(claimsForBody(bodyWithDefaultedRefs, {
        input_files: [],
        read_sessions: [],
      }), SECRET),
      secret: SECRET,
      body: bodyWithDefaultedRefs,
      nowSeconds: 150,
    }), 'scope_mismatch');

    const matchingClaims = claimsForBody(bodyWithDefaultedRefs, {
      input_files: [
        { id: 'file_same_session', session_id: 'sess_output', name: 'inputs/current.csv' },
        { id: 'file_default_name', session_id: 'sess_output', name: 'file2.code' },
      ],
      read_sessions: ['sess_output'],
    });

    expect(verifyExecuteRequestManifest({
      headerValue: signExecutionManifest(matchingClaims, SECRET),
      secret: SECRET,
      body: bodyWithDefaultedRefs,
      nowSeconds: 150,
    })).toEqual(matchingClaims);
  });

  test('rejects missing, wrong-session, wrong-file, and expired manifests', () => {
    expectManifestError(() => verifyExecuteRequestManifest({
      headerValue: undefined,
      secret: SECRET,
      body,
      nowSeconds: 150,
    }), 'missing_header');

    expectManifestError(() => verifyExecuteRequestManifest({
      headerValue: signExecutionManifest(claimsForBody(body, { output_session_id: 'other_output' }), SECRET),
      secret: SECRET,
      body,
      nowSeconds: 150,
    }), 'scope_mismatch');

    expectManifestError(() => verifyExecuteRequestManifest({
      headerValue: signExecutionManifest(claimsForBody(body, { input_files: [{ id: 'file_other', session_id: 'sess_input', name: 'inputs/data.csv' }] }), SECRET),
      secret: SECRET,
      body,
      nowSeconds: 150,
    }), 'scope_mismatch');

    expectManifestError(() => verifyExecuteRequestManifest({
      headerValue: signExecutionManifest(claimsForBody(body), SECRET),
      secret: SECRET,
      body,
      nowSeconds: 1000,
    }), 'expired');
  });

  test('rejects duplicated request files that do not exactly match manifest multiplicity', () => {
    const duplicateBody = {
      session_id: 'sess_output',
      files: [
        { id: 'file_123', storage_session_id: 'sess_input', name: 'inputs/data.csv' },
        { id: 'file_123', storage_session_id: 'sess_input', name: 'inputs/data.csv' },
      ],
    };
    const token = signExecutionManifest(claims({
      execute_body_sha256: executionManifestBodySha256(duplicateBody),
      input_files: [
        { id: 'file_123', session_id: 'sess_input', name: 'inputs/data.csv' },
        { id: 'file_other', session_id: 'sess_input', name: 'inputs/other.csv' },
      ],
    }), SECRET);

    expectManifestError(() => verifyExecuteRequestManifest({
      headerValue: token,
      secret: SECRET,
      body: duplicateBody,
      nowSeconds: 150,
    }), 'scope_mismatch');
  });

  test('rejects extra manifest read sessions beyond the request file scope', () => {
    const token = signExecutionManifest(claimsForBody(body, {
      read_sessions: ['sess_input', 'sess_extra'],
    }), SECRET);

    expectManifestError(() => verifyExecuteRequestManifest({
      headerValue: token,
      secret: SECRET,
      body,
      nowSeconds: 150,
    }), 'scope_mismatch');
  });

  test('accepts scoped legacy manifests during the body-hash rollout grace window', () => {
    const legacyClaims = claims();
    const token = signExecutionManifest(legacyClaims, SECRET);

    expect(verifyExecuteRequestManifest({
      headerValue: token,
      secret: SECRET,
      body,
      nowSeconds: 150,
      bodyHashRequiredAfterSeconds: 200,
    })).toEqual(legacyClaims);
  });

  test('never admits input cache selectors through the legacy no-body-hash grace', () => {
    const cachedBody = {
      ...body,
      files: [
        body.files[0],
        { ...body.files[1], input_cache_key: 'a'.repeat(64) },
      ],
    };
    expectManifestError(() => verifyExecuteRequestManifest({
      headerValue: signExecutionManifest(claims(), SECRET),
      secret: SECRET,
      body: cachedBody,
      nowSeconds: 150,
      bodyHashRequiredAfterSeconds: 200,
    }), 'scope_mismatch');
  });

  test('rejects scoped legacy manifests after the body-hash rollout grace window', () => {
    expectManifestError(() => verifyExecuteRequestManifest({
      headerValue: signExecutionManifest(claims(), SECRET),
      secret: SECRET,
      body,
      nowSeconds: 200,
      bodyHashRequiredAfterSeconds: 200,
    }), 'scope_mismatch');
  });

  test('rejects manifests that do not bind the request body', () => {
    expectManifestError(() => verifyExecuteRequestManifest({
      headerValue: signExecutionManifest(claims(), SECRET),
      secret: SECRET,
      body,
      nowSeconds: 150,
    }), 'scope_mismatch');
  });

  test('rejects replayed inline-only manifests with substituted executable payloads', () => {
    const originalBody = {
      session_id: 'sess_output',
      language: 'python',
      version: '3.12.0',
      files: [{ name: 'main.py', content: 'print("authorized")' }],
    };
    const { bodyWithManifest, token } = signedBody(originalBody, {
      input_files: [],
      read_sessions: [],
    });

    expect(verifyExecuteRequestManifest({
      headerValue: token,
      secret: SECRET,
      body: bodyWithManifest,
      nowSeconds: 150,
    })).toEqual(claimsForBody(originalBody, {
      input_files: [],
      read_sessions: [],
    }));

    const substitutedBody = {
      ...originalBody,
      execution_manifest: token,
      language: 'bash',
      version: '5.2.0',
      args: ['--changed'],
      stdin: 'attacker controlled stdin',
      env_vars: { EXFIL_TARGET: 'https://example.invalid' },
      files: [{ name: 'main.sh', content: 'cat /mnt/data/*' }],
    };

    expectManifestError(() => verifyExecuteRequestManifest({
      headerValue: token,
      secret: SECRET,
      body: substitutedBody,
      nowSeconds: 150,
    }), 'scope_mismatch');
  });

  test('rejects replayed manifests when file references match but code changes', () => {
    const { bodyWithManifest, token } = signedBody(body);
    const substitutedBody = {
      ...body,
      execution_manifest: token,
      language: 'bash',
      version: '5.2.0',
      args: ['changed'],
      stdin: 'changed stdin',
      env_vars: { CHANGED: '1' },
      files: [
        { name: 'main.py', content: 'print(2)' },
        { id: 'file_123', storage_session_id: 'sess_input', name: 'inputs/data.csv' },
      ],
    };

    expect(verifyExecuteRequestManifest({
      headerValue: token,
      secret: SECRET,
      body: bodyWithManifest,
      nowSeconds: 150,
    })).toEqual(claimsForBody(body));

    expectManifestError(() => verifyExecuteRequestManifest({
      headerValue: token,
      secret: SECRET,
      body: substitutedBody,
      nowSeconds: 150,
    }), 'scope_mismatch');
  });

  test('rejects non-base64url manifest parts as malformed', () => {
    const token = signExecutionManifest(claims(), SECRET);
    const [payload, signature] = token.split('.') as [string, string];

    expectManifestError(() => verifyExecutionManifest(`${payload}!comment.${signature}`, SECRET, {
      nowSeconds: 150,
    }), 'malformed');
  });

  test('carries the original output session from gateway signing through guest adaptation', () => {
    const prepared = prepareSandboxEgress({
      payload: lifecyclePayload(),
      claims: lifecycleManifestClaims(),
      grantId: 'grant_lifecycle',
      secret: EGRESS_SECRET,
      lifecycleRegistry: new LifecycleCaseRegistry(lifecycleRegistration(), () => LIFECYCLE_NOW_MS),
    });
    const request = buildSandboxExecuteRequest({
      payload: prepared.payload,
      executionManifestClaims: prepared.executionManifestClaims,
      executionManifestSecret: SECRET,
      executionManifestTtlSeconds: 300,
      nowSeconds: LIFECYCLE_NOW_SECONDS,
    });
    const verified = verifyExecuteRequestManifest({
      headerValue: request.body.execution_manifest,
      secret: SECRET,
      body: request.body,
      nowSeconds: LIFECYCLE_NOW_SECONDS,
    });
    const binding = {
      case_id: LIFECYCLE_CASE_ID,
      program_sha256: LIFECYCLE_PROGRAM_SHA256,
      output_session_id: LIFECYCLE_OUTPUT_SESSION,
    };

    expect(prepared.executionManifestClaims.output_session_id).not.toBe(LIFECYCLE_OUTPUT_SESSION);
    expect(verified.e2e_lifecycle_binding).toEqual(binding);
    withLifecycleRegistration(lifecycleRegistration(), () => {
      expect(resolveVerifiedLifecycleBinding(verified, request.body.files, LIFECYCLE_NOW_MS)).toEqual({
        execution_id: 'exec_123',
        binding,
      });
    });

    const tamperedBody = {
      ...request.body,
      files: [{ name: 'main.sh', content: `${LIFECYCLE_PROGRAM}echo changed\n` }],
    };
    expectManifestError(() => verifyExecuteRequestManifest({
      headerValue: request.body.execution_manifest,
      secret: SECRET,
      body: tamperedBody,
      nowSeconds: LIFECYCLE_NOW_SECONDS,
    }), 'scope_mismatch');

    const injectedBody = { ...request.body, e2e_lifecycle_binding: binding } as unknown as
      Parameters<typeof verifyExecuteRequestManifest>[0]['body'];
    expectManifestError(() => verifyExecuteRequestManifest({
      headerValue: request.body.execution_manifest,
      secret: SECRET,
      body: injectedBody,
      nowSeconds: LIFECYCLE_NOW_SECONDS,
    }), 'scope_mismatch');
  });

  test('requires a body-bound manifest before diagnostics even during the legacy grace window', () => {
    const binding = {
      case_id: LIFECYCLE_CASE_ID,
      program_sha256: LIFECYCLE_PROGRAM_SHA256,
      output_session_id: LIFECYCLE_OUTPUT_SESSION,
    };
    const legacyClaims = claims({
      output_session_id: LIFECYCLE_OUTPUT_SESSION,
      input_files: [],
      read_sessions: [],
      e2e_lifecycle_binding: binding,
    });
    const token = signExecutionManifest(legacyClaims, SECRET);
    const legacyBody = { ...lifecyclePayload(), execution_manifest: token };
    const verified = verifyExecuteRequestManifest({
      headerValue: token,
      secret: SECRET,
      body: legacyBody,
      nowSeconds: 150,
      bodyHashRequiredAfterSeconds: 200,
    });

    expect(verified.execute_body_sha256).toBeUndefined();
    expect(verified.e2e_lifecycle_binding).toEqual(binding);
    withLifecycleRegistration(lifecycleRegistration(), () => {
      expect(resolveVerifiedLifecycleBinding(verified, legacyBody.files, LIFECYCLE_NOW_MS)).toBeUndefined();
    });
  });

  test('disables diagnostics for mismatched, malformed, stale and digest-invalid bindings', () => {
    const prepared = prepareSandboxEgress({
      payload: lifecyclePayload(),
      claims: lifecycleManifestClaims(),
      grantId: 'grant_lifecycle',
      secret: EGRESS_SECRET,
      lifecycleRegistry: new LifecycleCaseRegistry(lifecycleRegistration(), () => LIFECYCLE_NOW_MS),
    });
    const request = buildSandboxExecuteRequest({
      payload: prepared.payload,
      executionManifestClaims: prepared.executionManifestClaims,
      executionManifestSecret: SECRET,
      executionManifestTtlSeconds: 300,
      nowSeconds: LIFECYCLE_NOW_SECONDS,
    });
    const verified = verifyExecuteRequestManifest({
      headerValue: request.body.execution_manifest,
      secret: SECRET,
      body: request.body,
      nowSeconds: LIFECYCLE_NOW_SECONDS,
    });
    const binding = verified.e2e_lifecycle_binding!;

    withLifecycleRegistration(lifecycleRegistration({ case_id: 'case_fedcba9876543210' }), () => {
      expect(resolveVerifiedLifecycleBinding(verified, request.body.files, LIFECYCLE_NOW_MS)).toBeUndefined();
    });
    withLifecycleRegistration(lifecycleRegistration(), () => {
      expect(resolveVerifiedLifecycleBinding({
        ...verified,
        e2e_lifecycle_binding: { ...binding, program_sha256: 'c'.repeat(64) },
      }, request.body.files, LIFECYCLE_NOW_MS)).toBeUndefined();
      expect(resolveVerifiedLifecycleBinding(verified, [
        { name: 'main.sh', content: `${LIFECYCLE_PROGRAM}echo extra\n` },
      ], LIFECYCLE_NOW_MS)).toBeUndefined();
    });
    withLifecycleRegistration(lifecycleRegistration({ expires_at_ms: LIFECYCLE_NOW_MS - 1 }), () => {
      expect(resolveVerifiedLifecycleBinding(verified, request.body.files, LIFECYCLE_NOW_MS)).toBeUndefined();
    });
    withLifecycleRegistration(undefined, () => {
      expect(resolveVerifiedLifecycleBinding(verified, request.body.files, LIFECYCLE_NOW_MS)).toBeUndefined();
    });

    const [payloadPart] = request.body.execution_manifest!.split('.');
    const rawClaims = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    rawClaims.e2e_lifecycle_binding = { ...rawClaims.e2e_lifecycle_binding, extra: 'field' };
    const rawPayload = JSON.stringify(rawClaims);
    const signature = crypto.createHmac('sha256', SECRET).update(rawPayload, 'utf8').digest('base64url');
    const malformedToken = `${Buffer.from(rawPayload, 'utf8').toString('base64url')}.${signature}`;
    expectManifestError(() => verifyExecuteRequestManifest({
      headerValue: malformedToken,
      secret: SECRET,
      body: request.body,
      nowSeconds: LIFECYCLE_NOW_SECONDS,
    }), 'malformed');
  });
});
