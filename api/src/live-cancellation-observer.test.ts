import { expect, spyOn, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { LiveCancellationObserver, observeLifecycleCase, scanGuestUid, type LifecycleKernel, type LifecycleRecord } from './live-cancellation-observer';
import { config } from './config';
import type { LifecycleCaseRegistration, VerifiedLifecycleBinding } from '../../shared/live-cancellation-registration';

const registration: LifecycleCaseRegistration = {
  case_id: 'synthetic_case_123456789', program_sha256: 'a'.repeat(64),
  output_basename: 'late.csv', horizon_ms: 30000, expires_at_ms: 1_700_000_900_000,
};
const context: VerifiedLifecycleBinding = { execution_id: 'synthetic_exec_123456789', binding: {
  case_id: registration.case_id, program_sha256: registration.program_sha256, output_session_id: 'synthetic_output_123456789',
} };
const identity = { uid: 200000, gid: 200000, slot: 0, perJobUid: true };

test('disabled observation performs no diagnostic I/O or request inspection', () => {
  const previous = config.e2e_lifecycle_case;
  config.e2e_lifecycle_case = undefined;
  const open = spyOn(fs, 'openSync').mockImplementation(() => { throw new Error('unexpected I/O'); });
  const list = spyOn(fs, 'readdirSync').mockImplementation(() => { throw new Error('unexpected I/O'); });
  try {
    const input = new Proxy({} as Parameters<typeof observeLifecycleCase>[0], {
      get() { throw new Error('unexpected request inspection'); },
    });
    expect(observeLifecycleCase(input)).toBeUndefined();
    expect(open).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  } finally {
    open.mockRestore();
    list.mockRestore();
    config.e2e_lifecycle_case = previous;
  }
});

function fixture() {
  let clock = { epoch: 1_700_000_000_000, mono: 100 };
  let leased = true;
  let processes = 1;
  let absent = true;
  let quiescent = true;
  let dropped = false;
  const records: LifecycleRecord[] = [];
  const kernel: LifecycleKernel = {
    bind: () => ({ group: '/synthetic', inode: 1, device: 1, root: {} as any, supervisor: {} as any }),
    quiescent: () => { if (!quiescent) throw new Error('uncertain'); },
    processes: () => processes,
    outputAbsent: () => absent,
  };
  const observer = new LiveCancellationObserver(registration, context, identity, {
    now: () => clock,
    isLeased: () => leased,
    sink: { write: event => records.push(event), failed: () => dropped },
    kernel,
  });
  const marker = Buffer.from(`CODEAPI_E2E_START:${registration.case_id}:1700000000.000000\n`);
  return {
    observer, records, marker,
    set: (values: { processes?: number; absent?: boolean; quiescent?: boolean; leased?: boolean; dropped?: boolean; clock?: typeof clock }) => {
      processes = values.processes ?? processes;
      absent = values.absent ?? absent;
      quiescent = values.quiescent ?? quiescent;
      leased = values.leased ?? leased;
      dropped = values.dropped ?? dropped;
      clock = values.clock ?? clock;
    },
  };
}

function cancel(f: ReturnType<typeof fixture>) {
  f.observer.stderr(f.marker, 123);
  f.observer.beforeAbort();
  f.observer.signalAccepted(true);
  f.set({ processes: 0 });
  f.observer.executionSettled(true, null);
}

test('split marker, actual cancellation, absence and matched release form one ordered receipt', () => {
  const f = fixture();
  f.observer.stderr(f.marker.subarray(0, 7), 123);
  expect(f.records.map(r => r.event)).toEqual(['selected']);
  f.observer.stderr(f.marker.subarray(7), 123);
  f.observer.beforeAbort();
  f.observer.signalAccepted(true);
  f.set({ processes: 0 });
  f.observer.executionSettled(true, null);
  f.observer.beforeCleanup({ dir: '/synthetic', workspaceId: 'test', identity });
  f.set({ leased: false });
  f.observer.released(true, false);
  expect(f.records.map(r => r.event)).toEqual(['selected', 'started', 'cancel_requested', 'terminal', 'released']);
  expect(f.records.map(r => r.sequence)).toEqual([1, 2, 3, 4, 5]);
  expect(f.records[f.records.length - 1]?.lease_released).toBe(true);
  expect(f.records.find(r => r.event === 'terminal')).toMatchObject({ sandbox_processes_remaining: 0, output_root_absent: true });
  expect(f.records.every(r => Buffer.byteLength(JSON.stringify(r)) < 1024)).toBe(true);
});

test('overflow, missing/invalid markers and kernel uncertainty never report terminal success', () => {
  for (const mode of ['overflow', 'missing', 'invalid', 'kernel'] as const) {
    const f = fixture();
    if (mode === 'overflow') f.observer.stderr(Buffer.alloc(513), 123);
    if (mode === 'invalid') f.observer.stderr(Buffer.from('unrelated\n'), 123);
    if (mode === 'kernel') { cancel(f); f.set({ quiescent: false }); }
    f.observer.beforeAbort();
    f.observer.beforeCleanup({ dir: '/synthetic', workspaceId: 'test', identity });
    f.observer.released(true, false);
    expect(f.records.some(r => r.event === 'observation_failed')).toBe(true);
    expect(f.records.some(r => r.event === 'terminal' || r.event === 'released')).toBe(false);
  }
});

test('surviving zombie, late file, changed lease and failed signal each prevent release acceptance', () => {
  for (const mode of ['zombie', 'file', 'lease', 'signal', 'normal', 'timeout', 'release'] as const) {
    const f = fixture();
    cancel(f);
    if (mode === 'zombie') f.set({ processes: 1 });
    if (mode === 'file') f.set({ absent: false });
    if (mode === 'lease') f.set({ leased: false });
    if (mode === 'signal') f.observer.signalAccepted(false);
    if (mode === 'normal') f.observer.executionSettled(false, null);
    if (mode === 'timeout') f.observer.executionSettled(true, 'TO');
    f.observer.beforeCleanup({ dir: '/synthetic', workspaceId: 'test', identity });
    f.observer.released(mode !== 'release', false);
    expect(f.records.some(r => r.event === 'released')).toBe(false);
    expect(f.records.some(r => r.event === 'observation_failed')).toBe(true);
  }
});

test('clock jump, expired observation and dropped export cannot report successful release', () => {
  for (const mode of ['clock', 'expired', 'drop'] as const) {
    const f = fixture();
    cancel(f);
    if (mode === 'clock') f.set({ clock: { epoch: 1_700_000_010_000, mono: 100 } });
    if (mode === 'expired') f.set({ clock: { epoch: registration.expires_at_ms, mono: 900100 } });
    if (mode === 'drop') f.set({ dropped: true });
    f.observer.beforeCleanup({ dir: '/synthetic', workspaceId: 'test', identity });
    f.observer.released(true, false);
    expect(f.records.some(r => r.event === 'released')).toBe(false);
  }
});

function processEntry(root: string, pid: string, uid: number, state = 'S') {
  fs.mkdirSync(path.join(root, pid));
  fs.writeFileSync(path.join(root, pid, 'status'), `Uid:\t${uid}\t${uid}\t${uid}\t${uid}\nPPid:\t1\n`);
  const fields = [state, ...Array(18).fill('0'), '1234'];
  fs.writeFileSync(path.join(root, pid, 'stat'), `${pid} (synthetic) ${fields.join(' ')}`);
}

test('complete UID scan includes zombies and rejects overflow, unreadable entries and deadlines', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lifecycle-proc-'));
  try {
    processEntry(root, '123', identity.uid, 'Z');
    processEntry(root, '124', identity.uid + 1);
    expect(scanGuestUid(identity.uid, { procRoot: root }).map(p => p.state)).toEqual(['Z']);
    expect(() => scanGuestUid(identity.uid, { procRoot: root, maxEntries: 1 })).toThrow();
    let time = 0;
    expect(() => scanGuestUid(identity.uid, { procRoot: root, now: () => time += 100, deadlineMs: 1 })).toThrow();
    fs.unlinkSync(path.join(root, '124/status'));
    expect(() => scanGuestUid(identity.uid, { procRoot: root })).toThrow();
  } finally { fs.rmSync(root, { recursive: true }); }
});

test('PID reuse during a UID scan is uncertainty rather than absence', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lifecycle-reuse-'));
  processEntry(root, '123', identity.uid);
  const read = fs.readSync;
  let changed = false;
  const hook = spyOn(fs, 'readSync').mockImplementation(((...args: Parameters<typeof fs.readSync>) => {
    const count = (read as (...values: any[]) => number)(...args);
    const buffer = args[1];
    if (!changed && Buffer.isBuffer(buffer) && buffer.subarray(0, count).toString().startsWith('123 (synthetic)')) {
      changed = true;
      const stat = path.join(root, '123/stat');
      fs.writeFileSync(stat, fs.readFileSync(stat, 'utf8').replace(/1234$/, '5678'));
    }
    return count;
  }) as typeof fs.readSync);
  try {
    expect(() => scanGuestUid(identity.uid, { procRoot: root })).toThrow();
    expect(changed).toBe(true);
  } finally {
    hook.mockRestore();
    fs.rmSync(root, { recursive: true });
  }
});
