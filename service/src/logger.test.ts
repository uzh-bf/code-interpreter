import { createHash } from 'node:crypto';
import { Writable } from 'node:stream';
import { describe, expect, test } from 'bun:test';
import { createLogger, format, transports } from 'winston';
import { sanitizeOperationalMetadata } from '../../shared/operational-log';
import { operationalLogFormat } from './logger';

const SENTINEL = 'PRIVATE_service_log_9dQm2V7x';

describe('Winston operational logging', () => {
  test('keeps only values-free operator metadata without mutating input', async () => {
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      },
    });
    const capture = createLogger({
      format: format.combine(operationalLogFormat(), format.json()),
      transports: [new transports.Stream({ stream })],
    });

    const run: Record<string, unknown> = {
      durationMs: 12,
      output: SENTINEL,
      outputBytes: 128,
    };
    Object.defineProperty(run, 'throwing', {
      enumerable: true,
      get() {
        throw new Error(SENTINEL);
      },
    });
    run.self = run;
    const metadata = {
      error: Object.assign(new Error(SENTINEL), { code: 'ETIMEDOUT' }),
      files: [{ filename: SENTINEL }],
      method: 'post',
      requestId: SENTINEL,
      run,
      status: 503,
    };

    capture.error(SENTINEL, metadata);
    capture.end();
    await new Promise<void>((resolve) => capture.on('finish', resolve));

    expect(metadata.run).toBe(run);
    expect(run.output).toBe(SENTINEL);
    const output = chunks.join('');
    for (const variant of [
      SENTINEL,
      createHash('sha256').update(SENTINEL).digest('hex'),
    ]) {
      expect(output).not.toContain(variant);
    }
    expect(output).toContain('Operational event');
    expect(output).toContain('"errorCategory":"timeout"');
    expect(output).toContain('"method":"POST"');
    expect(output).toContain('"status":503');
    expect(output).toContain('"durationMs":12');
    expect(output).toContain('"outputBytes":128');
    expect(output).toContain('"count":1');
  });

  test('is total for circular, repeated, buffered, and throwing values', () => {
    const repeated = { count: 2, secret: SENTINEL };
    const value: Record<string, unknown> = {
      files: Buffer.from(SENTINEL),
      metrics: repeated,
      run: repeated,
    };
    value.self = value;
    Object.defineProperty(value, 'status', {
      enumerable: true,
      get() {
        throw new Error(SENTINEL);
      },
    });

    expect(() => sanitizeOperationalMetadata(value)).not.toThrow();
    expect(sanitizeOperationalMetadata(value)).toEqual({
      files: { bytes: Buffer.byteLength(SENTINEL) },
      metrics: { count: 2 },
      run: { count: 2 },
    });
    expect(sanitizeOperationalMetadata({
      error: new Error(SENTINEL),
      reason: SENTINEL,
      stage: SENTINEL,
    })).toEqual({ errorCategory: 'internal' });
    expect(sanitizeOperationalMetadata({ errorCategory: SENTINEL }))
      .toEqual({ errorCategory: 'internal' });
    expect(sanitizeOperationalMetadata(new Error(SENTINEL)))
      .toEqual({ errorCategory: 'internal' });
  });
});
