#!/usr/bin/env bun
/** Manage OVH's independent support store; never promotes the application replica. */
import { execFileSync, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, symlinkSync, unlinkSync, writeFileSync, chmodSync, lstatSync, readdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const ROOT = '/home/ubuntu/hanasand-recovery/support'
const CONFIG = path.join(path.dirname(ROOT), 'support.json')
const DB = 'hanasand-support-db'
const SERVICE = 'hanasand-support'
const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'))
const removeFile = (file: string) => { if (existsSync(file)) unlinkSync(file) }
const run = (args: string[], env: Record<string, string> = {}, options: { stdout?: number | 'ignore' | 'pipe'; capture?: boolean } = {}) => {
    const result = spawnSync(args[0], args.slice(1), { env: { ...process.env, ...env }, encoding: 'utf8',
        stdout: options.capture ? 'pipe' : options.stdout ?? 'inherit', stderr: options.capture ? 'pipe' : 'inherit' })
    if (result.status !== 0) throw new Error(result.stderr || `${args[0]} failed with status ${result.status}`)
    return result.stdout || ''
}
const inspect = (name: string) => JSON.parse(execFileSync('docker', ['inspect', name], { encoding: 'utf8' }))[0]
const writeSecret = (file: string, value: string) => {
    mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
    const temporary = `${file}.tmp`
    writeFileSync(temporary, value, { mode: 0o600 })
    chmodSync(temporary, 0o600)
    renameSync(temporary, file)
}

export async function initialize(image: string) {
    mkdirSync(ROOT, { recursive: true, mode: 0o700 })
    if (!existsSync(CONFIG)) {
        const settings = { SUPPORT_SERVICE_BASE: 'http://127.0.0.1:19181', SUPPORT_SERVICE_KEY: randomBytes(32).toString('hex'),
            SUPPORT_DB_HOST: '127.0.0.1', SUPPORT_DB_PORT: '18508', SUPPORT_DB_NAME: 'hanasand_support', SUPPORT_MAINTENANCE: '1',
            SUPPORT_DB_USER: 'support', SUPPORT_DB_PASSWORD: randomBytes(32).toString('hex') }
        const fd = openSync(CONFIG, 'wx', 0o600)
        try { writeFileSync(fd, JSON.stringify(settings)) } finally { closeSync(fd) }
    }
    const config = readJson(CONFIG)
    const found = spawnSync('docker', ['inspect', DB], { stdio: 'ignore' })
    if (found.status === 0) {
        if (!inspect(DB).State.Running) throw new Error('Support database exists but is stopped; inspect before continuing')
        return
    }
    const env = { POSTGRES_USER: config.SUPPORT_DB_USER, POSTGRES_PASSWORD: config.SUPPORT_DB_PASSWORD, POSTGRES_DB: config.SUPPORT_DB_NAME }
    run(['docker', 'run', '-d', '--name', DB, '--restart', 'unless-stopped', '--network', 'host', '--memory', '512m', '--cpus', '1',
        '-v', 'hanasand-support-data:/var/lib/postgresql/data', ...Object.keys(env).flatMap(key => ['-e', key]), image,
        'postgres', '-p', '18508', '-c', 'listen_addresses=127.0.0.1', '-c', 'shared_buffers=128MB', '-c', 'max_connections=30', '-c', 'wal_level=replica', '-c', 'max_wal_size=1GB'], env, { stdout: 'ignore' })
    for (let i = 0; i < 300; i++) {
        if (spawnSync('docker', ['exec', DB, 'pg_isready', '-p', '18508', '-U', 'support', '-d', 'hanasand_support'], { stdio: 'ignore' }).status === 0) return
        await delay(1000)
    }
    throw new Error('Support database did not become ready')
}

export async function start(release: string) {
    if (!/^[0-9a-f]{40}$/.test(release)) throw new Error('Use a full committed release')
    const settings = Object.fromEntries(inspect('hanasand-api').Config.Env.map((item: string) => item.split(/=(.*)/s).slice(0, 2))) as Record<string, string>
    for (const key of ['RECOVERY_STATE_FILE', 'RECOVERY_ESSENTIAL_ONLY', 'AI_HEALTH_WORKER_BASE', 'SUPPORT_SERVICE_BASE']) delete settings[key]
    const config = readJson(CONFIG)
    Object.assign(settings, Object.fromEntries(Object.entries(config).filter(([key]) => key !== 'SUPPORT_SERVICE_BASE')))
    mkdirSync(path.join(ROOT, 'backups'), { recursive: true, mode: 0o700 })
    if (config.SUPPORT_MAINTENANCE === '1') writeFileSync(path.join(ROOT, 'maintenance'), '', { mode: 0o600 })
    else removeFile(path.join(ROOT, 'maintenance'))
    Object.assign(settings, { SUPPORT_MAINTENANCE_FILE: '/support-control/maintenance', SUPPORT_BACKUP_FILE: '/support-backups/latest.dump', PORT: '19181',
        SUPPORT_INTERNAL_SERVICE: '1', API_HTTP_ONLY: '1', AUTH_SERVICE_ONLY: '1', DB_TIMEOUT_MS: '1000', DB_MAX_CONN: '3', SUPPORT_AI_BASE: 'https://api.hanasand.com', HANASAND_RELEASE_COMMIT: release })
    let previous: string | undefined
    if (spawnSync('docker', ['inspect', SERVICE], { stdio: 'ignore' }).status === 0) {
        previous = `${SERVICE}-previous-${Math.floor(Date.now() / 1000)}`
        run(['docker', 'stop', '-t', '65', SERVICE], {}, { stdout: 'ignore' })
        run(['docker', 'rename', SERVICE, previous])
    }
    try {
        run(['docker', 'run', '-d', '--name', SERVICE, '--restart', 'unless-stopped', '--network', 'host', '--memory', '512m', '--cpus', '1',
            '-v', `${ROOT}:/support-control:ro`, '-v', `${ROOT}/backups:/support-backups:ro`, '--stop-timeout', '65', '--log-opt', 'max-size=10m', '--log-opt', 'max-file=3',
            ...Object.keys(settings).flatMap(key => ['-e', key]), '--entrypoint', 'bun', `hanasand-recovery-api:${release}`, 'src/supportServer.ts'], settings, { stdout: 'ignore' })
        for (let i = 0; i < 180; i++) {
            try {
                const response = await fetch('http://127.0.0.1:19181/ready', { signal: AbortSignal.timeout(2000) })
                const state = await response.json() as any
                if (state.ok && state.release === release) { console.log(JSON.stringify(state)); return }
            } catch { /* Poll until the service starts or the deadline expires. */ }
            await delay(1000)
        }
        throw new Error('Independent support service did not become ready')
    } catch (error) {
        const logs = spawnSync('docker', ['logs', '--tail', '40', SERVICE], { encoding: 'utf8' })
        writeFileSync(path.join(ROOT, 'last-start-error.log'), (logs.stdout || '') + (logs.stderr || ''))
        spawnSync('docker', ['rm', '-f', SERVICE], { stdio: 'ignore' })
        if (previous) { run(['docker', 'rename', previous, SERVICE]); run(['docker', 'start', SERVICE], {}, { stdout: 'ignore' }) }
        throw error
    }
}

export function backup() {
    const destination = path.join(ROOT, 'backups')
    mkdirSync(destination, { recursive: true, mode: 0o700 })
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '').replace(/Z$/, 'Z')
    const temporary = path.join(destination, `${stamp}.partial`)
    const saved = path.join(destination, `${stamp}.dump`)
    const fd = openSync(temporary, 'w', 0o600)
    try { run(['docker', 'exec', DB, 'pg_dump', '-p', '18508', '-U', 'support', '-d', 'hanasand_support', '-Fc'], {}, { stdout: fd }) }
    catch (error) { removeFile(temporary); throw error }
    finally { closeSync(fd) }
    if (lstatSync(temporary).size < 100) throw new Error('Support backup was empty')
    chmodSync(temporary, 0o600)
    renameSync(temporary, saved)
    const next = path.join(destination, 'latest.next')
    removeFile(next)
    symlinkSync(path.basename(saved), next)
    renameSync(next, path.join(destination, 'latest.dump'))
    for (const old of readdirSync(destination).filter(name => name.endsWith('.dump') && name !== 'latest.dump').sort().slice(0, -48)) unlinkSync(path.join(destination, old))
    console.log(saved)
}

