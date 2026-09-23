import * as fs from 'node:fs';
import { join } from 'node:path';

const unit = '/system.slice/hanasand-log-collector.service';
let lastCleanup = 0;
export interface Execution {
  unit: string; boot_id: string; pid: string; parent_pid: string;
  started_at: number; finished_at: number; executable: string; arguments: string[];
  exit_code: number; stderr_empty: boolean;
}
// These are short-lived completion receipts, not a new log queue. Missing or
// expired receipts keep the original audit record. Workers share this directory.
export function recordExecution(root: string, pid: number, args: string[], started: number) {
  try {
    if (process.getuid?.() !== 0 || !['journalctl', 'ausearch'].includes(args[0])
      || !fs.readFileSync('/proc/self/cgroup', 'utf8').split('\n').some(line => line.split(':')[2] === unit)
      || fs.readFileSync('/proc/self/loginuid', 'utf8').trim() !== '4294967295') return;
    const directory = join(root, 'completed-executions'); fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const now = Date.now();
    if (now - lastCleanup > 60_000) {
      for (const name of fs.readdirSync(directory)) {
        if (/^\d+-\d+\.json$/.test(name) && Number(name.split('-')[0]) < Math.floor(now / 60_000) - 5) fs.rmSync(join(directory, name), { force: true });
      }
      lastCleanup = now;
    }
    const receipt: Execution = { unit: 'hanasand-log-collector.service', boot_id: fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim(),
      pid: String(pid), parent_pid: String(process.pid), started_at: started, finished_at: now,
      executable: args[0] === 'journalctl' ? '/usr/bin/journalctl' : '/usr/sbin/ausearch', arguments: args, exit_code: 0, stderr_empty: true };
    // Readers ignore a partially written receipt; this intentionally fails open.
    fs.writeFileSync(join(directory, `${Math.floor(started / 60_000)}-${pid}.json`), JSON.stringify(receipt), { mode: 0o600, flag: 'wx' });
  } catch { /* Verification is optional; never interrupt collection to drop a log. */ }
}
export function executionReceipts(root: string, pid: string, timestamp: number): Execution[] {
  if (!/^[1-9]\d*$/.test(pid) || timestamp < Date.now() - 300_000 || timestamp > Date.now()) return [];
  try {
    const boot = fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim(), directory = join(root, 'completed-executions');
    const minute = Math.floor(timestamp / 60_000);
    // A command has a 60-second timeout. Read at most two specific receipts,
    // rather than scanning all recent executions for every audit batch.
    return [minute, minute - 1].flatMap(bucket => {
      try { const item = JSON.parse(fs.readFileSync(join(directory, `${bucket}-${pid}.json`), 'utf8')); return item.boot_id === boot ? [item] : []; } catch { return []; }
    });
  } catch { return []; }
}
export type ExecutionLookup = Execution[] | ((pid: string, timestamp: number) => Execution[]);
export function matchingExecution(attrs: Record<string, string>, argv: string[], timestamp: number, receipts: ExecutionLookup) {
  if (attrs.success !== 'yes' || attrs.exit !== '0' || attrs.uid !== '0' || attrs.auid !== '4294967295'
    || attrs.tty !== '(none)' || attrs.ses !== '4294967295'
    || !['journalctl', 'ausearch'].includes(argv[0])
    || ['euid', 'suid', 'fsuid', 'gid', 'egid', 'sgid', 'fsgid'].some(key => attrs[key] !== '0')) return undefined;
  const completed = typeof receipts === 'function' ? receipts(attrs.pid, timestamp) : receipts;
  return completed.find(item => item.pid === attrs.pid && item.parent_pid === attrs.ppid
    && timestamp >= item.started_at && timestamp <= item.finished_at && item.exit_code === 0 && item.stderr_empty
    && item.executable === attrs.exe?.replace(/^"|"$/g, '') && JSON.stringify(item.arguments) === JSON.stringify(argv));
}
