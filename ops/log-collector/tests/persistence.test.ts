import { test, expect, beforeEach, afterEach } from 'bun:test';
import * as os from 'node:os';
import { fs, join, Store, event, iso } from '../core';
import { GroupCommit } from '../persistence';

let root: string;
beforeEach(() => { root = fs.mkdtempSync(join(os.tmpdir(), 'collector-commit-')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
const row = (n: number) => event({ host: 'fixture' }, String(n), 'app', 'event-' + n, iso());
const disk = () => new Store(root);

test('one barrier commits many sources and coalesces their checkpoints', async () => {
  let calls = 0;
  const group = new GroupCommit(root, async () => { calls++; }, 0), sources = Array.from({ length: 8 }, () => new Store(root, group));
  for (let n = 0; n < 100; n++) { await sources[n % 8].send([row(n)]); sources[n % 8].save('cursor-' + n % 8, n); }
  expect(disk().queuedNames('live', 1000)).toHaveLength(0);
  expect(disk().load('cursor-0', -1)).toBe(-1);
  await group.flush();
  expect(calls).toBe(1); expect(disk().queuedNames('live', 1000)).toHaveLength(100);
  expect(disk().load('cursor-0', -1)).toBe(96);
});

test('queue listing returns bounded pages so large backlogs need no full scan', () => {
  const queue = disk().path('queue/live'); fs.mkdirSync(queue, { recursive: true });
  for (let index = 0; index < 250; index++) {
    const name = String(index).padStart(20, '0') + '-batch.json';
    fs.writeFileSync(join(queue, name), JSON.stringify({ events: [row(index)] }));
  }
  fs.writeFileSync(join(queue, 'unfinished.pending'), '{}');
  const first = disk().queuedNames('live', 40);
  expect(first).toHaveLength(40); expect(first).toEqual([...first].sort());
  first.forEach(path => fs.rmSync(path));
  const second = disk().queuedNames('live', 40);
  expect(second).toHaveLength(40); expect(second.some(path => first.includes(path))).toBe(false);
});

test('fresh live batches take priority over the legacy live backlog', () => {
  const store = disk(), legacy = store.path('queue/live'), current = store.path('queue/live/current');
  fs.mkdirSync(legacy, { recursive: true }); fs.mkdirSync(current, { recursive: true });
  fs.writeFileSync(join(legacy, '01790000000000000000-old.json'), JSON.stringify({ events: [row(1)] }));
  fs.writeFileSync(join(current, '01791000000000000000-new.json'), JSON.stringify({ events: [row(2)] }));
  expect(store.queuedNames('live', 1)[0]).toBe(join(current, '01791000000000000000-new.json'));
  expect(store.queuedBatches('history')).toEqual([]);
  fs.rmSync(join(current, '01791000000000000000-new.json'));
  expect(store.queuedNames('live', 1)[0]).toBe(join(legacy, '01790000000000000000-old.json'));
});

test('updates received during a barrier cannot publish a newer unsafe cursor', async () => {
  let release!: () => void;
  const gate = new Promise<void>(ok => release = ok);
  const group = new GroupCommit(root, () => gate, 0), store = new Store(root, group);
  await store.send([row(1)]); store.save('cursor', 1);
  const flush = group.flush();
  await store.send([row(2)]); store.save('cursor', 2);
  release(); await flush;
  expect(disk().load('cursor', 0)).toBe(1); expect(store.load('cursor', 0)).toBe(2);
  expect(disk().queuedNames('live', 100)).toHaveLength(1);
  await group.flush(); expect(disk().load('cursor', 0)).toBe(2); expect(disk().queuedNames('live', 100)).toHaveLength(2);
});

test('failed persistence does not publish batches or advance durable cursors', async () => {
  disk().save('cursor', 0);
  const group = new GroupCommit(root, async () => { throw new Error('disk full'); }, 0), store = new Store(root, group);
  await store.send([row(1)]); store.save('cursor', 1);
  await expect(group.flush()).rejects.toThrow('disk full');
  expect(disk().load('cursor', -1)).toBe(0); expect(disk().queuedNames('live', 100)).toHaveLength(0);
});

test('a transient persistence barrier failure preserves queued batches and checkpoints for retry', async () => {
  let calls = 0;
  const group = new GroupCommit(root, async () => { if (++calls === 1) throw new Error('transient sync failure'); }, 0);
  const store = new Store(root, group); store.queueBatch([row(4)], 'live'); store.save('cursor', 4);
  await expect(group.flush()).rejects.toThrow('transient sync failure');
  expect(disk().queuedNames('live', 100)).toHaveLength(0); expect(disk().load('cursor', -1)).toBe(-1);
  await group.flush();
  expect(disk().queuedNames('live', 100)).toHaveLength(1); expect(disk().load('cursor', -1)).toBe(4);
});

test('the persistence timer retries after a failed filesystem barrier', async () => {
  let calls = 0, failures = 0;
  const group = new GroupCommit(root, async () => { if (++calls === 1) throw new Error('transient sync failure'); }, 5);
  new Store(root, group).queueBatch([row(5)], 'live');
  group.start(() => { failures++; });
  const deadline = Date.now() + 1000;
  while (group.flushes === 0 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  await group.close();
  expect(failures).toBe(1); expect(calls).toBeGreaterThanOrEqual(2);
  expect(disk().queuedNames('live', 100)).toHaveLength(1);
});

test('a partial queue rename failure keeps the remaining batches and cursor pending for retry', async () => {
  let renames = 0;
  const rename = (from: string, to: string) => {
    if (++renames === 2) throw Object.assign(new Error('directory update failed'), { code: 'ENOSPC' });
    fs.renameSync(from, to);
  };
  const group = new GroupCommit(root, async () => {}, 0, rename), store = new Store(root, group);
  store.queueBatch([row(6)], 'live'); store.queueBatch([row(7)], 'live'); store.save('cursor', 7);
  const barrier = store.durable(); let acknowledged = false; void barrier.then(() => { acknowledged = true; });
  await expect(group.flush()).rejects.toThrow('queue publication failed (ENOSPC)');
  expect(acknowledged).toBe(false); expect(disk().load('cursor', -1)).toBe(-1);
  await group.flush(); await barrier;
  expect(disk().queuedNames('live', 100)).toHaveLength(2); expect(disk().load('cursor', -1)).toBe(7);
});

test('power loss after the data barrier recovers pending batches with the old cursor', async () => {
  const snapshot = join(root, 'durable'), state = join(root, 'state');
  new Store(state).save('cursor', 0);
  const group = new GroupCommit(state, async () => { fs.cpSync(state, snapshot, { recursive: true }); }, 0), store = new Store(state, group);
  await store.send([row(1)]); store.save('cursor', 1); await group.flush();
  // Only what existed at syncfs is durable; emulate losing subsequent renames.
  fs.rmSync(state, { recursive: true }); fs.cpSync(snapshot, state, { recursive: true });
  expect(new Store(state).load('cursor', -1)).toBe(0);
  const recovered = new GroupCommit(state, async () => {}, 0); await recovered.recover(); await recovered.flush();
  const paths = new Store(state).queuedNames('live', 100);
  expect(paths).toHaveLength(1); expect(JSON.parse(fs.readFileSync(paths[0], 'utf8')).events[0].sourceEventId).toBe(row(1).sourceEventId);
});

test('power loss after checkpoint persistence retains its dependent batch', async () => {
  const snapshot = join(root, 'durable'), state = join(root, 'state'); let calls = 0;
  const group = new GroupCommit(state, async () => { if (++calls === 2) fs.cpSync(state, snapshot, { recursive: true }); }, 0), store = new Store(state, group);
  await store.send([row(2)]); store.save('cursor', 2); await group.flush(); await group.flush();
  fs.rmSync(state, { recursive: true }); fs.cpSync(snapshot, state, { recursive: true });
  expect(new Store(state).load('cursor', -1)).toBe(2); expect(new Store(state).queuedNames('live', 100)).toHaveLength(1);
});

test('partial unpublished batch is quarantined and leaves its cursor replayable', async () => {
  const state = new Store(root); state.save('cursor', 0);
  fs.mkdirSync(state.path('queue/live'), { recursive: true }); fs.writeFileSync(state.path('queue/live/torn.pending'), '{"events":[');
  const group = new GroupCommit(root, async () => {}, 0); await group.recover(); await group.flush();
  expect(fs.existsSync(state.path('queue/live/torn.pending.interrupted'))).toBe(true);
  expect(state.load('cursor', -1)).toBe(0); expect(state.queuedNames('live', 100)).toHaveLength(0);
});

test('external acknowledgements wait for the barrier covering prior batches', async () => {
  const group = new GroupCommit(root, async () => {}, 0), store = new Store(root, group); let acknowledged = false;
  await store.send([row(1)]); const ack = store.durable().then(() => acknowledged = true);
  await Promise.resolve(); expect(acknowledged).toBe(false);
  await group.flush(); await ack; expect(acknowledged).toBe(true); expect(disk().queuedNames('live', 100)).toHaveLength(1);
});

test('barriers remain rate limited even when shutdown requests another flush', async () => {
  const times: number[] = [], group = new GroupCommit(root, async () => { times.push(performance.now()); }, 50);
  group.dirty(); await group.flush(); group.dirty(); await group.close();
  expect(times).toHaveLength(2); expect(times[1] - times[0]).toBeGreaterThanOrEqual(45);
});
