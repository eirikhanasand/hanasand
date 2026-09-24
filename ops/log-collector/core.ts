import type { Persistence } from './persistence';
import * as fs from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import * as http from 'node:http';
import * as https from 'node:https';
import { spawn } from 'node:child_process';
import { recordExecution } from './executions';
import { setTimeout as sleep } from 'node:timers/promises';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Metadata = { [key: string]: Json };
export interface Config { host: string; start?: string; url?: string; token?: string; guestCollection?: boolean }
export interface LogEvent { sourceEventId: string; service: string; host: string; message: string; timestamp: string; level: string; metadata: Metadata }
export type AtomicEventGroup = { events: LogEvent[]; atomic: true };
export type Events = Iterable<LogEvent | AtomicEventGroup> | AsyncIterable<LogEvent | AtomicEventGroup>;
export const MAX_RECORD_BYTES = 8 * 1024 * 1024;
export const BATCH_BYTES = 256 * 1024;
export const BATCH_COUNT = 100;
export const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export const iso = (value = Date.now() / 1000) => {
  const micros = Math.round(value * 1e6), whole = Math.floor(micros / 1e6), fraction = micros - whole * 1e6;
  return new Date(whole * 1000).toISOString().replace('.000Z', (fraction ? '.' + String(fraction).padStart(6, '0') : '') + '+00:00');
};
export const seconds = (value: string) => {
  const match = value.match(/^(.*T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/);
  const result = match ? Date.parse(match[1] + match[3]) / 1000 + Number('0.' + (match[2] || '0').slice(0, 6)) : Date.parse(value) / 1000;
  if (!Number.isFinite(result)) throw new Error('Invalid timestamp');
  return result;
};
export const jsonSize = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
const chars = (text: string, count: number) => Array.from(text).slice(0, count).join('');
export function scrub(text: string): string {
  if (!/bearer|basic|password|passwd|token|secret|cookie|authorization|api|https?:\/\/|curl|sshpass|mysql|mariadb|redis-cli/i.test(text)) return text;
  text = text.replace(/\b(Bearer|Basic)\s+[A-Za-z0-9+/_.=-]+/gi, '$1 [REDACTED]')
    .replace(/(["'](?:set-cookie|cookie|authorization)\s*:\s*)([^"'\r\n]*)(["'])/gi, '$1[REDACTED]$3')
    .replace(/^(\s*(?:set-cookie|cookie|authorization)\s*:\s*)[^\r\n]*/gi, '$1[REDACTED]')
    .replace(/(\b(?:authorization|proxy-authorization)\s*[:=]\s*)(?:bearer\s+|basic\s+)?[^\s'"]+/gi, '$1[REDACTED]')
    .replace(/((?:--[\w-]*(?:password|passwd|token|secret|api[_-]?key|cookie)[\w-]*\s+)|(?:\b[\w-]*(?:password|passwd|token|secret|api[_-]?key|cookie)[\w-]*["']?\s*[=:]\s*))("[^"\r\n]*"|'[^'\r\n]*'|[^\s&;,"']+)/gi, '$1[REDACTED]');
  for (const [program, flag] of [['curl', '(?:-u|-U|--user|--proxy-user|--oauth2-bearer)'], ['sshpass', '-p'], ['(?:mysql|mariadb)', '-p'], ['redis-cli', '-a']]) {
    text = text.replace(new RegExp('(\\b' + program + '\\b[^;\\r\\n|]*?\\s' + flag + '(?:=|\\s+))("[^"\\r\\n]*"|\'[^\'\\r\\n]*\'|[^\\s;|]+)', 'gi'), '$1[REDACTED]');
  }
  for (const [program, flag] of [['curl', '(?:-u|-U)'], ['(?:sshpass|mysql|mariadb)', '-p'], ['redis-cli', '-a']]) {
    text = text.replace(new RegExp('(\\b' + program + '\\b[^;\\r\\n|]*?\\s' + flag + ')([^\\s;|]+)', 'g'), '$1[REDACTED]');
  }
  return text.replace(/(https?:\/\/)[^/@\s:]+:[^/@\s]+@/g, '$1[REDACTED]@');
}
export function scrubArguments(args: string[]): string[] {
  const flags: Record<string, string[]> = { curl: ['-u', '-U', '--user', '--proxy-user', '--oauth2-bearer'], sshpass: ['-p'], mysql: ['-p'], mariadb: ['-p'], 'redis-cli': ['-a'] };
  const short = flags[basename(args[0] || '')] || [];
  let hide = false;
  return args.map(arg => {
    if (hide) { hide = false; return '[REDACTED]'; }
    const attached = short.find(flag => flag.length === 2 && arg.startsWith(flag) && arg.length > 2);
    const assigned = short.find(flag => arg.startsWith(flag + '='));
    hide = short.includes(arg) || /^--?[\w-]*(?:password|passwd|token|secret|api[_-]?key|cookie|authorization)[\w-]*$/i.test(arg);
    return attached ? attached + '[REDACTED]' : assigned ? assigned + '=[REDACTED]' : scrub(arg);
  });
}
export function scrubMetadata(value: Json): Json {
  if (Array.isArray(value)) return value.map(scrubMetadata);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    /password|token|secret|cookie|authorization|api[_-]?key/i.test(key) ? '[REDACTED]' :
      key === 'arguments' && Array.isArray(item) && item.every(arg => typeof arg === 'string') ? scrubArguments(item as string[]) : scrubMetadata(item)]));
  return typeof value === 'string' ? scrub(value) : value;
}
export function fitText(value: string, budget: number): string {
  if (jsonSize(value) <= budget) return value;
  const points = Array.from(value); let low = 0, high = points.length;
  while (low < high) { const middle = Math.ceil((low + high) / 2); if (jsonSize(points.slice(0, middle).join('')) <= budget) low = middle; else high = middle - 1; }
  return points.slice(0, low).join('');
}
function compact(value: Json, depth = 0, field = ''): Json {
  if (typeof value === 'string') return fitText(value, ['command_line', 'command'].includes(field) ? 65536 : 4096);
  if (Array.isArray(value)) {
    const result: Json[] = [];
    for (const item of value.slice(0, field === 'arguments' ? 512 : 16)) {
      const next = compact(item, depth + 1);
      if (jsonSize([...result, next]) > (field === 'arguments' ? 65536 : 16384)) break;
      result.push(next);
    }
    return result;
  }
  if (value && typeof value === 'object') {
    if (depth > 4) return { truncated: true };
    const priority = ['process', 'executable', 'command_line', 'command', 'arguments', 'user', 'event_type', 'action', 'outcome', 'collector', 'physical_host', 'vm', 'structured'];
    const keys = [...priority.filter(key => key in value), ...Object.keys(value).filter(key => !priority.includes(key))];
    const result: Metadata = {};
    for (const key of keys.slice(0, 32)) { const item = compact(value[key], depth + 1, key); if (jsonSize({ ...result, [key]: item }) <= 170000) result[key] = item; }
    return result;
  }
  return value;
}
export function boundedMetadata(value: Metadata): Metadata {
  const clean = scrubMetadata(value) as Metadata, size = jsonSize(clean);
  return size <= 230000 ? clean : { ...compact(clean) as Metadata, telemetry_truncated: true, metadata_original_bytes: size, metadata_preview: fitText(JSON.stringify(clean), 32000) };
}
export function event(config: Config, sourceId: string, service: string, message: string, timestamp: string, metadata: Metadata = {}, level = 'info'): LogEvent {
  return { sourceEventId: sha(config.host + ':' + sourceId), service: chars(service, 256), host: config.host, message: chars(scrub(message), 65536) || '(empty)', timestamp, level, metadata: boundedMetadata(metadata) };
}
export function syncDirectory(path: string) { const fd = fs.openSync(path, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
export class Store {
  private staged = new Map<string, string>();
  private pendingBatches = 0;
  constructor(public root = process.env.HANASAND_LOG_STATE || '/var/lib/hanasand-log-collector', public persistence?: Persistence) { fs.mkdirSync(root, { recursive: true, mode: 0o700 }); }
  path(name: string) { return join(this.root, name); }
  readRaw(name: string): string | null { return this.staged.get(name) ?? (fs.existsSync(this.path(name)) ? fs.readFileSync(this.path(name), 'utf8') : null); }
  load<T>(name: string, fallback: T): T { const raw = this.readRaw(name); return raw === null ? fallback : JSON.parse(raw) as T; }
  save(name: string, value: unknown) { this.saveRaw(name, JSON.stringify(value)); }
  saveRaw(name: string, data: string) {
    const path = this.path(name);
    if (this.persistence) {
      if (this.readRaw(name) === data) return;
      this.persistence.checkpoint(path, data); this.staged.set(name, data); return;
    }
    const pending = path + '.' + randomUUID() + '.tmp', fd = fs.openSync(pending, 'wx', 0o600);
    try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(pending, path); syncDirectory(dirname(path));
  }
  async durable() { if (this.persistence) { await this.persistence.barrier(); this.pendingBatches = 0; } }
  queueBatch(batch: LogEvent[], lane: string, atomic = false) {
    const root = this.path('queue/' + lane);
    fs.mkdirSync(root, { recursive: true, mode: 0o700 });
    if (!this.persistence) { syncDirectory(dirname(root)); syncDirectory(this.root); }
    const identity = (BigInt(Date.now()) * 1000000n).toString().padStart(20, '0') + '-' + randomUUID().replaceAll('-', '');
    const pending = join(root, identity + '.pending'), path = join(root, identity + '.json');
    const fd = fs.openSync(pending, 'wx', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify({ events: batch, ...(atomic ? { atomic: true } : {}) })); if (!this.persistence) fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    if (this.persistence) { this.persistence.queue(pending); this.pendingBatches++; }
    else { fs.renameSync(pending, path); syncDirectory(root); }
  }
  async send(events: Events) {
    const batches: Record<string, LogEvent[]> = { live: [], history: [] }, sizes = { live: 0, history: 0 };
    let flushed = performance.now();
    const flush = () => { for (const lane of ['live', 'history'] as const) if (batches[lane].length) { this.queueBatch(batches[lane], lane); batches[lane] = []; sizes[lane] = 0; } };
    const laneFor = (item: LogEvent) => !Number.isFinite(Date.parse(item.timestamp)) || Date.parse(item.timestamp) >= Date.now() - 60000 ? 'live' : 'history';
    const append = async (item: LogEvent) => {
      if (this.pendingBatches >= 128) await this.durable();
      const lane = laneFor(item), size = jsonSize(item);
      if (batches[lane].length && (sizes[lane] + size > BATCH_BYTES || batches[lane].length >= BATCH_COUNT)) { this.queueBatch(batches[lane], lane); batches[lane] = []; sizes[lane] = 0; }
      batches[lane].push(item); sizes[lane] += size;
      if (performance.now() - flushed >= 100) { flush(); flushed = performance.now(); }
    };
    for await (const item of events) {
      if ('atomic' in item && item.atomic === true) {
        if (!item.events.length) continue;
        if (item.events.length <= BATCH_COUNT && jsonSize({ events: item.events }) <= BATCH_BYTES) {
          if (this.pendingBatches >= 128) await this.durable();
          // Correlated evidence must reach the receiver together. This is only
          // a transport boundary; the receiver still evaluates its saved rules.
          flush();
          this.queueBatch(item.events, item.events.some(event => laneFor(event) === 'live') ? 'live' : 'history', true);
          flushed = performance.now();
        } else {
          // Oversized groups lose grouping, never evidence or the existing limits.
          for (const event of item.events) await append(event);
        }
      } else await append(item as LogEvent);
    }
    flush();
  }
  queuedNames(lane: string, limit: number): string[] {
    const root = this.path('queue/' + lane); if (!fs.existsSync(root)) return [];
    const names: string[] = [], directory = fs.opendirSync(root);
    try { for (let entry; (entry = directory.readSync());) {
      if (!entry.name.endsWith('.json')) continue;
      // Keep only the first 100 names, regardless of backlog size.
      if (names.length < limit || entry.name < names[names.length - 1]) { names.push(entry.name); names.sort(); if (names.length > limit) names.pop(); }
    } } finally { directory.closeSync(); }
    return names.map(name => join(root, name));
  }
  queuedBatches(lane: string): string[] {
    if (lane === 'history' && this.queuedNames('live', 1).length) return [];
    const paths: string[] = []; let size = 0, count = 0;
    for (const path of this.queuedNames(lane, BATCH_COUNT)) {
      const raw = readBounded(path, 512000), batch = JSON.parse(raw.toString()) as { events: LogEvent[]; atomic?: boolean }, entries = batch.events.length;
      if (batch.atomic && paths.length) break;
      if (paths.length && (size + raw.length > BATCH_BYTES || count + entries > BATCH_COUNT)) break;
      paths.push(path); size += raw.length; count += entries;
      if (batch.atomic) break;
    }
    return paths;
  }
}
export function readBounded(path: string, limit: number): Buffer {
  const fd = fs.openSync(path, 'r');
  try { const buffer = Buffer.alloc(limit + 1); const size = fs.readSync(fd, buffer, 0, buffer.length, 0); if (size > limit) throw new Error('Record exceeds size limit'); return buffer.subarray(0, size); }
  finally { fs.closeSync(fd); }
}
export class DeliveryError extends Error { override name = 'DeliveryError'; }
export class CollectionError extends Error { override name = 'CollectionError'; }
export class CommandError extends Error {
  override name = 'CommandError';
  constructor(public code: number | null, public reason?: string) { super('Command collection failed'); }
}
export class TimeoutError extends Error { override name = 'TimeoutError'; }
export const collectionError = (error: unknown) => error instanceof CollectionError || error instanceof DeliveryError ? error.message : error instanceof Error ? error.name : 'Error';
export class Delivery {
  url: URL; agent: http.Agent | https.Agent;
  eventAgeSeconds = 0;
  private acknowledged = new Map<string, number>();
  constructor(public config: Config, private persistence?: Persistence) {
    this.url = new URL(config.url || '');
    if (!['http:', 'https:'].includes(this.url.protocol) || this.url.username || this.url.password) throw new Error('Invalid ingestion URL');
    if (this.url.protocol === 'http:' && !['127.0.0.1', 'localhost', '[::1]'].includes(this.url.hostname)) throw new Error('Remote ingestion requires HTTPS');
    this.agent = this.url.protocol === 'https:' ? new https.Agent({ keepAlive: true, maxSockets: 1 }) : new http.Agent({ keepAlive: true, maxSockets: 1 });
  }
  close() { this.agent.destroy(); }
  async deliver(paths: string[]): Promise<number> {
    const batches = paths.map(path => JSON.parse(readBounded(path, 512000).toString()) as { events: LogEvent[]; atomic?: boolean });
    const atomic = batches.some(batch => batch.atomic === true);
    if (atomic && paths.length !== 1) throw new DeliveryError('Atomic evidence group must be delivered separately');
    const queued = batches.flatMap(batch => batch.events);
    if (queued.some(item => typeof item.sourceEventId !== 'string' || !item.sourceEventId)) throw new DeliveryError('Missing stable event identity');
    // Live and recovery cursors overlap. Only skip IDs for which this process
    // already received an exact durable ACK; restart/expiry safely replays them.
    const now = Date.now();
    for (const [id, at] of this.acknowledged) { if (at > now - 120000) break; this.acknowledged.delete(id); }
    const seen = new Set<string>();
    // Replays of correlated evidence must include every member, even when one
    // member was acknowledged earlier without the later completion evidence.
    const events = atomic ? queued : queued.filter(item => { if (this.acknowledged.has(item.sourceEventId) || seen.has(item.sourceEventId)) return false; seen.add(item.sourceEventId); return true; });
    const payload = JSON.stringify({ events });
    if (Buffer.byteLength(payload) > 512000 || events.length > BATCH_COUNT) throw new Error('Delivery batch exceeds ingestion limit');
    if (events.length) try {
      await new Promise<void>((resolve, reject) => {
        const transport = this.url.protocol === 'https:' ? https : http;
        const request = transport.request(this.url, { method: 'POST', agent: this.agent, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), Authorization: 'Bearer ' + this.config.token } }, response => {
          const buffers: Buffer[] = []; let size = 0;
          response.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 4096) response.destroy(new DeliveryError('Oversized ingestion acknowledgement')); else buffers.push(chunk); });
          response.on('error', reject);
          response.on('end', () => { try {
            if (response.statusCode !== 201) throw new DeliveryError('Ingestion HTTP ' + response.statusCode);
            const ack = JSON.parse(Buffer.concat(buffers).toString());
            if (ack.ok !== true || ack.accepted !== events.length) throw new DeliveryError('Ingestion acknowledgement mismatch');
            resolve();
          } catch (error) { reject(error); } });
        });
        const timer = setTimeout(() => request.destroy(new TimeoutError()), 8000);
        request.on('close', () => clearTimeout(timer)); request.on('error', reject); request.end(payload);
      });
    } catch (error) { this.close(); throw error; }
    for (const item of events) this.acknowledged.set(item.sourceEventId, Date.now());
    while (this.acknowledged.size > 10000) this.acknowledged.delete(this.acknowledged.keys().next().value!);
    for (const path of paths) fs.unlinkSync(path);
    if (paths.length) { if (this.persistence) this.persistence.dirty(); else syncDirectory(dirname(paths[0])); }
    this.eventAgeSeconds = Math.max(0, ...events.map(item => Number.isFinite(Date.parse(item.timestamp)) ? (Date.now() - Date.parse(item.timestamp)) / 1000 : 0));
    return queued.length;
  }
}
export async function* recordLines(input: AsyncIterable<Buffer | string>): AsyncGenerator<string> {
  let chunks: Buffer[] = [], size = 0;
  for await (const value of input) {
    const chunk = typeof value === 'string' ? Buffer.from(value) : value;
    let begin = 0;
    for (let end; (end = chunk.indexOf(10, begin)) >= 0;) {
      const part = chunk.subarray(begin, end + 1); size += part.length;
      if (size > MAX_RECORD_BYTES) throw new Error('Source record exceeds 8MB; cursor retained');
      chunks.push(part); yield Buffer.concat(chunks, size).toString('utf8'); chunks = []; size = 0; begin = end + 1;
    }
    if (begin < chunk.length) { chunks.push(chunk.subarray(begin)); size += chunk.length - begin; }
    if (size > MAX_RECORD_BYTES) throw new Error('Source record exceeds 8MB; cursor retained');
  }
  if (size) yield Buffer.concat(chunks, size).toString('utf8');
}
export interface CommandOptions { accepted?: number[]; timeout?: number; merged?: boolean; disk?: boolean; raw?: boolean; attestExecution?: boolean }
export class Commands {
  constructor(public store: Store) {}
  async *stream(args: string[], options: CommandOptions = {}): AsyncGenerator<string> {
    const root = this.store.path('capture'); fs.mkdirSync(root, { recursive: true, mode: 0o700 });
    const base = join(root, randomUUID()), errorPath = base + '.err', outputPath = base + '.out';
    const errorFd = fs.openSync(errorPath, 'wx', 0o600);
    const outputFd = options.disk ? fs.openSync(outputPath, 'wx', 0o600) : undefined;
    const started = Date.now();
    const child = spawn(args[0], args.slice(1), { env: { ...process.env, LC_ALL: 'C' }, stdio: ['ignore', outputFd ?? 'pipe', options.merged && outputFd !== undefined ? outputFd : errorFd] });
    let expired = false;
    const timer = setTimeout(() => { expired = true; child.kill('SIGKILL'); }, (options.timeout ?? 60) * 1000);
    const completion = new Promise<number | null>((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
    // Attach a handler immediately so spawn failures cannot become unhandled while reading.
    void completion.catch(() => {});
    try {
      if (!options.disk) yield* recordLines(child.stdout!);
      const code = await completion;
      if (expired) throw new TimeoutError();
      const detail = readBoundedPrefix(options.merged ? outputPath : errorPath, 4096).toString().trim();
      if (!(options.accepted || [0]).includes(code ?? -1) || (code === 1 && !['', '<no matches>'].includes(detail))) {
        const reason = [['No such container', 'removed during collection'], ['does not support reading', 'logging driver does not support reading'], ['invalid character', 'invalid log data']].find(([fragment]) => detail.includes(fragment))?.[1];
        throw new CommandError(code, reason);
      }
      if (options.attestExecution && code === 0 && fs.statSync(errorPath).size === 0 && child.pid) recordExecution(this.store.root, child.pid, args, started);
      if (options.disk) {
        if (options.raw) { for await (const chunk of fs.createReadStream(outputPath, { encoding: 'utf8' })) yield chunk as string; }
        else yield* recordLines(fs.createReadStream(outputPath));
      }
    } finally {
      clearTimeout(timer); if (child.exitCode === null) child.kill('SIGKILL'); await completion.catch(() => {});
      fs.closeSync(errorFd); if (outputFd !== undefined) fs.closeSync(outputFd);
      fs.rmSync(errorPath, { force: true }); if (outputFd !== undefined) fs.rmSync(outputPath, { force: true });
    }
  }
  async run(args: string[], options: CommandOptions = {}): Promise<string> {
    let result = '';
    for await (const line of this.stream(args, options)) { result += line; if (Buffer.byteLength(result) > MAX_RECORD_BYTES) throw new Error('Command output exceeds 8MB'); }
    return result;
  }
}
export function readBoundedPrefix(path: string, limit: number): Buffer {
  const fd = fs.openSync(path, 'r'); try { const buffer = Buffer.alloc(limit); return buffer.subarray(0, fs.readSync(fd, buffer, 0, limit, 0)); } finally { fs.closeSync(fd); }
}
export { fs, join, dirname, basename, randomUUID, sleep };
