import { afterEach, describe, expect, test } from 'bun:test';
import { spawnSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

function envValue(text: string, name: string): string | undefined {
  const line = text.split(/\r?\n/).find((candidate) => candidate.startsWith(`${name}=`));
  return line?.slice(name.length + 1);
}

describe('setup-local-auth-env', () => {
  test('writes an explicit LibreChat trust entry and removes legacy verifier policy', () => {
    const dir = mkdtempSync(join(tmpdir(), 'codeapi-auth-setup-'));
    tempDirs.push(dir);
    const librechatEnv = join(dir, 'librechat.env');
    const codeApiEnv = join(dir, 'codeapi.env');
    writeFileSync(
      librechatEnv,
      'CODEAPI_JWT_ISSUER=librechat-local\nCODEAPI_JWT_AUDIENCE=codeapi-local\n',
    );
    writeFileSync(
      codeApiEnv,
      'CODEAPI_JWT_ISSUER=stale\nCODEAPI_JWT_AUDIENCE=stale\nCODEAPI_JWT_ALLOWED_ALGS=HS256\n',
    );

    const script = resolve(process.cwd(), '../scripts/setup-local-auth-env.js');
    const result = spawnSync(
      process.execPath,
      [script, '--librechat-env', librechatEnv, '--codeapi-env', codeApiEnv],
      { encoding: 'utf8' },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).not.toContain('kid:');

    const codeApiText = readFileSync(codeApiEnv, 'utf8');
    expect(envValue(codeApiText, 'CODEAPI_JWT_ISSUER')).toBeUndefined();
    expect(envValue(codeApiText, 'CODEAPI_JWT_AUDIENCE')).toBeUndefined();
    expect(envValue(codeApiText, 'CODEAPI_JWT_ALLOWED_ALGS')).toBeUndefined();
    const entries = JSON.parse(
      envValue(codeApiText, 'CODEAPI_JWT_TRUST_ENTRIES_JSON') ?? 'null',
    );
    expect(entries).toEqual([
      {
        issuer: 'librechat-local',
        audiences: ['codeapi-local'],
        keyIds: ['lc-codeapi-local-2026-05'],
        allowedAlgorithms: ['EdDSA'],
        principalSources: ['librechat_jwt', 'openid_reuse'],
      },
    ]);
  });
});
