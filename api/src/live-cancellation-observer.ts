import * as fs from 'node:fs';
import pino from 'pino';
import { config } from './config';
import {
  LifecycleCaseRegistry,
  inlineProgramSha256,
  validLifecycleBinding,
  type LifecycleCaseRegistration,
  type VerifiedLifecycleBinding,
} from '../../shared/live-cancellation-registration';
import { sandboxJobUidPool, type SandboxJobIdentity, type SandboxWorkspaceLease } from './workspace-isolation';

export const LIFECYCLE_DIAGNOSTIC = 'codeapi-lifecycle-v1';
const MAX_RECORDS = 16;
const MAX_BYTES = 16 * 1024;
const MAX_MARKER_BYTES = 512;
const PROCESS_LIMIT = 8192;
const PROCESS_DEADLINE_MS = 250;
const ID = /^[A-Za-z0-9_-]{16,64}$/;

type Failure = 'expired' | 'clock_changed' | 'marker_invalid' | 'marker_missing'
  | 'kernel_unavailable' | 'lease_changed' | 'signal_failed' | 'not_cancelled'
  | 'termination_stalled' | 'processes_remain' | 'output_present'
  | 'cleanup_deferred' | 'release_unacknowledged' | 'export_failed';
type Event = 'selected' | 'started' | 'cancel_requested' | 'terminal' | 'released' | 'observation_failed';

export interface LifecycleRecord {
  diagnostic: typeof LIFECYCLE_DIAGNOSTIC;
  sequence: number;
  case_id: string;
  execution_id: string;
  output_session_id: string;
  event: Event;
  guest_epoch_ms: number;
  guest_monotonic_ms: number;
  process_started_epoch_ms: number;
  horizon_ms: number;
  start_epoch_lower_ms?: number;
  start_epoch_upper_ms?: number;
  sandbox_processes_remaining?: number;
  output_root_absent?: boolean;
  lease_released?: boolean;
  reason?: Failure;
}

export interface LifecycleSink {
  write(record: LifecycleRecord): void;
  failed(): boolean;
}

/** Separate from normal logging: only this closed diagnostic schema reaches it. */
export function createLifecycleSink(fd = 1): LifecycleSink {
  let failed = false;
  let count = 0;
  let bytes = 0;
  const destination = pino.destination({
    fd, sync: false, minLength: 0, maxLength: 15 * 1024, maxWrite: 1024,
  });
  destination.on('drop', () => { failed = true; });
  destination.on('error', () => { failed = true; });
  const logger = pino({
    base: null,
    timestamp: false,
    formatters: { level: () => ({ diagnostic: LIFECYCLE_DIAGNOSTIC }) },
  }, destination);
  return {
    failed: () => failed,
    write(record) {
      if (failed) return;
      const size = Buffer.byteLength(JSON.stringify(record)) + 1;
      if (++count > MAX_RECORDS || size > 1024 || bytes + size > MAX_BYTES) {
        failed = true;
        return;
      }
      bytes += size;
      // The fixed prefix is supplied by Pino's nonempty level formatter.
      const { diagnostic: _diagnostic, ...fields } = record;
      try { logger.info(fields); } catch { failed = true; }
    },
  };
}

function fail(): never { throw new Error('Lifecycle observation unavailable'); }
function errno(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}
function readText(file: string, maxBytes = 8192): string {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const buffer = Buffer.alloc(maxBytes + 1);
    let bytes = 0;
    for (;;) {
      const count = fs.readSync(fd, buffer, bytes, buffer.length - bytes, null);
      bytes += count;
      if (bytes > maxBytes) fail();
      if (!count) return buffer.subarray(0, bytes).toString('utf8');
    }
  } finally { fs.closeSync(fd); }
}

export interface GuestProcess {
  pid: string;
  parent: string;
  generation: string;
  state: string;
  uid: number;
}

