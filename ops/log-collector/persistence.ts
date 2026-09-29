import * as fs from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import type { MessagePort } from 'node:worker_threads';

export const COMMIT_INTERVAL_MS = 1250;
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
  return new Promise((ok, fail) => execFile('sync', ['-f', root], { timeout: 120000 }, error => {
    if (!error) return ok();
    const detail = error.killed ? 'timed out' : typeof error.code === 'string' || typeof error.code === 'number' ? String(error.code) : 'failed';
    const failure = new Error('Collector persistence barrier failed (' + detail + ')');
    failure.name = 'PersistenceBarrierError'; fail(failure);
  }));
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
  constructor(public root: string, private sync = () => syncFilesystem(root), private interval = COMMIT_INTERVAL_MS, private rename = (from: string, to: string) => fs.renameSync(from, to)) {}
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
      try { await this.flush(); } catch (error) { failed(error); }
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
    let phase = 'checkpoint staging';
    try {
      for (const [path, data] of checkpoints) {
        const pending = path + '.' + randomUUID() + '.tmp'; staged.push([pending, path]);
        fs.writeFileSync(pending, data, { mode: 0o600, flag: 'wx' });
      }
      phase = 'filesystem sync';
      await this.sync();
      phase = 'queue publication';
      for (const path of queues) this.rename(path, path.slice(0, -'.pending'.length) + '.json');
      phase = 'checkpoint publication';
      for (const [pending, path] of staged) this.rename(pending, path);
    }
    catch (error) {
      // Publication can fail after some renames. Keep unpublished files and
      // cursors queued for retry; already-published queue files are durable
      // and need not be renamed again.
      const retryCheckpoints = new Map<string, string>();
      for (const [pending, path] of staged) {
        if (phase === 'checkpoint publication' && !fs.existsSync(pending)) continue;
        fs.rmSync(pending, { force: true }); retryCheckpoints.set(path, checkpoints.get(path)!);
      }
      const retryQueues = new Set([...queues].filter(path => fs.existsSync(path) || !fs.existsSync(path.slice(0, -'.pending'.length) + '.json')));
      this.checkpoints = new Map([...retryCheckpoints, ...this.checkpoints]);
      this.queues = new Set([...retryQueues, ...this.queues]);
      this.waiters = [...waiters, ...this.waiters];
      this.changed = true;
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined;
      const detail = code || (error instanceof Error ? error.message : 'failed');
      const failure = new Error('Collector persistence ' + phase + ' failed (' + detail + ')');
      failure.name = 'PersistenceBarrierError';
      throw failure;
    }
    this.flushes++; this.lastFlushMs = performance.now() - this.lastStarted; this.lastFlushAt = new Date().toISOString();
    // A durable .pending batch survives a crash even if its rename does not.
    // Publish all batches before any cursor that depends on them.
    if (queues.size || staged.length) this.changed = true;
    for (const ok of waiters) ok();
  }
  async recover() {
    for (const lane of ['live', 'history']) {
      let scanned = 0;
      const roots = [
        { path: join(this.root, 'queue', lane, 'current'), recoverPending: true },
        { path: join(this.root, 'queue', lane), recoverPending: false },
      ];
      for (const { path: root, recoverPending } of roots) {
        if (!fs.existsSync(root)) continue;
        const directory = fs.opendirSync(root);
        try {
          for (let entry; (entry = directory.readSync());) {
            if (++scanned % 1000 === 0) await new Promise<void>(resolve => setImmediate(resolve));
            // Legacy flat queues keep their old cursor until publication, so
            // source replay can rebuild these batches without renaming into a
            // directory too large for new writes.
            if (!recoverPending || !entry.name.endsWith('.pending')) continue;
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
}
