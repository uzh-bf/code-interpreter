import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { randomUUID, createHash } from 'node:crypto';
import { open, readFile } from 'node:fs/promises';
import { writeSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const MAX_BYTES = 1024 * 1024;
const ID = /^[A-Za-z0-9_-]{21}$/;
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const CAPS = Object.freeze({
    requests: 160,
    executions: 40,
    files: 16,
    guestMs: 120000,
});
const SUSTAINED_CAPS = Object.freeze({
    requests: 400,
    executions: 360,
    files: 16,
    guestMs: 1080000,
});

export class QualificationError extends Error {
    constructor(reason, status) {
        super(reason);
        this.reason = reason;
        this.status = status;
    }
}
const check = (ok, reason) => {
    if (!ok) throw new QualificationError(reason);
};

export function apiBase(raw) {
    let url;
    try {
        url = new URL(raw);
    } catch {
        throw new QualificationError('invalid_destination');
    }
    check(
        !url.username && !url.password && !url.search && !url.hash,
        'invalid_destination'
    );
    check(
        url.pathname === '/v1' || url.pathname === '/v1/',
        'invalid_destination'
    );
    check(
        url.protocol === 'https:' ||
            (url.protocol === 'http:' &&
                ['127.0.0.1', '[::1]'].includes(url.hostname)),
        'invalid_destination'
    );
    url.pathname = '/v1/';
    return url;
}

// The timer covers headers and the complete body; an idle socket timer alone
// does not bound a server that slowly continues sending bytes.
export function exchange(
    base,
    path,
    { method = 'GET', token, body, headers = {}, timeoutMs = 60000 } = {}
) {
    const root = apiBase(String(base));
    check(
        typeof path === 'string' &&
            path.startsWith('/') &&
            !path.startsWith('//'),
        'invalid_path'
    );
    const url = new URL(root.pathname.slice(0, -1) + path, root);
    check(
        url.origin === root.origin &&
            url.pathname.startsWith('/v1/') &&
            !url.hash,
        'invalid_path'
    );
    const bytes = body === undefined ? undefined : Buffer.from(body);
    check(!bytes || bytes.length <= MAX_BYTES, 'request_too_large');
    check(
        Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 60000,
        'invalid_deadline'
    );
    return new Promise((resolve, reject) => {
        let settled = false;
        let res;
        let timer;
        const finish = (error, result) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (error) {
                res?.destroy();
                req.destroy();
                reject(error);
            } else resolve(result);
        };
        const req = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
            url,
            {
                method,
                agent: false,
                headers: {
                    ...headers,
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    ...(bytes ? { 'Content-Length': bytes.length } : {}),
                },
            },
            response => {
                res = response;
                if (res.statusCode >= 300 && res.statusCode < 400)
                    return finish(new QualificationError('redirect_rejected'));
                let size = 0;
                const chunks = [];
                res.on('data', chunk => {
                    size += chunk.length;
                    if (size > MAX_BYTES)
                        finish(new QualificationError('response_too_large'));
                    else chunks.push(chunk);
                });
                res.on('aborted', () =>
                    finish(new QualificationError('response_truncated'))
                );
                res.on('error', () =>
                    finish(new QualificationError('response_error'))
                );
                res.on('close', () => {
                    if (!res.complete)
                        finish(new QualificationError('response_truncated'));
                });
                res.on('end', () =>
                    finish(null, {
                        status: res.statusCode,
                        headers: res.headers,
                        bytes: Buffer.concat(chunks),
                    })
                );
            }
        );
        req.on('error', () =>
            finish(new QualificationError('transport_error'))
        );
        timer = setTimeout(
            () => finish(new QualificationError('request_deadline')),
            timeoutMs
        );
        req.end(bytes);
    });
}