export function readGuestProcess(pid: string, procRoot = '/proc'): GuestProcess {
  if (!/^\d+$/.test(pid)) fail();
  const status = readText(`${procRoot}/${pid}/status`);
  const stat = readText(`${procRoot}/${pid}/stat`);
  const fields = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/);
  const uids = status.match(/^Uid:\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/m);
  const parent = status.match(/^PPid:\s+(\d+)$/m)?.[1];
  if (!uids || !parent || !/^\d+$/.test(fields[19] ?? '') || !/^[A-Z]$/.test(fields[0] ?? '')) fail();
  if (uids.slice(1).some(uid => uid !== uids[1])) fail();
  return { pid, parent, generation: fields[19], state: fields[0], uid: Number(uids[1]) };
}

/** A vanished or unreadable entry is uncertainty, never a successful empty scan. */
export function scanGuestUid(
  uid: number,
  options: { procRoot?: string; maxEntries?: number; now?: () => number; deadlineMs?: number } = {},
): GuestProcess[] {
  const root = options.procRoot ?? '/proc';
  const now = options.now ?? (() => performance.now());
  const deadline = now() + Math.min(options.deadlineMs ?? PROCESS_DEADLINE_MS, PROCESS_DEADLINE_MS);
  const entries = fs.readdirSync(root).filter(name => /^\d+$/.test(name));
  if (entries.length > Math.min(options.maxEntries ?? PROCESS_LIMIT, PROCESS_LIMIT)) fail();
  const found: GuestProcess[] = [];
  for (const pid of entries) {
    if (now() > deadline) fail();
    // Discard other identities without retaining their process metadata.
    const status = readText(`${root}/${pid}/status`);
    const uids = status.match(/^Uid:\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/m);
    if (!uids) fail();
    if (!uids.slice(1).some(value => Number(value) === uid)) continue;
    const before = readGuestProcess(pid, root);
    const after = readGuestProcess(pid, root);
    if (before.generation !== after.generation || before.uid !== uid || after.uid !== uid) fail();
    found.push(after);
  }
  if (now() > deadline) fail();
  return found;
}

interface KernelBinding {
  group: string;
  inode: number;
  device: number;
  root: GuestProcess;
  supervisor: GuestProcess;
}

export interface LifecycleKernel {
  bind(supervisorPid: number, identity: SandboxJobIdentity): KernelBinding;
  quiescent(binding: KernelBinding): void;
  processes(identity: SandboxJobIdentity): number;
  outputAbsent(workspace: SandboxWorkspaceLease, basename: string): boolean;
}

