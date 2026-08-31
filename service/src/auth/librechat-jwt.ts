import {
  createHmac,
  createPublicKey,
  timingSafeEqual,
  verify as cryptoVerify,
} from 'crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, parse } from 'path';
import type { JsonWebKey, KeyObject } from 'crypto';
import type { Request } from 'express';
import type { AuthProvider } from './provider';
import type { CodeApiPrincipal } from './principal';

type JwtAlg = 'EdDSA' | 'RS256' | 'HS256';
type InternalJwtPrincipalSource = 'librechat_jwt' | 'openid_reuse';
type JwtPrincipalSource = InternalJwtPrincipalSource | `external:${string}`;

interface JwtHeader {
  alg?: string;
  typ?: string;
  kid?: string;
}

interface LibreChatJwtClaims {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  iat?: number;
  nbf?: number;
  exp?: number;
  jti?: string;
  tenant_id?: string;
  role?: string;
  principal_source?: string;
  org_id?: string;
  service_id?: string;
  external_user_id?: string;
  /** @deprecated Legacy alias for `external_user_id`. The production token
   *  issuer still mints it; drop this once the issuer emits the new claim. */
  chc_user_id?: string; // leak-check:allow
  auth_context_hash?: string;
  plan_id?: string;
}

interface PublicKeyEntry {
  alg?: JwtAlg;
  key: KeyObject | Buffer;
}

interface JwtTrustEntry {
  issuer: string;
  audiences: Set<string>;
  keyIds: Set<string>;
  allowedAlgs: Set<JwtAlg>;
  principalSources: Set<JwtPrincipalSource>;
}

interface VerificationConfig {
  trustEntries: Map<string, JwtTrustEntry>;
  clockSkewSeconds: number;
  maxTokenLifetimeSeconds: number;
  keys: Map<string, PublicKeyEntry>;
  rawConfig: string;
  reloadAt: number;
}

export class CodeApiJwtAuthError extends Error {
  readonly reason: string;
  constructor(reason: string, message: string) {
    super(message);
    this.name = 'CodeApiJwtAuthError';
    this.reason = reason;
  }
}

let configCache: VerificationConfig | null = null;
const DEFAULT_KEY_CACHE_TTL_SECONDS = 30;
const MAX_KEY_CACHE_TTL_SECONDS = 300;
const DEFAULT_MAX_TOKEN_LIFETIME_SECONDS = 300;
const MAX_TOKEN_LIFETIME_SECONDS = 300;
const DEFAULT_SINGLE_TENANT_ID = 'legacy';
const SUPPORTED_ALGORITHMS = new Set<JwtAlg>(['EdDSA', 'RS256', 'HS256']);
const INTERNAL_PRINCIPAL_SOURCES = new Set<InternalJwtPrincipalSource>([
  'librechat_jwt',
  'openid_reuse',
]);
const EXTERNAL_PRINCIPAL_SOURCE = /^external:([a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?)$/;
const RESERVED_EXTERNAL_SOURCE_SLUGS = new Set(['synthetic_test', 'none', 'api_key']);
const TRUST_ENTRY_FIELDS = new Set([
  'issuer',
  'audiences',
  'keyIds',
  'allowedAlgorithms',
  'principalSources',
]);

function base64UrlDecode(value: string): Buffer {
  try {
    return Buffer.from(value, 'base64url');
  } catch {
    throw new CodeApiJwtAuthError('malformed', 'JWT segment is not valid base64url');
  }
}

function parseJsonSegment<T>(segment: string, label: string): T {
  try {
    return JSON.parse(base64UrlDecode(segment).toString('utf8')) as T;
  } catch (err) {
    if (err instanceof CodeApiJwtAuthError) {
      throw err;
    }
    throw new CodeApiJwtAuthError('malformed', `${label} is not valid JSON`);
  }
}

function getBearerToken(req: Request): string | null {
  const header = req.header('Authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
}

function parseAllowedAlgs(): Set<JwtAlg> {
  const raw = process.env.CODEAPI_JWT_ALLOWED_ALGS ?? 'EdDSA,RS256';
  const allowed = new Set<JwtAlg>();
  for (const value of raw.split(',')) {
    const alg = value.trim();
    if (alg === 'EdDSA' || alg === 'RS256' || alg === 'HS256') {
      allowed.add(alg);
    }
  }
  if (allowed.size === 0) {
    throw new CodeApiJwtAuthError(
      'config',
      'CODEAPI_JWT_ALLOWED_ALGS must include EdDSA, RS256, or HS256',
    );
  }
  return allowed;
}

function assertUniqueStrings(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new CodeApiJwtAuthError('config', `${name} must be a non-empty array`);
  }
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new CodeApiJwtAuthError('config', `${name} must contain non-empty strings`);
    }
    if (item !== item.trim()) {
      throw new CodeApiJwtAuthError('config', `${name} values must not contain surrounding whitespace`);
    }
    if (seen.has(item)) {
      throw new CodeApiJwtAuthError('config', `${name} must not contain duplicate values`);
    }
    seen.add(item);
    result.push(item);
  }
  return result;
}

