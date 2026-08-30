import { YAML } from 'bun';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'bun:test';
import type {
  ExecuteResponse,
  ExecuteResult,
  SandboxExecuteResponse,
} from './types/service';

type Schema = {
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
  ExecuteResponse,
  ExecuteResult
> = true;
const sandboxResponseRemainsSeparate: SandboxExecuteResponse = {
  language: 'python',
  version: '3',
  session_id: 'internal-session',
  files: [],
};

function loadSpec(path: string): OpenApiDocument {
  return YAML.parse(readFileSync(path, 'utf8')) as OpenApiDocument;
}

const publicSpecPath = resolve(import.meta.dir, '../openapi.yml');
const internalSpecPath = resolve(import.meta.dir, '../../api/openapi.yaml');

describe('OpenAPI contract boundaries', () => {
  test('the public execution type is flat and separate from the sandbox wire', () => {
    expect(publicResponseMatchesFlatResult).toBe(true);
    expect(sandboxResponseRemainsSeparate).toHaveProperty('language');
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
      '/sessions/{session_id}/objects/{fileId}',
      '/upload',
      '/upload/batch',
    ]);
    expect(spec.paths).not.toHaveProperty('/api/v2/execute');
    expect(spec.paths).not.toHaveProperty('/execute');
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

    for (const path of Object.values(spec.paths)) {
      for (const operation of Object.values(path)) {
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
