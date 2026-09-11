import { describe, expect, test } from 'bun:test';
import { EventEmitter } from 'events';
import { spawnSync } from 'node:child_process';

type TraceMiddleware = (
  req: EventEmitter & {
    method?: string;
    originalUrl?: string;
    path?: string;
    url?: string;
    headers?: Record<string, string | string[] | undefined>;
  },
  res: EventEmitter & { statusCode?: number },
  next: () => void,
) => void;

type TelemetryTestSubject = {
  captureTraceCarrier: () => Record<string, string>;
  injectTraceHeaders: <T extends Record<string, string>>(headers?: T) => T & Record<string, string>;
  normalizeTracePath: (path: string) => string;
  traceHttpRequest: (name?: string) => TraceMiddleware;
  withTraceContext: <T>(
    carrier: Record<string, string | string[] | undefined> | undefined,
    fn: () => T,
  ) => T;
};

const TRACE_ID = '11111111111111111111111111111111';
const SPAN_ID = '2222222222222222';
const TRACEPARENT = `00-${TRACE_ID}-${SPAN_ID}-01`;

export function runTelemetryPrivacyGuardTests(telemetry: TelemetryTestSubject): void {
  describe('telemetry privacy guards', () => {
    test('preserves low-cardinality health and metrics paths', () => {
      expect(telemetry.normalizeTracePath('/metrics?token=secret')).toBe('/metrics');
      expect(telemetry.normalizeTracePath('/health?token=secret')).toBe('/health');
      expect(telemetry.normalizeTracePath('/v1/health?token=secret')).toBe('/v1/health');
      expect(telemetry.normalizeTracePath('/ready?token=secret')).toBe('/ready');
      expect(telemetry.normalizeTracePath('/live?token=secret')).toBe('/live');
    });

    test('normalizes session and object identifiers out of trace paths', () => {
      const sessionId = 'session_abcdefghijklmnopqrstuvwxyz';
      const objectId = 'object_abcdefghijklmnopqrstuvwxyz';

      expect(telemetry.normalizeTracePath(`/sessions/${sessionId}/objects/${objectId}?download_token=secret`))
        .toBe('/sessions/:session/objects/:object');
      expect(telemetry.normalizeTracePath(`/sessions/${sessionId}/results?api_key=secret`))
        .toBe('/sessions/:session/results');
    });

    test('normalizes egress grant identifiers out of internal trace paths', () => {
      const grantId = 'ceg1_abcdefghijklmnopqrstuvwxyz';

      expect(telemetry.normalizeTracePath(`/internal/egress-grants/${grantId}/restore-result`))
        .toBe('/internal/egress-grants/:grant/restore-result');
      expect(telemetry.normalizeTracePath(`/internal/egress-grants/${grantId}/revoke`))
        .toBe('/internal/egress-grants/:grant/revoke');
    });

    test('masks generic long ids and strips query strings from trace paths', () => {
      const secretLikeSegment = 'sk_abcdefghijklmnopqrstuvwxyz1234567890';
      const normalized = telemetry.normalizeTracePath(`/download/${secretLikeSegment}/artifact.txt?token=secret`);

      expect(normalized).toBe('/download/:id/artifact.txt');
      expect(normalized).not.toContain(secretLikeSegment);
      expect(normalized).not.toContain('token=secret');
    });

    test('captures only trace context from incoming carriers', () => {
      const captured = telemetry.withTraceContext({
        traceparent: TRACEPARENT,
        baggage: 'user_id=secret-user',
        authorization: 'Bearer secret-token',
        cookie: 'session=secret-cookie',
      }, () => telemetry.captureTraceCarrier());

      expect(captured.traceparent).toStartWith(`00-${TRACE_ID}-`);
      expect(captured).not.toHaveProperty('baggage');
      expect(captured).not.toHaveProperty('authorization');
      expect(captured).not.toHaveProperty('cookie');
    });

    test('injects trace headers without dropping existing non-sensitive headers', () => {
      const headers = telemetry.withTraceContext({ traceparent: TRACEPARENT }, () => telemetry.injectTraceHeaders({
        Accept: 'application/json',
      }));

      expect(headers.Accept).toBe('application/json');
      expect(headers.traceparent).toStartWith(`00-${TRACE_ID}-`);
    });

    test('keeps trace context through downstream request stream callbacks', async () => {
      const req = Object.assign(new EventEmitter(), {
        method: 'POST',
        path: '/v1/execute',
        headers: { traceparent: TRACEPARENT },
      });
      const res = Object.assign(new EventEmitter(), { statusCode: 200 });

      const captured = new Promise<Record<string, string>>((resolve) => {
        telemetry.traceHttpRequest('test.http.request')(req, res, () => {
          req.on('bodyParsed', async () => {
            await Promise.resolve();
            resolve(telemetry.captureTraceCarrier());
          });
        });
      });

      req.emit('bodyParsed');
      const carrier = await captured;
      res.emit('finish');

      expect(carrier.traceparent).toStartWith(`00-${TRACE_ID}-`);
    });
  });
}