function assertNoUnknownFields(value: Record<string, unknown>, name: string): void {
  for (const field of Object.keys(value)) {
    if (!TRUST_ENTRY_FIELDS.has(field)) {
      throw new CodeApiJwtAuthError('config', `${name} contains unknown field ${field}`);
    }
  }
}

function isSupportedPrincipalSource(value: string): value is JwtPrincipalSource {
  if (INTERNAL_PRINCIPAL_SOURCES.has(value as InternalJwtPrincipalSource)) {
    return true;
  }
  const match = EXTERNAL_PRINCIPAL_SOURCE.exec(value);
  return match !== null && !RESERVED_EXTERNAL_SOURCE_SLUGS.has(match[1]);
}

function parseClockSkew(): number {
  const parsed = Number(process.env.CODEAPI_JWT_CLOCK_SKEW_SECONDS);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 30;
  }
  return Math.min(Math.floor(parsed), 30);
}

function parseCappedSeconds(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

function publicKeyFromValue(value: string): KeyObject {
  const trimmed = value.replace(/\\n/g, '\n').trim();
  try {
    if (trimmed.startsWith('{')) {
      return createPublicKey({ key: JSON.parse(trimmed) as JsonWebKey, format: 'jwk' });
    }
    return createPublicKey(trimmed);
  } catch {
    throw new CodeApiJwtAuthError('config', 'CodeAPI JWT public key is invalid');
  }
}

function addKey(
  keys: Map<string, PublicKeyEntry>,
  kid: string,
  entry: PublicKeyEntry,
): void {
  if (keys.has(kid)) {
    throw new CodeApiJwtAuthError('config', `Duplicate CodeAPI JWT key ID: ${kid}`);
  }
  keys.set(kid, entry);
}

function loadJwks(keys: Map<string, PublicKeyEntry>, raw: string): void {
  let parsed: { keys?: Array<JsonWebKey & { kid?: string; alg?: string }> };
  try {
    parsed = JSON.parse(raw) as { keys?: Array<JsonWebKey & { kid?: string; alg?: string }> };
  } catch {
    throw new CodeApiJwtAuthError('config', 'CODEAPI_JWT_JWKS_JSON is not valid JSON');
  }
  if (!Array.isArray(parsed.keys)) {
    throw new CodeApiJwtAuthError('config', 'CODEAPI_JWT_JWKS_JSON must contain a keys array');
  }
  for (const jwk of parsed.keys) {
    if (!jwk.kid) {
      continue;
    }
    try {
      addKey(keys, jwk.kid, {
        alg: jwk.alg === 'EdDSA' || jwk.alg === 'RS256' ? jwk.alg : undefined,
        key: createPublicKey({ key: jwk, format: 'jwk' }),
      });
    } catch {
      throw new CodeApiJwtAuthError('config', `CodeAPI JWT public key ${jwk.kid} is invalid`);
    }
  }
}

function loadPublicKeyDir(keys: Map<string, PublicKeyEntry>, dir: string): void {
  try {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      throw new CodeApiJwtAuthError('config', 'CODEAPI_JWT_PUBLIC_KEYS_DIR is not a directory');
    }
    for (const file of readdirSync(dir)) {
      const fullPath = join(dir, file);
      if (!statSync(fullPath).isFile()) {
        continue;
      }
      const kid = parse(file).name;
      if (!kid) {
        continue;
      }
      addKey(keys, kid, { key: publicKeyFromValue(readFileSync(fullPath, 'utf8')) });
    }
  } catch (error) {
    if (error instanceof CodeApiJwtAuthError) {
      throw error;
    }
    throw new CodeApiJwtAuthError('config', 'CODEAPI_JWT_PUBLIC_KEYS_DIR could not be read');
  }
}

