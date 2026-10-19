import crypto from 'crypto';

/** Opt-in synthetic lifecycle case registration. Absence disables observation. */
export const LIFECYCLE_CASE_ENV = 'SANDBOX_E2E_LIFECYCLE_CASE';

const MAX_REGISTRATION_BYTES = 1024;
const MIN_HORIZON_MS = 1_000;
const MAX_HORIZON_MS = 300_000;
const MAX_FUTURE_MS = 900_000;
const CASE_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;
const SHA256_HEX_RE = /^[a-f0-9]{64}$/;
const OUTPUT_BASENAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const OPAQUE_OUTPUT_SESSION_RE = /^[A-Za-z0-9_-]{16,64}$/;
const REGISTRATION_KEYS = [
  'case_id',
  'program_sha256',
  'output_basename',
  'horizon_ms',
  'expires_at_ms',
] as const;
const BINDING_KEYS = ['case_id', 'program_sha256', 'output_session_id'] as const;

export interface LifecycleCaseRegistration {
  case_id: string;
  program_sha256: string;
  output_basename: string;
  horizon_ms: number;
  expires_at_ms: number;
}

export interface LifecycleBinding {
  case_id: string;
  program_sha256: string;
  output_session_id: string;
}

export interface VerifiedLifecycleBinding {
  execution_id: string;
  binding: LifecycleBinding;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every(key => keys.includes(key));
}

function isPrintableAscii(value: string): boolean {
  return /^[\x20-\x7E]*$/.test(value);
}

/**
 * Parses the bounded synthetic registration. Any malformed, oversized,
 * non-compact or expired value disables observation instead of throwing.
 */
export function parseLifecycleRegistration(
  raw: string | undefined,
  nowMs: number = Date.now(),
): LifecycleCaseRegistration | undefined {
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  if (!Number.isFinite(nowMs)) return undefined;
  if (Buffer.byteLength(raw, 'utf8') > MAX_REGISTRATION_BYTES) return undefined;
  if (!isPrintableAscii(raw)) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!isPlainObject(parsed) || !hasExactKeys(parsed, REGISTRATION_KEYS)) return undefined;
  /* The wire value is one compact JSON object: rejecting whitespace, duplicate
   * keys and escaped spellings keeps the configuration single-spelled and
   * bounded. */
  if (JSON.stringify(parsed) !== raw) return undefined;

  const { case_id, program_sha256, output_basename, horizon_ms, expires_at_ms } = parsed;
  if (typeof case_id !== 'string' || !CASE_ID_RE.test(case_id)) return undefined;
  if (typeof program_sha256 !== 'string' || !SHA256_HEX_RE.test(program_sha256)) return undefined;
  if (
    typeof output_basename !== 'string' ||
    !OUTPUT_BASENAME_RE.test(output_basename)
  ) {
    return undefined;
  }
  if (
    typeof horizon_ms !== 'number' ||
    !Number.isInteger(horizon_ms) ||
    horizon_ms < MIN_HORIZON_MS ||
    horizon_ms > MAX_HORIZON_MS
  ) {
    return undefined;
  }
  if (
    typeof expires_at_ms !== 'number' ||
    !Number.isInteger(expires_at_ms) ||
    expires_at_ms <= nowMs ||
    expires_at_ms > nowMs + MAX_FUTURE_MS
  ) {
    return undefined;
  }

  return { case_id, program_sha256, output_basename, horizon_ms, expires_at_ms };
}

/**
 * Digest of the exact admitted inline UTF-8 program. File references, binary
 * encodings and multi-file requests are unsupported and return undefined.
 */
export function inlineProgramSha256(files: unknown): string | undefined {
  if (!Array.isArray(files) || files.length !== 1) return undefined;
  const file = files[0];
  if (!isPlainObject(file)) return undefined;
  if (typeof file.content !== 'string') return undefined;
  /* Job's inline-file mapping materializes absent optional ids as undefined
   * and fills `storage_session_id` with the execution's output session. The
   * object/file reference marker is a real `id` (or cache/ref metadata). */
  if (
    file.id != null ||
    file.input_cache_key != null ||
    file.modified_from != null
  ) {
    return undefined;
  }
  if (file.encoding !== undefined && file.encoding !== 'utf8') return undefined;
  return crypto.createHash('sha256').update(file.content, 'utf8').digest('hex');
}

/** Exact-shape check for the signed diagnostic binding. */
export function validLifecycleBinding(value: unknown): value is LifecycleBinding {
  if (!isPlainObject(value) || !hasExactKeys(value, BINDING_KEYS)) return false;
  if (typeof value.case_id !== 'string' || !CASE_ID_RE.test(value.case_id)) return false;
  if (typeof value.program_sha256 !== 'string' || !SHA256_HEX_RE.test(value.program_sha256)) return false;
  return (
    typeof value.output_session_id === 'string' &&
    OPAQUE_OUTPUT_SESSION_RE.test(value.output_session_id)
  );
}

/** One process-local claim per registration; failures never rearm a claim. */
export class LifecycleCaseRegistry {
  private readonly registration: LifecycleCaseRegistration | undefined;
  private readonly now: () => number;
  private claimed = false;

  constructor(raw: string | undefined, now: () => number = Date.now) {
    this.now = now;
    this.registration = parseLifecycleRegistration(raw, this.now());
  }

  claim(programSha256: string, caseId?: string): LifecycleCaseRegistration | undefined {
    const registration = this.registration;
    if (!registration || this.claimed) return undefined;
    const nowMs = this.now();
    if (!Number.isFinite(nowMs) || registration.expires_at_ms <= nowMs) return undefined;
    if (registration.program_sha256 !== programSha256) return undefined;
    if (caseId !== undefined && registration.case_id !== caseId) return undefined;
    this.claimed = true;
    return registration;
  }
}
