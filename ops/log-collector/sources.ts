import { fs, join, dirname, basename, Store, Commands, Config, LogEvent, Metadata, event, scrub, scrubArguments, iso, seconds, sha, MAX_RECORD_BYTES, BATCH_BYTES, CollectionError, CommandError, TimeoutError, collectionError } from './core';
import { executionReceipts, matchingExecution, type ExecutionLookup } from './executions';

const trimEnding = (text: string) => text.replace(/\n$/, '').replace(/\r$/, '');
export const shellQuote = (value: string) => value === '' ? "''" : /^[\w@%+=:,./-]+$/.test(value) ? value : "'" + value.replaceAll("'", "'\"'\"'") + "'";
export function auditArg(value: string): string {
  if (value.startsWith('"')) return value.slice(1, -1);
  return /^(?:[0-9a-f]{2})+$/i.test(value) ? Buffer.from(value, 'hex').toString('utf8') : value;
}
export function parseAudit(text: string, config: Config, receipts: ExecutionLookup = []): LogEvent[] {
  const groups = new Map<string, string[]>(), events: LogEvent[] = [];
  for (const line of text.split(/\r?\n/)) {
    const row = line.split('\x1d', 1)[0]; if (!/^type=(SYSCALL|EXECVE) /.test(row)) continue;
    const identity = row.match(/msg=audit\((\d+(?:\.\d+)?):(\d+)\)/)?.[0];
    if (identity) { if (!groups.has(identity)) groups.set(identity, []); groups.get(identity)!.push(row); }
  }
  for (const [identity, rows] of groups) {
    const syscall = rows.find(row => row.startsWith('type=SYSCALL ')); if (!syscall) continue;
    const attrs = Object.fromEntries([...syscall.matchAll(/\b(\w+)=((?:"[^"]*")|\S+)/g)].map(match => [match[1], match[2]]));
    const args = new Map<number, string>(), parts = new Map<number, Map<number, string>>();
    for (const row of rows.filter(row => row.startsWith('type=EXECVE '))) for (const match of row.matchAll(/\ba(\d+)(?:\[(\d+)\])?=((?:"[^"]*")|\S+)/g)) {
      const key = Number(match[1]);
      if (match[2] !== undefined) { if (!parts.has(key)) parts.set(key, new Map()); parts.get(key)!.set(Number(match[2]), auditArg(match[3])); }
      else args.set(key, auditArg(match[3]));
    }
    for (const [key, chunks] of parts) args.set(key, [...chunks].sort((a, b) => a[0] - b[0]).map(pair => pair[1]).join(''));
    if (!args.size) continue;
    let argv = [...args].sort((a, b) => a[0] - b[0]).map(pair => pair[1]);
    const executable = auditArg(attrs.exe || '"' + argv[0] + '"'); argv = scrubArguments(argv);
    const command = scrub(argv.map(shellQuote).join(' ')), match = identity.match(/\((\d+(?:\.\d+)?):(\d+)\)/)!;
    const execution = matchingExecution(attrs, argv, Number(match[1]) * 1000, receipts);
    events.push(event(config, 'audit:' + identity, 'audit', command, iso(Number(match[1])), {
      collector: 'auditd', event_type: 'process', action: 'exec', outcome: attrs.success === 'yes' ? 'success' : 'failure',
      process: { executable, command_line: command, arguments: argv, pid: attrs.pid ?? null, parent_pid: attrs.ppid ?? null },
      user: { id: attrs.uid ?? null, login_id: attrs.auid ?? null }, audit_id: match[2],
      ...(execution ? { collector_execution: { ...execution } } : {}),
    }));
  }
  return events;
}
export async function* auditEvents(lines: AsyncIterable<string>, config: Config, receipts: ExecutionLookup = []) {
  let identity: string | undefined, rows: string[] = [], size = 0;
  for await (const line of lines) {
    if (!/^type=(SYSCALL|EXECVE) /.test(line)) continue;
    const current = line.match(/msg=audit\((\d+(?:\.\d+)?):(\d+)\)/)?.[0]; if (!current) continue;
    if (identity && current !== identity) { yield* parseAudit(rows.join(''), config, receipts); rows = []; size = 0; }
    identity = current; size += Buffer.byteLength(line); if (size > MAX_RECORD_BYTES) throw new Error('Audit event exceeds 8MB; cursor retained'); rows.push(line);
  }
  if (rows.length) yield* parseAudit(rows.join(''), config, receipts);
}
export function localAuditDate(timestamp: number): string[] {
  const d = new Date(timestamp * 1000), pad = (n: number) => String(n).padStart(2, '0');
  return [pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + '/' + pad(d.getFullYear() % 100), pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())];
}
export function checkpointTime(path: string): number | null {
  if (!fs.existsSync(path)) return null;
  const match = fs.readFileSync(path, 'utf8').match(/^output=.*?\s(\d+(?:\.\d+)?):\d+/m); return match ? Number(match[1]) : null;
}
export function dockerEvent(config: Config, id: string, name: string, timestamp: string, message: string, stream?: string): LogEvent {
  const metadata: Metadata = { collector: 'docker', container_id: id }; if (stream) metadata.stream = stream;
  let level = 'info';
  try {
    const structured = JSON.parse(message);
    if (structured && typeof structured === 'object' && !Array.isArray(structured)) {
      let raw = structured.level;
      if (typeof raw === 'string') { raw = raw.trim().toLowerCase(); raw = ({ warning: 'warn', critical: 'fatal' } as Record<string, string>)[raw] || raw; }
      level = typeof raw === 'number' ? ({ 10: 'debug', 20: 'debug', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal' } as Record<number, string>)[raw] || 'info' : ['debug', 'info', 'warn', 'error', 'fatal'].includes(raw) ? raw : 'info';
      metadata.structured = structured;
    }
  } catch { if (/\b(error|exception|failed|failure|fatal|panic)\b/i.test(message)) level = 'error'; }
  return event(config, 'docker:' + id + ':' + timestamp + ':' + message, name, message, timestamp, metadata, level);
}
export async function* dockerCliStream(config: Config, id: string, name: string, lines: AsyncIterable<string>): AsyncGenerator<LogEvent> {
  let timestamp: string | undefined, parts: string[] = [], size = 0;
  for await (const line of lines) {
    const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})) /);
    if (match) {
      if (timestamp) yield dockerEvent(config, id, name, timestamp, trimEnding(parts.join('')));
      timestamp = match[1]; parts = [line.slice(match[0].length)]; size = Buffer.byteLength(parts[0]);
    } else if (timestamp) { parts.push(line); size += Buffer.byteLength(line); }
    if (size > MAX_RECORD_BYTES) throw new Error('Docker event exceeds 8MB; cursor retained');
  }
  if (timestamp) yield dockerEvent(config, id, name, timestamp, trimEnding(parts.join('')));
}
export interface DockerSource { name: string; path: string; since: string }
interface Cursor { device: number; inode: number; offset: number; anchor?: string }
interface LogFile { rank: number; path: string; stat: fs.Stats }
export function dockerJsonFiles(source: DockerSource): LogFile[] {
  const parent = dirname(source.path), prefix = basename(source.path); if (!fs.existsSync(parent)) return [];
  const result: LogFile[] = [];
  for (const name of fs.readdirSync(parent)) {
    if (!name.startsWith(prefix)) continue;
    const suffix = name.slice(prefix.length), match = suffix.match(/^\.(\d+)(?:\.gz)?$/); if (suffix && !match) continue;
    const path = join(parent, name);
    try { const stat = fs.statSync(path); if (stat.isFile()) result.push({ rank: match ? Number(match[1]) : 0, path, stat }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  return result.sort((a, b) => b.rank - a.rank);
}
// Bounded buffered reads avoid a syscall per byte without reading a whole log.
class FileLines {
  position: number; buffer = Buffer.alloc(0); index = 0;
  constructor(public fd: number, offset: number) { this.position = offset; }
  next(): Buffer {
    const parts: Buffer[] = []; let size = 0;
    while (size <= MAX_RECORD_BYTES) {
      if (this.index === this.buffer.length) {
        const chunk = Buffer.alloc(65536), count = fs.readSync(this.fd, chunk, 0, chunk.length, this.position);
        this.buffer = chunk.subarray(0, count); this.index = 0; if (!count) break;
      }
      const newline = this.buffer.indexOf(10, this.index), end = newline < 0 ? this.buffer.length : newline + 1;
      const part = this.buffer.subarray(this.index, end); parts.push(part); size += part.length; this.position += part.length; this.index = end;
      if (newline >= 0) break;
    }
    if (size > MAX_RECORD_BYTES) throw new CollectionError('JSON log record exceeds 8MB; cursor retained');
    return Buffer.concat(parts, size);
  }
}
export class Sources {
  constructor(public store: Store, public commands = new Commands(store)) {}
  async journal(config: Config, live = false) {
    const stateName = live ? 'journal-live.json' : 'journal.json';
    const checkpoint = this.store.load<string | { cursor: string; since?: string } | null>(stateName, null);
    let cursor = typeof checkpoint === 'string' ? checkpoint : checkpoint?.cursor;
    let since = typeof checkpoint === 'object' && checkpoint ? checkpoint.since || config.start! : live ? iso(Date.now() / 1000 - 60) : config.start!;
    const args = ['journalctl', '--no-pager', '-o', 'json', '--show-cursor', '--lines=+1000'];
    async function* consume(output: AsyncIterable<string>): AsyncGenerator<LogEvent> {
      for await (const line of output) {
        if (!line.startsWith('{')) continue;
        const row = JSON.parse(line); cursor = row.__CURSOR; since = iso(Number(row.__REALTIME_TIMESTAMP) / 1e6);
        const priority = Number(row.PRIORITY ?? 6), level = priority <= 2 ? 'fatal' : priority === 3 ? 'error' : priority === 4 ? 'warn' : priority === 7 ? 'debug' : 'info';
        const service = String(row.SYSLOG_IDENTIFIER || row._SYSTEMD_UNIT || 'system').replace(/\.service$/, '');
        if (service === 'hanasand-log-collector') continue;
        yield event(config, 'journal:' + cursor, service, String(row.MESSAGE ?? ''), since, { collector: 'journal', pid: row._PID ?? null, user: { id: row._UID ?? null }, unit: row._SYSTEMD_UNIT ?? null }, level);
      }
    }
    try { await this.store.send(consume(this.commands.stream([...args, ...(cursor ? ['--after-cursor', cursor] : ['--since', since])], { timeout: live ? 5 : 60, attestExecution: true }))); }
    catch (error) { if (!(error instanceof CommandError) || !cursor) throw error; await this.store.send(consume(this.commands.stream([...args, '--since', since], { timeout: live ? 5 : 60 }))); }
    if (cursor) this.store.save(stateName, { cursor, since });
  }
  async audit(config: Config, live = false) {
    const prefix = live ? 'audit-live' : 'audit', pending = this.store.path(prefix + '.pending');
    const checkpoint = this.store.readRaw(prefix + '.checkpoint');
    const match = checkpoint?.match(/^output=.*?\s(\d+(?:\.\d+)?):\d+/m);
    const timestamp = match ? Number(match[1]) : null, reuse = checkpoint !== null && (!live || timestamp !== null && timestamp >= Date.now() / 1000 - 60);
    if (reuse) fs.writeFileSync(pending, checkpoint!); else fs.rmSync(pending, { force: true });
    const args = ['ausearch', '--input-logs', '--checkpoint', pending, '-k', 'hanasand_exec', '--raw'];
    if (live && !reuse) args.push('--start', ...localAuditDate(Date.now() / 1000 - 60));
    let end: number | undefined;
    if (!live) {
      const beginning = Math.max(timestamp ?? 0, this.store.load<number>('audit-window.json', 0), seconds(config.start || iso(Date.now() / 1000 - 60)));
      end = Math.min(Math.floor(Date.now() / 1000) - 1, Math.floor(beginning) + 60); if (end <= beginning) return;
      args.push('--end', ...localAuditDate(end)); if (checkpoint === null) args.push('--start', ...localAuditDate(beginning));
    }
    // A first live pass may scan large retained files before it can checkpoint.
    // Later passes keep the short timeout and resume that fresh checkpoint.
    const read = (command: string[]) => this.store.send(auditEvents(this.commands.stream(command, { accepted: [0, 1], timeout: live && reuse ? 5 : 60, disk: true, attestExecution: true }), config, (pid, timestamp) => executionReceipts(this.store.root, pid, timestamp)));
    try { await read(args); }
    catch (error) { if (!(error instanceof CommandError) || ![10, 11, 12].includes(error.code ?? -1) || !fs.existsSync(pending)) throw error; await read([...args, '--start', 'checkpoint']); }
    if (fs.existsSync(pending)) { this.store.saveRaw(prefix + '.checkpoint', fs.readFileSync(pending, 'utf8')); fs.unlinkSync(pending); }
    if (end !== undefined) this.store.save('audit-window.json', end);
  }
  async registerDockerFile(id: string, name: string, since: string) {
    try {
      const details = JSON.parse(await this.commands.run(['docker', 'inspect', '--format', '{"path":{{json .LogPath}},"driver":{{json .HostConfig.LogConfig.Type}}}', id], { timeout: 15 }));
      if (details.driver !== 'json-file' || !fs.statSync(details.path).isFile()) return false;
      fs.accessSync(details.path, fs.constants.R_OK);
      const source: DockerSource = { name, path: details.path, since }; if (dockerJsonFiles(source).some(file => file.path.endsWith('.gz'))) return false;
      const sources = this.store.load<Record<string, DockerSource>>('docker-file-sources.json', {}); sources[id] = source; this.store.save('docker-file-sources.json', sources); return true;
    } catch { return false; }
  }
  async retireDockerFile(config: Config, id: string, source: DockerSource) {
    const retired = this.store.load<Metadata>('docker-file-retired.json', {}), cursors: Metadata = {};
    for (const kind of ['history', 'live']) {
      const name = 'docker-file-' + kind + '-' + id + '.json', cursor = this.store.load<Metadata | null>(name, null);
      if (cursor) cursors[kind] = { checkpoint: cursor, last_ack_at: iso(fs.statSync(this.store.path(name)).mtimeMs / 1000) };
    }
    const entry: Metadata = { source: { ...source }, retired_at: iso(), final_coverage: 'unknown', cursors };
    await this.store.send([event(config, 'docker-source-retired:' + id, 'host-log-collector', source.name + ': container removed; final log coverage is unknown because source files are unavailable', entry.retired_at as string,
      { collector: 'docker', container_id: id, source_status: 'removed_source_unavailable', retired_source: entry }, 'error')]);
    retired[id] = entry; this.store.save('docker-file-retired.json', retired);
    const sources = this.store.load<Record<string, DockerSource>>('docker-file-sources.json', {}); delete sources[id]; this.store.save('docker-file-sources.json', sources);
  }
  async dockerCreatedAt(id: string) {
    const created = this.store.load<Record<string, string>>('docker-created.json', {});
    if (!created[id]) {
      try { const timestamp = (await this.commands.run(['docker', 'inspect', '--format', '{{.Created}}', id], { timeout: 15 })).trim(); seconds(timestamp); created[id] = timestamp; this.store.save('docker-created.json', created); }
      catch { return null; }
    }
    return created[id];
  }
  async notice(config: Config, id: string, source: DockerSource, cursor: Cursor, reason: string) {
    const identity = 'docker-file-notice:' + id + ':' + cursor.inode + ':' + cursor.offset + ':' + (cursor.anchor || '') + ':' + reason;
    await this.store.send([event(config, identity, 'host-log-collector', source.name + ': ' + reason, iso(), { collector: 'docker', container_id: id, source_status: reason }, 'error')]);
  }
  async dockerFileBatch(config: Config, id: string, source: DockerSource, live = false): Promise<number> {
    const stateName = 'docker-file-' + (live ? 'live-' : 'history-') + id + '.json';
    let cursor = this.store.load<Cursor | null>(stateName, null);
    const files = dockerJsonFiles(source); if (!files.length) throw new CollectionError(source.name + ' (source files unavailable)');
    let selected = files.find(file => cursor && file.stat.ino === cursor.inode && file.stat.dev === cursor.device);
    if (cursor && !selected) { await this.notice(config, id, source, cursor, 'previous source file unavailable; replaying retained history'); cursor = null; }
    selected ??= live ? files[files.length - 1] : files[0];
    const { rank, path, stat } = selected;
    if (path.endsWith('.gz')) throw new CollectionError(source.name + ' (compressed history requires CLI recovery; file cursor preserved)');
    let offset = cursor?.offset ?? 0;
    if (cursor && stat.size < offset) { await this.notice(config, id, source, cursor, 'source file truncated; replaying available contents'); offset = 0; }
    const fd = fs.openSync(path, 'r'); let complete = offset, anchor = Buffer.alloc(0), eof = false;
    const events: LogEvent[] = [];
    try {
      const actual = fs.fstatSync(fd); if (actual.dev !== stat.dev || actual.ino !== stat.ino) throw new CollectionError(source.name + ' (source rotated during open; retrying)');
      if (live && !cursor) {
        const base = Math.max(0, stat.size - MAX_RECORD_BYTES), tail = Buffer.alloc(stat.size - base);
        const count = fs.readSync(fd, tail, 0, tail.length, base), last = tail.subarray(0, count).lastIndexOf(10); offset = last < 0 ? 0 : base + last + 1;
      }
      anchor = Buffer.alloc(Math.min(offset, 128)); fs.readSync(fd, anchor, 0, anchor.length, Math.max(0, offset - 128));
      if (cursor?.anchor && offset === cursor.offset && sha(anchor) !== cursor.anchor) { await this.notice(config, id, source, cursor, 'source file rewritten or truncated; replaying available contents'); offset = 0; anchor = Buffer.alloc(0); }
      const reader = new FileLines(fd, offset), started = performance.now(), cutoff = seconds(source.since); let scanned = 0, eventBytes = 0; complete = offset;
      while (scanned < MAX_RECORD_BYTES && events.length < 100 && eventBytes < BATCH_BYTES && performance.now() - started < 100) {
        const line = reader.next(); if (!line.length) { eof = true; break; }
        if (line[line.length - 1] !== 10) {
          if (rank > 0) {
            const digest = sha(line);
            events.push(event(config, 'docker-fragment:' + id + ':' + stat.ino + ':' + complete + ':' + digest, source.name, line.toString('utf8'), iso(), {
              collector: 'docker', container_id: id, event_type: 'source_fragment', source_fragment: { reason: 'incomplete_rotated_record', inode: String(stat.ino), offset: complete, byte_length: line.length, sha256: digest, file_modified_at: iso(stat.mtimeMs / 1000), encoding: 'utf8-replacement', preview_truncated: line.length > 65536 },
            }, 'error'));
            complete = reader.position; anchor = Buffer.concat([anchor, line]).subarray(-128); eof = true;
          }
          break;
        }
        let timestamp: string, message: string, stream: string, time: number;
        try {
          const record = JSON.parse(line.toString('utf8'));
          if (typeof record.log !== 'string' || !['stdout', 'stderr'].includes(record.stream) || typeof record.time !== 'string') throw new Error();
          const match = record.time.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/); if (!match) throw new Error();
          time = seconds(record.time); timestamp = match[1] + '.' + (match[2] || '').padEnd(9, '0') + match[3]; message = trimEnding(record.log); stream = record.stream;
        } catch { throw new CollectionError(source.name + ' (invalid JSON log record at byte ' + complete + ')'); }
        if (time >= cutoff) { const item = dockerEvent(config, id, source.name, timestamp, message, stream); events.push(item); eventBytes += Buffer.byteLength(JSON.stringify(item)); }
        scanned += line.length; complete = reader.position; anchor = Buffer.concat([anchor, line]).subarray(-128);
      }
    } finally { fs.closeSync(fd); }
    await this.store.send(events);
    let next: Cursor = { device: stat.dev, inode: stat.ino, offset: complete, anchor: sha(anchor) };
    const index = files.indexOf(selected);
    if (eof && index + 1 < files.length) { const nextStat = files[index + 1].stat; next = { device: nextStat.dev, inode: nextStat.ino, offset: 0 }; }
    if (JSON.stringify(next) !== JSON.stringify(cursor)) this.store.save(stateName, next);
    return Math.max(0, stat.size - complete) + files.slice(index + 1).reduce((sum, file) => sum + file.stat.size, 0);
  }
  async dockerFileSource(config: Config, live = false) {
    const sources = this.store.load<Record<string, DockerSource>>('docker-file-sources.json', {}), failures: string[] = []; let remaining = 0;
    for (const [id, source] of Object.entries(sources)) {
      try { remaining += await this.dockerFileBatch(config, id, source, live); } catch (error) { failures.push(error instanceof CollectionError ? error.message : source.name + ' (' + collectionError(error) + ')'); }
    }
    if (failures.length) throw new CollectionError(failures.join('; '));
    return { sources: Object.keys(sources).length, pendingFileBytes: remaining, retiredUnavailableSources: Object.keys(this.store.load('docker-file-retired.json', {})).length };
  }
  async docker(config: Config) {
    if (!process.env.PATH?.split(':').some(path => fs.existsSync(join(path, 'docker')))) return;
    const inventory = await this.commands.run(['docker', 'ps', '-a', '--format', '{{.ID}} {{.Names}}']);
    const containers = inventory.trim().split('\n').filter(Boolean).map(row => row.split(/ (.*)/s).slice(0, 2));
    const checkpoints = this.store.load<Record<string, string>>('docker.json', {}), fileSources = this.store.load<Record<string, DockerSource>>('docker-file-sources.json', {}), failures: string[] = [];
    const current = new Set(containers.map(([id]) => id));
    for (const [id, source] of Object.entries(fileSources)) if (!current.has(id) && !dockerJsonFiles(source).length) {
      try { await this.retireDockerFile(config, id, source); delete fileSources[id]; } catch (error) { failures.push(source.name + ' (retirement notice delivery ' + collectionError(error) + ')'); }
    }
    for (const [id, name] of containers) {
      if (fileSources[id]) continue;
      let since = checkpoints[id] || config.start!;
      if (await this.registerDockerFile(id, name, since)) continue;
      const created = await this.dockerCreatedAt(id); if (created && seconds(created) > seconds(since)) since = created;
      const until = iso(Math.min(Date.now() / 1000 - 1, seconds(since) + 60)); if (seconds(until) <= seconds(since)) continue;
      try {
        await this.store.send(dockerCliStream(config, id, name, this.commands.stream(['docker', 'logs', '--timestamps', '--since', since, '--until', until, id], { disk: true, merged: true })));
        checkpoints[id] = until; this.store.save('docker.json', checkpoints);
      } catch (error) {
        const reason = error instanceof TimeoutError ? 'log read timed out after 60s' : error instanceof CommandError ? error.reason || 'log read exited ' + error.code : 'collection ' + collectionError(error);
        failures.push(name + ' (' + reason + ')');
      }
    }
    if (failures.length) throw new CollectionError('Docker log collection failed for ' + failures.join(', '));
  }
  async collect(config: Config) {
    const failures: string[] = [];
    for (const [name, source] of Object.entries({ audit: () => this.audit(config), journal: () => this.journal(config), docker: () => this.docker(config), docker_file_history: () => this.dockerFileSource(config), docker_file_live: () => this.dockerFileSource(config, true) })) {
      try { await source(); } catch (error) { failures.push(name + ': ' + collectionError(error)); }
    }
    return failures;
  }
}