function loadKeys(): Map<string, PublicKeyEntry> {
  const keys = new Map<string, PublicKeyEntry>();
  const jwksJson = process.env.CODEAPI_JWT_JWKS_JSON;
  if (jwksJson != null && jwksJson.trim() !== '') {
    loadJwks(keys, jwksJson);
  }

  const publicKeysDir = process.env.CODEAPI_JWT_PUBLIC_KEYS_DIR;
  if (publicKeysDir != null && publicKeysDir.trim() !== '') {
    loadPublicKeyDir(keys, publicKeysDir);
  }

  const publicKey = process.env.CODEAPI_JWT_PUBLIC_KEY;
  if (publicKey != null && publicKey.trim() !== '') {
    const kid = process.env.CODEAPI_JWT_KID ?? process.env.CODEAPI_JWT_KEY_ID;
    if (!kid) {
      throw new CodeApiJwtAuthError('config', 'CODEAPI_JWT_KID is required with CODEAPI_JWT_PUBLIC_KEY');
    }
    addKey(keys, kid, { key: publicKeyFromValue(publicKey) });
  }

  const hsSecret = process.env.CODEAPI_JWT_HS256_SECRET;
  if (hsSecret != null && hsSecret !== '') {
    const kid = process.env.CODEAPI_JWT_HS256_KID ?? process.env.CODEAPI_JWT_KID ?? 'hs256-dev';
    addKey(keys, kid, { alg: 'HS256', key: Buffer.from(hsSecret) });
  }

  if (keys.size === 0) {
    throw new CodeApiJwtAuthError('config', 'No CodeAPI JWT verification keys configured');
  }
  return keys;
}

function keyAlgorithm(key: PublicKeyEntry): JwtAlg | undefined {
  if (key.alg) {
    return key.alg;
  }
  if (Buffer.isBuffer(key.key)) {
    return 'HS256';
  }
  if (key.key.asymmetricKeyType === 'ed25519') {
    return 'EdDSA';
  }
  if (key.key.asymmetricKeyType === 'rsa') {
    return 'RS256';
  }
  return undefined;
}

function parseModernTrustEntries(keys: Map<string, PublicKeyEntry>, raw: string): Map<string, JwtTrustEntry> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CodeApiJwtAuthError('config', 'CODEAPI_JWT_TRUST_ENTRIES_JSON is not valid JSON');
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new CodeApiJwtAuthError(
      'config',
      'CODEAPI_JWT_TRUST_ENTRIES_JSON must be a non-empty array',
    );
  }

  for (const legacyName of [
    'CODEAPI_JWT_ISSUER',
    'CODEAPI_JWT_AUDIENCE',
    'CODEAPI_JWT_ALLOWED_ALGS',
  ]) {
    if ((process.env[legacyName] ?? '').trim() !== '') {
      throw new CodeApiJwtAuthError(
        'config',
        `${legacyName} cannot be combined with CODEAPI_JWT_TRUST_ENTRIES_JSON`,
      );
    }
  }

  const entries = new Map<string, JwtTrustEntry>();
  const assignedKeyIds = new Set<string>();
  for (const [index, value] of parsed.entries()) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new CodeApiJwtAuthError('config', `JWT trust entry ${index} must be an object`);
    }
    const record = value as Record<string, unknown>;
    assertNoUnknownFields(record, `JWT trust entry ${index}`);
    const issuer = typeof record.issuer === 'string' ? record.issuer : '';
    if (issuer === '' || issuer !== issuer.trim()) {
      throw new CodeApiJwtAuthError('config', `JWT trust entry ${index} issuer is invalid`);
    }
    if (entries.has(issuer)) {
      throw new CodeApiJwtAuthError('config', `Duplicate JWT trust issuer: ${issuer}`);
    }

    const audiences = assertUniqueStrings(record.audiences, `JWT trust entry ${index} audiences`);
    const keyIds = assertUniqueStrings(record.keyIds, `JWT trust entry ${index} keyIds`);
    const algorithmValues = assertUniqueStrings(
      record.allowedAlgorithms,
      `JWT trust entry ${index} allowedAlgorithms`,
    );
    const sourceValues = assertUniqueStrings(
      record.principalSources,
      `JWT trust entry ${index} principalSources`,
    );
    if (!algorithmValues.every((value): value is JwtAlg => SUPPORTED_ALGORITHMS.has(value as JwtAlg))) {
      throw new CodeApiJwtAuthError('config', `JWT trust entry ${index} has an unsupported algorithm`);
    }
    if (!sourceValues.every(isSupportedPrincipalSource)) {
      throw new CodeApiJwtAuthError('config', `JWT trust entry ${index} has an unsupported principal source`);
    }
    const allowedAlgs = new Set<JwtAlg>(algorithmValues);
    for (const keyId of keyIds) {
      if (assignedKeyIds.has(keyId)) {
        throw new CodeApiJwtAuthError('config', `JWT key ID is assigned to multiple trust entries: ${keyId}`);
      }
      const key = keys.get(keyId);
      if (!key) {
        throw new CodeApiJwtAuthError('config', `JWT trust entry references unknown key ID: ${keyId}`);
      }
      const algorithm = keyAlgorithm(key);
      if (!algorithm || !allowedAlgs.has(algorithm)) {
        throw new CodeApiJwtAuthError(
          'config',
          `JWT key ID ${keyId} is incompatible with its trust entry algorithms`,
        );
      }
      assignedKeyIds.add(keyId);
    }
    entries.set(issuer, {
      issuer,
      audiences: new Set(audiences),
      keyIds: new Set(keyIds),
      allowedAlgs,
      principalSources: new Set<JwtPrincipalSource>(sourceValues),
    });
  }

  for (const keyId of keys.keys()) {
    if (!assignedKeyIds.has(keyId)) {
      throw new CodeApiJwtAuthError('config', `CodeAPI JWT key ID is not assigned to a trust entry: ${keyId}`);
    }
  }
  return entries;
}

