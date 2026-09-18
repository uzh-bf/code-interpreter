import { YAML } from 'bun';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'bun:test';
import type {
  ExecuteResponse,
  ExecuteResult,
  PublicExecuteResponse,
} from './types/service';

type Schema = {
  oneOf?: Schema[];
  properties?: Record<string, unknown>;
  required?: string[];
};

type Operation = {
  responses: Record<string, { $ref?: string }>;
};

type OpenApiDocument = {
  info: { title: string; description?: string };
  servers?: Array<{ url: string }>;
  paths: Record<string, Record<string, Operation>>;
  components: {
    responses: Record<
      string,
      {
        headers?: Record<string, unknown>;
        content?: {
          'application/json'?: { schema?: { $ref?: string } };
        };
      }
    >;
    schemas: Record<string, Schema>;
  };
  'x-internal'?: boolean;
};

type IsExact<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;

const publicResponseMatchesFlatResult: IsExact<
  PublicExecuteResponse,
  ExecuteResult
> = true;
const internalResponseRemainsSeparate: IsExact<
  ExecuteResponse,
  PublicExecuteResponse
> = false;

function loadSpec(path: string): OpenApiDocument {
  return YAML.parse(readFileSync(path, 'utf8')) as OpenApiDocument;
}

function localRefs(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(localRefs);
  if (value === null || typeof value !== 'object') return [];

  return Object.entries(value).flatMap(([key, nested]) =>
    key === '$ref' && typeof nested === 'string' && nested.startsWith('#/')
      ? [nested]
      : localRefs(nested),
  );
}

function resolvesLocalRef(document: unknown, ref: string): boolean {
  let value = document;
  for (const segment of ref.slice(2).split('/')) {
    if (value === null || typeof value !== 'object' || !(segment in value)) return false;
    value = (value as Record<string, unknown>)[segment];
  }
  return true;
}

const publicSpecPath = resolve(import.meta.dir, '../openapi.yml');
const internalSpecPath = resolve(import.meta.dir, '../../api/openapi.yaml');

