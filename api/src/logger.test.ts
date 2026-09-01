import { Writable } from 'node:stream';
import { describe, expect, test } from 'bun:test';
import { createOperationalLogger } from './logger';

const SENTINEL = 'PRIVATE_api_log_6Rw9mQ2p';

describe('Pino operational logging', () => {
  test('sanitizes calls and keeps only approved child bindings', () => {
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      },
    });
    const capture = createOperationalLogger(stream);

    const run: Record<string, unknown> = {
      durationMs: 17,
      output: SENTINEL,
      outputBytes: 256,
    };
    Object.defineProperty(run, 'throwing', {
      enumerable: true,
      get() {
        throw new Error(SENTINEL);
      },
    });
    run.self = run;
    const metadata = {
      error: Object.assign(new Error(SENTINEL), { code: 'ENOSPC' }),
      files: [{ filename: SENTINEL }],
      method: 'get',
      requestId: SENTINEL,
      run,
      status: 507,
    };

    capture.error(metadata, SENTINEL);
    capture.child({ component: 'job' }).info({ success: true }, SENTINEL);
    capture.flush();

    expect(metadata.run).toBe(run);
    expect(run.output).toBe(SENTINEL);
    const output = chunks.join('');
    expect(output).not.toContain(SENTINEL);
    expect(output).toContain('Operational event');
    expect(output).toContain('"errorCategory":"capacity"');
    expect(output).toContain('"method":"GET"');
    expect(output).toContain('"status":507');
    expect(output).toContain('"durationMs":17');
    expect(output).toContain('"outputBytes":256');
    expect(output).toContain('"count":1');
    expect(output).toContain('"component":"job"');
    expect(output).toContain('"success":true');
  });
});
