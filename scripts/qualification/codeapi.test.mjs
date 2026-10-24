import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import {
    apiBase,
    exchange,
    guardCheck,
    createClient,
    runQualification,
} from './codeapi.mjs';

async function local(t, handler) {
    const server = createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => {
        server.closeAllConnections();
        return new Promise(resolve => server.close(resolve));
    });
    return `http://127.0.0.1:${server.address().port}/v1`;
}
async function files(t) {
    const dir = await mkdtemp(join(tmpdir(), 'codeapi-qualification-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const runId = randomUUID(),
        guardPath = join(dir, 'guard.json');
    await writeFile(
        guardPath,
        JSON.stringify({ runId, observedAt: Date.now(), ok: true })
    );
    return { runId, guardPath, receiptPath: join(dir, 'receipt.jsonl') };
}
const reply = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
};
const success = (stdout = 'qualification-ok\n', extra = {}) => ({
    session_id: 's'.repeat(21),
    code: 0,
    signal: null,
    status: null,
    stdout,
    stderr: '',
    files: [],
    ...extra,
});

test('destination confinement rejects unsafe endpoints before any request', () => {
    for (const url of [
        'http://example.org/v1',
        'https://user:password@example.org/v1',
        'https://example.org/v1?x=1',
        'https://example.org/v1#x',
        'https://example.org/other',
        'file:///v1',
    ]) {
        assert.throws(() => apiBase(url), { reason: 'invalid_destination' });
    }
    assert.throws(() => exchange('http://127.0.0.1:1/v1', '//example.org/x'), {
        reason: 'invalid_path',
    });
    assert.throws(() => exchange('http://127.0.0.1:1/v1', '/../other'), {
        reason: 'invalid_path',
    });
});

test('transport rejects redirects, overflow, truncation and whole-response deadlines', async t => {
    const base = await local(t, (req, res) => {
        if (req.url.endsWith('/redirect')) {
            res.writeHead(302, { Location: 'https://example.org/' });
            res.end();
        }
        if (req.url.endsWith('/large')) res.end(Buffer.alloc(1024 * 1024 + 1));
        if (req.url.endsWith('/truncated')) {
            res.writeHead(200, { 'Content-Length': '1000' });
            res.write('x');
            setImmediate(() => res.destroy());
        }
        if (req.url.endsWith('/slow')) {
            res.writeHead(200);
            res.write('x');
        }
    });
    for (const [path, reason] of [
        ['/redirect', 'redirect_rejected'],
        ['/large', 'response_too_large'],
        ['/truncated', 'response_truncated'],
        ['/slow', 'request_deadline'],
    ]) {
        await assert.rejects(exchange(base, path, { timeoutMs: 100 }), {
            reason,
        });
    }
});

test('guard is invocation-bound, fresh and fail-closed', async t => {
    const c = await files(t),
        now = Date.now();
    for (const guard of [
        { runId: c.runId, ok: false, observedAt: now },
        { runId: randomUUID(), ok: true, observedAt: now },
        { runId: c.runId, ok: true, observedAt: now - 21000 },
        { runId: c.runId, ok: true, observedAt: now + 1 },
    ]) {
        await writeFile(c.guardPath, JSON.stringify(guard));
        await assert.rejects(guardCheck(c.guardPath, c.runId, now), {
            reason: 'guard_rejected',
        });
    }
});

test('admission budgets and four-request concurrency apply before remote work', async t => {
    const c = await files(t);
    let calls = 0,
        active = 0,
        peak = 0;
    const request = async () => {
        calls++;
        active++;
        peak = Math.max(active, peak);
        await delay(5);
        active--;
        return {
            status: 200,
            headers: {},
            bytes: Buffer.from(JSON.stringify(success())),
        };
    };
    const client = createClient({
        ...c,
        baseUrl: 'http://127.0.0.1:1/v1',
        token: () => 'synthetic',
        request,
        limits: { executions: 5 },
    });
    await client.parallel(
        Array.from({ length: 30 }, (_, i) => i),
        4,
        () => client.execute('pass', 'python')
    );
    assert.equal(calls, 5);
    assert.ok(peak <= 4);
    assert.equal(client.state.stopped, true);
    const exhausted = createClient({
        ...c,
        baseUrl: 'http://127.0.0.1:1/v1',
        token: () => 'synthetic',
        request,
        limits: { requests: 40 },
    });
    await assert.rejects(exhausted.call('/health'), {
        reason: 'request_budget',
    });
    assert.equal(calls, 5);
});

test('unknown generated references retain every valid owned ref and mark uncertainty', async t => {
    const c = await files(t);
    const value = success('bad\n', {
        files: [
            {
                id: 'v'.repeat(21),
                name: 'output',
                storage_session_id: 's'.repeat(21),
            },
            { id: 'invalid', name: 'bad' },
        ],
    });
    const client = createClient({
        ...c,
        baseUrl: 'http://127.0.0.1:1/v1',
        token: () => 'synthetic',
        request: async () => ({
            status: 200,
            headers: {},
            bytes: Buffer.from(JSON.stringify(value)),
        }),
    });
    await assert.rejects(client.execute('pass', 'python'), {
        reason: 'unknown_output_reference',
    });
    assert.equal(client.state.owned.length, 1);
    assert.equal(client.state.uncertain, true);
});

async function protocol(
    t,
    { wrongRuntime = false, deleteFailure = false, rateLimit = false } = {}
) {
    const objects = new Map();
    let counter = 0,
        executions = 0,
        peak = 0,
        active = 0;
    const put = (name, bytes) => {
        const id = String(++counter).padStart(21, 'a');
        const ref = { id, name, storage_session_id: 's'.repeat(21) };
        objects.set(id, { ref, bytes });
        return ref;
    };
    const baseUrl = await local(t, async (req, res) => {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks),
            path = new URL(req.url, 'http://local').pathname;
        if (path === '/v1/health') return reply(res, 200, {});
        if (!req.headers.authorization)
            return reply(res, 401, { error: 'unauthorized' });
        if (req.headers['x-codeapi-expected-profile'] === 'stateful')
            return reply(res, 409, { error: 'execution_profile_mismatch' });
        if (path === '/v1/exec') {
            const input = JSON.parse(body);
            if (input.lang === 'unsupported-qualification-language')
                return reply(res, 400, {});
            if (rateLimit) {
                res.setHeader('Retry-After', '30');
                return reply(res, 429, { error: 'rate_limited' });
            }
            executions++;
            active++;
            peak = Math.max(peak, active);
            await delay(2);
            active--;
            if (wrongRuntime) {
                const ref = put('unexpected.csv', Buffer.from('owned'));
                return reply(res, 200, success('wrong\n', { files: [ref] }));
            }
            if (input.code.includes('write_bytes')) {
                const name = /joinpath\('([^']+)'\)\.write_bytes/.exec(
                    input.code
                )[1];
                const ref = put(name, objects.get(input.files[0].id).bytes);
                return reply(res, 200, success('copied\n', { files: [ref] }));
            }
            if (input.code.includes('sleep(30)'))
                return reply(
                    res,
                    200,
                    success('', { code: 137, signal: 'SIGKILL', status: 'TO' })
                );
            if (input.code.includes('recovered'))
                return reply(res, 200, success('recovered\n'));
            if (input.code.includes('qualification-load'))
                return reply(res, 200, success('qualification-load 2000\n'));
            return reply(res, 200, success());
        }
        if (path === '/v1/upload') {
            const text = body.toString(),
                name = /filename="([^"]+)"/.exec(text)[1];
            const bytes = Buffer.from(
                text
                    .split('Content-Type: text/plain\r\n\r\n')[1]
                    .split('\r\n--')[0]
            );
            const ref = put(name, bytes);
            return reply(res, 200, {
                storage_session_id: ref.storage_session_id,
                files: [{ fileId: ref.id, filename: name }],
            });
        }
        if (req.headers.authorization === 'Bearer other')
            return reply(res, 403, {});
        if (req.method === 'DELETE') {
            if (deleteFailure)
                return reply(res, 503, {
                    error: 'synthetic server text must not escape',
                });
            objects.delete(path.split('/').at(-1));
            return reply(res, 200, {});
        }
        if (path.startsWith('/v1/files/'))
            return reply(
                res,
                200,
                [...objects.values()].map(x => x.ref)
            );
        const object = objects.get(path.split('/').at(-1));
        if (!object) return reply(res, 404, {});
        if (path.startsWith('/v1/sessions/'))
            return reply(res, 200, { size: object.bytes.length });
        res.writeHead(200);
        res.end(object.bytes);
    });
    return {
        baseUrl,
        objects,
        get executions() {
            return executions;
        },
        get peak() {
            return peak;
        },
    };
}

