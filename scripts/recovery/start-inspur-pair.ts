#!/usr/bin/env node
/** Start unused local slots, inheriting the existing app's runtime settings locally. */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'

const [kind, image, source, ...ports] = process.argv.slice(2)
if (!['api', 'auth', 'frontend'].includes(kind) || ports.length !== 2 || !ports.every(port => /^\d+$/.test(port) && Number(port) > 1024 && Number(port) < 65535)) {
    throw new Error('Expected api|auth|frontend, image, source container, and two valid ports')
}

function inspect(...names) { return JSON.parse(execFileSync('docker', ['inspect', ...names], { encoding: 'utf8' })) }
function loadObject(file, allowed, label, minimumLength = 1) {
    if (!existsSync(file)) return {}
    const value = JSON.parse(readFileSync(file, 'utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.has(key)) ||
        Object.values(value).some(item => typeof item !== 'string' || item.length < minimumLength)) throw new Error(`Invalid ${label} configuration`)
    return value
}
function supportSettings() {
    const config = loadObject('/home/hanasand/hanasand/ops/runtime/support.json', new Set(['SUPPORT_SERVICE_KEY', 'SUPPORT_SERVICE_BASE']), 'private support routing')
    if (!Object.keys(config).length) return {}
    if (config.SUPPORT_SERVICE_KEY?.length < 32 || !['http://127.0.0.1:29181', 'http://127.0.0.1:19181'].includes(config.SUPPORT_SERVICE_BASE)) throw new Error('Invalid private support routing configuration')
    return { SUPPORT_SERVICE_KEY: config.SUPPORT_SERVICE_KEY, SUPPORT_SERVICE_BASE: config.SUPPORT_SERVICE_BASE }
}
function probeSettings() {
    const file = '/home/hanasand/hanasand/ops/runtime/probe-verification.json'
    if (!existsSync(file)) return {}
    const stats = lstatSync(file)
    if (!stats.isFile() || (stats.mode & 0o077)) throw new Error('Probe verification configuration must be a private regular file')
    const config = JSON.parse(readFileSync(file, 'utf8'))
    const allowed = new Set(['MODEL_PROBE_PROOF_KEY', 'READINESS_AUDIT_PROOF_PUBLIC_KEY'])
    if (!config || typeof config !== 'object' || Array.isArray(config) || !Object.keys(config).length ||
        Object.entries(config).some(([key, value]) => !allowed.has(key) || typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))) throw new Error('Invalid probe verification configuration')
    return config
}
function pairName(port) {
    const portsByKind = { api: [20802, 20803, 8082, 8083], frontend: [3200, 3300, 3000, 3100], auth: [8183, 8184, 8181, 8182] }
    const index = portsByKind[kind].indexOf(Number(port))
    if (index < 0) throw new Error(`Unsupported ${kind} slot ${port}`)
    return `hanasand-${kind}-${index + 1}`
}
function available(port) {
    return new Promise((resolve, reject) => {
        const server = createServer()
        server.once('error', reject)
        server.listen(Number(port), '127.0.0.1', () => server.close(error => error ? reject(error) : resolve()))
    })
}

const original = inspect(source)[0]
const settings = Object.fromEntries(original.Config.Env.map(item => {
    const separator = item.indexOf('=')
    return [item.slice(0, separator), item.slice(separator + 1)]
}))
if (kind === 'api' || kind === 'auth') settings.COMPACT_PWNED_RANGE_API = 'http://127.0.0.1:8099/range'
if (kind === 'api') {
    Object.assign(settings, supportSettings(), probeSettings())
    settings.DB_BACKUP_WORKER_SOCKET = '/var/lib/hanasand/backups/database/.worker.sock'
    Object.assign(settings, loadObject('/home/hanasand/hanasand/ops/runtime/log-ingest.json', new Set(['LOG_INGEST_TOKEN']), 'log ingestion', 32))
}
if (kind === 'api' || kind === 'auth') Object.assign(settings, loadObject('/home/hanasand/hanasand/ops/runtime/mail.json',
    new Set(['MAIL_ADMIN_USERNAME', 'MAIL_ADMIN_PASSWORD', 'MAIL_SERVICE_KEY', 'MAIL_SYSTEM_SENDER_PASSWORD', 'MAIL_INTERNAL_URL', 'MAIL_SMTP_INTERNAL_PORT']), 'mail runtime'))
