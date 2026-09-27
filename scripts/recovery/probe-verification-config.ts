/** Load private verification keys only into log-processing API processes. */
import { lstatSync, readFileSync } from 'node:fs'

export function probeVerificationSettings(file = '/home/hanasand/hanasand/ops/runtime/probe-verification.json') {
    let stats
    try { stats = lstatSync(file) } catch (error) { if (error.code === 'ENOENT') return {}; throw error }
    if (!stats.isFile() || (stats.mode & 0o077)) throw new Error('Probe verification configuration must be a private regular file')
    const config = JSON.parse(readFileSync(file, 'utf8'))
    const allowed = new Set(['MODEL_PROBE_PROOF_KEY', 'READINESS_AUDIT_PROOF_PUBLIC_KEY'])
    if (!config || typeof config !== 'object' || Array.isArray(config) || !Object.keys(config).length ||
        Object.entries(config).some(([key, value]) => !allowed.has(key) || typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))) {
        throw new Error('Invalid probe verification configuration')
    }
    return config
}
