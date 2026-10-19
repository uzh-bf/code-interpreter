import { expect, test } from 'bun:test';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as semver from 'semver';
import { config } from './config';
import { Job } from './job';
import type { Runtime } from './runtime';
import { readCleanupResources } from './cleanup-metrics';
import { prepareWorkspaceRoot, sandboxJobUidPool } from './workspace-isolation';

// Run only in a dedicated Linux test container with /tmp mounted as tmpfs.
// The real-jail variant additionally needs the runner image's namespace/cgroup
// permissions, nsjail, spec-guard and NSJAIL_CONFIG. Never target a live runner.
const tmpfsEnabled = process.env.SANDBOX_CLEANUP_TMPFS_TEST === '1';
const nsjailEnabled = process.env.SANDBOX_CLEANUP_NSJAIL_TEST === '1';

function runtime(pkgdir: string): Runtime {
  return {
    language: 'bash',
    version: new semver.SemVer('5.2.0'),
    aliases: [],
    pkgdir,
    compiled: false,
    env_vars: {},
    timeouts: { compile: 1000, run: 1000 },
    cpu_times: { compile: 1000, run: 1000 },
    memory_limits: { compile: 128 * 1048576, run: 128 * 1048576 },
    max_process_count: 64,
    max_open_files: 64,
    max_file_size: 16 * 1048576,
    output_max_size: 4096,
  };
}

function jobFor(rt: Runtime, content: string): Job {
  return new Job({
    session_id: 'cleanup-stress',
    runtime: rt,
    files: [{ name: 'main.sh', content }],
    args: [],
    stdin: '',
    timeouts: rt.timeouts,
    cpu_times: rt.cpu_times,
    memory_limits: rt.memory_limits,
    is_synthetic: true,
  });
}

function workspace(job: Job): string {
  return (job as unknown as { submissionDir: string }).submissionDir;
}

function assertTmpfsBaseline(
  baseline: ReturnType<typeof readCleanupResources>
): void {
  const after = readCleanupResources();
  expect(after.tmp?.isTmpfs).toBe(true);
  // Allow a few metadata pages, not one retained 8 MiB payload per execution.
  expect(after.tmp!.bytes).toBeLessThanOrEqual(baseline.tmp!.bytes + 64 * 1024);
  expect(after.tmp!.inodes).toBeLessThanOrEqual(baseline.tmp!.inodes + 4);
  expect(after.workspaces).toEqual(baseline.workspaces);
}

test.skipIf(!tmpfsEnabled)(
  'repeated file-heavy Job cleanup returns tmpfs bytes and inodes near baseline',
  async () => {
    expect(process.platform).toBe('linux');
    await prepareWorkspaceRoot();
    const baseline = readCleanupResources();
    expect(baseline.tmp?.isTmpfs).toBe(true);
    const activeBefore = sandboxJobUidPool.activeCount();
    const payload = Buffer.alloc(8 * 1048576, 0x61);
    for (let iteration = 0; iteration < 24; iteration++) {
      const job = jobFor(runtime('/tmp'), 'echo test');
      let dir = '';
      try {
        await job.prime();
        dir = workspace(job);
        await fsp.writeFile(path.join(dir, 'payload'), payload);
        for (let i = 0; i < 64; i++)
          await fsp.writeFile(path.join(dir, `small-${i}`), 'x');
        expect(readCleanupResources().tmp!.bytes).toBeGreaterThan(
          baseline.tmp!.bytes + payload.length
        );
      } finally {
        await job.cleanup();
      }
      expect(fs.existsSync(dir)).toBe(false);
      expect(sandboxJobUidPool.activeCount()).toBe(activeBefore);
      assertTmpfsBaseline(baseline);
    }
  },
  30_000
);

function processesForUid(uid: number): string[] {
  return fs.readdirSync('/proc').filter(pid => {
    if (!/^\d+$/.test(pid)) return false;
    try {
      return (
        fs
          .readFileSync(`/proc/${pid}/status`, 'utf8')
          .match(/^Uid:\s+(\d+)/m)?.[1] === String(uid)
      );
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code === 'ENOENT' ||
        (error as NodeJS.ErrnoException).code === 'ESRCH'
      )
        return false;
      throw error;
    }
  });
}

