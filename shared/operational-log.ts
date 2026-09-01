export const OPERATIONAL_LOG_MESSAGE = 'Operational event';

export const ERROR_CATEGORIES = [
  'validation',
  'authentication',
  'authorization',
  'configuration',
  'timeout',
  'capacity',
  'dependency',
  'internal',
] as const;

type ErrorCategory = typeof ERROR_CATEGORIES[number];

const BOOLEAN_KEYS = new Set([
  'authenticated',
  'enabled',
  'hasApiKeyHeader',
  'hasBearerToken',
  'hasSyntheticToken',
  'inherited',
  'liveBackup',
  'modified',
  'present',
  'retryable',
  'success',
]);

const CONTAINER_KEYS = new Set([
  'counts',
  'files',
  'limits',
  'metrics',
  'run',
  'usage',
]);

const COMPONENTS = new Set([
  'api',
  'egress-gateway',
  'file-server',
  'job',
  'sandbox-api',
  'sandbox-runner',
  'service-api',
  'tool-call-server',
  'worker',
]);

const NUMBER_KEYS = new Set([
  'agentCount',
  'attempt',
  'attempts',
  'backoffMs',
  'bodyBytes',
  'byteSize',
  'bytes',
  'code',
  'concurrency',
  'count',
  'cpuTimeMs',
  'durationMs',
  'fileCount',
  'inheritedCount',
  'inputBytes',
  'jobWindow',
  'memoryBytes',
  'modifiedCount',
  'outputBytes',
  'processed',
  'released',
  'removed',
  'retries',
  'size',
  'skillCount',
  'status',
  'statusCode',
  'timeoutMs',
  'userCount',
  'wallTimeMs',
]);

const REASONS = new Set([
  'bad_signature',
  'capacity',
  'config',
  'expired',
  'future_iat',
  'invalid_manifest',
  'invalid_token',
  'malformed',
  'malformed_claims',
  'missing_config',
  'not_allowed',
  'not_yet_valid',
  'scope_mismatch',
  'timeout',
  'ttl_too_long',
  'unknown_kid',
  'weak_config',
  'wrong_alg',
  'wrong_audience',
  'wrong_issuer',
  'wrong_source',
]);

const ROUTES = new Set([
  'unmatched',
  'v1.download',
  'v1.exec',
  'v1.exec.programmatic',
  'v1.files.delete',
  'v1.files.list',
  'v1.files.metadata',
  'v1.files.object',
  'v1.health',
  'v1.upload',
  'v1.upload.batch',
  'v2.execute',
  'v2.lifecycle',
  'v2.runtimes',
]);

const STAGES = new Set([
  'authentication',
  'checkpoint',
  'cleanup',
  'download',
  'execution',
  'restore',
  'setup',
  'shutdown',
  'startup',
  'upload',
  'warmup',
]);

const METHODS = new Set([
  'DELETE',
  'GET',
  'HEAD',
  'OPTIONS',
  'PATCH',
  'POST',
  'PUT',
]);
const HOOKS = new Set(['pause', 'resume', 'run', 'terminate']);
const SIGNALS = new Set([
  'SIGABRT',
  'SIGALRM',
  'SIGBUS',
  'SIGFPE',
  'SIGHUP',
  'SIGILL',
  'SIGINT',
  'SIGKILL',
  'SIGPIPE',
  'SIGQUIT',
  'SIGSEGV',
  'SIGTERM',
  'SIGTRAP',
]);

const LANGUAGE_CLASSES = new Map([
  ['bash', 'shell'],
  ['bun', 'javascript'],
  ['c', 'compiled'],
  ['cpp', 'compiled'],
  ['go', 'compiled'],
  ['java', 'compiled'],
  ['javascript', 'javascript'],
  ['node', 'javascript'],
  ['php', 'interpreted'],
  ['python', 'python'],
  ['r', 'interpreted'],
  ['ruby', 'interpreted'],
  ['rust', 'compiled'],
  ['shell', 'shell'],
  ['typescript', 'javascript'],
]);

