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

test('power loss after the data barrier recovers pending batches with the old cursor', async () => {
  const snapshot = join(root, 'durable'), state = join(root, 'state');
  new Store(state).save('cursor', 0);
  const group = new GroupCommit(state, async () => { fs.cpSync(state, snapshot, { recursive: true }); }, 0), store = new Store(state, group);
  await store.send([row(1)]); store.save('cursor', 1); await group.flush();
  // Only what existed at syncfs is durable; emulate losing subsequent renames.
  fs.rmSync(state, { recursive: true }); fs.cpSync(snapshot, state, { recursive: true });
  expect(new Store(state).load('cursor', -1)).toBe(0);
  const recovered = new GroupCommit(state, async () => {}, 0); recovered.recover(); await recovered.flush();
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
  const group = new GroupCommit(root, async () => {}, 0); group.recover(); await group.flush();
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