test.skipIf(!nsjailEnabled)(
  'real NsJail releases detached descendants and file-heavy workspaces on success, timeout and overflow',
  async () => {
    expect(process.platform).toBe('linux');
    expect(config.per_job_uids).toBe(true);
    expect(process.getuid?.()).toBe(0);
    await prepareWorkspaceRoot();
    const pkgdir = await fsp.mkdtemp(
      path.join(os.tmpdir(), 'cleanup-runtime-')
    );
    await fsp.chmod(pkgdir, 0o755);
    await fsp.writeFile(path.join(pkgdir, 'run'), 'exec /bin/bash "$@"\n', {
      mode: 0o644,
    });
    const baseline = readCleanupResources();
    expect(baseline.tmp?.isTmpfs).toBe(true);
    const activeBefore = sandboxJobUidPool.activeCount();
    try {
      for (let iteration = 0; iteration < 12; iteration++) {
        const ending = iteration % 3;
        const job = jobFor(
          runtime(pkgdir),
          `set -eu
# Both linked workspace data and an unlinked open file held by a detached child.
dd if=/dev/zero of=payload bs=1048576 count=8 status=none
# Per-jail /tmp is a different mount from the runner's /tmp.
dd if=/dev/zero of=/tmp/held bs=1048576 count=8 status=none
exec 3</tmp/held
rm /tmp/held
setsid /bin/sh -c 'echo ready > /mnt/data/child-ready; exec sleep 30' >/dev/null 2>&1 &
while [ ! -f child-ready ]; do sleep 0.01; done
${
  ending === 0
    ? 'echo complete'
    : ending === 1
    ? 'sleep 30'
    : "while :; do printf '%1024s' x; done"
}
`
        );
        let dir = '';
        let uid = -1;
        try {
          await job.prime();
          dir = workspace(job);
          uid = (job as unknown as { jobIdentity: { uid: number } }).jobIdentity
            .uid;
          const result = await job.execute();
          expect(result.run?.status).toBe(
            ending === 0 ? null : ending === 1 ? 'TO' : 'OL'
          );
          if (ending === 0) expect(result.run?.stdout).toContain('complete');
          // Check before workspace removal can conceal a surviving writer.
          expect(processesForUid(uid)).toEqual([]);
        } finally {
          await job.cleanup();
        }
        expect(fs.existsSync(dir)).toBe(false);
        expect(sandboxJobUidPool.activeCount()).toBe(activeBefore);
        assertTmpfsBaseline(baseline);
      }
    } finally {
      await fsp.rm(pkgdir, { recursive: true, force: true });
    }
  },
  60_000
);


test.skipIf(!nsjailEnabled)(
  'caller cancellation joins direct and broker-wrapped guests including detached descendants before UID release',
  async () => {
    await prepareWorkspaceRoot();
    const pkgdir = await fsp.mkdtemp(path.join(os.tmpdir(), 'cancel-runtime-'));
    await fsp.chmod(pkgdir, 0o755);
    await fsp.writeFile(path.join(pkgdir, 'run'), 'exec /bin/bash "$@"\n', { mode: 0o644 });
    const activeBefore = sandboxJobUidPool.activeCount();
    const oldPort = config.allowed_local_network_port;
    const oldTarget = process.env.SANDBOX_FORWARD_TARGET;
    config.allowed_local_network_port = 3190;
    process.env.SANDBOX_FORWARD_TARGET = 'http://127.0.0.1:1';
    try {
      for (const pipes of [false, true]) {
        const rt = runtime(pkgdir);
        rt.timeouts.run = 10_000;
        const controller = new AbortController();
        const job = new Job({
          runtime: rt, session_id: 'cancel-owned-guest',
          files: [{ name: 'main.sh', content: `set -eu
setsid /bin/sh -c 'echo started > /mnt/data/child-ready; sleep 3; echo late > /mnt/data/late-output' >/dev/null 2>&1 &
while [ ! -f child-ready ]; do sleep 0.01; done
sleep 8
` }], args: [], stdin: '', timeouts: rt.timeouts, cpu_times: rt.cpu_times,
          memory_limits: rt.memory_limits, is_synthetic: true, tool_call_socket_enabled: pipes,
        });
        let uid = -1;
        try {
          await job.prime(controller.signal);
          const dir = workspace(job);
          uid = (job as unknown as { jobIdentity: { uid: number } }).jobIdentity.uid;
          const executing = job.execute(controller.signal);
          void executing.catch(() => undefined);
          for (let attempt = 0; !fs.existsSync(path.join(dir, 'child-ready')); attempt++) {
            if (attempt >= 200) throw new Error('Guest did not reach correlated start marker');
            await Promise.race([new Promise(resolve => setTimeout(resolve, 10)), executing.then(result => { throw new Error('Guest ended before cancellation: ' + JSON.stringify(result.run)); })]);
          }
          expect(processesForUid(uid).length).toBeGreaterThan(0);
          controller.abort(new DOMException('test caller disconnected', 'AbortError'));
          await expect(executing).rejects.toMatchObject({ name: 'AbortError' });
          expect(processesForUid(uid)).toEqual([]);
          expect(fs.existsSync(path.join(dir, 'late-output'))).toBe(false);
          expect(sandboxJobUidPool.activeCount()).toBe(activeBefore + 1);
        } finally { await job.cleanup(); }
        expect(sandboxJobUidPool.activeCount()).toBe(activeBefore);
        expect(processesForUid(uid)).toEqual([]);
        const followup = new Job({
          runtime: rt, session_id: 'cancel-owned-guest-recovery',
          files: [{ name: 'main.sh', content: 'printf recovered' }], args: [], stdin: '',
          timeouts: rt.timeouts, cpu_times: rt.cpu_times, memory_limits: rt.memory_limits,
          is_synthetic: true, tool_call_socket_enabled: pipes,
        });
        try {
          await followup.prime();
          const result = await followup.execute();
          expect(result.run?.code).toBe(0);
          expect(result.run?.stdout).toBe('recovered');
        } finally { await followup.cleanup(); }
        expect(sandboxJobUidPool.activeCount()).toBe(activeBefore);
      }
    } finally {
      config.allowed_local_network_port = oldPort;
      if (oldTarget === undefined) delete process.env.SANDBOX_FORWARD_TARGET;
      else process.env.SANDBOX_FORWARD_TARGET = oldTarget;
      await fsp.rm(pkgdir, { recursive: true, force: true });
    }
  }, 30_000,
);
