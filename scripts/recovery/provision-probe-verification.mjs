import { generateKeyPairSync, createPrivateKey, createPublicKey, randomBytes } from 'node:crypto';
import { existsSync, lstatSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const configPath = '/home/hanasand/hanasand/ops/runtime/probe-verification.json';
const privatePath = '/var/lib/hanasand-log-collector/readiness-private.pem';
const scratch = mkdtempSync(join(tmpdir(), 'hanasand-probe-keys-'));
const stagedPrivate = join(scratch, 'readiness-private.pem');
const allowed = ['MODEL_PROBE_PROOF_KEY', 'READINESS_AUDIT_PROOF_PUBLIC_KEY'];
try {
    const existing = existsSync(configPath);
    if (existing && (!lstatSync(configPath).isFile() || (lstatSync(configPath).mode & 0o077))) throw new Error('Expected a private regular verification file');
    const config = existing ? JSON.parse(readFileSync(configPath, 'utf8')) : {};
    if (!config || Array.isArray(config) || typeof config !== 'object' || Object.keys(config).some(key => !allowed.includes(key))
        || Object.values(config).some(value => typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))) throw new Error('Invalid existing verification configuration');
    const previous = spawnSync('sudo', ['-n', 'install', '-m', '0600', '-o', String(process.getuid()), '-g', String(process.getgid()), privatePath, stagedPrivate], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' } });
    if (previous.status !== 0 && !previous.stderr.includes('No such file or directory')) throw new Error('Cannot inspect existing host signing key');
    const key = previous.status === 0 ? createPrivateKey(readFileSync(stagedPrivate)) : generateKeyPairSync('ed25519').privateKey;
    if (key.asymmetricKeyType !== 'ed25519') throw new Error('Unexpected host signing key type');
    const publicKey = createPublicKey(key).export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
    if (config.READINESS_AUDIT_PROOF_PUBLIC_KEY && config.READINESS_AUDIT_PROOF_PUBLIC_KEY !== publicKey) throw new Error('Existing pinned key does not match host signing key');
    config.READINESS_AUDIT_PROOF_PUBLIC_KEY = publicKey;
    config.MODEL_PROBE_PROOF_KEY ||= randomBytes(32).toString('hex');
    writeFileSync(stagedPrivate, key.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600 });
    execFileSync('sudo', ['-n', 'install', '-m', '0600', stagedPrivate, privatePath]);
    const pending = configPath + '.pending-' + process.pid;
    writeFileSync(pending, JSON.stringify(config) + '\n', { mode: 0o600, flag: 'wx' });
    renameSync(pending, configPath);
    console.log('Probe verification keys configured. Existing keys preserved.');
} finally {
    rmSync(scratch, { recursive: true, force: true });
}