function buildTrustEntries(keys: Map<string, PublicKeyEntry>): Map<string, JwtTrustEntry> {
  const modern = process.env.CODEAPI_JWT_TRUST_ENTRIES_JSON;
  if (modern !== undefined) {
    return parseModernTrustEntries(keys, modern);
  }
  const issuer = process.env.CODEAPI_JWT_ISSUER ?? 'librechat';
  const audience = process.env.CODEAPI_JWT_AUDIENCE ?? 'codeapi';
  return new Map([
    [issuer, {
      issuer,
      audiences: new Set([audience]),
      keyIds: new Set(keys.keys()),
      allowedAlgs: parseAllowedAlgs(),
      principalSources: new Set<JwtPrincipalSource>(['librechat_jwt', 'openid_reuse']),
    }],
  ]);
}

function rawConfigFingerprint(): string {
  return JSON.stringify({
    issuer: process.env.CODEAPI_JWT_ISSUER,
    audience: process.env.CODEAPI_JWT_AUDIENCE,
    allowedAlgs: process.env.CODEAPI_JWT_ALLOWED_ALGS,
    trustEntries: process.env.CODEAPI_JWT_TRUST_ENTRIES_JSON,
    skew: process.env.CODEAPI_JWT_CLOCK_SKEW_SECONDS,
    maxTokenLifetime: process.env.CODEAPI_JWT_MAX_TTL_SECONDS,
    keyCacheTtl: process.env.CODEAPI_JWT_KEY_CACHE_TTL_SECONDS,
    jwks: process.env.CODEAPI_JWT_JWKS_JSON,
    publicKeysDir: process.env.CODEAPI_JWT_PUBLIC_KEYS_DIR?.trim(),
    publicKey: process.env.CODEAPI_JWT_PUBLIC_KEY,
    kid: process.env.CODEAPI_JWT_KID,
    keyId: process.env.CODEAPI_JWT_KEY_ID,
    hsKid: process.env.CODEAPI_JWT_HS256_KID,
    hsSecret: process.env.CODEAPI_JWT_HS256_SECRET,
  });
}