function safeGet(value: object, key: string): unknown {
  try {
    return (value as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}

function safeKeys(value: object): string[] {
  try {
    return Object.keys(value);
  } catch {
    return [];
  }
}

function errorCategory(error: unknown): ErrorCategory {
  if (error == null || (typeof error !== 'object' && typeof error !== 'function')) {
    return 'internal';
  }

  const name = safeGet(error, 'name');
  const code = safeGet(error, 'code');

  if (typeof name === 'string') {
    if (/AuthProviderConfigError|ConfigurationError/.test(name)) return 'configuration';
    if (/CodeApiJwtAuthError|AuthenticationError/.test(name)) return 'authentication';
    if (/AuthorizationError|FileRefAuthorizationError/.test(name)) return 'authorization';
    if (/Capacity|PayloadTooLarge|StateTooLarge/.test(name)) return 'capacity';
    if (/Timeout|AbortError/.test(name)) return 'timeout';
    if (/AxiosError|DependencyError/.test(name)) return 'dependency';
    if (/Manifest|SyntaxError|TypeError|ValidationError/.test(name)) return 'validation';
  }

  switch (code) {
    case 'EACCES':
    case 'EPERM':
      return 'authorization';
    case 'ENOSPC':
      return 'capacity';
    case 'ETIMEDOUT':
    case 'ABORT_ERR':
      return 'timeout';
    case 'ECONNREFUSED':
    case 'ECONNRESET':
    case 'ENETUNREACH':
    case 'ENOTFOUND':
    case 'EPIPE':
      return 'dependency';
    default:
      return 'internal';
  }
}

function component(value: unknown): string | undefined {
  return typeof value === 'string' && COMPONENTS.has(value) ? value : undefined;
}

function classifiedString(key: string, value: unknown): [string, string] | undefined {
  if (typeof value !== 'string') return undefined;

  if (key === 'component' || key === 'service') {
    const safe = component(value);
    return safe == null ? undefined : [key, safe];
  }
  if (key === 'method') {
    const method = value.toUpperCase();
    return METHODS.has(method) ? [key, method] : undefined;
  }
  if (key === 'route') return ROUTES.has(value) ? [key, value] : undefined;
  if (key === 'reason') return REASONS.has(value) ? [key, value] : undefined;
  if (key === 'stage') return STAGES.has(value) ? [key, value] : undefined;
  if (key === 'hook') return HOOKS.has(value) ? [key, value] : undefined;
  if (key === 'signal') return SIGNALS.has(value) ? [key, value] : undefined;
  if (key === 'errorCategory') {
    const safe = (ERROR_CATEGORIES as readonly string[]).includes(value)
      ? value
      : 'internal';
    return [key, safe];
  }
  if (key === 'language' || key === 'languageClass') {
    const safe = LANGUAGE_CLASSES.get(value.toLowerCase());
    return safe == null ? undefined : ['languageClass', safe];
  }
  if (key === 'queue' || key === 'worker' || key === 'workerClass') {
    const safe = value.toLowerCase() === 'python' ? 'python' : 'other';
    return ['workerClass', safe];
  }
  return undefined;
}

function sanitizeObject(
  value: object,
  ancestors: Set<object>,
): Record<string, unknown> {
  if (ancestors.has(value)) return {};
  ancestors.add(value);

  const safe: Record<string, unknown> = {};
  for (const key of safeKeys(value)) {
    const member = safeGet(value, key);

    if (key === 'err' || key === 'error' || key === 'cause') {
      safe.errorCategory = errorCategory(member);
      continue;
    }
    if (NUMBER_KEYS.has(key) && typeof member === 'number' && Number.isFinite(member)) {
      safe[key] = member;
      continue;
    }
    if (BOOLEAN_KEYS.has(key) && typeof member === 'boolean') {
      safe[key] = member;
      continue;
    }

    const classified = classifiedString(key, member);
    if (classified != null) {
      safe[classified[0]] = classified[1];
      continue;
    }

    if (!CONTAINER_KEYS.has(key) || member == null || typeof member !== 'object') continue;
    if (Buffer.isBuffer(member)) {
      safe[key] = { bytes: member.byteLength };
    } else if (Array.isArray(member)) {
      safe[key] = { count: member.length };
    } else {
      const nested = sanitizeObject(member, ancestors);
      if (Object.keys(nested).length > 0) safe[key] = nested;
    }
  }

  ancestors.delete(value);
  return safe;
}

export function sanitizeOperationalMetadata(value: unknown): Record<string, unknown> {
  try {
    if (value == null || typeof value !== 'object') return {};
    if (value instanceof Error) return { errorCategory: errorCategory(value) };
    if (Buffer.isBuffer(value)) return { bytes: value.byteLength };
    if (Array.isArray(value)) return { count: value.length };
    return sanitizeObject(value, new Set());
  } catch {
    return {};
  }
}

type SanitizedLogInfo = {
  level: string;
  message: string;
  [key: string]: unknown;
  [key: symbol]: unknown;
};

export function sanitizeOperationalLogInfo(info: unknown): SanitizedLogInfo {
  const rawLevel = info != null && typeof info === 'object' ? safeGet(info, 'level') : undefined;
  const level = typeof rawLevel === 'string' ? rawLevel : 'info';
  return {
    ...sanitizeOperationalMetadata(info),
    level,
    message: OPERATIONAL_LOG_MESSAGE,
    [Symbol.for('level')]: level,
  };
}
