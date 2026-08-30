import type { ErrorRequestHandler, Request, RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../types';
import { SessionKeyResolutionError } from '../session-key';
import { CodeApiJwtAuthError } from '../auth/librechat-jwt';
import { AuthProviderConfigError } from '../auth/provider';
import { hasSyntheticAccessToken } from '../auth/synthetic';
import logger from '../logger';
import {
  operationalAuthProvider,
  operationalErrorClass,
  operationalMethod,
  operationalPrincipalSource,
  operationalRoute,
} from '../operational-log';

function statusFromError(error: unknown): number {
  if (error instanceof SessionKeyResolutionError) {
    return error.status;
  }
  const status = (error as { status?: unknown; statusCode?: unknown } | undefined)?.status;
  if (typeof status === 'number' && status >= 400 && status < 600) {
    return status;
  }
  const statusCode = (error as { statusCode?: unknown } | undefined)?.statusCode;
  if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 600) {
    return statusCode;
  }
  if (error instanceof CodeApiJwtAuthError) {
    return error.reason === 'config' ? 500 : 401;
  }
  if (error instanceof AuthProviderConfigError) {
    return 500;
  }
  return 500;
}

export function buildRequestErrorLogMeta(error: unknown, req: Request): Record<string, unknown> {
  const authReq = req as AuthenticatedRequest;
  return {
    status: statusFromError(error),
    method: operationalMethod(req.method),
    route: operationalRoute(req),
    authProvider: operationalAuthProvider(
      process.env.CODEAPI_AUTH_PROVIDER || 'librechat-jwt',
    ),
    principalSource: operationalPrincipalSource(
      authReq.codeApiPrincipal?.principalSource,
    ),
    errorClass: operationalErrorClass(error),
  };
}

export function buildRequestNotFoundLogMeta(req: Request): Record<string, unknown> {
  return {
    status: 404,
    method: operationalMethod(req.method),
    route: operationalRoute(req),
    authProvider: operationalAuthProvider(
      process.env.CODEAPI_AUTH_PROVIDER || 'librechat-jwt',
    ),
    hasBearerToken: Boolean(req.header('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()),
    hasApiKeyHeader: Boolean(req.header('X-API-Key')),
    hasSyntheticToken: hasSyntheticAccessToken(req),
  };
}

export const requestNotFoundLogger: RequestHandler = (req, res) => {
  logger.warn('Unhandled CodeAPI route', buildRequestNotFoundLogMeta(req));
  res.status(404).json({ error: 'Not found' });
};

export const requestErrorLogger: ErrorRequestHandler = (error, req, res, next) => {
  const status = statusFromError(error);
  logger.error('Unhandled CodeAPI request error', buildRequestErrorLogMeta(error, req));

  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof SessionKeyResolutionError) {
    res.status(status).json({ error: error.message });
    return;
  }

  res.status(status).json({
    error: status >= 500 ? 'Internal server error' : (error as Error | undefined)?.message ?? 'Request failed',
  });
};