if (kind === 'auth') Object.assign(settings, loadObject('/home/hanasand/hanasand/ops/runtime/auth-providers.json',
    new Set(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'APPLE_CLIENT_ID', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY']), 'authentication provider'))
Object.assign(settings, { NODE_ENV: 'production', RECOVERY_SITE: 'inspur', HANASAND_RELEASE_COMMIT: image.split(':').at(-1),
    RECOVERY_STATE_FILE: '/recovery/state.json', DB_HOST: '127.0.0.1', DB_PORT: '18504', DB_MAX_CONN: kind === 'api' ? '20' : '5',
    DB_TIMEOUT_MS: '2000', LISTEN_HOST: '127.0.0.1' })
delete settings.DB_POOL_HOST
delete settings.DB_POOL_PORT
if (kind === 'api') Object.assign(settings, { AI_HEALTH_WORKER_BASE: 'http://127.0.0.1:8080', API_HTTP_ONLY: '1', DB_IDLE_TIMEOUT_MS: '15000',
    HANASAND_APP_UPDATE_DIR: '/srv/hanasand/app-updates', VM_HOST_ID: 'inspur', TI_SCRAPER_API_BASE: 'http://127.0.0.1:18097' })
if (kind === 'auth') settings.AUTH_SERVICE_ONLY = '1'
if (kind === 'frontend') Object.assign(settings, { CODE_REVIEW_INVENTORY_PATH: '/app/code-review/current.json', HOSTNAME: '127.0.0.1',
    FRONTEND_AUTH_API: 'http://127.0.0.1:28082/api', FRONTEND_INTERNAL_API: 'http://127.0.0.1:28082/api',
    TI_SCRAPER_API_BASE: 'http://127.0.0.1:18097', RECOVERY_STATUS_URL: 'http://127.0.0.1:19901/status' })

const runningIds = execFileSync('docker', ['ps', '-q'], { encoding: 'utf8' }).trim().split(/\s+/).filter(Boolean)
const running = runningIds.length ? inspect(...runningIds) : []
const aliases = {}
for (const container of running) for (const network of Object.values(container.NetworkSettings.Networks)) {
    if (network.IPAddress) for (const alias of network.Aliases || []) aliases[alias] = network.IPAddress
}
for (const port of ports) {
    const name = pairName(port)
    if (spawnSync('docker', ['inspect', name], { stdio: 'ignore' }).status === 0) throw new Error(`${name} already exists; choose unused slots before deploying`)
    await available(port)
    settings.PORT = port
    const args = ['run', '-d', '--name', name, '--restart', 'unless-stopped', '--network', 'host', '--memory', kind === 'auth' ? '512m' : '2g',
        '--cpus', kind === 'auth' ? '1' : '2', '--stop-timeout', '65', '-v', '/home/hanasand/hanasand/ops/runtime/status:/recovery:ro']
    if (kind === 'api') args.push('-v', '/var/lib/hanasand/docker-storage:/var/lib/hanasand/docker-storage')
    if (kind === 'api' || kind === 'frontend') args.push('-v', '/home/hanasand/hanasand/ops/code-review/published:/app/code-review:ro')
    for (const key of Object.keys(settings)) args.push('-e', key)
    for (const [alias, address] of Object.entries(aliases)) args.push('--add-host', `${alias}:${address}`)
    if (kind !== 'auth') {
        const destinations = kind === 'api' ? new Set(['/var/lib/hanasand', '/srv/hanasand/app-updates', '/var/run/docker.sock',
            '/var/snap/lxd/common/lxd/unix.socket', '/var/spool/cron/crontabs', '/host/var/lib/hanasand']) : new Set(['/var/lib/hanasand-prompt'])
        for (const mount of original.Mounts) {
            if (!destinations.has(mount.Destination)) continue
            const sourcePath = mount.Type === 'volume' ? mount.Name : mount.Source
            args.push('-v', `${sourcePath}:${mount.Destination}${mount.RW ? '' : ':ro'}`)
        }
    }
    args.push('--entrypoint', 'bun', image, kind === 'api' ? 'src/index.ts' : kind === 'auth' ? 'src/authServer.ts' : 'server.js')
    execFileSync('docker', args, { env: { ...process.env, ...settings }, stdio: 'inherit' })
}
