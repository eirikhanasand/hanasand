import { once } from 'node:events';
import { StringDecoder } from 'node:string_decoder';
import { fs, join, Store, Commands, Config, LogEvent, Metadata, Events, randomUUID, MAX_RECORD_BYTES, scrub, boundedMetadata, syncDirectory, sha, iso, readBoundedPrefix, collectionError, CollectionError } from './core';
import { Sources, auditEvents, localAuditDate } from './sources';

export function checkpointFiles(root: string) {
  return ['audit.checkpoint', 'audit-window.json', 'journal.json', 'docker.json', 'docker-created.json', ...fs.readdirSync(root).filter(name => /^docker-file-.*\.json$/.test(name))];
}
// Incremental JSON decoding accepts existing Python exports, including alternate
// property order. At most one event and one input chunk are retained in memory.
export async function* jsonEvents(input: AsyncIterable<Buffer | string>, metadata: Record<string, unknown>, array = false): AsyncGenerator<LogEvent> {
  const iterator = input[Symbol.asyncIterator](), decoder = new StringDecoder('utf8'); let buffer = '', eof = false;
  async function fill() {
    const next = await iterator.next();
    if (next.done) { buffer += decoder.end(); eof = true; }
    else buffer += typeof next.value === 'string' ? next.value : decoder.write(next.value);
    if (Buffer.byteLength(buffer) > MAX_RECORD_BYTES) throw new Error('Export record exceeds 8MB');
  }
  async function whitespace() { buffer = buffer.trimStart(); while (!buffer && !eof) { await fill(); buffer = buffer.trimStart(); } }
  async function token(expected: string) { await whitespace(); if (!buffer.startsWith(expected)) throw new Error('Invalid export JSON'); buffer = buffer.slice(expected.length); }
  async function value(): Promise<unknown> {
    await whitespace(); let index = 0, depth = 0, quoted = false, escaped = false;
    const complex = buffer[0] === '[' || buffer[0] === '{', string = buffer[0] === '"';
    while (true) {
      while (index < buffer.length) {
        const char = buffer[index];
        if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') { quoted = false; if (string && depth === 0) { index++; const result = JSON.parse(buffer.slice(0, index)); buffer = buffer.slice(index); return result; } } }
        else if (char === '"') quoted = true;
        else if (char === '{' || char === '[') depth++;
        else if (char === '}' || char === ']') {
          if (!complex && depth === 0) { const result = JSON.parse(buffer.slice(0, index)); buffer = buffer.slice(index); return result; }
          depth--; if (complex && depth === 0) { index++; const result = JSON.parse(buffer.slice(0, index)); buffer = buffer.slice(index); return result; }
        } else if (!complex && !string && /[\s,:]/.test(char)) { const result = JSON.parse(buffer.slice(0, index)); buffer = buffer.slice(index); return result; }
        index++;
      }
      if (eof) { const result = JSON.parse(buffer); buffer = ''; return result; }
      await fill();
    }
  }
  async function* events() {
    await token('['); await whitespace(); if (buffer.startsWith(']')) { await token(']'); return; }
    while (true) { yield await value() as LogEvent; await whitespace(); if (buffer.startsWith(']')) { await token(']'); return; } await token(','); }
  }
  try {
    if (array) yield* events();
    else {
      await token('{');
      while (true) { const key = await value(); if (typeof key !== 'string') throw new Error('Invalid export key'); await token(':'); if (key === 'events') yield* events(); else metadata[key] = await value(); await whitespace(); if (buffer.startsWith('}')) { await token('}'); break; } await token(','); }
    }
    await whitespace(); if (buffer) throw new Error('Trailing export data');
  } finally { await iterator.return?.(); }
}
export async function writeOutput(text: string) { if (!process.stdout.write(text)) await once(process.stdout, 'drain'); }
export async function guestExport(store: Store, config: Config, write = writeOutput, collect = (sources: Sources) => sources.collect(config)) {
  const spool = store.path('export.json');
  if (!fs.existsSync(spool)) {
    const pending = store.path('pending'); fs.rmSync(pending, { recursive: true, force: true }); fs.mkdirSync(pending, { mode: 0o700 });
    for (const name of checkpointFiles(store.root)) if (fs.existsSync(store.path(name))) fs.copyFileSync(store.path(name), join(pending, name));
    const staging = store.path('export.pending'), fd = fs.openSync(staging, 'w', 0o600); let first = true;
    const guestStore = new Store(pending);
    guestStore.send = async (events: Events) => { for await (const item of events) {
      for (const entry of 'atomic' in item && item.atomic === true ? item.events : [item]) {
        fs.writeSync(fd, (first ? '' : ',') + JSON.stringify(entry)); first = false;
      }
    } };
    try {
      fs.writeSync(fd, '{"id":' + JSON.stringify(randomUUID().replaceAll('-', '')) + ',"events":[');
      const failures = await collect(new Sources(guestStore));
      fs.writeSync(fd, '],"failures":' + JSON.stringify(failures) + '}'); fs.fsyncSync(fd);
    } finally { fs.closeSync(fd); }
    fs.renameSync(staging, spool); syncDirectory(store.root);
  }
  const metadata: Record<string, unknown> = {}; let first = true; await write('{"events":[');
  for await (const item of jsonEvents(fs.createReadStream(spool), metadata)) {
    item.message = scrub(item.message); item.metadata = boundedMetadata(item.metadata || {});
    await write((first ? '' : ',') + JSON.stringify(item)); first = false;
  }
  await write('],"id":' + JSON.stringify(metadata.id) + ',"failures":' + JSON.stringify(metadata.failures) + '}\n');
}
export function guestAck(store: Store, identity: string) {
  const match = readBoundedPrefix(store.path('export.json'), 256).toString().match(/^\s*\{\s*"id"\s*:\s*("[^"\\]*")/);
  if (!match || JSON.parse(match[1]) !== identity) throw new Error('Guest export acknowledgement mismatch');
  const pending = store.path('pending');
  for (const name of checkpointFiles(pending)) if (fs.existsSync(join(pending, name))) fs.renameSync(join(pending, name), store.path(name));
  syncDirectory(store.root); fs.unlinkSync(store.path('export.json')); syncDirectory(store.root); fs.rmSync(pending, { recursive: true, force: true });
}
export async function printRecent(store: Store, config: Config, write = writeOutput) {
  const commands = new Commands(store); let first = true; await write('[');
  for await (const item of auditEvents(commands.stream(['ausearch', '--input-logs', '-k', 'hanasand_exec', '--raw', '--start', ...localAuditDate(Date.now() / 1000 - 60)], { accepted: [0, 1] }), config)) {
    await write((first ? '' : ',') + JSON.stringify(item)); first = false;
  }
  await write(']\n');
}
export async function guests(store: Store, config: Config) {
  if (config.guestCollection === false) throw new CollectionError('Administrative VM access unavailable');
  if (!fs.existsSync('/var/snap/lxd/common/lxd/unix.socket')) return;
  const commands = new Commands(store), lxc = '/snap/lxd/current/bin/lxc';
  const inventory = JSON.parse(await commands.run([lxc, 'list', '--format=json'])) as { name: string; status?: string; type?: string; created_at?: string }[];
  const binary = '/usr/local/lib/hanasand-log-collector/collector.cjs', version = sha(fs.readFileSync(binary));
  const installed = store.load<Record<string, string>>('guests.json', {}), failures: string[] = [];
  for (const guest of inventory) {
    const name = guest.name; if (guest.status !== 'Running') continue;
    const identity = name + ':' + (guest.created_at || '') + ':' + version;
    try {
      if (installed[name] !== identity) {
        const staging = '/var/lib/hanasand-log-collector/install'; await commands.run([lxc, 'exec', name, '--', 'mkdir', '-p', staging]);
        for (const file of ['collector.cjs', 'install.sh', 'launcher.sh']) await commands.run([lxc, 'file', 'push', '--uid=0', '--gid=0', '/usr/local/lib/hanasand-log-collector/' + file, name + staging + '/' + file]);
        await commands.run([lxc, 'exec', name, '--', 'sh', staging + '/install.sh', config.host + '/' + name, '--guest'], { timeout: 360 });
        installed[name] = identity; store.save('guests.json', installed);
      }
      async function* forward(output: AsyncIterable<string>, metadata: Record<string, unknown>, array = false) {
        for await (const item of jsonEvents(output, metadata, array)) { item.metadata = { ...item.metadata, physical_host: config.host, vm: { name, type: guest.type ?? null } }; yield item; }
      }
      await store.send(forward(commands.stream([lxc, 'exec', name, '--', '/usr/local/sbin/hanasand-log-collector', '--recent', config.host + '/' + name], { disk: true, raw: true }), {}, true));
      const metadata: Record<string, unknown> = {};
      await store.send(forward(commands.stream([lxc, 'exec', name, '--', '/usr/local/sbin/hanasand-log-collector', '--export', config.host + '/' + name, config.start!], { disk: true, raw: true, timeout: 120 }), metadata));
      if (typeof metadata.id !== 'string' || !Array.isArray(metadata.failures)) throw new Error('Invalid guest export');
      await store.durable(); // The guest may discard its spool only after the host queue is durable.
      await commands.run([lxc, 'exec', name, '--', '/usr/local/sbin/hanasand-log-collector', '--ack', metadata.id]);
      if (metadata.failures.length) failures.push(name + ': ' + metadata.failures.join(', '));
    } catch (error) { failures.push(name + ': ' + collectionError(error)); }
  }
  store.save('guest-coverage.json', { checkedAt: iso(), instances: inventory.map(g => ({ name: g.name, status: g.status, type: g.type })), failures });
  if (failures.length) throw new CollectionError('Guest collection failed: ' + failures.join(', '));
}
