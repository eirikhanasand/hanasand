import { test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import * as os from 'node:os';
import * as http from 'node:http';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { fs, join, Store, Delivery, DeliveryError, Commands, CommandError, CollectionError, Config, LogEvent, iso, sha, scrub, scrubArguments, scrubMetadata, boundedMetadata, event, recordLines, MAX_RECORD_BYTES, seconds } from '../core';
import { Sources, parseAudit, dockerEvent, dockerCliStream, localAuditDate, auditEvents } from '../sources';
import { guestExport, guestAck, jsonEvents } from '../guests';
import { configure, retention, releaseReady } from '../configuration';
let root: string, store: Store, source: Sources;
const config: Config = { host: 'fixture', start: '2026-09-19T00:00:00Z', token: 'synthetic-test-token' };
beforeEach(() => { root = fs.mkdtempSync(join(os.tmpdir(), 'collector-test-')); store = new Store(join(root, 'state')); source = new Sources(store); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
async function* lines(text: string) { for (const line of text.match(/[^\n]*\n|[^\n]+$/g) || []) yield line; }
async function array<T>(iterable: AsyncIterable<T>) { const result: T[] = []; for await (const item of iterable) result.push(item); return result; }
function queued(lane = 'history') { return store.queuedNames(lane, 1000).flatMap(path => JSON.parse(fs.readFileSync(path, 'utf8')).events) as LogEvent[]; }
function capture() { const events: LogEvent[] = []; store.send = async items => { for await (const item of items) events.push(...('atomic' in item ? item.events : [item])); }; return events; }
const audit = (id = 456, args = 'argc=1 a0="whoami"') => `type=SYSCALL msg=audit(1789817000.123:${id}): success=yes pid=123 ppid=100 uid=1000 auid=1000 exe="/usr/bin/whoami"\ntype=EXECVE msg=audit(1789817000.123:${id}): ${args}\n`;
const logLine = (message: string, second = 1, stream = 'stdout') => Buffer.from(JSON.stringify({ log: message + '\n', time: `2026-09-19T00:00:${String(second).padStart(2, '0')}.1Z`, stream }) + '\n');
function logFixture() { const path = join(root, 'container-json.log'); return { name: 'cdn', path, since: config.start! }; }

test('audit identity, process attributes, split and hex arguments preserve Python format', () => {
  const row = parseAudit(audit(), config)[0];
  expect(row.sourceEventId).toBe(sha('fixture:audit:msg=audit(1789817000.123:456)'));
  expect(row.timestamp).toBe('2026-09-19T11:23:20.123000+00:00');
  expect(row.metadata.process).toEqual({ executable: '/usr/bin/whoami', command_line: 'whoami', arguments: ['whoami'], pid: '123', parent_pid: '100' });
  const split = parseAudit(audit(457, 'argc=4 a0="curl" a1="--password" a2="private phrase" a3[0]="https://example.test/" a3[1]=73616d706c65'), config)[0];
  expect((split.metadata.process as any).arguments).toEqual(['curl', '--password', '[REDACTED]', 'https://example.test/sample']);
  expect(JSON.stringify(split)).not.toContain('private');
  expect(parseAudit('random whoami text', config)).toEqual([]);
});
for (const text of ['token: Bearer synthetic-private', 'curl --client-secret-key synthetic-private https://example.test', 'curl --header "Cookie: sid=synthetic-private; session=synthetic-private" https://example.test', 'curl -u "user:synthetic-private" https://example.test', 'sshpass -p synthetic-private ssh example.test', 'mysql -p synthetic-private', 'redis-cli -a synthetic-private', 'DB_PASSWORD="synthetic-private phrase"', 'curl -uuser:synthetic-private https://example.test', 'mysql -psynthetic-private', 'curl https://user:synthetic-private@example.test']) {
  test('redacts credential syntax: ' + text.split('synthetic')[0], () => expect(scrub(text)).not.toContain('synthetic-private'));
}
test('argument redaction preserves unrelated flags and nested metadata', () => {
  expect(scrubArguments(['mkdir', '-p', '/etc/cron.d'])).toEqual(['mkdir', '-p', '/etc/cron.d']);
  expect(scrub('ssh -p 222 example.test')).toBe('ssh -p 222 example.test');
  expect(scrubArguments(['curl', '--user=user:private'])).toEqual(['curl', '--user=[REDACTED]']);
  expect(JSON.stringify(scrubMetadata({ process: { arguments: ['curl', '-u', 'private'] }, authorization: 'private' }))).not.toContain('private');
  expect(scrub('curl -H "Cookie: sid=private; session=private" https://example.test')).toBe('curl -H "Cookie: [REDACTED]" https://example.test');
});
test('oversized Unicode metadata stays within ingestion limit and retains process evidence', () => {
  const row = event(config, 'large', 'app', '🔥'.repeat(65536), iso(), { process: { executable: '/usr/bin/whoami', arguments: ['whoami'] }, structured: { huge: 'x'.repeat(2000000) } });
  expect(Buffer.byteLength(JSON.stringify(row))).toBeLessThan(512000); expect(row.metadata.telemetry_truncated).toBe(true);
  expect((row.metadata.process as any).arguments).toEqual(['whoami']);
});
test('configuration retains start and writes protected credentials without printing', () => {
  const path = join(root, 'config.json'), credential = join(root, 'credential.json'); fs.writeFileSync(path, JSON.stringify({ start: config.start })); fs.writeFileSync(credential, JSON.stringify({ LOG_INGEST_TOKEN: 'synthetic-credential-value-long-enough' }));
  configure('ovhcloud', credential, path); const result = JSON.parse(fs.readFileSync(path, 'utf8'));
  expect(result.start).toBe(config.start); expect(result.url).toBe('https://api.hanasand.com/api/logs/ingest'); expect(fs.statSync(path).mode & 0o777).toBe(0o600);
});
test('audit date uses local C locale and microsecond cutoffs remain distinct', () => {
  expect(localAuditDate(1789822896)[0]).toBe('09/19/26'); expect(seconds('2026-09-19T00:00:00.123456Z')).toBeGreaterThan(seconds('2026-09-19T00:00:00.123000Z'));
});
test('stream groups only one audit event at a time', async () => expect((await array(auditEvents(lines(audit(1) + audit(2)), config))).map(e => e.sourceEventId)).toEqual(parseAudit(audit(1) + audit(2), config).map(e => e.sourceEventId)));
test('record reader preserves Unicode split across chunks and rejects oversized records', async () => {
  async function* chunks() { const bytes = Buffer.from('🔥\nsecond\n'); for (const byte of bytes) yield Buffer.from([byte]); }
  expect(await array(recordLines(chunks()))).toEqual(['🔥\n', 'second\n']);
  async function* large() { for (let n = 0; n < 130; n++) yield Buffer.alloc(65536, 65); }
  await expect(array(recordLines(large()))).rejects.toThrow('8MB');
});
test('command failure and timeout retain bounded, secret-free errors', async () => {
  const commands = new Commands(store);
  await expect(commands.run([process.execPath, '-e', 'process.stderr.write("secret");process.exit(1)'])).rejects.toThrow('Command collection failed');
  await expect(commands.run([process.execPath, '-e', 'setTimeout(()=>{},10000)'], { timeout: 0.02 })).rejects.toThrow();
  expect(fs.readdirSync(store.path('capture'))).toEqual([]);
  await expect(commands.run(['/nonexistent/collector-test-command'])).rejects.toThrow();
});
test('journal rotation retries saved timestamp and only commits after durable queue', async () => {
  store.save('journal.json', { cursor: 'expired', since: config.start }); const calls: string[][] = [];
  source.commands.stream = async function* (args) { calls.push(args); if (calls.length === 1) throw new CommandError(1); yield JSON.stringify({ __CURSOR: 'next', __REALTIME_TIMESTAMP: '1789817000123456', MESSAGE: 'ready' }) + '\n'; };
  await source.journal(config); expect(calls[1].slice(-2)).toEqual(['--since', config.start!]);
  expect(store.load<unknown>('journal.json', null)).toEqual({ cursor: 'next', since: '2026-09-19T11:23:20.123456+00:00' }); expect(queued()).toHaveLength(1);
  store.send = async () => { throw new Error('disk full'); }; await expect(source.journal(config)).rejects.toThrow('disk full'); expect(store.load<any>('journal.json', {}).cursor).toBe('next');
});
test('audit failure leaves stable checkpoint; rotation recovery and empty windows advance safely', async () => {
  fs.writeFileSync(store.path('audit.checkpoint'), 'original');
  const calls: string[][] = [];
  source.commands.stream = async function* (args) { calls.push(args); fs.writeFileSync(store.path('audit.pending'), 'next'); if (calls.length === 1) throw new CommandError(12); yield audit(); };
  store.send = async () => { throw new Error('disk full'); };
  await expect(source.audit(config)).rejects.toThrow(); expect(fs.readFileSync(store.path('audit.checkpoint'), 'utf8')).toBe('original');
  store.send = Store.prototype.send.bind(store); await source.audit(config); expect(calls.at(-1)!.slice(-2)).toEqual(['--start', 'checkpoint']); expect(fs.readFileSync(store.path('audit.checkpoint'), 'utf8')).toBe('next');
  expect(store.load<number>('audit-window.json', 0)).toBe(seconds(config.start!) + 60);
});
test('live audit has a separate checkpoint and bounded recent query', async () => {
  fs.writeFileSync(store.path('audit.checkpoint'), 'history'); let args: string[] = [];
  source.commands.stream = async function* (command) { args = command; fs.writeFileSync(store.path('audit-live.pending'), 'live'); yield audit(); };
  await source.audit(config, true); expect(args).toContain('--start'); expect(fs.readFileSync(store.path('audit.checkpoint'), 'utf8')).toBe('history'); expect(fs.readFileSync(store.path('audit-live.checkpoint'), 'utf8')).toBe('live');
});

test('Docker file IDs match CLI; levels and multiline contents survive', async () => {
  const log = logFixture(); fs.writeFileSync(log.path, Buffer.concat([logLine('first\nsecond'), logLine('{"level":50,"message":"failed"}', 2, 'stderr')])); const events = capture(); await source.dockerFileBatch(config, 'id', log);
  const cli = await array(dockerCliStream(config, 'id', 'cdn', lines('2026-09-19T00:00:01.100000000Z first\nsecond\n')));
  expect(events[0].sourceEventId).toBe(cli[0].sourceEventId); expect(events[1].level).toBe('error'); expect(events[1].metadata.stream).toBe('stderr'); expect(store.load<any>('docker-file-history-id.json', {}).offset).toBe(fs.statSync(log.path).size);
});
for (const [raw, expected] of [[' ERROR ', 'error'], ['WARNING', 'warn'], ['CRITICAL', 'fatal'], ['INFO', 'info'], [50, 'error'], [30, 'info']] as const) test('Docker level ' + raw, () => expect(dockerEvent(config, 'id', 'app', iso(), JSON.stringify({ level: raw, message: 'mentions error' })).level).toBe(expected));
test('partial record waits; rotation finishes old inode first', async () => {
  const log = logFixture(), second = logLine('second', 2), events = capture(); fs.writeFileSync(log.path, Buffer.concat([logLine('first'), second.subarray(0, -4)])); await source.dockerFileBatch(config, 'id', log);
  expect(events.map(e => e.message)).toEqual(['first']); fs.appendFileSync(log.path, second.subarray(-4)); fs.renameSync(log.path, log.path + '.1'); fs.writeFileSync(log.path, logLine('third', 3));
  await source.dockerFileBatch(config, 'id', log); await source.dockerFileBatch(config, 'id', log); expect(events.map(e => e.message)).toEqual(['first', 'second', 'third']);
});
test('failed queue write cannot advance file checkpoint or discard retry identity', async () => {
  const log = logFixture(); fs.writeFileSync(log.path, logLine('ready')); const queue = store.queueBatch.bind(store); store.queueBatch = () => { throw new Error('disk full'); };
  await expect(source.dockerFileBatch(config, 'id', log)).rejects.toThrow('disk full'); expect(store.load('docker-file-history-id.json', null)).toBeNull(); store.queueBatch = queue;
  await source.dockerFileBatch(config, 'id', log); expect(queued()[0].sourceEventId).toBe(dockerEvent(config, 'id', 'cdn', '2026-09-19T00:00:01.100000000Z', 'ready').sourceEventId);
});
test('live file cursor is independent and captures writes without replaying history', async () => {
  const log = logFixture(), events = capture(); fs.writeFileSync(log.path, logLine('history')); await source.dockerFileBatch(config, 'id', log, true); expect(events).toHaveLength(0);
  fs.appendFileSync(log.path, logLine('new', 2)); await source.dockerFileBatch(config, 'id', log, true); await source.dockerFileBatch(config, 'id', log);
  expect(events.map(e => e.message)).toEqual(['new', 'history', 'new']); expect(events[0].sourceEventId).toBe(events[2].sourceEventId);
});
test('compressed history fails explicitly while live file collection continues', async () => {
  const log = logFixture(), events = capture(); fs.writeFileSync(log.path + '.1.gz', 'compressed'); fs.writeFileSync(log.path, logLine('old'));
  await expect(source.dockerFileBatch(config, 'id', log)).rejects.toThrow('compressed history'); expect(store.load('docker-file-history-id.json', null)).toBeNull();
  await source.dockerFileBatch(config, 'id', log, true); fs.appendFileSync(log.path, logLine('new', 2)); await source.dockerFileBatch(config, 'id', log, true); expect(events.map(e => e.message)).toEqual(['new']);
  source.commands.run = async () => JSON.stringify({ path: log.path, driver: 'json-file' }); expect(await source.registerDockerFile('id', log.name, log.since)).toBe(false);
});
test('closed fragment preserves redacted evidence and stable identity before successor', async () => {
  const log = logFixture(), events = capture(), fragment = Buffer.from('{"log":"unfinished token=private'); fs.writeFileSync(log.path + '.1', fragment); fs.writeFileSync(log.path, logLine('new'));
  await source.dockerFileBatch(config, 'id', log); await source.dockerFileBatch(config, 'id', log); expect(events[0].level).toBe('error'); expect(events[0].message).not.toContain('private'); expect((events[0].metadata.source_fragment as any).byte_length).toBe(fragment.length); expect(events[1].message).toBe('new'); expect(fs.readFileSync(log.path + '.1')).toEqual(fragment);
});
for (const mode of ['truncate', 'rewrite', 'missing']) test('file discontinuity notice: ' + mode, async () => {
  const log = logFixture(), events = capture(); fs.writeFileSync(log.path, logLine('old-' + 'x'.repeat(100))); await source.dockerFileBatch(config, 'id', log);
  if (mode === 'missing') fs.renameSync(log.path, join(root, 'outside-retention'));
  fs.writeFileSync(log.path, logLine('new-' + 'x'.repeat(mode === 'rewrite' ? 200 : 0), 2)); await source.dockerFileBatch(config, 'id', log);
  expect(events.some(e => e.service === 'host-log-collector')).toBe(true); expect(events.at(-1)!.message).toStartWith('new-');
});
test('invalid complete record and oversized record preserve history checkpoint', async () => {
  const log = logFixture(), events = capture(); fs.writeFileSync(log.path, Buffer.concat([logLine('valid'), Buffer.from('invalid\n')]));
  await expect(source.dockerFileBatch(config, 'id', log)).rejects.toThrow('invalid JSON'); expect(events).toHaveLength(0); expect(store.load('docker-file-history-id.json', null)).toBeNull();
  fs.writeFileSync(log.path, Buffer.alloc(MAX_RECORD_BYTES + 1, 65)); await expect(source.dockerFileBatch(config, 'id', log)).rejects.toThrow('8MB');
});
test('Docker cutoff is inclusive and batch count bounded', async () => {
  const log = logFixture(), events = capture(); log.since = '2026-09-19T00:00:02.100000Z'; fs.writeFileSync(log.path, Buffer.concat([logLine('before'), ...Array.from({ length: 150 }, (_, i) => logLine('row-' + i, 2))]));
  await source.dockerFileBatch(config, 'id', log); expect(events).toHaveLength(100); expect(events[0].message).toBe('row-0'); await source.dockerFileBatch(config, 'id', log); expect(events).toHaveLength(150);
});
test('removed source retires only after durable notice and keeps old cursors', async () => {
  const log = logFixture(); store.save('docker-file-sources.json', { old: log }); store.save('docker-file-history-old.json', { device: 1, inode: 2, offset: 123 }); const original = store.send.bind(store);
  store.send = async () => { throw new Error('disk full'); }; await expect(source.retireDockerFile(config, 'old', log)).rejects.toThrow(); expect(store.load<any>('docker-file-sources.json', {}).old).toEqual(log);
  store.send = original; await source.retireDockerFile(config, 'old', log); expect(store.load('docker-file-sources.json', {})).toEqual({}); expect(store.load<any>('docker-file-retired.json', {}).old.final_coverage).toBe('unknown'); expect(store.load<any>('docker-file-history-old.json', {}).offset).toBe(123);
});

async function server(reply: (events: LogEvent[]) => Promise<[number, unknown]> | [number, unknown], run: (cfg: Config, requests: LogEvent[][], connections: Set<unknown>) => Promise<void>) {
  const requests: LogEvent[][] = [], connections = new Set<unknown>();
  const service = http.createServer(async (req, res) => { connections.add(req.socket); const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk); const events = JSON.parse(Buffer.concat(chunks).toString()).events; requests.push(events); const [status, ack] = await reply(events); const body = JSON.stringify(ack); res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }); res.end(body); });
  service.listen(0, '127.0.0.1'); await once(service, 'listening');
  try { await run({ ...config, url: `http://127.0.0.1:${(service.address() as any).port}/api/logs/ingest` }, requests, connections); }
  finally { service.closeAllConnections(); await new Promise<void>(resolve => service.close(() => resolve())); }
}
test('HTTP delivery only deletes exact acknowledged batches and reuses its connection', async () => {
  await store.send([event(config, 'one', 'fixture', 'ready', iso())]); const path = store.queuedNames('live', 1)[0], original = fs.readFileSync(path);
  for (const ack of [{ ok: true }, { ok: true, accepted: 0 }, { ok: false, accepted: 1 }]) await server(() => [201, ack], async cfg => {
    const delivery = new Delivery(cfg); try { await expect(delivery.deliver([path])).rejects.toThrow('acknowledgement'); } finally { delivery.close(); } expect(fs.readFileSync(path)).toEqual(original);
  });
  await server(events => [201, { ok: true, accepted: events.length }], async (cfg, requests, connections) => {
    const delivery = new Delivery(cfg); try { expect(await delivery.deliver([path])).toBe(1); await store.send([event(config, 'two', 'fixture', 'ready', iso())]); await delivery.deliver(store.queuedBatches('live')); } finally { delivery.close(); }
    expect(requests).toHaveLength(2); expect(connections.size).toBe(1);
  }); expect(store.queuedNames('live', 1)).toEqual([]);
});
test('failed response and lost ACK preserve stable IDs across sender restart', async () => {
  await store.send([event(config, 'one', 'fixture', 'ready', iso())]); const path = store.queuedNames('live', 1)[0];
  await server(() => [503, { error: 'busy' }], async cfg => { const d = new Delivery(cfg); try { await expect(d.deliver([path])).rejects.toThrow('HTTP 503'); } finally { d.close(); } });
  // Restore the identical durable batch to simulate a crash after commit but
  // before unlink. Receiver-side deduplication sees the same sourceEventId.
  await server(events => [201, { ok: true, accepted: events.length }], async (cfg, requests) => {
    const raw = fs.readFileSync(path); const first = new Delivery(cfg); await first.deliver([path]); first.close(); fs.writeFileSync(path, raw);
    const restarted = new Delivery(cfg); await restarted.deliver([path]); restarted.close(); expect(requests[0][0].sourceEventId).toBe(requests[1][0].sourceEventId);
  });
});
test('history yields to live batches, small files coalesce within 100 events', async () => {
  await store.send([event(config, 'old', 'fixture', 'ready', '2026-01-01T00:00:00Z')]);
  for (let i = 0; i < 105; i++) await store.send([event(config, String(i), 'fixture', 'ready', iso())]);
  expect(store.queuedBatches('history')).toEqual([]); expect(store.queuedBatches('live')).toHaveLength(100);
  await server(events => [201, { ok: true, accepted: events.length }], async cfg => { const d = new Delivery(cfg); await d.deliver(store.queuedBatches('live')); expect(store.queuedBatches('live')).toHaveLength(5); await d.deliver(store.queuedBatches('live')); d.close(); });
  expect(store.queuedBatches('history')).toHaveLength(1);
});
test('a blocked history request does not block live acknowledgement', async () => {
  await store.send([event(config, 'old', 'fixture', 'ready', '2026-01-01T00:00:00Z'), event(config, 'new', 'fixture', 'ready', iso())]);
  let release!: () => void, started!: () => void; const blocked = new Promise<void>(resolve => { started = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
  await server(async events => { if (events[0].timestamp.startsWith('2026-01')) { started(); await gate; } return [201, { ok: true, accepted: events.length }]; }, async cfg => {
    const history = new Delivery(cfg), live = new Delivery(cfg), pending = history.deliver(store.queuedNames('history', 1));
    try { await blocked; const begin = performance.now(); await live.deliver(store.queuedBatches('live')); expect(performance.now() - begin).toBeLessThan(1000); }
    finally { release(); await pending; history.close(); live.close(); }
  });
});
test('insecure remote URL and oversized acknowledgement preserve queue', async () => {
  expect(() => new Delivery({ ...config, url: 'http://example.test/ingest' })).toThrow('HTTPS'); expect(() => new Delivery({ ...config, url: 'https://user:pass@example.test' })).toThrow('Invalid');
  await store.send([event(config, 'one', 'fixture', 'ready', iso())]); const paths = store.queuedBatches('live');
  await server(() => [201, { huge: 'x'.repeat(5000) }], async cfg => { const d = new Delivery(cfg); try { await expect(d.deliver(paths)).rejects.toThrow(); } finally { d.close(); } }); expect(fs.existsSync(paths[0])).toBe(true);
});
test('application file reaches durable HTTP acknowledgement under ten seconds', async () => {
  const log = logFixture(); fs.writeFileSync(log.path, ''); await source.dockerFileBatch(config, 'id', log, true);
  await server(events => [201, { ok: true, accepted: events.length }], async cfg => {
    const begin = performance.now(); fs.appendFileSync(log.path, JSON.stringify({ log: 'realtime\n', stream: 'stdout', time: iso() }) + '\n'); await source.dockerFileBatch(cfg, 'id', log, true);
    const d = new Delivery(cfg); await d.deliver(store.queuedBatches('live')); d.close(); expect(performance.now() - begin).toBeLessThan(10000);
  });
});
test('guest export streams legacy property order, Unicode and large arrays', async () => {
  const events = Array.from({ length: 300 }, (_, i) => event(config, String(i), 'test', i === 150 ? '🔥'.repeat(65536) : 'ready', iso()));
  const raw = Buffer.from(JSON.stringify({ id: 'retained', events, failures: [] })), metadata: Record<string, unknown> = {};
  async function* chunks() { for (let i = 0; i < raw.length; i += 1031) yield raw.subarray(i, i + 1031); }
  expect(await array(jsonEvents(chunks(), metadata))).toEqual(events); expect(metadata).toEqual({ id: 'retained', failures: [] });
  const alternate: Record<string, unknown> = {}; expect(await array(jsonEvents(lines(JSON.stringify({ events: events.slice(0, 1), failures: [], id: 'last' })), alternate))).toEqual(events.slice(0, 1)); expect(alternate.id).toBe('last');
  await expect(array(jsonEvents(lines('{"events":[]} trailing'), {}))).rejects.toThrow('Trailing');
});
test('guest replay retains source cursors until matching host acknowledgement', async () => {
  store.save('journal.json', 'before'); let collected = 0, first = '';
  const collect = async (sources: Sources) => { collected++; await sources.store.send([event(config, 'guest', 'test', 'whoami', iso())]); sources.store.save('journal.json', 'after'); sources.store.save('docker-file-history-id.json', { offset: 123 }); return []; };
  await guestExport(store, config, async text => { first += text; }, collect); let second = ''; await guestExport(store, config, async text => { second += text; }, collect);
  expect(first).toBe(second); expect(collected).toBe(1); expect(store.load('journal.json', '')).toBe('before'); expect(() => guestAck(store, 'wrong')).toThrow('mismatch');
  guestAck(store, JSON.parse(first).id); expect(store.load('journal.json', '')).toBe('after'); expect(store.load<any>('docker-file-history-id.json', {}).offset).toBe(123); expect(fs.existsSync(store.path('export.json'))).toBe(false);
});
test('legacy guest export is re-redacted without changing source identity', async () => {
  store.save('export.json', { id: 'legacy', events: [{ sourceEventId: 'stable', message: 'curl -uprivate', metadata: { process: { arguments: ['curl', '-u', 'private'] } } }], failures: [] }); let output = '';
  await guestExport(store, config, async text => { output += text; }); expect(output).not.toContain('private'); expect(JSON.parse(output).events[0].sourceEventId).toBe('stable');
});
test('retention expands small stores, preserves actions and backup, then becomes idempotent', () => {
  const path = join(root, 'auditd.conf'), text = 'max_log_file = 8 # original comment\nnum_logs = 5\nmax_log_file_action = ROTATE\ndisk_full_action = SUSPEND\n'; fs.writeFileSync(path, text);
  expect(retention(path, 20 * 1024 ** 3).changed).toBe(true); expect(fs.readFileSync(path, 'utf8')).toContain('max_log_file = 100 # original comment'); expect(fs.readFileSync(path, 'utf8')).toContain('disk_full_action = SUSPEND'); expect(fs.readFileSync(path + '.before-hanasand-retention', 'utf8')).toBe(text); expect(retention(path, 20 * 1024 ** 3).changed).toBe(false);
});
test('retention preserves larger and nonrotating policies and fails before writing on low disk', () => {
  const path = join(root, 'auditd.conf'); for (const [action, size, count] of [['KEEP_LOGS', 8, 5], ['HALT', 8, 5], ['ROTATE', 500, 20]]) {
    const text = `max_log_file = ${size}\nnum_logs = ${count}\nmax_log_file_action = ${action}\n`; fs.writeFileSync(path, text); expect(retention(path, 0).changed).toBe(false); expect(fs.readFileSync(path, 'utf8')).toBe(text);
  }
  fs.writeFileSync(path, 'max_log_file_action = ROTATE\n'); expect(() => retention(path, 3 * 1024 ** 3)).toThrow('headroom'); expect(fs.readFileSync(path, 'utf8')).toBe('max_log_file_action = ROTATE\n');
});

test('Docker CLI isolates failures, clamps creation time, and commits only completed minute', async () => {
  const oldPath = process.env.PATH; const bin = join(root, 'bin'); fs.mkdirSync(bin); fs.writeFileSync(join(bin, 'docker'), 'fixture'); process.env.PATH = bin + ':' + oldPath;
  try {
    const events = capture(), reads: string[][] = []; source.registerDockerFile = async () => false;
    source.commands.run = async args => args[1] === 'ps' ? 'bad broken\ngood healthy\n' : '2026-09-19T00:00:05Z';
    source.commands.stream = async function* (args) { reads.push(args); if (args.at(-1) === 'bad') throw new CommandError(1, 'removed during collection'); yield '2026-09-19T00:00:30.000000000Z ready\n'; };
    await expect(source.docker(config)).rejects.toThrow('broken (removed during collection)'); expect(events[0].service).toBe('healthy');
    expect(reads[1][4]).toBe('2026-09-19T00:00:05Z'); expect(store.load<any>('docker.json', {})).toEqual({ good: '2026-09-19T00:01:05+00:00' });
    store.send = async () => { throw new Error('private failure'); }; await expect(source.docker(config)).rejects.toThrow('healthy (collection Error)'); expect(store.load<any>('docker.json', {}).good).toBe('2026-09-19T00:01:05+00:00');
  } finally { process.env.PATH = oldPath; }
});
test('Docker inventory failure cannot retire sources; removed source with retained history stays readable', async () => {
  const oldPath = process.env.PATH; const bin = join(root, 'bin'); fs.mkdirSync(bin); fs.writeFileSync(join(bin, 'docker'), 'fixture'); process.env.PATH = bin + ':' + oldPath;
  try {
    const log = logFixture(); fs.writeFileSync(log.path, logLine('retained')); store.save('docker-file-sources.json', { old: log }); source.commands.run = async () => { throw new Error('offline'); };
    await expect(source.docker(config)).rejects.toThrow(); expect(store.load<any>('docker-file-sources.json', {}).old).toEqual(log);
    source.commands.run = async () => ''; await source.docker(config); const events = capture(); await source.dockerFileBatch(config, 'old', log); expect(events[0].message).toBe('retained'); expect(store.load('docker-file-retired.json', {})).toEqual({});
  } finally { process.env.PATH = oldPath; }
});
test('replacement container enrolls readable JSON file with its original cutoff and new identity', async () => {
  const oldPath = process.env.PATH; const bin = join(root, 'bin'); fs.mkdirSync(bin); fs.writeFileSync(join(bin, 'docker'), 'fixture'); process.env.PATH = bin + ':' + oldPath;
  try {
    const log = logFixture(); fs.writeFileSync(log.path, logLine('replacement')); store.save('docker-file-sources.json', { old: { ...log, path: join(root, 'gone') } }); store.save('docker-file-history-old.json', { offset: 123 }); store.save('docker.json', { new: log.since });
    source.commands.run = async args => args[1] === 'ps' ? 'new cdn\n' : JSON.stringify({ driver: 'json-file', path: log.path });
    const events = capture(); await source.docker(config); expect(store.load<any>('docker-file-sources.json', {}).new.since).toBe(log.since); expect(store.load<any>('docker-file-history-old.json', {}).offset).toBe(123);
    await source.dockerFileBatch(config, 'new', log); expect(events.at(-1)!.sourceEventId).toBe(dockerEvent(config, 'new', 'cdn', '2026-09-19T00:00:01.100000000Z', 'replacement').sourceEventId);
  } finally { process.env.PATH = oldPath; }
});
test('failed discontinuity notice retains the original checkpoint for retry', async () => {
  const log = logFixture(); fs.writeFileSync(log.path, logLine('original-' + 'x'.repeat(100))); await source.dockerFileBatch(config, 'id', log); const cursor = store.load<any>('docker-file-history-id.json', {});
  fs.writeFileSync(log.path, logLine('short')); store.send = async () => { throw new Error('disk full'); }; await expect(source.dockerFileBatch(config, 'id', log)).rejects.toThrow(); expect(store.load<any>('docker-file-history-id.json', {})).toEqual(cursor);
});

test('live audit allows initial retained-log scan before returning to short checkpoint reads', async () => {
  const timeouts: (number | undefined)[] = [];
  source.commands.stream = async function* (_args, options = {}) {
    timeouts.push(options.timeout);
    fs.writeFileSync(store.path('audit-live.pending'), 'output=- ' + Date.now() / 1000 + ':123 0x514\n');
    yield audit();
  };
  await source.audit(config, true); await source.audit(config, true);
  expect(timeouts).toEqual([60, 5]);
});

test('activation requires fresh source checks and a real ACK while preserving backpressure health', () => {
  const now = Date.now(), fresh = iso(now / 1000), stale = iso(now / 1000 - 60);
  const health = { runtime: 'typescript', release: 'revision', checkedAt: fresh, source_status: {
    audit_live: { ok: true, checkedAt: fresh }, journal_live: { ok: true, checkedAt: fresh },
    delivery_live: { ok: false, checkedAt: fresh, lastAcknowledgedAt: fresh, error: 'Ingestion HTTP 503' },
  } };
  expect(releaseReady(health, 'revision', now)).toBe(true);
  expect(health.source_status.delivery_live.ok).toBe(false);
  expect(releaseReady(health, 'different', now)).toBe(false);
  health.source_status.delivery_live.lastAcknowledgedAt = stale;
  expect(releaseReady(health, 'revision', now)).toBe(false);
  health.source_status.delivery_live.lastAcknowledgedAt = fresh;
  health.source_status.audit_live.ok = false;
  expect(releaseReady(health, 'revision', now)).toBe(false);
});


test('overlapping live/recovery batches remove acknowledged duplicates without another request', async () => {
  const item = event(config, 'overlap', 'fixture', 'ready', iso());
  await server(events => [201, { ok: true, accepted: events.length }], async (cfg, requests) => {
    const delivery = new Delivery(cfg);
    try {
      await store.send([item, item]); await delivery.deliver(store.queuedBatches('live'));
      expect(requests[0]).toHaveLength(1);
      await store.send([item]); expect(await delivery.deliver(store.queuedBatches('live'))).toBe(1);
      expect(requests).toHaveLength(1); expect(store.queuedNames('live', 1)).toEqual([]);
      await store.send([item, event(config, 'new-overlap', 'fixture', 'new', iso())]);
      await delivery.deliver(store.queuedBatches('live'));
      expect(requests).toHaveLength(2); expect(requests[1]).toHaveLength(1);
      expect(requests[1][0].message).toBe('new');
    } finally { delivery.close(); }
  });
});

test('a failed acknowledgement cannot enter the delivery deduplication cache', async () => {
  let fail = true;
  await store.send([event(config, 'failed-overlap', 'fixture', 'ready', iso())]);
  await server(events => [201, { ok: true, accepted: fail ? 0 : events.length }], async (cfg, requests) => {
    const delivery = new Delivery(cfg);
    try {
      await expect(delivery.deliver(store.queuedBatches('live'))).rejects.toThrow('acknowledgement');
      fail = false; await delivery.deliver(store.queuedBatches('live'));
      expect(requests).toHaveLength(2); expect(store.queuedNames('live', 1)).toEqual([]);
    } finally { delivery.close(); }
  });

});


test('expired acknowledgements replay safely through the receiver', async () => {
  const item = event(config, 'expired-overlap', 'fixture', 'ready', iso());
  await server(events => [201, { ok: true, accepted: events.length }], async (cfg, requests) => {
    const delivery = new Delivery(cfg);
    try {
      await store.send([item]); await delivery.deliver(store.queuedBatches('live'));
      await store.send([item]); const now = Date.now(), clock = spyOn(Date, 'now').mockReturnValue(now + 120001);
      try { await delivery.deliver(store.queuedBatches('live')); } finally { clock.mockRestore(); }
      expect(requests).toHaveLength(2); expect(requests[1][0].sourceEventId).toBe(item.sourceEventId);
    } finally { delivery.close(); }
  });
});
