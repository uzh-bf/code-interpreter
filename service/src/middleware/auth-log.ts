import type { AuthenticatedRequest } from '../types';
import { hasSyntheticAccessToken } from '../auth/synthetic';
import {
  operationalAuthProvider,
  operationalAuthReason,
  operationalErrorClass,
  operationalMethod,
  operationalPrincipalSource,
  operationalRoute,
} from '../operational-log';

type AuthLogExtra = {
  error?: unknown;
  mode?: unknown;
  reason?: unknown;
  reasonSource?: 'jwt' | 'synthetic';
};

export function buildAuthLogMeta(
  req: AuthenticatedRequest,
  extra: AuthLogExtra = {},
): Record<string, unknown> {
  const mode = extra.mode;
  const safeMode =
    mode === 'local' || mode === 'synthetic'
      ? mode
      : operationalAuthProvider(
          mode ?? process.env.CODEAPI_AUTH_PROVIDER ?? 'librechat-jwt',
        );
  return {
    method: operationalMethod(req.method),
    route: operationalRoute(req),
    authProvider: operationalAuthProvider(
      process.env.CODEAPI_AUTH_PROVIDER || 'librechat-jwt',
    ),
    hasBearerToken: Boolean(
      req.header('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim(),
    ),
    hasApiKeyHeader: Boolean(req.header('X-API-Key')),
    hasSyntheticToken: hasSyntheticAccessToken(req),
    principalSource: operationalPrincipalSource(
      req.codeApiPrincipal?.principalSource,
    ),
    mode: safeMode,
    reason:
      extra.reasonSource == null
        ? undefined
        : operationalAuthReason(extra.reason, extra.reasonSource),
    errorClass:
      extra.error == null ? undefined : operationalErrorClass(extra.error),
  };
}
