import * as fs from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import type { MessagePort } from 'node:worker_threads';

export const COMMIT_INTERVAL_MS = 2000;
export type PersistenceRequest =
  | { persistence: 'checkpoint'; path: string; data: string }
  | { persistence: 'queue'; path: string }
  | { persistence: 'dirty' }
  | { persistence: 'barrier'; id: number };
export interface Persistence {
  checkpoint(path: string, data: string): void;
  queue(path: string): void;
  dirty(): void;
  barrier(): Promise<void>;
}
export function syncFilesystem(root: string): Promise<void> {
  // One syncfs covers file contents AND directory entries. No per-file fsyncs.
  return new Promise((ok, fail) => execFile('sync', ['-f', root], { timeout: 15000 }, error => error ? fail(new Error('Collector persistence barrier failed')) : ok()));
}
export class WorkerPersistence implements Persistence {
  private next = 0;
  private waiting = new Map<number, () => void>();
  constructor(private port: MessagePort) {
    port.on('message', message => {
      if (typeof message?.persisted !== 'number') return;
      this.waiting.get(message.persisted)?.(); this.waiting.delete(message.persisted);
    });
  }
  checkpoint(path: string, data: string) { this.port.postMessage({ persistence: 'checkpoint', path, data }); }
  queue(path: string) { this.port.postMessage({ persistence: 'queue', path }); }
  dirty() { this.port.postMessage({ persistence: 'dirty' }); }
  barrier() {
    const id = ++this.next;
    return new Promise<void>(ok => { this.waiting.set(id, ok); this.port.postMessage({ persistence: 'barrier', id }); });
  }
}
export class GroupCommit implements Persistence {
  private checkpoints = new Map<string, string>();
  private queues = new Set<string>();
  private waiters: (() => void)[] = [];
  private changed = false;
  private active: Promise<void> | null = null;
  private lastStarted = -Infinity;
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  flushes = 0;
  lastFlushMs = 0;
  lastFlushAt?: string;
  constructor(public root: string, private sync = () => syncFilesystem(root), private interval = COMMIT_INTERVAL_MS) {}
  private check(path: string) {
    const name = relative(resolve(this.root), resolve(path));
    if (!name || name.startsWith('..') || name.startsWith('/')) throw new Error('Persistence path outside collector state');
  }
  checkpoint(path: string, data: string) { this.check(path); this.checkpoints.set(path, data); this.changed = true; }
  queue(path: string) { this.check(path); if (!path.endsWith('.pending')) throw new Error('Invalid pending batch'); this.queues.add(path); this.changed = true; }
  dirty() { this.changed = true; }
  barrier() { this.changed = true; return new Promise<void>(ok => this.waiters.push(ok)); }
  accept(message: PersistenceRequest, reply: (value: { persisted: number }) => void) {
    switch (message.persistence) {
      case 'checkpoint': this.checkpoint(message.path, message.data); break;
      case 'queue': this.queue(message.path); break;
      case 'dirty': this.dirty(); break;
      case 'barrier': void this.barrier().then(() => reply({ persisted: message.id })); break;
    }
  }
  start(failed: (error: unknown) => void) {
    const tick = async () => {
      try { await this.flush(); } catch (error) { failed(error); return; }
      if (!this.stopped) this.timer = setTimeout(tick, this.interval);
    };
    this.timer = setTimeout(tick, this.interval);
  }
  async close() {
    this.stopped = true; clearTimeout(this.timer);
    if (this.active) await this.active;
    await this.flush(); // Commit queued contents before publishing cursors.
    await this.flush(); // Persist the resulting renames and acknowledged deletions.
  }
  async flush(): Promise<void> {
    if (this.active) return this.active;
    if (!this.changed) return;
    this.active = this.commit();
    try { await this.active; } finally { this.active = null; }
  }
  private async commit() {
    const wait = this.interval - (performance.now() - this.lastStarted);
    if (wait > 0) await new Promise(ok => setTimeout(ok, wait));
    this.lastStarted = performance.now();
    // Only cursors received BEFORE this barrier may be published afterward.
    // Each source posts its queue writes before posting its corresponding cursor.
    const checkpoints = this.checkpoints, queues = this.queues, waiters = this.waiters;
    this.checkpoints = new Map(); this.queues = new Set(); this.waiters = []; this.changed = false;
    const staged: [string, string][] = [];
    for (const [path, data] of checkpoints) {
      const pending = path + '.' + randomUUID() + '.tmp';
      fs.writeFileSync(pending, data, { mode: 0o600, flag: 'wx' }); staged.push([pending, path]);
    }
    await this.sync();
    this.flushes++; this.lastFlushMs = performance.now() - this.lastStarted; this.lastFlushAt = new Date().toISOString();
    // A durable .pending batch survives a crash even if its rename does not.
    // Publish all batches before any cursor that depends on them.
    for (const path of queues) fs.renameSync(path, path.slice(0, -'.pending'.length) + '.json');
    for (const [pending, path] of staged) fs.renameSync(pending, path);
    if (queues.size || staged.length) this.changed = true;
    for (const ok of waiters) ok();
  }
  recover() {
    for (const lane of ['live', 'history']) {
      const root = join(this.root, 'queue', lane); if (!fs.existsSync(root)) continue;
      const directory = fs.opendirSync(root);
      try {
        for (let entry; (entry = directory.readSync());) {
          if (!entry.name.endsWith('.pending')) continue;
          const path = join(root, entry.name);
          // An interrupted, unpublished batch cannot have advanced a durable
          // cursor. Quarantine it; source replay recovers its stable event IDs.
          try {
            if (fs.statSync(path).size > 512000) throw new Error('Oversized pending batch');
            const value = JSON.parse(fs.readFileSync(path, 'utf8'));
            if (!Array.isArray(value.events) || !value.events.length) throw new Error('Invalid pending batch');
            this.queue(path);
          } catch { fs.renameSync(path, path + '.interrupted'); this.dirty(); }
        }
      } finally { directory.closeSync(); }
    }
  }
}
