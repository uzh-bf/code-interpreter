import { createHash } from 'node:crypto';
import { Writable } from 'node:stream';
import { describe, expect, test } from 'bun:test';
import pino from 'pino';
import { operationalErrorMeta } from './operational-log';

const SENTINEL = 'PRIVATE_sandbox_capture_6Rw9mQ2p';

describe('Pino operational log capture', () => {
  test('does not serialize runtime identifiers, content, or nested errors', () => {
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      },
    });
    const captureLogger = pino({ level: 'debug' }, stream);
    const error = {
      name: 'Error',
      message: `failed for ${SENTINEL}`,
      stack: `Error: ${SENTINEL}`,
      code: SENTINEL,
      filename: `${SENTINEL}.csv`,
      output: SENTINEL,
      response: { data: SENTINEL },
    };

    captureLogger.error(
      {
        status: 500,
        durationMs: 12,
        fileCount: 1,
        bytes: 128,
        ...operationalErrorMeta(error),
      },
      'Synthetic sandbox failure',
    );
    captureLogger.info(
      { outputBytes: SENTINEL.length, removed: 2 },
      'Synthetic runtime cleanup',
    );
    captureLogger.flush();

    const captured = chunks.join('');
    expect(captured).toContain('Synthetic sandbox failure');
    expect(captured).toContain('durationMs');
    expect(captured).toContain('fileCount');
    expect(captured).toContain('outputBytes');
    expect(captured).toContain('unexpected');
    for (const variant of [
      SENTINEL,
      encodeURIComponent(SENTINEL),
      Buffer.from(SENTINEL).toString('base64'),
      createHash('sha256').update(SENTINEL).digest('hex'),
    ]) {
      expect(captured).not.toContain(variant);
    }
  });
});