function getConfig(): VerificationConfig {
  const rawConfig = rawConfigFingerprint();
  const now = Date.now();
  if (configCache?.rawConfig === rawConfig && configCache.reloadAt > now) {
    return configCache;
  }
  const keyCacheTtlSeconds = parseCappedSeconds(
    process.env.CODEAPI_JWT_KEY_CACHE_TTL_SECONDS,
    DEFAULT_KEY_CACHE_TTL_SECONDS,
    MAX_KEY_CACHE_TTL_SECONDS,
  );
  const keys = loadKeys();
  configCache = {
    rawConfig,
    reloadAt: now + keyCacheTtlSeconds * 1000,
    trustEntries: buildTrustEntries(keys),
    clockSkewSeconds: parseClockSkew(),
    maxTokenLifetimeSeconds: parseCappedSeconds(
      process.env.CODEAPI_JWT_MAX_TTL_SECONDS,
      DEFAULT_MAX_TOKEN_LIFETIME_SECONDS,
      MAX_TOKEN_LIFETIME_SECONDS,
    ),
    keys,
  };
  return configCache;
}

function verifySignature(
  alg: JwtAlg,
  key: PublicKeyEntry,
  signingInput: string,
  signature: Buffer,
): boolean {
  if (alg === 'HS256') {
    if (!Buffer.isBuffer(key.key)) {
      return false;
    }
    const expected = createHmac('sha256', key.key).update(signingInput).digest();
    return expected.length === signature.length && timingSafeEqual(expected, signature);
  }
  if (Buffer.isBuffer(key.key)) {
    return false;
  }
  try {
    return cryptoVerify(
      alg === 'RS256' ? 'RSA-SHA256' : null,
      Buffer.from(signingInput),
      key.key,
      signature,
    );
  } catch {
    return false;
  }
}

function assertString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new CodeApiJwtAuthError('malformed_claims', `${name} is required`);
  }
  return value;
}

function assertAudience(value: unknown, accepted: Set<string>): void {
  if (typeof value === 'string' && value.trim() !== '') {
    if (!accepted.has(value)) {
      throw new CodeApiJwtAuthError('wrong_audience', 'JWT audience is not accepted');
    }
    return;
  }

  if (Array.isArray(value) && value.length > 0) {
    if (!value.every((audience) => typeof audience === 'string')) {
      throw new CodeApiJwtAuthError('malformed_claims', 'aud must contain only strings');
    }
    if (value.some((audience) => accepted.has(audience))) {
      return;
    }
    throw new CodeApiJwtAuthError('wrong_audience', 'JWT audience is not accepted');
  }

  throw new CodeApiJwtAuthError('malformed_claims', 'aud is required');
}

function assertNumericDate(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new CodeApiJwtAuthError('malformed_claims', `${name} must be a number`);
  }
  return value;
}

function optionalString(value: unknown, name: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    throw new CodeApiJwtAuthError('malformed_claims', `${name} must be a string`);
  }
  return value;
}

function strictTenantIsolation(): boolean {
  return process.env.CODEAPI_TENANT_ISOLATION_STRICT === 'true';
}

function resolveSingleTenantId(): string {
  const configured = process.env.CODEAPI_JWT_SINGLE_TENANT_ID;
  if (configured != null && configured.trim() !== '') {
    return configured.trim();
  }
  return DEFAULT_SINGLE_TENANT_ID;
}

function resolveTenantIdClaim(value: unknown): string {
  const tenantId = optionalString(value, 'tenant_id');
  if (tenantId) {
    return tenantId;
  }
  if (strictTenantIsolation()) {
    throw new CodeApiJwtAuthError('malformed_claims', 'tenant_id is required');
  }
  return resolveSingleTenantId();
}

function assertPrincipalSource(value: unknown, accepted: Set<JwtPrincipalSource>): JwtPrincipalSource {
  const principalSource = assertString(value, 'principal_source');
  if (accepted.has(principalSource as JwtPrincipalSource)) {
    return principalSource as JwtPrincipalSource;
  }
  throw new CodeApiJwtAuthError('malformed_claims', 'principal_source is not accepted');
}

