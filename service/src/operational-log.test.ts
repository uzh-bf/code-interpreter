import { createHash } from 'node:crypto';
import { describe, expect, test } from 'bun:test';
import type { Request } from 'express';
import {
  operationalAuthReason,
  operationalErrorMeta,
  operationalMethod,
  operationalPrincipalSource,
  operationalRoute,
} from './operational-log';

const SENTINEL = 'PRIVATE_user-file_9dQm2V7x';

function request(path: string, method = 'GET'): Request {
  return {
    method,
    originalUrl: path,
    path,
    url: path,
  } as Request;
}

describe('operational log classification', () => {
  test('maps dynamic and unknown paths to fixed route classes', () => {
    expect(
      operationalRoute(request(`/v1/download/${SENTINEL}/${SENTINEL}`)),
    ).toBe('v1.download');
    expect(operationalRoute(request(`/unmatched/${SENTINEL}`))).toBe('unmatched');
    expect(operationalMethod(`CUSTOM-${SENTINEL}`)).toBe('OTHER');
  });

  test('does not retain raw, encoded, hashed, nested, or stack sentinels', () => {
    const error = {
      name: 'AxiosError',
      message: `failed for ${SENTINEL}`,
      stack: `Error: ${SENTINEL}`,
      nested: { response: { data: SENTINEL } },
    };
    const serialized = JSON.stringify(operationalErrorMeta(error));
    const variants = [
      SENTINEL,
      encodeURIComponent(SENTINEL),
      Buffer.from(SENTINEL).toString('base64'),
      createHash('sha256').update(SENTINEL).digest('hex'),
    ];

    expect(serialized).toBe('{"errorClass":"upstream_http"}');
    for (const variant of variants) {
      expect(serialized).not.toContain(variant);
    }
  });

  test('keeps only allowlisted auth reasons and principal sources', () => {
    expect(operationalAuthReason('wrong_issuer', 'jwt')).toBe('wrong_issuer');
    expect(operationalAuthReason(SENTINEL, 'jwt')).toBe('other');
    expect(operationalPrincipalSource('klicker_jwt')).toBe('klicker_jwt');
    expect(operationalPrincipalSource(SENTINEL)).toBe('other');
  });
});