test('independent contract, bounded phases and exact artifacts complete with owned cleanup', async t => {
    const c = await files(t),
        server = await protocol(t);
    const result = await runQualification({
        ...c,
        baseUrl: server.baseUrl,
        token: () => 'synthetic-secret',
        comparisonToken: () => 'other',
        mode: 'all',
        waitMs: 0,
        request: exchange,
    });
    assert.equal(result.status, 'passed');
    assert.equal(server.objects.size, 0);
    assert.ok(
        result.executions <= 40 &&
            result.requests <= 160 &&
            result.requestedGuestMs <= 120000
    );
    assert.ok(server.peak <= 4);
    const receipt = await readFile(c.receiptPath, 'utf8');
    assert.equal(receipt.includes('synthetic-secret'), false);
    assert.equal(receipt.includes('qualification-ok'), false);
    assert.equal((await stat(c.receiptPath)).mode & 0o777, 0o600);
    const phases = receipt
        .trim()
        .split('\n')
        .map(JSON.parse)
        .filter(x => x.type === 'phase');
    assert.equal(phases.length, 3);
    assert.ok(phases.every(x => x.successful === x.offered));
});

test('malformed HTTP success stops load and still deletes returned owned output', async t => {
    const c = await files(t),
        server = await protocol(t, { wrongRuntime: true });
    const result = await runQualification({
        ...c,
        baseUrl: server.baseUrl,
        token: () => 'synthetic',
        mode: 'all',
        waitMs: 0,
        request: exchange,
    });
    assert.equal(result.status, 'failed');
    assert.equal(server.executions, 1);
    assert.equal(server.objects.size, 0);
    assert.equal(result.cleanupUncertain, false);
});

