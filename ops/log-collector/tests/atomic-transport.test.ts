import { afterEach, beforeEach, expect, test } from 'bun:test';
import * as http from 'node:http';
import { tmpdir } from 'node:os';
import { fs, join, Store, Delivery, event, iso, type AtomicEventGroup, type LogEvent } from '../core';

let root: string, store: Store;
beforeEach(() => { root = fs.mkdtempSync(join(tmpdir(), 'atomic-collector-')); store = new Store(root); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
const sample = (id: string, timestamp = iso()) => event({ host: 'fixture' }, id, 'fixture', 'observed event', timestamp);
const group = (): AtomicEventGroup => ({ atomic: true, events: Array.from({ length: 4 }, (_, i) => sample('member-' + i)) });
const queued = (lane = 'live') => store.queuedNames(lane, 1000).map(path => ({ path, ...JSON.parse(fs.readFileSync(path, 'utf8')) }));

test('a slow producer cannot split a completed group at the elapsed flush boundary', async () => {
  const completed = group(), before = sample('before'), after = sample('after');
  async function* input() {
    yield before;
    await new Promise(resolve => setTimeout(resolve, 120));
    yield completed;
    yield after;
  }
  await store.send(input());
  const files = queued(), atomic = files.filter(file => file.atomic);
  expect(atomic).toHaveLength(1);
  expect(atomic[0].events).toEqual(completed.events);
  expect(files.flatMap(file => file.events).map((item: LogEvent) => item.sourceEventId).sort())
    .toEqual([before, ...completed.events, after].map(item => item.sourceEventId).sort());
  while (store.queuedNames('live', 1).length) {
    const paths = store.queuedBatches('live');
    if (paths.some(path => JSON.parse(fs.readFileSync(path, 'utf8')).atomic)) expect(paths).toEqual([atomic[0].path]);
    for (const path of paths) fs.unlinkSync(path);
  }
});

test('groups respect count and byte limits and oversized groups preserve every original', async () => {
  const completed = group();
  await store.send([...Array.from({ length: 99 }, (_, i) => sample('prefix-' + i)), completed]);
  expect(queued().find(file => file.atomic)?.events).toEqual(completed.events);
  const oversized = Array.from({ length: 101 }, (_, i) => sample('oversized-' + i));
  await store.send([{ atomic: true, events: oversized }]);
  const large = [sample('large-1'), sample('large-2')].map(item => ({ ...item, message: 'x'.repeat(140000) }));
  await store.send([{ atomic: true, events: large }]);
  const files = queued(), all = files.flatMap(file => file.events);
  for (const item of [...oversized, ...large]) expect(all).toContainEqual(item);
  for (const file of files) {
    expect(file.events.length).toBeLessThanOrEqual(100);
    expect(fs.statSync(file.path).size).toBeLessThan(512000);
  }
  expect(files.filter(file => file.atomic)).toHaveLength(1);
});

test('a group crossing the live/history threshold stays together', async () => {
  const completed = group(); completed.events[0].timestamp = iso(Date.now() / 1000 - 61);
  await store.send([completed]);
  expect(queued('history')).toEqual([]);
  expect(queued()[0].events).toEqual(completed.events);
});

test('atomic delivery preserves previously acknowledged members and retries the entire group', async () => {
  const requests: LogEvent[][] = []; let fail = false;
  const server = http.createServer((request, response) => {
    let body = '';
    request.on('data', chunk => body += chunk);
    request.on('end', () => {
      const rows = JSON.parse(body).events; requests.push(rows);
      response.writeHead(201, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: true, accepted: rows.length - (fail ? 1 : 0) }));
    });
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address() as { port: number };
  const delivery = new Delivery({ host: 'fixture', url: `http://127.0.0.1:${address.port}/ingest`, token: 'synthetic-test' });
  try {
    const completed = group();
    await store.send([completed.events[1]]); await delivery.deliver(store.queuedBatches('live'));
    await store.send([completed]); await delivery.deliver(store.queuedBatches('live'));
    expect(requests[1]).toEqual(completed.events);
    await store.send([completed]); const paths = store.queuedBatches('live'); fail = true;
    await expect(delivery.deliver(paths)).rejects.toThrow('acknowledgement');
    expect(paths.every(path => fs.existsSync(path))).toBe(true);
    fail = false; await delivery.deliver(paths);
    expect(requests[2]).toEqual(completed.events);
    expect(requests[3]).toEqual(completed.events);
    expect(store.queuedNames('live', 1)).toEqual([]);
  } finally { delivery.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