describe('OpenAPI contract boundaries', () => {
  test('all local OpenAPI references resolve', () => {
    for (const path of [publicSpecPath, internalSpecPath]) {
      const spec = loadSpec(path);
      for (const ref of localRefs(spec)) expect(resolvesLocalRef(spec, ref)).toBe(true);
    }
  });

  test('the named public execution type is flat without changing the internal export', () => {
    expect(publicResponseMatchesFlatResult).toBe(true);
    expect(internalResponseRemainsSeparate).toBe(false);
  });

  test('the public spec exposes the supported v1 routes', () => {
    const spec = loadSpec(publicSpecPath);

    expect(spec.info.title).toContain('Public');
    expect(spec.servers?.[0]?.url.endsWith('/v1')).toBe(true);
    expect(Object.keys(spec.paths).sort()).toEqual([
      '/download/{session_id}/{fileId}',
      '/exec',
      '/files/{session_id}',
      '/files/{session_id}/{fileId}',
      '/hosted-apps',
      '/hosted-apps/{app_id}',
      '/sessions/{session_id}/objects/{fileId}',
      '/upload',
      '/upload/batch',
    ]);
  });

  test('the public request and response schemas match the service types', () => {
    const schemas = loadSpec(publicSpecPath).components.schemas;
    const requestFile = schemas.RequestFile;
    const executeResponse = schemas.ExecuteResponse;
    const fileRef = schemas.FileRef;
    const uploadResponse = schemas.UploadResponse;

    expect(requestFile.required?.sort()).toEqual([
      'id',
      'kind',
      'name',
      'resource_id',
      'storage_session_id',
    ]);
    expect(Object.keys(requestFile.properties ?? {}).sort()).toEqual([
      'id',
      'kind',
      'name',
      'resource_id',
      'storage_session_id',
      'version',
    ]);
    expect(executeResponse.required?.sort()).toEqual([
      'files',
      'session_id',
      'stderr',
      'stdout',
    ]);
    expect(executeResponse.properties).not.toHaveProperty('run');
    expect(executeResponse.properties).not.toHaveProperty('compile');
    expect(executeResponse.properties).not.toHaveProperty('language');
    expect(executeResponse.properties).not.toHaveProperty('version');
    expect(fileRef.required?.sort()).toEqual(['id', 'name']);
    expect(Object.keys(fileRef.properties ?? {}).sort()).toEqual([
      'id',
      'inherited',
      'modified_from',
      'name',
      'path',
      'storage_session_id',
    ]);
    expect(uploadResponse.required?.sort()).toEqual([
      'files',
      'message',
      'storage_session_id',
    ]);
    expect(uploadResponse.properties).not.toHaveProperty('session_id');
  });

  test('the public spec documents rate limits and timeout responses', () => {
    const spec = loadSpec(publicSpecPath);
    const rateLimitHeaders = Object.keys(
      spec.components.responses.GenericRateLimited.headers ?? {},
    ).sort();

    expect(rateLimitHeaders).toEqual([
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
      'Retry-After',
    ]);
    expect(
      spec.components.responses.ExecutionRateLimited.content?.[
        'application/json'
      ]?.schema?.$ref,
    ).toBe('#/components/schemas/RateLimitError');

    const rateLimitedRoutes = [
      '/exec',
      '/download/{session_id}/{fileId}',
      '/upload',
      '/upload/batch',
      '/files/{session_id}',
      '/sessions/{session_id}/objects/{fileId}',
      '/files/{session_id}/{fileId}',
    ];
    for (const route of rateLimitedRoutes) {
      for (const operation of Object.values(spec.paths[route])) {
        expect(operation.responses).toHaveProperty('429');
      }
    }
    expect(spec.paths['/exec'].post.responses).toHaveProperty('504');
    expect(spec.paths['/upload'].post.responses).toHaveProperty('504');
  });

  test('the internal spec describes only the sandbox v2 execute contract', () => {
    const spec = loadSpec(internalSpecPath);
    const schemas = spec.components.schemas;

    expect(spec['x-internal']).toBe(true);
    expect(spec.info.title).toContain('Internal');
    expect(Object.keys(spec.paths)).toEqual(['/api/v2/execute']);
    expect(
      Object.keys(spec.paths['/api/v2/execute'].post.responses).sort(),
    ).toEqual(['200', '400', '401', '403', '409', '413', '415', '500']);
    expect(Object.keys(schemas.ExecuteRequest.properties ?? {}).sort()).toEqual([
      'args',
      'compile_cpu_time',
      'compile_memory_limit',
      'compile_timeout',
      'egress_grant',
      'env_vars',
      'execution_manifest',
      'files',
      'language',
      'output_session_id',
      'run_cpu_time',
      'run_memory_limit',
      'run_timeout',
      'session_id',
      'stdin',
      'tool_call_socket',
      'version',
    ]);
    expect(schemas.ExecuteRequest.required?.sort()).toEqual([
      'files',
      'language',
      'version',
    ]);
    expect(Object.keys(schemas.Error.properties ?? {}).sort()).toEqual([
      'error',
      'message',
    ]);
    expect(schemas.InputFile.required).toBeUndefined();
    expect(schemas.InputFile.oneOf?.map((shape) => shape.required)).toEqual([
      ['content'],
      ['id', 'storage_session_id'],
    ]);
    expect(
      (schemas.InputFile.properties?.input_cache_key as Record<string, unknown>)
        .pattern,
    ).toBe('^[0-9a-f]{64}$');
    expect(Object.keys(schemas.ExecuteResponse.properties ?? {}).sort()).toEqual([
      'compile',
      'files',
      'language',
      'run',
      'session_id',
      'version',
    ]);
  });
});