function validateClaims(
  claims: LibreChatJwtClaims,
  config: VerificationConfig,
  trustEntry: JwtTrustEntry,
): CodeApiPrincipal {
  const now = Math.floor(Date.now() / 1000);
  const userId = assertString(claims.sub, 'sub');
  const tenantId = resolveTenantIdClaim(claims.tenant_id);
  const jti = assertString(claims.jti, 'jti');
  const iat = assertNumericDate(claims.iat, 'iat');
  const nbf = assertNumericDate(claims.nbf, 'nbf');
  const exp = assertNumericDate(claims.exp, 'exp');
  const planId = optionalString(claims.plan_id, 'plan_id');
  const principalSource = assertPrincipalSource(claims.principal_source, trustEntry.principalSources);
  const authContextHash = assertString(claims.auth_context_hash, 'auth_context_hash');

  if (jti.length > 256) {
    throw new CodeApiJwtAuthError('malformed_claims', 'jti is too long');
  }
  assertAudience(claims.aud, trustEntry.audiences);
  if (exp <= now - config.clockSkewSeconds) {
    throw new CodeApiJwtAuthError('expired', 'JWT is expired');
  }
  if (nbf > now + config.clockSkewSeconds) {
    throw new CodeApiJwtAuthError('not_yet_valid', 'JWT is not yet valid');
  }
  if (iat > now + config.clockSkewSeconds) {
    throw new CodeApiJwtAuthError('future_iat', 'JWT iat is in the future');
  }
  if (exp <= iat) {
    throw new CodeApiJwtAuthError('malformed_claims', 'JWT exp must be after iat');
  }
  if (exp - iat > config.maxTokenLifetimeSeconds) {
    throw new CodeApiJwtAuthError('ttl_too_long', 'JWT lifetime exceeds CodeAPI maximum');
  }

  return {
    userId,
    tenantId,
    role: typeof claims.role === 'string' ? claims.role : undefined,
    orgId: typeof claims.org_id === 'string' ? claims.org_id : undefined,
    serviceId: typeof claims.service_id === 'string' ? claims.service_id : undefined,
    externalUserId: typeof claims.external_user_id === 'string'
      ? claims.external_user_id
      // Legacy fallback until the token issuer emits external_user_id.
      : typeof claims.chc_user_id === 'string' ? claims.chc_user_id : undefined, // leak-check:allow
    principalSource,
    authContextHash,
    planId,
  };
}

export function validateLibreChatJwtVerifierConfig(): void {
  getConfig();
}

export function verifyLibreChatJwt(token: string): CodeApiPrincipal {
  const config = getConfig();
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new CodeApiJwtAuthError('malformed', 'JWT must have three segments');
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJsonSegment<JwtHeader>(encodedHeader, 'JWT header');
  const claims = parseJsonSegment<LibreChatJwtClaims>(encodedPayload, 'JWT payload');
  const issuer = assertString(claims.iss, 'iss');
  const trustEntry = config.trustEntries.get(issuer);
  if (!trustEntry) {
    throw new CodeApiJwtAuthError('wrong_issuer', 'JWT issuer is not trusted');
  }
  const alg = header.alg;
  if (alg !== 'EdDSA' && alg !== 'RS256' && alg !== 'HS256') {
    throw new CodeApiJwtAuthError('wrong_alg', 'JWT alg is not supported');
  }
  if (!trustEntry.allowedAlgs.has(alg)) {
    throw new CodeApiJwtAuthError('wrong_alg', 'JWT alg is not allowed');
  }
  if (header.typ !== undefined && header.typ !== 'JWT') {
    throw new CodeApiJwtAuthError('malformed', 'JWT typ must be JWT');
  }
  const kid = assertString(header.kid, 'kid');
  if (!trustEntry.keyIds.has(kid)) {
    throw new CodeApiJwtAuthError('unknown_kid', 'JWT kid is not configured for issuer');
  }
  const key = config.keys.get(kid);
  if (!key) {
    throw new CodeApiJwtAuthError('unknown_kid', 'JWT kid is not configured');
  }
  if (key.alg && key.alg !== alg) {
    throw new CodeApiJwtAuthError('wrong_alg', 'JWT alg does not match key');
  }
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = base64UrlDecode(encodedSignature);
  if (!verifySignature(alg, key, signingInput, signature)) {
    throw new CodeApiJwtAuthError('bad_signature', 'JWT signature is invalid');
  }
  return validateClaims(claims, config, trustEntry);
}

export class LibreChatJwtAuthProvider implements AuthProvider {
  async verify(req: Request): Promise<CodeApiPrincipal | null> {
    const token = getBearerToken(req);
    if (!token) {
      return null;
    }
    return verifyLibreChatJwt(token);
  }
}