test('failed cleanup and ordinary rate limit stay terminal without retries', async t => {
    for (const options of [{ deleteFailure: true }, { rateLimit: true }]) {
        const c = await files(t),
            server = await protocol(t, options);
        const result = await runQualification({
            ...c,
            baseUrl: server.baseUrl,
            token: () => 'synthetic',
            mode: 'all',
            waitMs: 0,
            request: exchange,
        });
        assert.equal(result.status, 'failed');
        if (options.deleteFailure) assert.equal(result.cleanupUncertain, true);
        else {
            assert.equal(server.executions, 0);
            assert.ok(result.failures.some(x => x.reason === 'rate_limited'));
        }
        const receipt = await readFile(c.receiptPath, 'utf8');
        assert.equal(
            receipt.includes('synthetic server text must not escape'),
            false
        );
    }
});

test('stale safety guard prevents all traffic but does not prevent owned cleanup', async t => {
    const c = await files(t),
        server = await protocol(t);
    const client = createClient({
        ...c,
        baseUrl: server.baseUrl,
        token: () => 'synthetic',
    });
    client.own('s'.repeat(21), 'a'.repeat(21), 'synthetic');
    await writeFile(c.guardPath, '{}');
    await assert.rejects(client.call('/health'), { reason: 'guard_rejected' });
    await client.cleanup();
    assert.equal(client.state.requests, 2);
});
