import { lstatSync, readFileSync, readdirSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { LogEvent, Json } from './core';
import { eligibleModelDiscovery, modelLogDigest, modelProofMac, validModelProofMac } from '../../api/src/utils/mill/analyzeModelDiscovery';

type Proof = Record<string, unknown>;
const cache = new Map<string, { stamp: string; proofs: Proof[] }>();
function receipts(file: string): Proof[] {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.size > 8 * 1024 * 1024 || (stat.mode & 0o077)) return [];
  const stamp = `${stat.ino}:${stat.size}:${stat.mtimeMs}`;
  if (cache.get(file)?.stamp === stamp) return cache.get(file)!.proofs;
  const proofs = readFileSync(file, 'utf8').trim().split('\n').map(line => JSON.parse(line)) as Proof[];
  if (cache.size >= 4) cache.delete(cache.keys().next().value!);
  cache.set(file, { stamp, proofs });
  return proofs;
}
function verificationKey(file: string): string {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.size > 4096 || (stat.mode & 0o077) || ![0, 1000, process.getuid?.()].includes(stat.uid)) return '';
  const key = JSON.parse(readFileSync(file, 'utf8')).MODEL_PROBE_PROOF_KEY;
  return typeof key === 'string' && /^[a-f0-9]{64}$/.test(key) ? key : '';
}
// Inspect the host listener, not an asserted port or a process-name match.
export function ownsModelListener(pid: string, port: number, proc = '/proc'): boolean {
  if (!/^[1-9]\d*$/.test(pid) || !Number.isInteger(port) || port < 18081 || port > 18088) return false;
  try {
    const sockets = new Set(readFileSync(join(proc, 'net/tcp'), 'utf8').trim().split('\n').slice(1).flatMap(line => {
      const fields = line.trim().split(/\s+/), [address, hexPort] = (fields[1] || '').split(':');
      return fields[3] === '0A' && ['0100007F', '00000000'].includes(address) && parseInt(hexPort, 16) === port ? [`socket:[${fields[9]}]`] : [];
    }));
    return sockets.size > 0 && readdirSync(join(proc, pid, 'fd')).some(fd => {
      try { return sockets.has(readlinkSync(join(proc, pid, 'fd', fd))); } catch { return false; }
    });
  } catch { return false; }
}
export function enrichModelProbe(log: LogEvent, cursor: string, options: {
  directory?: string; keyFile?: string; proc?: string;
} = {}): LogEvent {
  if (log.host !== 'inspur' || log.service !== 'run_model_inspur_vllm_gpu.sh' || log.level !== 'info'
    || Object.keys(log.metadata).sort().join(',') !== 'collector,pid,unit,user'
    || log.metadata.collector !== 'journal' || log.metadata.unit !== 'hanasand-model.service') return log;
  const match = /^\(APIServer pid=([1-9]\d*)\) INFO: +127\.0\.0\.1:([1-9]\d*) - "GET \/v1\/models\?hanasand_probe=([a-f0-9-]{36}) HTTP\/1\.1" 200 OK$/.exec(log.message);
  if (!match || log.metadata.pid !== match[1]) return log;
  try {
    const key = verificationKey(options.keyFile || process.env.MODEL_PROBE_VERIFICATION_FILE || '/home/hanasand/resilience/probe-verification.json');
    if (!key) return log;
    const time = Date.parse(log.timestamp);
    if (!Number.isFinite(time)) return log;
    const directory = options.directory || process.env.MODEL_PROBE_PROOF_DIR || '/var/lib/hanasand/model-probe-receipts';
    // Completion may cross an hour boundary. Absence or partial writes keep immediately.
    const hours = new Set([time - 1000, time, time + 1000].map(value => new Date(value).toISOString().slice(0, 13)));
    const candidates: Proof[] = [];
    for (const hour of hours) {
      try { candidates.push(...receipts(join(directory, hour + '.jsonl')).filter(proof => proof.nonce === match[3])); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return log; }
    }
    if (candidates.length !== 1) return log;
    const proof = candidates[0];
    if (proof.serverPid !== null || proof.logSha256 !== null || !validModelProofMac(proof, key)
      || !ownsModelListener(match[1], proof.serverPort as number, options.proc)) return log;
    const bound: Proof = { ...proof, serverPid: match[1], logSha256: modelLogDigest(log, cursor) };
    bound.mac = modelProofMac(bound, key);
    const enriched = { ...log, metadata: { ...log.metadata, cursor, model_probe: bound as Json } };
    return eligibleModelDiscovery(enriched, key) ? enriched : log;
  } catch { return log; }
}
