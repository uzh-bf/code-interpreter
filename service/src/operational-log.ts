import type { Request } from 'express';

const JWT_REASONS = new Set([
  'bad_signature',
  'config',
  'expired',
  'future_iat',
  'malformed',
  'malformed_claims',
  'not_yet_valid',
  'ttl_too_long',
  'unknown_kid',
  'wrong_alg',
  'wrong_audience',
  'wrong_issuer',
]);

const SYNTHETIC_REASONS = new Set([
  'invalid_token',
  'missing_config',
  'not_allowed',
  'weak_config',
]);

function requestPath(req: Request): string {
  return (req.originalUrl || req.path || req.url || '').split('?')[0] ?? '';
}

export function operationalRoute(req: Request): string {
  const path = requestPath(req);
  if (/^(?:\/v1)?\/exec\/?$/.test(path)) return 'v1.exec';
  if (/^(?:\/v1)?\/exec\/programmatic\/?$/.test(path)) {
    return 'v1.exec.programmatic';
  }
  if (/^(?:\/v1)?\/upload\/batch\/?$/.test(path)) return 'v1.upload.batch';
  if (/^(?:\/v1)?\/upload\/?$/.test(path)) return 'v1.upload';
  if (/^(?:\/v1)?\/download\/[^/]+\/[^/]+\/?$/.test(path)) {
    return 'v1.download';
  }
  if (/^(?:\/v1)?\/files\/[^/]+\/[^/]+\/?$/.test(path)) {
    return req.method.toUpperCase() === 'DELETE' ? 'v1.files.delete' : 'v1.files.object';
  }
  if (/^(?:\/v1)?\/files\/[^/]+\/?$/.test(path)) return 'v1.files.list';
  if (/^(?:\/v1)?\/sessions\/[^/]+\/objects\/[^/]+\/?$/.test(path)) {
    return 'v1.files.metadata';
  }
  if (/^\/v1\/health\/?$/.test(path)) return 'v1.health';
  return 'unmatched';
}

export function operationalMethod(method: string | undefined): string {
  switch (method?.toUpperCase()) {
    case 'DELETE':
    case 'GET':
    case 'HEAD':
    case 'OPTIONS':
    case 'PATCH':
    case 'POST':
    case 'PUT':
      return method.toUpperCase();
    default:
      return 'OTHER';
  }
}

export function operationalAuthProvider(value: unknown): string {
  return value === 'none' || value === 'librechat-jwt' ? value : 'invalid';
}

export function operationalPrincipalSource(value: unknown): string | undefined {
  switch (value) {
    case 'klicker_jwt':
    case 'librechat_jwt':
    case 'none':
    case 'openid_reuse':
    case 'synthetic_test':
      return value;
    default:
      return value == null ? undefined : 'other';
  }
}

export function operationalAuthReason(
  value: unknown,
  source: 'jwt' | 'synthetic',
): string {
  const allowed = source === 'jwt' ? JWT_REASONS : SYNTHETIC_REASONS;
  return typeof value === 'string' && allowed.has(value) ? value : 'other';
}

export function operationalErrorClass(error: unknown): string {
  const value = error as { name?: unknown; code?: unknown; message?: unknown } | null;
  const name = typeof value?.name === 'string' ? value.name : '';
  switch (name) {
    case 'AbortError':
      return 'aborted';
    case 'AuthProviderConfigError':
    case 'CodeApiJwtAuthError':
      return 'authentication';
    case 'AxiosError':
      return 'upstream_http';
    case 'ExecutionStateTooLargeError':
      return 'capacity';
    case 'FileRefAuthorizationError':
      return 'authorization';
    case 'SessionKeyResolutionError':
      return 'session_key';
    case 'SyntaxError':
    case 'TypeError':
      return 'invalid_state';
  }

  switch (value?.code) {
    case 'ABORT_ERR':
      return 'aborted';
    case 'ECONNREFUSED':
    case 'ECONNRESET':
    case 'ENETUNREACH':
    case 'ENOTFOUND':
    case 'EPIPE':
      return 'dependency';
    case 'ETIMEDOUT':
      return 'timeout';
  }

  const message = typeof value?.message === 'string' ? value.message.toLowerCase() : '';
  if (message.includes('timed out') || message.includes('timeout')) return 'timeout';
  if (message.includes('abort')) return 'aborted';
  return 'unexpected';
}

export function operationalErrorMeta(error: unknown): { errorClass: string } {
  return { errorClass: operationalErrorClass(error) };
}
