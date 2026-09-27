#!/usr/bin/env node
/** Release the scheduled log worker without interrupting a backup or index build. */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync, writeFileSync, unlinkSync, chmodSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const release = process.argv[2]
if (!/^[0-9a-f]{40}$/.test(release || '')) throw new Error('Pass the full built release commit.')
if (process.env.HANASAND_DEPLOY_LOCK_HELD !== '1') {
    const entrypoint = process.env.HANASAND_TYPESCRIPT_ENTRYPOINT || fileURLToPath(import.meta.url)
    const runner = path.resolve(path.dirname(entrypoint), '../run-typescript-node.sh')
    const locked = spawnSync('flock', ['-x', '/tmp/hanasand-frontend-deploy.lock', runner, entrypoint, release], {
        env: { ...process.env, HANASAND_DEPLOY_LOCK_HELD: '1' }, stdio: 'inherit',
    })
    process.exit(locked.status ?? 1)
}

const catchup = {}
for (const [key, minimum, maximum] of [['LOG_CATCHUP_BATCH_LIMIT', 1, 1000], ['LOG_CATCHUP_HISTORY_LIMIT', 1, 10000], ['LOG_CATCHUP_INTERVAL_MS', 50, 5000]]) {
    if (process.env[key] === undefined) continue
    if (!/^\d+$/.test(process.env[key]) || Number(process.env[key]) < minimum || Number(process.env[key]) > maximum) throw new Error(`${key} must be an integer from ${minimum} to ${maximum}.`)
    catchup[key] = process.env[key]
}
const image = `hanasand-recovery-api:${release}`
const root = '/home/hanasand/hanasand'
const docker = (args, options = {}) => execFileSync('docker', args, { encoding: 'utf8', ...options }).trim()
const psql = sql => docker(['exec', 'hanasand_database', 'psql', '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-U', 'hanasand', '-d', 'hanasand', '-c', sql])
if (psql('SELECT count(*) FROM pg_stat_progress_create_index WHERE datname=current_database()') !== '0') {
    throw new Error('Wait for the database index build to finish before restarting the scheduled worker. The existing worker has been left running.')
}
if (psql("SELECT count(*) FROM pg_stat_activity WHERE application_name='pg_dump' AND xact_start IS NOT NULL") !== '0') {
    const tracked = psql("SELECT to_regclass('public.app_schema_releases') IS NOT NULL") === 't'
    const applied = tracked && psql(`SELECT EXISTS(SELECT 1 FROM app_schema_releases WHERE release='${release}')`) === 't'
    if (!applied) throw new Error('Wait for the database backup to finish before applying a new schema release. The existing worker has been left running.')
}
const api = JSON.parse(docker(['inspect', 'hanasand_api']))[0]
const settings = Object.fromEntries(api.Config.Env.map(item => {
    const separator = item.indexOf('=')
    return [item.slice(0, separator), item.slice(separator + 1)]
}))
function readObject(file, allowed, label, minLength = 1) {
    if (!existsSync(file)) return {}
    const value = JSON.parse(readFileSync(file, 'utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.entries(value).some(([key, item]) => !allowed.has(key) || typeof item !== 'string' || item.length < minLength)) {
        throw new Error(`Invalid ${label} configuration`)
    }
    return value
}
let support = {}
const supportPath = '/home/hanasand/hanasand/ops/runtime/support.json'
if (existsSync(supportPath)) {
    const source = JSON.parse(readFileSync(supportPath, 'utf8'))
    if (typeof source.SUPPORT_SERVICE_KEY !== 'string' || source.SUPPORT_SERVICE_KEY.length < 32 ||
        !['http://127.0.0.1:29181', 'http://127.0.0.1:19181'].includes(source.SUPPORT_SERVICE_BASE)) throw new Error('Invalid private support routing configuration')
    support = { SUPPORT_SERVICE_KEY: source.SUPPORT_SERVICE_KEY }
}
const verificationPath = '/home/hanasand/hanasand/ops/runtime/probe-verification.json'
let verification = {}
if (existsSync(verificationPath)) {
    const stats = lstatSync(verificationPath)
    if (!stats.isFile() || stats.mode & 0o077) throw new Error('Probe verification configuration must be a private regular file')
    verification = readObject(verificationPath, new Set(['MODEL_PROBE_PROOF_KEY', 'READINESS_AUDIT_PROOF_PUBLIC_KEY']), 'probe verification')
    if (!Object.keys(verification).length || Object.values(verification).some(value => !/^[a-f0-9]{64}$/.test(value))) throw new Error('Invalid probe verification configuration')
}
Object.assign(settings, support, verification, { HANASAND_APP_UPDATE_DIR: '/srv/hanasand/app-updates', DB_BACKUP_WORKER_SOCKET: '/var/lib/hanasand/backups/database/.worker.sock' })
Object.assign(settings, readObject('/home/hanasand/hanasand/ops/runtime/log-ingest.json', new Set(['LOG_INGEST_TOKEN']), 'log ingestion', 32))
Object.assign(settings, readObject('/home/hanasand/hanasand/ops/runtime/mail.json', new Set(['MAIL_ADMIN_USERNAME', 'MAIL_ADMIN_PASSWORD', 'MAIL_SERVICE_KEY', 'MAIL_SYSTEM_SENDER_PASSWORD', 'MAIL_INTERNAL_URL', 'MAIL_SMTP_INTERNAL_PORT']), 'mail runtime'))
if (settings.API_HTTP_ONLY === '1') throw new Error('Expected a full API container as the scheduled worker source')
execFileSync('docker', ['image', 'inspect', image], { stdio: 'ignore' })
const override = `/tmp/monitoring-worker-${process.pid}.json`
writeFileSync(override, '', { mode: 0o600, flag: 'wx' })
chmodSync(override, 0o600)
function apply(target, environment) {
    writeFileSync(override, JSON.stringify({ services: { api: { image: target, command: api.Config.Cmd, environment,
        stop_grace_period: '65s', volumes: ['/home/hanasand/hanasand/ops/runtime/status:/recovery:ro'],
        networks: { hanasandnet: { gw_priority: 1 }, pwnednet: {}, browsernet: {} } } } }))
    execFileSync('docker', ['compose', '-f', 'docker-compose.yml', '-f', override, 'up', '-d', '--no-deps', '--no-build', 'api'], { cwd: root, stdio: 'inherit' })
}
async function ready(expected) {
    for (let attempt = 0; attempt < 90; attempt++) {
        try {
            const response = await fetch('http://127.0.0.1:8080/health', { signal: AbortSignal.timeout(3000) })
            const state = await response.json()
            if (response.ok && state.ok && state.release === expected) return
        } catch { /* Retry while the container starts or reloads. */ }
        await delay(2000)
    }
    throw new Error('Scheduled worker readiness failed')
}
try {
    try {
        apply(image, { ...settings, ...catchup, HANASAND_RELEASE_COMMIT: release, VM_HOST_ID: 'inspur' })
        await ready(release)
    } catch (error) {
        apply(api.Image, settings)
        await ready(settings.HANASAND_RELEASE_COMMIT || 'unknown')
        throw error
    }
    console.log(`Scheduled worker ready at ${release}`)
} finally { unlinkSync(override) }
