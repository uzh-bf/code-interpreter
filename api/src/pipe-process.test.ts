import { describe, test, expect } from 'bun:test';
import { EventEmitter, once } from 'node:events';
import { pipeline } from 'node:stream/promises';
import { PassThrough, Readable } from 'node:stream';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as vm from 'node:vm';
import { spawnPipeProcess, toolCallPipes } from './pipe-process';

async function collect(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

describe('anonymous process pipes', () => {
  test('large concurrent streams preserve backpressure and output before close', async () => {
    const bytes = Buffer.alloc(2 * 1024 * 1024, 'p');
    await Promise.all(Array.from({ length: 8 }, async () => {
      const child = spawnPipeProcess('/bin/sh', ['-c', 'cat; printf stderr >&2']);
      const closed = once(child, 'close');
      const output = collect(child.stdout);
      const errors = collect(child.stderr);
      await pipeline(Readable.from([bytes]), child.stdin);
      const [code] = await closed;
      expect(code).toBe(0);
      expect(await output).toEqual(bytes);
      expect((await errors).toString()).toBe('stderr');
    }));
  }, 15000);

  test.skipIf(process.platform !== 'linux')('Linux children receive FIFO stdin, stdout and stderr', async () => {
    const child = spawnPipeProcess('/bin/sh', ['-c', 'test -p /proc/self/fd/0 && test -p /proc/self/fd/1 && test -p /proc/self/fd/2']);
    child.stdin.end();
    const [code] = await once(child, 'close');
    if (process.platform === 'linux') expect(code).toBe(0);
  });

  test('cancellation releases a blocked stdin writer', async () => {
    const child = spawnPipeProcess('/bin/sleep', ['30']);
    const closed = once(child, 'close');
    const writing = pipeline(Readable.from([Buffer.alloc(2 * 1024 * 1024)]), child.stdin);
    // Observe immediately: cancellation may reject before the exit listener.
    const rejected = writing.then(() => false, () => true);
    await new Promise(resolve => setTimeout(resolve, 20));
    child.kill('SIGKILL');
    await closed;
    expect(await rejected).toBe(true);
    expect(child.stdin.destroyed).toBe(true);
  }, 5000);

  test('spawn failures and killed children release every pipe', async () => {
    const ownedPipes = new Set<string>();
    const addon = process.platform === 'linux'
      ? require(process.env.SANDBOX_PIPE_ADDON || path.resolve(__dirname, '..', '.build', 'anonymous-pipes.node')) : undefined;
    const create = addon?.createPipe;
    if (addon) addon.createPipe = () => {
      const fds = create();
      for (const fd of fds) ownedPipes.add(fs.readlinkSync(`/proc/self/fd/${fd}`));
      return fds;
    };
    try {
      for (let n = 0; n < 12; n++) {
        const missing = spawnPipeProcess('/missing-codeapi-executable');
        const missingClosed = new Promise<void>(resolve => missing.once('close', () => resolve()));
        const error = await new Promise<NodeJS.ErrnoException>(resolve => missing.once('error', resolve));
        expect(error.code).toBe('ENOENT');
        await missingClosed;
        const child = spawnPipeProcess('/bin/sleep', ['30']);
        const closed = once(child, 'close');
        child.kill('SIGKILL');
        await closed;
        expect(child.stdin.destroyed).toBe(true);
        expect(child.stdout.destroyed).toBe(true);
        expect(child.stderr.destroyed).toBe(true);
      }
    } finally {
      if (addon) addon.createPipe = create;
    }
    if (process.platform === 'linux') {
      // Runtime watcher/pid descriptors can appear asynchronously. Assert the
      // exact pipe inodes we allocated, including duplicates held by FileSink.
      const survivors = () => fs.readdirSync('/proc/self/fd').flatMap(fd => {
        try { const inode = fs.readlinkSync(`/proc/self/fd/${fd}`); return ownedPipes.has(inode) ? [inode] : []; }
        catch { return []; }
      });
      // Bun releases internal duplicates asynchronously after wrapper close.
      const deadline = performance.now() + 1000;
      let pending = survivors();
      while (pending.length > 0 && performance.now() < deadline) {
        await new Promise<void>(resolve => setImmediate(resolve));
        pending = survivors();
      }
      expect(pending).toEqual([]);
    }
  }, 10000);
});

const bridge = process.env.TCS_PIPE_BRIDGE || '/usr/local/bin/tool-call-pipe-bridge';
const nativeAvailable = process.platform === 'linux' && fs.existsSync(bridge);

async function until(check: () => boolean): Promise<void> {
  const deadline = Date.now() + 3000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('Synthetic process did not reach its synchronization point');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

test.skipIf(!nativeAvailable)('pending TERM across either side of native fork is forwarded once and reaped', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-fork-'));
  const executable = path.join(tmp, 'bridge');
  const source = path.join(tmp, 'fork-test.c');
  fs.writeFileSync(source, `#define _GNU_SOURCE
#include <unistd.h>
#include <signal.h>
static pid_t controlled_fork(void);
static int observed_kill(pid_t pid, int sig);
#define fork controlled_fork
#define kill observed_kill
#define main relay_main
#include ${JSON.stringify(path.resolve(__dirname, 'tool-call-pipe-bridge.c'))}
#undef main
#undef fork
#undef kill
static int forwarded;
static pid_t controlled_fork(void) {
    if (strcmp(getenv("FORK_WINDOW"), "before") == 0) raise(SIGTERM);
    pid_t pid = fork();
    if (pid > 0) {
        printf("%ld\\n", (long)pid); fflush(stdout);
        if (strcmp(getenv("FORK_WINDOW"), "after") == 0) raise(SIGTERM);
    }
    return pid;
}
static int observed_kill(pid_t pid, int sig) {
    forwarded++;
    raise(SIGTERM);
    return kill(pid, sig);
}
int main(int argc, char **argv) {
    int result = relay_main(argc, argv);
    fprintf(stderr, "%d\\n", forwarded);
    return result;
}
`);
  try {
    const compiler = spawnPipeProcess('gcc', ['-O2', '-Wall', '-Wextra', '-Werror', '-o', executable, source]);
    compiler.stdin.end();
    const [compiled, compilerOutput, compilerErrors] = await Promise.all([
      once(compiler, 'close'), collect(compiler.stdout), collect(compiler.stderr),
    ]);
    expect(compiled[0], Buffer.concat([compilerOutput, compilerErrors]).toString()).toBe(0);
    for (const window of ['before', 'after']) {
      const pipes = toolCallPipes();
      const relay = spawnPipeProcess(executable, ['--job-pipes', '/bin/sleep', '30'], {
        stdio: ['ignore', 'pipe', 'pipe', ...pipes.child],
        env: { ...process.env, FORK_WINDOW: window },
      });
      const closed = once(relay, 'close');
      const output = collect(relay.stdout);
      const errors = collect(relay.stderr);
      pipes.closeChild();
      pipes.reader.resume();
      try {
        const [code] = await closed;
        const pid = Number((await output).toString().trim());
        expect(Number.isSafeInteger(pid) && pid > 0).toBe(true);
        expect(code).toBe(143);
        expect((await errors).toString().trim()).toBe('1');
        expect(fs.existsSync(`/proc/${pid}`)).toBe(false);
      } finally {
        if (relay.exitCode === null && relay.signalCode === null) relay.kill('SIGKILL');
        await closed;
        pipes.reader.destroy(); pipes.writer.destroy();
      }
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}, 10_000);

test.skipIf(!nativeAvailable)('broker startup owns cancellation before spawn and during child assignment', async () => {
  const built = await Bun.build({ entrypoints: [path.resolve(__dirname, 'tool-call-pipe-broker.ts')], target: 'node', format: 'cjs' });
  expect(built.success).toBe(true);
  const source = await built.outputs[0].text();
  for (const phase of ['before-spawn', 'during-assignment', 'spawn-failure']) {
    const signals = Object.assign(new EventEmitter(), {
      platform: 'linux', argv: ['node', 'broker', '/bin/sleep', '30'],
      env: { SANDBOX_FORWARD_TARGET: 'http://127.0.0.1:1' }, exitCode: undefined as number | undefined,
    });
    let spawned = 0;
    let nextFd = 10;
    const allocated = new Set<number>();
    const pairs: number[][] = [];
    const child = Object.assign(new EventEmitter(), {
      pid: 1234, exitCode: null, signalCode: null,
      kill: (signal: string) => { expect(signal).toBe('SIGTERM'); terminated++; return true; },
    });
    let terminated = 0;
    const module = { exports: {} };
    const requireMock = Object.assign((name: string) => {
      if (name === 'node:fs') return { closeSync: (fd: number) => allocated.delete(fd) };
      if (name === 'node:net') return { Socket: PassThrough };
      if (name === 'node:child_process') return { spawn: () => {
        spawned++;
        if (phase === 'spawn-failure') throw new Error('synthetic spawn failure');
        signals.emit('SIGTERM');
        return child;
      } };
      if (name.endsWith('anonymous-pipes.node')) return { createPipe: () => {
        if (phase === 'before-spawn') signals.emit('SIGTERM');
        const fds = [nextFd++, nextFd++];
        pairs.push(fds);
        fds.forEach(fd => allocated.add(fd));
        return fds;
      } };
      return require(name);
    }, { main: module });
    const run = () => vm.runInNewContext(source, {
      require: requireMock, module, process: signals, __dirname, Buffer, URL, setTimeout, clearTimeout,
    });
    if (phase === 'spawn-failure') expect(run).toThrow('synthetic spawn failure');
    else {
      run();
      signals.emit('SIGTERM'); signals.emit('SIGINT');
      expect(spawned).toBe(phase === 'before-spawn' ? 0 : 1);
      expect(terminated).toBe(phase === 'before-spawn' ? 0 : 1);
      expect(signals.exitCode).toBeUndefined();
      if (spawned) {
        child.emit('exit', 143, null); child.emit('close', 143, null);
        await new Promise(resolve => setImmediate(resolve));
        expect(signals.exitCode).toBe(143);
      }
    }
    await new Promise(resolve => setImmediate(resolve));
    // The mock streams do not own real descriptors. The child-side copies
    // must still be closed by the production startup finally block.
    for (const fd of [pairs[0][1], pairs[1][0]]) expect(allocated.has(fd)).toBe(false);
  }
});

test.skipIf(!nativeAvailable)('TERM before broker handlers are installed leaves startup childless', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'broker-pre-handler-'));
  const bundle = path.join(tmp, 'broker.cjs');
  const preload = path.join(tmp, 'pause.cjs');
  const marker = path.join(tmp, 'guest-started');
  const built = await Bun.build({ entrypoints: [path.resolve(__dirname, 'tool-call-pipe-broker.ts')], target: 'node', format: 'cjs' });
  expect(built.success).toBe(true);
  fs.writeFileSync(bundle, await built.outputs[0].text());
  fs.writeFileSync(preload, "require('node:fs').writeSync(1, 'paused\\n'); process.kill(process.pid, 'SIGSTOP');");
  const child = spawnPipeProcess('node', ['--require', preload, bundle, '/bin/sh', '-c', `echo started > ${marker}`], {
    env: { ...process.env, SANDBOX_FORWARD_TARGET: 'http://127.0.0.1:1', TCS_PIPE_BRIDGE: bridge },
  });
  const closed = once(child, 'close');
  const output = collect(child.stdout);
  const errors = collect(child.stderr);
  child.stdin.end();
  try {
    await until(() => /^State:\s+T/m.test(fs.readFileSync(`/proc/${child.pid}/status`, 'utf8')));
    child.kill('SIGTERM'); child.kill('SIGCONT');
    const [code, signal] = await closed;
    expect(code === 143 || signal === 'SIGTERM').toBe(true);
    expect((await output).toString()).toBe('paused\n');
    expect((await errors).length).toBe(0);
    expect(fs.existsSync(marker)).toBe(false);
  } finally {
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGCONT'); child.kill('SIGKILL'); }
    await closed;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}, 10_000);
