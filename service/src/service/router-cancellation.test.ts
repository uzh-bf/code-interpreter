import { expect, test } from 'bun:test';
import { resolve } from 'node:path';

test('regular execution fences admission and observes only premature response abandonment', async () => {
  const probe = Bun.spawn([process.execPath, '-e', `
    import { mock } from 'bun:test';
    import assert from 'node:assert/strict';
    import { EventEmitter } from 'node:events';
    const passthrough = (_req, _res, next) => next();
    mock.module('./src/middleware/auth', () => ({ sessionAuth: passthrough }));
    mock.module('./src/middleware/limits', () => ({ executionLimiter: passthrough, uploadLimiter: passthrough, downloadLimiter: passthrough, fetchLimiter: passthrough, deleteLimiter: passthrough }));
    mock.module('./src/lifecycle', () => ({ checkServiceStartUp: () => false, checkServiceShutDown: () => false }));
    let mode = 'normal', current, submitted, releaseAdmission, releaseCompletion, fences, removed, committed;
    const never = new Promise(() => {});
    const queue = (queueName) => ({
      add: async (_type, data, options) => {
        submitted = { data, options, queueName };
        const job = { id: options.jobId, queueName, getState: async () => 'waiting', remove: async () => { removed++; },
          waitUntilFinished: () => mode === 'running' ? new Promise(resolve => { releaseCompletion = resolve; }) : Promise.resolve({ stdout: 'ok' }) };
        if (mode === 'lost') throw new Error('lost enqueue reply');
        if (mode === 'admission') return new Promise(resolve => { releaseAdmission = () => resolve(job); });
        if (mode === 'never') return never;
        return job;
      },
    });
    mock.module('./src/queue', () => ({
      pyQueue: queue('python'), otherQueue: queue('other'), pyQueueEvents: {}, otherQueueEvents: {}, queueNames: { python: 'python', other: 'other' },
      jobCancellationRegistry: { register: async () => {}, unregister: async () => {} },
      waitForJobFinished: async job => job.waitUntilFinished(),
      connection: {
        set: async () => { if (mode === 'ownership') current.res.emit('close'); return 'OK'; },
        eval: async () => { fences++; return committed ? [0, JSON.stringify({ result: committed })] : [1]; },
      },
    }));
    const { env } = await import('./src/config');
    Object.assign(env, { JOB_TIMEOUT: 1000, RUNTIME_SESSION_MODE: 'stateless', SANDBOX_BACKEND: 'http', HARDENED_SANDBOX_MODE: false, EGRESS_GRANT_SECRET: '', EXECUTION_MANIFEST_SECRET: '' });
    const { default: router } = await import('./src/service/router');
    const handler = router.stack.find(layer => layer.route?.path === '/exec').route.stack.at(-1).handle;
    function start(nextMode, lang = 'bash') {
      mode = nextMode; submitted = undefined; fences = 0; removed = 0; committed = undefined;
      const req = Object.assign(new EventEmitter(), { body: { code: 'echo synthetic', lang }, headers: {}, header: () => undefined,
        codeApiPrincipal: { userId: 'synthetic-user', tenantId: 'synthetic-tenant', principalSource: 'none' }, codeApiAuthContext: { userId: 'synthetic-user', tenantId: 'synthetic-tenant' } });
      const res = Object.assign(new EventEmitter(), { writableFinished: false, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; this.writableFinished = true; this.emit('finish'); this.emit('close'); return this; } });
      current = { req, res };
      return { req, res, done: handler(req, res) };
    }
    const tick = () => new Promise(resolve => setImmediate(resolve));
    async function bounded(result) { let timer; try { await Promise.race([result, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('route did not settle')), 500); })]); } finally { clearTimeout(timer); } }
    for (const lang of ['py', 'bash']) {
      const { req, res, done } = start('normal', lang);
      req.emit('close'); // Reading the request body is not response abandonment.
      await bounded(done);
      assert.equal(res.statusCode, 200); assert.equal(fences, 0);
      assert.equal(submitted.data.cancellable, true);
      assert.equal(submitted.options.timestamp + env.JOB_TIMEOUT, submitted.data.deadlineAtMs);
      assert.ok(submitted.data.cancellationTtlSeconds > env.JOB_TIMEOUT / 1000);
      assert.equal(res.listenerCount('close'), 0); assert.equal(req.listenerCount('aborted'), 0);
    }
    const active = start('running'); await tick(); active.res.emit('close'); await bounded(active.done);
    assert.equal(fences, 1); assert.equal(active.res.body, undefined); assert.equal(removed, 1);
    releaseCompletion({ stdout: 'late' }); await tick(); assert.equal(active.res.body, undefined);
    const pending = start('admission'); await tick(); pending.res.emit('close'); await bounded(pending.done);
    assert.equal(fences, 1); const admitted = submitted; releaseAdmission(); await tick();
    assert.equal(removed, 1); assert.equal(admitted.data.deadlineAtMs, admitted.options.timestamp + env.JOB_TIMEOUT);
    const unknown = start('never'); await tick(); unknown.res.emit('close'); await bounded(unknown.done); assert.equal(fences, 1);
    const lost = start('lost'); await bounded(lost.done); assert.equal(fences, 1); assert.equal(lost.res.statusCode, 500);
    const won = start('lost'); committed = { stdout: 'committed' }; await bounded(won.done);
    assert.deepEqual(won.res.body, committed); assert.equal(won.res.statusCode, 200);
    const early = start('ownership'); await bounded(early.done); assert.equal(submitted, undefined); assert.equal(early.res.body, undefined);
    console.log('ROUTE_CANCELLATION_OK');
  `], { cwd: resolve(__dirname, '../..'), stdout: 'pipe', stderr: 'pipe' });
  const [exitCode, stdout, stderr] = await Promise.all([
    probe.exited, new Response(probe.stdout).text(), new Response(probe.stderr).text(),
  ]);
  expect(exitCode, `${stdout}\n${stderr}`).toBe(0);
  expect(stdout).toContain('ROUTE_CANCELLATION_OK');
}, 15000);