const guestKernel: LifecycleKernel = {
  bind(ownedPid, identity) {
    const processes = scanGuestUid(identity.uid);
    if (processes.length === 0) fail();
    const membership = readText(`/proc/${processes[0].pid}/cgroup`, 1024).trim();
    const rootPid = membership.match(/^0::\/NSJAIL\.(\d+)$/)?.[1];
    if (!rootPid) fail();
    const root = readGuestProcess(rootPid);
    if (root.uid !== identity.uid || root.state === 'Z') fail();
    const mapping = readText(`/proc/${rootPid}/uid_map`, 1024).trim().split(/\s+/);
    if (mapping.join() !== ['65534', String(identity.uid), '1'].join()) fail();
    if (processes.some(proc => readText(`/proc/${proc.pid}/cgroup`, 1024).trim() !== membership)) fail();
    const status = readText(`/proc/${rootPid}/status`);
    // No usable cgroup mount, capabilities or privilege-gaining exec in the jail.
    if (!/^CapEff:\s+0+$/m.test(status) || !/^NoNewPrivs:\s+1$/m.test(status)) fail();
    if (/ - cgroup2? /m.test(readText(`/proc/${rootPid}/mountinfo`, 65536))) fail();
    const fds = fs.readdirSync(`/proc/${rootPid}/fd`);
    if (fds.length > 64) fail();
    for (const fd of fds) {
      if (fs.readlinkSync(`/proc/${rootPid}/fd/${fd}`).includes('/sys/fs/cgroup')) fail();
    }
    const supervisor = readGuestProcess(root.parent);
    if (!fs.readlinkSync(`/proc/${supervisor.pid}/exe`).endsWith('/nsjail')) fail();
    let ancestor = supervisor;
    for (let depth = 0; ancestor.pid !== String(ownedPid); depth++) {
      if (depth >= 4 || ancestor.parent === '0' || ancestor.parent === '1') fail();
      ancestor = readGuestProcess(ancestor.parent);
    }
    const group = `/sys/fs/cgroup/NSJAIL.${rootPid}`;
    const stat = fs.statSync(group);
    if (!/^populated 1$/m.test(readText(`${group}/cgroup.events`, 1024))) fail();
    const after = readGuestProcess(rootPid);
    if (after.generation !== root.generation || after.uid !== identity.uid) fail();
    return { group, inode: stat.ino, device: stat.dev, root, supervisor };
  },
  quiescent(binding) {
    // The exact previously populated supervisor must have settled first.
    try {
      if (readGuestProcess(binding.supervisor.pid).generation === binding.supervisor.generation) fail();
    } catch (error) {
      if (errno(error) !== 'ENOENT' && errno(error) !== 'ESRCH') throw error;
    }
    let stat: fs.Stats;
    try {
      stat = fs.statSync(binding.group);
    } catch (error) {
      if (errno(error) !== 'ENOENT') throw error;
      return;
    }
    if (stat.ino !== binding.inode || stat.dev !== binding.device) fail();
    if (!/^populated 0$/m.test(readText(`${binding.group}/cgroup.events`, 1024))) fail();
  },
  processes: identity => scanGuestUid(identity.uid).length,
  outputAbsent(workspace, basename) {
    const fd = fs.openSync(workspace.dir, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    try {
      const anchor = fs.fstatSync(fd);
      if (!anchor.isDirectory() || anchor.uid !== workspace.identity.uid) fail();
      try {
        fs.lstatSync(`/proc/self/fd/${fd}/${basename}`);
        return false;
      } catch (error) {
        if (errno(error) !== 'ENOENT') throw error;
        const after = fs.fstatSync(fd);
        if (after.ino !== anchor.ino || after.dev !== anchor.dev) fail();
        return true;
      }
    } finally { fs.closeSync(fd); }
  },
};

const registry = new LifecycleCaseRegistry(config.e2e_lifecycle_case);

export function observeLifecycleCase(args: {
  binding?: VerifiedLifecycleBinding;
  identity: SandboxJobIdentity;
  files: unknown;
  language: string;
  compiled: boolean;
  stateful: boolean;
}): LiveCancellationObserver | undefined {
  if (!config.e2e_lifecycle_case || !args.binding || args.stateful || args.compiled
    || args.language !== 'bash' || !args.identity.perJobUid || !config.use_cgroupv2) return;
  if (!ID.test(args.binding.execution_id) || !validLifecycleBinding(args.binding.binding)
    || !sandboxJobUidPool.isActive(args.identity)) return;
  const digest = inlineProgramSha256(args.files);
  if (!digest || digest !== args.binding.binding.program_sha256) return;
  const registration = registry.claim(digest, args.binding.binding.case_id);
  if (!registration) return;
  try {
    return new LiveCancellationObserver(registration, args.binding, args.identity, {
      sink: createLifecycleSink(),
      isLeased: () => sandboxJobUidPool.isActive(args.identity),
    });
  } catch { return; }
}

export class LiveCancellationObserver {
  private sequence = 0;
  private failed = false;
  private marker = Buffer.alloc(0);
  private started = false;
  private cancelRequested = false;
  private signalled = false;
  private settled = false;
  private terminal = false;
  private binding?: KernelBinding;
  private readonly epoch: number;
  private readonly mono: number;
  private readonly kernel: LifecycleKernel;
  private readonly now: () => { epoch: number; mono: number };

  constructor(
    private readonly registration: LifecycleCaseRegistration,
    private readonly context: VerifiedLifecycleBinding,
    private readonly identity: SandboxJobIdentity,
    private readonly options: {
      sink: LifecycleSink;
      isLeased: () => boolean;
      kernel?: LifecycleKernel;
      now?: () => { epoch: number; mono: number };
    },
  ) {
    this.kernel = options.kernel ?? guestKernel;
    this.now = options.now ?? (() => ({ epoch: Date.now(), mono: performance.now() }));
    const clock = this.now();
    this.epoch = clock.epoch;
    this.mono = clock.mono;
    this.emit('selected');
  }

  private emit(event: Event, fields: Partial<LifecycleRecord> = {}): void {
    if (this.failed && event !== 'observation_failed') return;
    const clock = this.now();
    if (!Number.isFinite(clock.epoch) || !Number.isFinite(clock.mono)
      || Math.abs((clock.epoch - this.epoch) - (clock.mono - this.mono)) > 25
      || clock.epoch >= this.registration.expires_at_ms || this.options.sink.failed()) {
      this.failed = true;
      return;
    }
    // Call sites use closed fields, never arbitrary logger metadata.
    this.options.sink.write({
      diagnostic: LIFECYCLE_DIAGNOSTIC,
      sequence: ++this.sequence,
      case_id: this.registration.case_id,
      execution_id: this.context.execution_id,
      output_session_id: this.context.binding.output_session_id,
      event,
      guest_epoch_ms: clock.epoch,
      guest_monotonic_ms: clock.mono,
      process_started_epoch_ms: Math.floor(this.epoch - this.mono),
      horizon_ms: this.registration.horizon_ms,
      ...fields,
    });
  }

  reject(reason: Failure): void {
    if (this.failed) return;
    this.failed = true;
    try { this.emit('observation_failed', { reason }); } catch { /* observe only */ }
  }

  stderr(chunk: Buffer, supervisorPid: number | undefined): void {
    if (this.failed || this.started) return;
    try {
      const end = chunk.indexOf(10);
      const prefix = end < 0 ? chunk : chunk.subarray(0, end + 1);
      if (this.marker.length + prefix.length > MAX_MARKER_BYTES) return this.reject('marker_invalid');
      this.marker = Buffer.concat([this.marker, prefix]);
      if (end < 0) return;
      const expected = `CODEAPI_E2E_START:${this.registration.case_id}:`;
      const line = this.marker.toString('ascii');
      const rawTime = line.startsWith(expected) ? line.slice(expected.length).trimEnd() : '';
      if (!/^\d{10}\.[0-9]{1,6}$/.test(rawTime) || supervisorPid == null || !this.options.isLeased()) {
        return this.reject('marker_invalid');
      }
      const time = Number(rawTime) * 1000;
      const received = this.now().epoch;
      if (!Number.isFinite(time) || time < this.epoch || time > received + 1) return this.reject('marker_invalid');
      this.binding = this.kernel.bind(supervisorPid, this.identity);
      this.started = true;
      this.marker = Buffer.alloc(0);
      this.emit('started', { start_epoch_lower_ms: Math.floor(time), start_epoch_upper_ms: received });
    } catch { this.reject('kernel_unavailable'); }
  }

  beforeAbort(): void {
    if (this.failed) return;
    try {
      if (!this.started || !this.binding || !this.options.isLeased()) return this.reject('marker_missing');
      this.cancelRequested = true;
      this.emit('cancel_requested');
    } catch { this.reject('kernel_unavailable'); }
  }

  signalAccepted(accepted: boolean): void {
    if (!accepted) return this.reject('signal_failed');
    this.signalled = true;
  }

  executionSettled(cancelled: boolean, status: string | null): void {
    if (this.failed) return;
    if (!cancelled || !this.cancelRequested || !this.signalled || status !== null) return this.reject('not_cancelled');
    this.settled = true;
  }

  beforeCleanup(workspace: SandboxWorkspaceLease): void {
    if (this.failed) return;
    try {
      if (!this.settled || !this.binding) return this.reject('not_cancelled');
      if (workspace.identity !== this.identity || !this.options.isLeased()) return this.reject('lease_changed');
      this.kernel.quiescent(this.binding);
      if (this.kernel.processes(this.identity) !== 0) return this.reject('processes_remain');
      this.kernel.quiescent(this.binding);
      if (!this.options.isLeased()) return this.reject('lease_changed');
      if (!this.kernel.outputAbsent(workspace, this.registration.output_basename)) return this.reject('output_present');
      this.terminal = true;
      this.emit('terminal', { sandbox_processes_remaining: 0, output_root_absent: true });
    } catch { this.reject('kernel_unavailable'); }
  }

  released(wasActive: boolean, isActive: boolean): void {
    if (this.failed) return;
    try {
      if (!this.terminal || !wasActive || isActive) return this.reject('release_unacknowledged');
      this.emit('released', { lease_released: true });
    } catch { this.reject('export_failed'); }
  }
}