function json(response) {
    try {
        return JSON.parse(response.bytes.toString('utf8'));
    } catch {
        throw new QualificationError('invalid_json');
    }
}
function status(response, expected) {
    if (response.status !== expected)
        throw new QualificationError(
            response.status === 429 ? 'rate_limited' : 'unexpected_http',
            response.status
        );
}
function multipart(runId, name, bytes) {
    const boundary = `qualification-${randomUUID()}`;
    const fields = [
        ['kind', 'user'],
        ['id', runId],
    ].map(
        ([k, v]) =>
            `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`
    );
    return {
        body: Buffer.concat([
            Buffer.from(
                fields.join('') +
                    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: text/plain\r\n\r\n`
            ),
            bytes,
            Buffer.from(`\r\n--${boundary}--\r\n`),
        ]),
        headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
    };
}

export async function guardCheck(path, runId, now = Date.now()) {
    let guard;
    try {
        guard = JSON.parse(await readFile(path, 'utf8'));
    } catch {
        throw new QualificationError('guard_unavailable');
    }
    check(
        guard.runId === runId &&
            guard.ok === true &&
            Number.isFinite(guard.observedAt) &&
            now >= guard.observedAt &&
            now - guard.observedAt <= 20000,
        'guard_rejected'
    );
    return guard;
}

export function createClient({
    baseUrl,
    token,
    runId,
    guardPath,
    receipt = () => {},
    limits = {},
    now = Date.now,
    request = exchange,
    receiptHealthy = () => true,
    monotonic = now,
    envelope = 'bounded',
}) {
    const base = apiBase(baseUrl);
    check(UUID.test(runId), 'invalid_run_id');
    check(typeof token === 'function', 'token_supplier_required');
    check(['bounded', 'sustained'].includes(envelope), 'invalid_envelope');
    const maximum = envelope === 'sustained' ? SUSTAINED_CAPS : CAPS;
    const totalMs = envelope === 'sustained' ? 1800000 : 900000;
    const admissionMs = envelope === 'sustained' ? 1620000 : 720000;
    const cap = Object.fromEntries(
        Object.entries(maximum).map(([k, v]) => [
            k,
            Math.min(v, limits[k] ?? v),
        ])
    );
    check(
        Object.values(cap).every(v => Number.isSafeInteger(v) && v >= 0),
        'invalid_budget'
    );
    const start = monotonic();
    const objectOwners = new Map();
    const state = {
        requests: 0,
        executions: 0,
        guestMs: 0,
        owned: [],
        failures: [],
        uncertain: false,
        stopped: false,
        peak: 0,
        inFlight: 0,
        dispatches: 0,
    };
    const fail = error => {
        state.stopped = true;
        const result =
            error instanceof QualificationError
                ? {
                      reason: error.reason,
                      ...(error.status ? { httpStatus: error.status } : {}),
                  }
                : { reason: 'unexpected_failure' };
        state.failures.push(result);
        receipt({ type: 'failure', ...result });
    };
    async function call(
        path,
        {
            cleanup = false,
            guestMs = 0,
            auth = token,
            dispatchBy = Infinity,
            ...options
        } = {}
    ) {
        const requestEnd = Math.min(
            monotonic() + (cleanup ? 15000 : 60000),
            start + totalMs
        );
        const dispatchCheck = () => {
            check(!state.stopped || cleanup, 'admission_stopped');
            check(
                monotonic() - start < (cleanup ? totalMs : admissionMs),
                'run_deadline'
            );
            check(monotonic() <= dispatchBy, 'dispatch_deadline');
            check(monotonic() < requestEnd, 'request_deadline');
        };
        check(!state.stopped || cleanup, 'admission_stopped');
        check(cleanup || receiptHealthy(), 'receipt_unavailable');
        dispatchCheck();
        if (!cleanup) await guardCheck(guardPath, runId, now());
        dispatchCheck();
        check(state.inFlight < 4, 'concurrency_budget');
        check(
            state.requests <
                (cleanup ? cap.requests : Math.max(0, cap.requests - 40)),
            'request_budget'
        );

        if (path === '/exec') {
            check(
                state.executions < cap.executions &&
                    state.guestMs + guestMs <= cap.guestMs,
                'execution_budget'
            );
            state.executions++;
            state.guestMs += guestMs;
        }
        state.requests++;
        const began = now();
        state.inFlight++;
        state.peak = Math.max(state.peak, state.inFlight);
        let dispatched = false;
        try {
            const credential =
                auth === null
                    ? undefined
                    : await new Promise((resolve, reject) => {
                          const timer = setTimeout(
                              () =>
                                  reject(
                                      new QualificationError(
                                          'credential_deadline'
                                      )
                                  ),
                              Math.max(
                                  0,
                                  Math.min(
                                      1000,
                                      requestEnd - monotonic(),
                                      dispatchBy - monotonic()
                                  )
                              )
                          );
                          Promise.resolve()
                              .then(auth)
                              .then(
                                  value => {
                                      clearTimeout(timer);
                                      resolve(value);
                                  },
                                  () => {
                                      clearTimeout(timer);
                                      reject(
                                          new QualificationError(
                                              'credential_unavailable'
                                          )
                                      );
                                  }
                              );
                      });
            check(
                auth === null ||
                    (typeof credential === 'string' && credential.length > 0),
                'credential_unavailable'
            );
            dispatchCheck();
            if (!cleanup) await guardCheck(guardPath, runId, now());
            dispatchCheck();
            check(cleanup || receiptHealthy(), 'receipt_unavailable');
            dispatched = true;
            state.dispatches++;
            const response = await request(base, path, {
                ...options,
                token: credential,
                timeoutMs: requestEnd - monotonic(),
                headers: {
                    'X-CodeAPI-Expected-Profile': 'default',
                    ...options.headers,
                },
            });
            receipt({
                type: 'request',
                method: options.method ?? 'GET',
                operation: cleanup
                    ? 'cleanup'
                    : path === '/exec'
                    ? 'exec'
                    : 'file_or_contract',
                status: response.status,
                durationMs: now() - began,
            });
            if (response.status === 429) {
                const retry = Number(response.headers['retry-after']);
                receipt({
                    type: 'rate_limit',
                    retryAfterSeconds: Number.isFinite(retry) ? retry : null,
                });
            }
            return response;
        } catch (error) {
            if (dispatched && (path === '/exec' || path === '/upload'))
                state.uncertain = true;
            throw error;
        } finally {
            state.inFlight--;
        }
    }
    const own = (session, id, name, auth = token) => {
        if (!ID.test(session ?? '') || !ID.test(id ?? '')) {
            state.uncertain = true;
            throw new QualificationError('unknown_output_reference');
        }
        const existing = state.owned.find(
            x => x.id === id && x.storage_session_id === session
        );
        if (existing) {
            check(typeof name === 'string', 'unusable_output_name');
            return existing;
        }
        const ref = {
            id,
            storage_session_id: session,
            name: typeof name === 'string' ? name : '',
            kind: 'user',
            resource_id: runId,
        };
        state.owned.push(ref);
        objectOwners.set(ref, auth);
        receipt({ type: 'owned_object', id, storage_session_id: session });
        check(typeof name === 'string', 'unusable_output_name');
        check(state.owned.length <= cap.files, 'file_budget');
        return ref;
    };
    async function execute(
        code,
        lang,
        {
            files = [],
            timeout = 3000,
            expectTimeout = false,
            auth = token,
            dispatchBy = Infinity,
        } = {}
    ) {
        check(typeof auth === 'function', 'token_supplier_required');
        const began = now();
        const response = await call('/exec', {
            auth,
            dispatchBy,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, lang, timeout, files }),
            guestMs: timeout,
        });
        if (response.status !== 200 && response.status !== 429)
            state.uncertain = true;
        status(response, 200);
        let value;
        try {
            value = json(response);
        } catch (error) {
            state.uncertain = true;
            throw error;
        }
        if (!Array.isArray(value.files)) {
            state.uncertain = true;
            throw new QualificationError('unknown_output_reference');
        }
        const created = [];
        let badReference = false;
        for (const file of value.files) {
            if (file?.inherited === true) continue;
            try {
                created.push(
                    own(
                        file?.storage_session_id ?? value.session_id,
                        file?.id,
                        file?.name,
                        auth
                    )
                );
            } catch {
                badReference = true;
            }
        }
        if (badReference)
            throw new QualificationError('unknown_output_reference');
        if (value.artifact_delivery) state.uncertain = true;
        check(ID.test(value.session_id ?? ''), 'invalid_session');
        if (expectTimeout)
            check(
                value.code !== 0 &&
                    (value.status === 'TO' || value.signal === 'SIGKILL'),
                'guest_timeout_missing'
            );
        else
            check(
                value.code === 0 &&
                    !value.signal &&
                    !value.status &&
                    !value.artifact_delivery &&
                    value.stderr === '',
                'execution_failed'
            );
        check(typeof value.stdout === 'string', 'invalid_stdout');
        return { value, created, durationMs: now() - began };
    }
    async function parallel(items, concurrency, fn) {
        check(
            Number.isInteger(concurrency) &&
                concurrency >= 1 &&
                concurrency <= 4,
            'invalid_concurrency'
        );
        let next = 0;
        let admissionFailure;
        await Promise.all(
            Array.from({ length: concurrency }, async () => {
                while (
                    next < items.length &&
                    !state.stopped &&
                    !admissionFailure
                ) {
                    const item = items[next++];
                    try {
                        await fn(item);
                    } catch (error) {
                        if (
                            error instanceof QualificationError &&
                            [
                                'concurrency_budget',
                                'execution_budget',
                                'request_budget',
                            ].includes(error.reason)
                        )
                            admissionFailure ??= error;
                        else fail(error);
                    }
                }
            })
        );
        if (admissionFailure) fail(admissionFailure);
    }
    async function cleanup() {
        const objects = [...state.owned];
        let next = 0;
        await Promise.all(
            Array.from({ length: Math.min(4, objects.length) }, async () => {
                while (next < objects.length) {
                    const object = objects[next++];
                    try {
                        const path = `/${object.storage_session_id}/${object.id}?kind=user`;
                        const removed = await call('/files' + path, {
                            method: 'DELETE',
                            cleanup: true,
                            auth: objectOwners.get(object),
                        });
                        check(
                            removed.status === 200 || removed.status === 404,
                            'delete_failed'
                        );
                        status(
                            await call('/download' + path, {
                                cleanup: true,
                                auth: objectOwners.get(object),
                            }),
                            404
                        );
                        receipt({
                            type: 'deleted_object',
                            id: object.id,
                            storage_session_id: object.storage_session_id,
                        });
                    } catch (error) {
                        state.uncertain = true;
                        fail(error);
                    }
                }
            })
        );
    }
    return {
        state,
        runId,
        call,
        own,
        execute,
        parallel,
        cleanup,
        fail,
        receipt,
        now,
        stop: () => {
            state.stopped = true;
        },
    };
}

const percentile = (values, p) =>
    [...values].sort((a, b) => a - b)[
        Math.max(0, Math.ceil(values.length * p) - 1)
    ] ?? null;

async function contract(client, comparisonToken) {
    const { call, execute, own, receipt } = client;
    status(await call('/health'), 200);
    const empty = JSON.stringify({
        code: 'print(1)',
        lang: 'python',
        timeout: 3000,
    });
    status(
        await call('/exec', {
            method: 'POST',
            body: empty,
            headers: { 'Content-Type': 'application/json' },
            auth: null,
        }),
        401
    );
    const mismatch = await call('/exec', {
        method: 'POST',
        body: empty,
        headers: {
            'Content-Type': 'application/json',
            'X-CodeAPI-Expected-Profile': 'stateful',
        },
    });
    status(mismatch, 409);
    check(
        json(mismatch).error === 'execution_profile_mismatch',
        'profile_mismatch_shape'
    );
    status(
        await call('/exec', {
            method: 'POST',
            body: JSON.stringify({
                code: '',
                lang: 'unsupported-qualification-language',
                timeout: 3000,
            }),
            headers: { 'Content-Type': 'application/json' },
        }),
        400
    );
    const marker = 'qualification-ok';
    for (const [lang, code] of [
        ['python', `print('${marker}')`],
        ['node', `console.log('${marker}')`],
        ['js', `console.log('${marker}')`],
        ['ts', `const value: string = '${marker}'; console.log(value)`],
        ['bash', `printf '${marker}\\n'`],
    ]) {
        const result = await execute(code, lang);
        check(
            result.value.stdout === marker + '\n' &&
                result.created.length === 0,
            'runtime_output_mismatch'
        );
        receipt({
            type: 'case',
            name: 'runtime',
            language: lang,
            status: 'passed',
        });
    }
    const bytes = Buffer.from('key,value\nalpha,2\nbeta,4\n');
    const response = await call('/upload', {
        method: 'POST',
        ...multipart(client.runId, 'input.csv', bytes),
    });
    if (response.status !== 200) client.state.uncertain = true;
    status(response, 200);
    let uploaded;
    try {
        uploaded = json(response);
    } catch (error) {
        client.state.uncertain = true;
        throw error;
    }
    if (!Array.isArray(uploaded.files) || !uploaded.files.length) {
        client.state.uncertain = true;
        throw new QualificationError('upload_reference_missing');
    }
    const refs = uploaded.files.map(f =>
        own(uploaded.storage_session_id, f.fileId, f.filename)
    );
    check(refs.length === 1, 'upload_count_mismatch');
    const input = refs[0];
    const inputDownload = await call(
        `/download/${input.storage_session_id}/${input.id}?kind=user`
    );
    status(inputDownload, 200);
    check(inputDownload.bytes.equals(bytes), 'input_bytes_mismatch');
    const listResponse = await call(
        `/files/${input.storage_session_id}?kind=user&detail=normalized`
    );
    status(listResponse, 200);
    const listing = json(listResponse);
    check(
        Array.isArray(listing) &&
            listing.some(f => f.id === input.id || f.fileId === input.id),
        'list_missing_input'
    );
    const metadata = await call(
        `/sessions/${input.storage_session_id}/objects/${input.id}?kind=user`
    );
    status(metadata, 200);
    check(json(metadata)?.size === bytes.length, 'invalid_metadata');
    if (comparisonToken)
        status(
            await call(
                `/download/${input.storage_session_id}/${input.id}?kind=user`,
                { auth: comparisonToken }
            ),
            403
        );
    else
        receipt({
            type: 'case',
            name: 'ownership_denial',
            status: 'not_tested',
        });
    let previous = input;
    for (const name of ['copy.csv', 'reused.csv']) {
        const code = `from pathlib import Path\np=Path('/mnt/data')\np.joinpath('${name}').write_bytes(p.joinpath('${previous.name}').read_bytes())\nprint('copied')`;
        const output = await execute(code, 'python', { files: [previous] });
        check(
            output.value.stdout === 'copied\n' &&
                output.created.length === 1 &&
                output.created[0].name === name,
            'artifact_missing'
        );
        previous = output.created[0];
        const download = await call(
            `/download/${previous.storage_session_id}/${previous.id}?kind=user`
        );
        status(download, 200);
        check(download.bytes.equals(bytes), 'artifact_bytes_mismatch');
    }
    await execute('import time\ntime.sleep(30)', 'python', {
        timeout: 500,
        expectTimeout: true,
    });
    const recovered = await execute("print('recovered')", 'python');
    check(
        recovered.value.stdout === 'recovered\n' &&
            recovered.created.length === 0,
        'recovery_failed'
    );
    receipt({ type: 'case', name: 'contract', status: 'passed' });
}

async function load(client, waitMs) {
    for (const [name, concurrency, mixed] of [
        ['python_sequential', 1, false],
        ['python_burst', 4, false],
        ['mixed_burst', 4, true],
    ]) {
        await delay(waitMs);
        const began = client.now();
        const samples = [];
        await client.parallel(
            Array.from({ length: 8 }, (_, i) => i),
            concurrency,
            async i => {
                const node = mixed && i % 2 === 1;
                const marker = 'qualification-load';
                const code = node
                    ? `const t=performance.now(); await new Promise(r=>setTimeout(r,2000)); console.log('${marker} '+Math.round(performance.now()-t))`
                    : `import time\nt=time.monotonic()\ntime.sleep(2)\nprint('${marker} '+str(round((time.monotonic()-t)*1000)))`;
                const result = await client.execute(
                    code,
                    node ? 'node' : 'python'
                );
                const match = /^qualification-load (\d+)\n$/.exec(
                    result.value.stdout
                );
                check(
                    match &&
                        Number(match[1]) >= 1500 &&
                        Number(match[1]) <= 3000 &&
                        result.created.length === 0,
                    'load_output_mismatch'
                );
                samples.push({
                    durationMs: result.durationMs,
                    guestMs: Number(match[1]),
                    language: node ? 'node' : 'python',
                });
            }
        );
        const durationMs = client.now() - began;
        client.receipt({
            type: 'phase',
            name,
            offered: 8,
            successful: samples.length,
            concurrency,
            durationMs,
            throughputPerSecond: samples.length / (durationMs / 1000),
            p50Ms: percentile(
                samples.map(x => x.durationMs),
                0.5
            ),
            p95Ms: percentile(
                samples.map(x => x.durationMs),
                0.95
            ),
            p99Ms: percentile(
                samples.map(x => x.durationMs),
                0.99
            ),
            samples,
        });
        check(!client.state.stopped, 'phase_failed');
    }
}

const RESOURCE_BYTES = 32 * 1024 * 1024;
const HASH_STEPS = 1000000;
const RESOURCE_KINDS = Object.freeze(['cpu', 'memory', 'node_memory']);

function prepareResourceWorkload(kind, seed) {
    check(RESOURCE_KINDS.includes(kind), 'invalid_resource_kind');
    check(
        typeof seed === 'string' && /^[a-zA-Z0-9:_-]{1,160}$/.test(seed),
        'invalid_resource_nonce'
    );
    const memory = kind !== 'cpu';
    const pattern = createHash('sha256').update(seed).digest()[0];
    let value = Buffer.from(seed);
    if (memory) value = Buffer.alloc(RESOURCE_BYTES, pattern);
    else
        for (let i = 0; i < HASH_STEPS; i++)
            value = createHash('sha256').update(value).digest();
    const digest = memory
        ? createHash('sha256').update(value).digest('hex')
        : value.toString('hex');
    return {
        kind,
        lang: kind === 'node_memory' ? 'node' : 'python',
        pattern,
        digest,
        bytes: memory ? RESOURCE_BYTES : 0,
    };
}

function renderResourceWorkload(template, nonce) {
    check(
        typeof nonce === 'string' && /^[a-zA-Z0-9:_-]{1,160}$/.test(nonce),
        'invalid_resource_nonce'
    );
    const { kind, lang, pattern, digest, bytes } = template;
    const memory = kind !== 'cpu';
    const literal = JSON.stringify(nonce);
    const code =
        kind === 'node_memory'
            ? `// qualification-resource:node_memory
import {createHash} from 'node:crypto';
const nonce=${literal};
const seed=${JSON.stringify(template.seed)};
const cpu=process.cpuUsage(), wall=performance.now();
const data=Buffer.alloc(${RESOURCE_BYTES},${pattern});
for(let i=0;i<data.length;i+=4096)data[i]=${pattern};
const digest=createHash('sha256').update(data).digest('hex');
const used=process.cpuUsage(cpu);
console.log(JSON.stringify({nonce,digest,bytes:data.length,cpuMs:(used.user+used.system)/1000,wallMs:performance.now()-wall}));`
            : `# qualification-resource:${kind}
import hashlib,json,time
nonce=${literal}
seed=${JSON.stringify(template.seed)}
cpu=time.process_time(); wall=time.perf_counter()
${
    memory
        ? `data=bytearray([${pattern}])*${RESOURCE_BYTES}
for i in range(0,len(data),4096): data[i]=${pattern}
digest=hashlib.sha256(data).hexdigest()`
        : `data=seed.encode('utf8')
for _ in range(${HASH_STEPS}): data=hashlib.sha256(data).digest()
digest=data.hex()`
}
print(json.dumps(dict(nonce=nonce,digest=digest,bytes=${
                  memory ? RESOURCE_BYTES : 0
              },cpuMs=(time.process_time()-cpu)*1000,wallMs=(time.perf_counter()-wall)*1000)))`;
    return {
        code,
        lang: kind === 'node_memory' ? 'node' : 'python',
        nonce,
        digest,
        bytes: memory ? RESOURCE_BYTES : 0,
    };
}

export function resourceWorkload(kind, nonce, seed = nonce) {
    const template = prepareResourceWorkload(kind, seed);
    return renderResourceWorkload({ ...template, seed }, nonce);
}

function validateResourceResult(work, kind, result) {
    let output;
    try {
        output = JSON.parse(result.value.stdout);
    } catch {
        throw new QualificationError('resource_output_mismatch');
    }
    check(
        output.nonce === work.nonce &&
            output.digest === work.digest &&
            output.bytes === work.bytes &&
            Number.isFinite(output.cpuMs) &&
            output.cpuMs > 0 &&
            Number.isFinite(output.wallMs) &&
            output.wallMs > 0 &&
            output.wallMs <= 3000 &&
            result.created.length === 0,
        'resource_output_mismatch'
    );
    return {
        language: work.lang,
        kind,
        bytes: work.bytes,
        cpuMs: output.cpuMs,
        guestWallMs: output.wallMs,
        durationMs: result.durationMs,
    };
}

async function resources(
    client,
    { waitMs, began, monotonic, pause, guardPath }
) {
    check(
        monotonic() - began + 2 * waitMs + 10000 + 20000 <= 100000,
        'soak_preflight_deadline'
    );
    async function sample(kind, phase, index, prepared) {
        const work =
            prepared ??
            resourceWorkload(kind, `${client.runId}:${phase}:${index}`);
        const result = await client.execute(work.code, work.lang);
        const item = {
            phase,
            index,
            ...validateResourceResult(work, kind, result),
        };
        client.receipt({ type: 'resource_sample', ...item });
        return item;
    }
    for (const [name, count, kind] of [
        ['cpu', 6, 'cpu'],
        ['memory', 4, 'memory'],
    ]) {
        const preparationBegan = monotonic();
        const prepared = Array.from({ length: count }, (_, i) =>
            resourceWorkload(kind, `${client.runId}:${name}:${i}`)
        );
        await pause(Math.max(0, waitMs - (monotonic() - preparationBegan)));
        const startedAt = client.now(),
            phaseBegan = monotonic();
        const samples = [];
        await client.parallel(
            Array.from({ length: count }, (_, i) => i),
            2,
            async i => samples.push(await sample(kind, name, i, prepared[i]))
        );
        check(
            !client.state.stopped && samples.length === count,
            'resource_phase_incomplete'
        );
        await pause(5000);
        client.receipt({
            type: 'resource_phase',
            name,
            offered: count,
            successful: samples.length,
            concurrency: 2,
            startedAt,
            endedAt: client.now(),
            durationMs: monotonic() - phaseBegan,
        });
    }
    const anchor = monotonic(),
        wallAnchor = client.now();
    check(anchor - began <= 100000, 'soak_anchor_deadline');
    const end = anchor + 600000;
    client.receipt({
        type: 'soak_start',
        startedAt: wallAnchor,
        durationMs: 600000,
        offered: 16,
        spacingMs: 37500,
    });
    for (let i = 0; i < 16; i++) {
        const due = anchor + i * 37500;
        await pause(Math.max(0, due - monotonic()));
        check(monotonic() - due <= 10000, 'soak_slot_missed');
        check(!client.state.stopped, 'admission_stopped');
        const kind = i % 2 ? 'node_memory' : 'cpu';
        const prepared = resourceWorkload(kind, `${client.runId}:soak:${i}`);
        check(monotonic() - due <= 10000, 'soak_slot_missed');
        await sample(kind, 'soak', i, prepared);
        check(monotonic() <= end, 'soak_response_overrun');
    }
    await pause(Math.max(0, end - monotonic()));
    // Admission checks do not prove health during the final observation-only interval.
    const finalBound = monotonic() + 10000;
    let finalGuard;
    while (monotonic() < finalBound) {
        finalGuard = await guardCheck(guardPath, client.runId, client.now());
        if (finalGuard.observedAt >= wallAnchor + 600000) break;
        await pause(1000);
    }
    check(
        finalGuard.observedAt >= wallAnchor + 600000 && !client.state.stopped,
        'final_observation_missing'
    );
    client.receipt({
        type: 'resource_phase',
        name: 'soak',
        offered: 16,
        successful: 16,
        concurrency: 1,
        startedAt: wallAnchor,
        endedAt: client.now(),
        durationMs: monotonic() - anchor,
    });
}

const SUSTAINED_SLOTS = 48;
const SUSTAINED_SPACING_MS = 10000;
const SUSTAINED_PLATEAU_MS = 480000;
const SUSTAINED_BOUNDARY_MS = 10000;
const SUSTAINED_KIND_CYCLE = Object.freeze([
    'cpu',
    'memory',
    'node_memory',
    'cpu',
]);

function sustainedWave(burst, slot) {
    const callers = slot % 2 === 0 ? ['a', 'b'] : ['b', 'a'];
    if (burst === 1)
        return [
            {
                caller: callers[0],
                position: 0,
                kind: SUSTAINED_KIND_CYCLE[Math.floor(slot / 2) % 4],
            },
        ];
    if (burst === 2)
        return callers.map(caller => ({
            caller,
            position: 0,
            kind: SUSTAINED_KIND_CYCLE[slot % 4],
        }));
    check(burst === 4, 'invalid_sustained_burst');
    return callers.flatMap(caller =>
        [0, 1].map(position => ({
            caller,
            position,
            kind: SUSTAINED_KIND_CYCLE[(2 * slot + position) % 4],
        }))
    );
}

function addAllocation(target, caller, kind) {
    target[caller] ??= { cpu: 0, memory: 0, node_memory: 0 };
    target[caller][kind]++;
}

async function sustained({
    client,
    token,
    comparisonToken,
    waitMs,
    began,
    monotonic,
    pause,
    guardPath,
}) {
    check(
        monotonic() - began + 31000 + 3 * 490000 <= 1620000,
        'sustained_preflight_deadline'
    );

    const preparationBegan = monotonic();
    const templates = Object.fromEntries(
        RESOURCE_KINDS.map(kind => {
            const seed = `${client.runId}:sustained:template:${kind}`;
            return [kind, { ...prepareResourceWorkload(kind, seed), seed }];
        })
    );
    await pause(Math.max(0, waitMs - (monotonic() - preparationBegan)));

    const suppliers = { a: token, b: comparisonToken };
    const reportFailure = (context, error) => {
        const detail =
            error instanceof QualificationError
                ? {
                      reason: error.reason,
                      ...(error.status ? { httpStatus: error.status } : {}),
                  }
                : { reason: 'unexpected_failure' };
        client.receipt({
            type: 'sustained_failure',
            ...context,
            ...detail,
        });
        client.fail(
            error instanceof QualificationError
                ? error
                : new QualificationError('unexpected_failure')
        );
    };

    for (const burst of [1, 2, 4]) {
        if (client.state.stopped) break;
        const phaseBegan = monotonic(),
            wallBegan = client.now(),
            end = phaseBegan + SUSTAINED_PLATEAU_MS;
        const outstanding = new Set();
        const activeByCaller = { a: 0, b: 0 };
        const samples = [];
        const scheduledAllocation = {
            a: { cpu: 0, memory: 0, node_memory: 0 },
            b: { cpu: 0, memory: 0, node_memory: 0 },
        };
        const successfulAllocation = {
            a: { cpu: 0, memory: 0, node_memory: 0 },
            b: { cpu: 0, memory: 0, node_memory: 0 },
        };
        const admittedByCaller = { a: 0, b: 0 };
        const successfulByCaller = { a: 0, b: 0 };
        const failedByCaller = { a: 0, b: 0 };
        let active = 0,
            offered = 0,
            admitted = 0,
            successful = 0,
            failed = 0,
            attemptedMs = 0;

        client.receipt({
            type: 'sustained_start',
            name: `${burst}x`,
            plateau: burst,
            offered: SUSTAINED_SLOTS * burst,
            concurrency: burst,
            startedAt: wallBegan,
            durationMs: SUSTAINED_PLATEAU_MS,
        });

        const context = (slot, item) => ({
            plateau: burst,
            slot,
            caller: item.caller,
            position: item.position,
            order: item.order,
            kind: item.kind,
        });
        try {
            for (let slot = 0; slot < SUSTAINED_SLOTS; slot++) {
                if (client.state.stopped) break;
                const due = phaseBegan + slot * SUSTAINED_SPACING_MS;
                await pause(Math.max(0, due - monotonic()));
                if (client.state.stopped) break;
                const wave = sustainedWave(burst, slot);
                wave.forEach((item, order) => {
                    item.order = order;
                });
                offered += wave.length;
                for (const item of wave)
                    addAllocation(scheduledAllocation, item.caller, item.kind);
                if (monotonic() - due > 1000) {
                    for (const item of wave)
                        reportFailure(
                            context(slot, item),
                            new QualificationError('sustained_slot_late')
                        );
                    break;
                }
                if (
                    active + wave.length > 4 ||
                    wave.some(
                        item =>
                            activeByCaller[item.caller] +
                                wave.filter(x => x.caller === item.caller)
                                    .length >
                            2
                    )
                ) {
                    for (const item of wave)
                        reportFailure(
                            context(slot, item),
                            new QualificationError('sustained_slot_blocked')
                        );
                    break;
                }

                for (const item of wave) {
                    const nonce = `${client.runId}:${burst}:${slot}:${item.caller}:${item.position}`;
                    const offeredAt = monotonic();
                    admitted++;
                    admittedByCaller[item.caller]++;
                    active++;
                    activeByCaller[item.caller]++;
                    const work = renderResourceWorkload(
                        templates[item.kind],
                        nonce
                    );
                    const task = client
                        .execute(work.code, work.lang, {
                            auth: suppliers[item.caller],
                            dispatchBy: due + 1000,
                        })
                        .then(async result => {
                            const measurement = validateResourceResult(
                                work,
                                item.kind,
                                result
                            );
                            const sample = {
                                plateau: burst,
                                slot,
                                caller: item.caller,
                                position: item.position,
                                order: item.order,
                                ...measurement,
                            };
                            samples.push(sample);
                            successful++;
                            successfulByCaller[item.caller]++;
                            addAllocation(
                                successfulAllocation,
                                item.caller,
                                item.kind
                            );
                            client.receipt({
                                type: 'sustained_sample',
                                ...sample,
                            });
                        })
                        .catch(error => {
                            failed++;
                            failedByCaller[item.caller]++;
                            reportFailure(context(slot, item), error);
                        })
                        .finally(() => {
                            attemptedMs += monotonic() - offeredAt;
                            active--;
                            activeByCaller[item.caller]--;
                            outstanding.delete(task);
                            if (monotonic() > end)
                                reportFailure(
                                    context(slot, item),
                                    new QualificationError(
                                        'sustained_response_overrun'
                                    )
                                );
                        });
                    outstanding.add(task);
                }
            }
            await Promise.all(outstanding);
        } finally {
            await Promise.all(outstanding);
        }

        if (!client.state.stopped) await pause(Math.max(0, end - monotonic()));
        const durationMs = monotonic() - phaseBegan;
        const perCaller = Object.fromEntries(
            ['a', 'b'].map(caller => {
                const callerSamples = samples.filter(
                    sample => sample.caller === caller
                );
                return [
                    caller,
                    {
                        offered: Object.values(
                            scheduledAllocation[caller]
                        ).reduce((sum, count) => sum + count, 0),
                        admitted: admittedByCaller[caller],
                        successful: successfulByCaller[caller],
                        failed: failedByCaller[caller],
                        allocation: scheduledAllocation[caller],
                        successfulAllocation: successfulAllocation[caller],
                        p50Ms: percentile(
                            callerSamples.map(x => x.durationMs),
                            0.5
                        ),
                        p95Ms: percentile(
                            callerSamples.map(x => x.durationMs),
                            0.95
                        ),
                        p99Ms: percentile(
                            callerSamples.map(x => x.durationMs),
                            0.99
                        ),
                    },
                ];
            })
        );
        client.receipt({
            type: 'sustained_phase',
            name: `${burst}x`,
            plateau: burst,
            slots: SUSTAINED_SLOTS,
            spacingMs: SUSTAINED_SPACING_MS,
            burstCeiling: burst,
            scheduledDurationMs: SUSTAINED_PLATEAU_MS,
            offered,
            admitted,
            successful,
            failed,
            startedAt: wallBegan,
            endedAt: client.now(),
            durationMs,
            achievedPerSecond:
                durationMs > 0 ? successful / (durationMs / 1000) : 0,
            occupancy: durationMs > 0 ? attemptedMs / durationMs : 0,
            p50Ms: percentile(
                samples.map(x => x.durationMs),
                0.5
            ),
            p95Ms: percentile(
                samples.map(x => x.durationMs),
                0.95
            ),
            p99Ms: percentile(
                samples.map(x => x.durationMs),
                0.99
            ),
            allocation: scheduledAllocation,
            successfulAllocation,
            perCaller,
        });

        if (client.state.stopped) break;
        const wallEnd = wallBegan + SUSTAINED_PLATEAU_MS;
        const boundaryEnd = monotonic() + SUSTAINED_BOUNDARY_MS;
        let boundary;
        while (monotonic() <= boundaryEnd) {
            try {
                boundary = await guardCheck(
                    guardPath,
                    client.runId,
                    client.now()
                );
                if (boundary.observedAt >= wallEnd) break;
            } catch {
                boundary = undefined;
            }
            const remaining = boundaryEnd - monotonic();
            if (remaining <= 0) break;
            await pause(Math.min(1000, remaining));
        }
        if (!boundary || boundary.observedAt < wallEnd) {
            reportFailure(
                { plateau: burst, boundary: true },
                new QualificationError('sustained_boundary_missing')
            );
            break;
        }
        client.receipt({ type: 'sustained_boundary', plateau: burst });
    }
}

export async function runQualification({
    baseUrl,
    token,
    comparisonToken,
    runId = randomUUID(),
    guardPath,
    receiptPath,
    mode = 'contract',
    waitMs = 31000,
    ...testing
} = {}) {
    check(
        ['contract', 'all', 'resources', 'sustained'].includes(mode),
        'invalid_mode'
    );
    check(
        mode !== 'sustained' ||
            (typeof token === 'function' &&
                typeof comparisonToken === 'function'),
        'sustained_suppliers_required'
    );
    check(
        (!testing.monotonic && !testing.pause) || testing.request,
        'test_clock_requires_transport'
    );
    const monotonic = testing.monotonic ?? (() => performance.now());
    const pause = testing.pause ?? delay;
    const began = monotonic();
    check(waitMs === 31000 || testing.request, 'invalid_rate_window');
    check(
        typeof receiptPath === 'string' && receiptPath.length > 0,
        'receipt_required'
    );
    const file = await open(receiptPath, 'wx', 0o600);
    let receiptFailed = false;
    const receipt = value => {
        if (receiptFailed) return;
        try {
            const bytes = Buffer.from(JSON.stringify(value) + '\n');
            let offset = 0;
            while (offset < bytes.length) {
                const written = writeSync(
                    file.fd,
                    bytes,
                    offset,
                    bytes.length - offset
                );
                if (written <= 0) throw new Error();
                offset += written;
            }
        } catch {
            receiptFailed = true;
        }
    };
    let client;
    const stopped = () => {
        if (client) {
            client.fail(new QualificationError('operator_stopped'));
        }
    };
    process.on('SIGINT', stopped);
    process.on('SIGTERM', stopped);
    process.on('SIGHUP', stopped);
    try {
        client = createClient({
            baseUrl,
            token,
            runId,
            guardPath,
            receipt,
            receiptHealthy: () => !receiptFailed,
            ...testing,
            envelope: mode === 'sustained' ? 'sustained' : 'bounded',
            monotonic,
        });
        receipt({ type: 'start', runId, mode });
        try {
            await contract(client, comparisonToken);
            if (mode === 'all') await load(client, waitMs);
            if (mode === 'resources')
                await resources(client, {
                    waitMs,
                    began,
                    monotonic,
                    pause,
                    guardPath,
                });
            if (mode === 'sustained')
                await sustained({
                    client,
                    token,
                    comparisonToken,
                    waitMs,
                    began,
                    monotonic,
                    pause,
                    guardPath,
                });
        } catch (error) {
            client.fail(error);
        }
        await client.cleanup();
        const summary = {
            type: 'summary',
            status:
                !client.state.failures.length &&
                !client.state.uncertain &&
                !receiptFailed
                    ? comparisonToken
                        ? 'passed'
                        : 'partial'
                    : 'failed',
            requests: client.state.requests,
            executions: client.state.executions,
            requestedGuestMs: client.state.guestMs,
            ownedObjects: client.state.owned.length,
            peakRequests: client.state.peak,
            cleanupUncertain: client.state.uncertain,
            receiptFailed,
            untested: comparisonToken ? [] : ['ownership_denial'],
            failures: client.state.failures,
        };
        receipt(summary);
        if (receiptFailed) {
            summary.status = 'failed';
            summary.receiptFailed = true;
        }
        return summary;
    } finally {
        process.removeListener('SIGINT', stopped);
        process.removeListener('SIGTERM', stopped);
        process.removeListener('SIGHUP', stopped);
        await file.close();
    }
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
) {
    const credential = process.env.CODEAPI_BEARER_TOKEN;
    const comparison = process.env.CODEAPI_COMPARISON_BEARER_TOKEN;
    delete process.env.CODEAPI_COMPARISON_BEARER_TOKEN;
    delete process.env.CODEAPI_BEARER_TOKEN;
    if (!process.argv.includes('--live') || process.env.CI || !credential) {
        process.stderr.write(
            'Explicit operator live mode and scoped authentication are required.\n'
        );
        process.exitCode = 2;
    } else {
        runQualification({
            baseUrl: process.env.CODEAPI_BASE_URL,
            token: () => credential,
            comparisonToken: comparison ? () => comparison : undefined,
            runId: process.env.CODEAPI_RUN_ID,
            guardPath: process.env.CODEAPI_GUARD,
            receiptPath: process.env.CODEAPI_RECEIPT,
            mode: process.argv.includes('--sustained')
                ? 'sustained'
                : process.argv.includes('--resources')
                ? 'resources'
                : process.argv.includes('--load')
                ? 'all'
                : 'contract',
        })
            .then(result => {
                process.stdout.write(
                    JSON.stringify({ status: result.status }) + '\n'
                );
                process.exitCode = result.status === 'passed' ? 0 : 1;
            })
            .catch(() => {
                process.stderr.write('Qualification setup failed.\n');
                process.exitCode = 2;
            });
    }
}