export async function maintenance(action: 'pause' | 'resume') {
    const config = readJson(CONFIG)
    config.SUPPORT_MAINTENANCE = action === 'pause' ? '1' : '0'
    writeSecret(CONFIG, JSON.stringify(config))
    const file = path.join(ROOT, 'maintenance')
    if (action === 'pause') writeFileSync(file, '', { mode: 0o600 })
    else removeFile(file)
    console.log(`Support ${action === 'pause' ? 'paused' : 'resumed'}`)
}

async function main() {
    const [action, value] = Bun.argv.slice(2)
    if (!['init', 'start', 'backup', 'pause', 'resume'].includes(action)) throw new Error('Use init, start, backup, pause or resume')
    if (process.env.HANASAND_SUPPORT_LOCKED !== '1') {
        const child = spawnSync('flock', ['-n', path.join(ROOT, 'deploy.lock'), process.execPath, import.meta.path, ...Bun.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, HANASAND_SUPPORT_LOCKED: '1' } })
        process.exit(child.status ?? 1)
    }
    mkdirSync(ROOT, { recursive: true, mode: 0o700 })
    if (action === 'init') await initialize(value || '')
    else if (action === 'start') await start(value || '')
    else if (action === 'backup') backup()
    else await maintenance(action as 'pause' | 'resume')
}
if (import.meta.main) await main()