export function runTelemetryFailureTests(): void {
  const faults = ['healthy', 'getTracer', 'propagator', 'exporter', 'processor', 'resource', 'provider', 'registration',
    'extract', 'inject', 'active', 'startSpan', 'setSpan', 'sanitize',
    'setAttribute', 'setStatus', 'recordException', 'end', 'listener'];
  for (const fault of faults) {
    test(`optional telemetry ${fault} failure preserves domain outcomes`, () => {
      const script = `
        import assert from 'node:assert/strict';
        import { EventEmitter } from 'node:events';
        import * as telemetry from ${JSON.stringify(import.meta.resolve('./telemetry-core'))};
        const fault = ${JSON.stringify(fault)};
        const sentinel = new Error('synthetic domain failure');
        const result = { ok: true };
        const root = {};
        const fail = name => { if (name === fault) throw new Error('synthetic telemetry fault'); };
        let endCalls = 0;
        const span = {
          setAttribute() { fail('setAttribute'); },
          setStatus() { fail('setStatus'); },
          recordException() { fail('recordException'); },
          end() { endCalls++; fail('end'); },
        };
        const tracer = { startSpan() { fail('startSpan'); return span; } };
        const resource = { merge() { return resource; } };
        telemetry.configureTelemetry({ defaultServiceName: 'synthetic', otel: {
          ROOT_CONTEXT: root, OtelSpanKind: { INTERNAL: 0, SERVER: 1 },
          SpanStatusCode: { OK: 1, ERROR: 2 },
          otelContext: { active() { fail('active'); return root; } },
          propagation: {
            setGlobalPropagator() { fail('propagator'); },
            extract() { fail('extract'); return root; },
            inject(context, carrier) { carrier.traceparent = 'partial'; fail('inject'); },
          },
          trace: {
            getTracer() { fail('getTracer'); return tracer; },
            setGlobalTracerProvider() { fail('registration'); },
            setSpan(context) { fail('setSpan'); return context; },
          },
          W3CTraceContextPropagator: class {},
          OTLPTraceExporter: class { constructor() { fail('exporter'); } },
          BatchSpanProcessor: class { constructor() { fail('processor'); } },
          BasicTracerProvider: class { constructor() { fail('provider'); } async shutdown() {} },
          defaultResource: () => resource, detectResources() { fail('resource'); return resource; },
          envDetector: {}, resourceFromAttributes: () => resource,
          sanitizeAttributes(attrs) { fail('sanitize'); return attrs; },
        }});
        let calls = 0;
        const actual = await telemetry.withSpan('synthetic', {}, facade => {
          calls++;
          facade.setAttribute('synthetic', true);
          facade.setStatus({ code: 'ERROR' });
          facade.recordException(sentinel);
          return result;
        });
        assert.equal(actual, result); assert.equal(calls, 1);
        for (const asyncFailure of [false, true]) {
          calls = 0;
          try {
            await telemetry.withSpan('synthetic', {}, () => {
              calls++;
              if (asyncFailure) return Promise.reject(sentinel);
              throw sentinel;
            });
            assert.fail('domain error was suppressed');
          } catch (error) { assert.equal(error, sentinel); }
          assert.equal(calls, 1);
        }
        calls = 0;
        assert.equal(telemetry.withTraceContext({}, () => { calls++; return result; }), result);
        assert.equal(calls, 1);
        const headers = telemetry.injectTraceHeaders({ 'x-synthetic': 'preserved' });
        assert.equal(headers['x-synthetic'], 'preserved');
        if (fault === 'inject') assert.equal(headers.traceparent, undefined);
        for (const domainFails of [false, true]) {
          const req = new EventEmitter(); req.headers = {}; req.path = '/health';
          const res = new EventEmitter(); res.statusCode = 200;
          if (fault === 'listener') res.once = () => { throw new Error('synthetic listener failure'); };
          calls = 0;
          try {
            telemetry.traceHttpRequest()(req, res, () => { calls++; if (domainFails) throw sentinel; });
            if (domainFails) assert.fail('next error was suppressed');
          } catch (error) { if (!domainFails) throw error; assert.equal(error, sentinel); }
          assert.equal(calls, 1);
          const endsBefore = endCalls;
          res.emit('finish'); res.emit('close');
          assert.ok(endCalls - endsBefore <= 1);
        }
      `;
      const child = spawnSync(process.execPath, ['--eval', script], {
        env: { PATH: process.env.PATH, OTEL_TRACING_ENABLED: 'true' },
        encoding: 'utf8', timeout: 10000,
      });
      expect({ status: child.status, stderr: child.stderr }).toEqual({ status: 0, stderr: '' });
    });
  }
}
