import { describe, expect, test } from 'bun:test';
import { parsePlanLimits } from './config';

describe('parsePlanLimits', () => {
  test('returns an empty catalog when unset or blank', () => {
    expect(parsePlanLimits(undefined)).toEqual({});
    expect(parsePlanLimits('')).toEqual({});
    expect(parsePlanLimits('   ')).toEqual({});
  });

  test('parses a plan catalog keyed by plan id', () => {
    expect(
      parsePlanLimits('{"plan_a":{"run_memory_limit":1048576,"max_file_size":2048}}'),
    ).toEqual({
      plan_a: { run_memory_limit: 1048576, max_file_size: 2048 },
    });
  });

  test('rejects malformed catalogs', () => {
    expect(() => parsePlanLimits('{nope')).toThrow('not valid JSON');
    expect(() => parsePlanLimits('[1]')).toThrow('JSON object');
    expect(() => parsePlanLimits('"plan_a"')).toThrow('JSON object');
    expect(() => parsePlanLimits('null')).toThrow('JSON object');
  });
});
