#!/usr/bin/env bun
/** Independent recovery status and transition alerts; never promotes a database. */
import { reconcile as reconcileDns } from './dns.ts'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { statfsSync } from 'node:fs'
import { createConnection } from 'node:net'
import { createServer } from 'node:http'
import { hostname, loadavg } from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

export const ROOT = process.env.RECOVERY_ROOT || '/home/ubuntu/hanasand-recovery'
export const CONFIG = path.join(ROOT, 'config.json')
export const STATE = path.join(ROOT, 'status', 'state.json')
export const STATUS_CACHE = new Map()

export async function atomicJson(file, value) {
    const temporary = file.replace(/\.[^.]+$/, '.tmp')
    await writeFile(temporary, JSON.stringify(value, null, 2))
    await rename(temporary, file)
}

export async function readJson(file, fallback) {
    try { return JSON.parse(await readFile(file, 'utf8')) }
    catch { return fallback }
}

export function stableObservation(old, healthy, now) {
    old ||= { healthy, count: 0, observed: healthy }
    const same = old.observed === healthy
    const since = same ? old.observedSince ?? now : now
    return { healthy: now - since >= 60 ? healthy : old.healthy, count: same ? old.count + 1 : 1, observed: healthy, observedSince: since }
}

export async function requestBody(url, timeout = 4000) {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeout) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return Buffer.from(await response.arrayBuffer())
}

export function chooseService(service, observations) {
    const selected = service.instances.find(instance => observations[instance.id])
    return { ...service, activeInstance: selected?.id || null, activeSite: selected?.site || null, activeEndpoint: selected?.endpoint || null,
        status: !selected ? 'unavailable' : selected === service.instances[0] ? 'up' : 'failed_over',
        instances: service.instances.map(instance => ({ ...instance, healthy: Boolean(observations[instance.id]) })) }
}

export function applyDnsPlacement(services, dnsState) {
    const hosts = { frontend: 'hanasand.com', api: 'api.hanasand.com', auth: 'api.hanasand.com' }
    return services.map(service => {
        if (dnsState[hosts[service.id]]?.activeSite !== 'ovhcloud') return service
        const ovh = chooseService(service, Object.fromEntries(service.instances.map(instance => [instance.id, instance.healthy && instance.site === 'ovhcloud'])))
        return ovh.activeInstance ? ovh : service
    })
}

export function transitionEmbed(previous, current, services, drill = false) {
    const restored = current.status === 'up' || previous.activeSite === 'ovhcloud' && current.activeSite === 'inspur'
    const active = current.activeInstance
    const preferred = current.instances[0].id
    const message = !active ? 'None of the instances are responding right now.' : current.status === 'up' ? `${active} is back online.` :
        restored ? `Traffic is back on Inspur through ${active}. ${preferred} is still down.` : previous.activeInstance ? `${previous.activeInstance} stopped responding. Traffic is now going to ${active}.` : `Service is back on ${active}. ${preferred} is still down.`
    const remaining = services.filter(service => service.status !== 'up').map(service => service.name)
    const checks = current.instances.filter(instance => !instance.healthy && instance.lastProxyCheck)
        .map(instance => `${instance.id}: ${instance.lastProxyCheck.check_status} (${instance.lastProxyCheck.check_duration} ms)`)
    return { title: `${drill ? '[TEST] ' : ''}${restored ? 'Failback' : 'Failover'}: ${current.name}`,
        description: `${previous.activeInstance || 'unavailable'} → ${current.activeInstance || 'unavailable'}. ${message}`,
        color: restored ? 0x00cc66 : 0xff0000,
        fields: [{ name: 'Active endpoint', value: current.activeEndpoint || 'None' },
            { name: 'Still affected', value: remaining.join(', ') || 'All monitored services are back to normal.' },
            ...(checks.length ? [{ name: 'Observed health checks', value: checks.join('\n').slice(0, 1024) }] : [])],
        timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') }
}

function dockerJson(args, timeout = 5000) { return execFileSync('docker', args, { encoding: 'utf8', timeout }).trim() }

export function databaseStatus(config) {
    const container = config.databaseContainer
    if (!container) return { status: 'unconfigured' }
    let status
    try {
        const sql = "SELECT json_build_object('replica', pg_is_in_recovery(), 'replayLsn', pg_last_wal_replay_lsn(), 'replayAt', pg_last_xact_replay_timestamp(), 'databaseBytes', pg_database_size(current_database()), 'receiverStatus', (SELECT status FROM pg_stat_wal_receiver LIMIT 1))"
        status = { status: 'up', ...JSON.parse(dockerJson(['exec', container, 'psql', '-U', 'hanasand', '-d', 'hanasand', '-p', String(config.databasePort || 5432), '-Atc', sql])) }
    } catch { status = { status: 'unavailable', reason: 'Cannot check the replica.' } }
    if (config.primaryDatabaseContainer) {
        try {
            const sql = "SELECT coalesce(json_agg(json_build_object('slot', slot_name, 'walStatus', wal_status, 'active', active, 'lagBytes', pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn))), '[]'::json) FROM pg_replication_slots s LEFT JOIN pg_stat_replication r ON r.pid=s.active_pid WHERE slot_name IN ('hanasand_inspur_standby','hanasand_ovh_standby')"
            status.slots = JSON.parse(dockerJson(['exec', config.primaryDatabaseContainer, 'psql', '-U', 'hanasand', '-d', 'hanasand', '-Atc', sql]))
        } catch { status.sourceStatus = 'unavailable' }
    }
    return status
}

export function trackReplicaLag(database, previous, now) {
    const timers = { ...(previous.lagTimers || {}) }
    for (const slot of database.slots || []) {
        const caughtUp = slot.active && slot.walStatus !== 'lost' && slot.lagBytes != null && slot.lagBytes >= 0 && slot.lagBytes <= 1048576
        const since = timers[slot.slot]
        slot.lagSince = caughtUp ? null : typeof since === 'number' && since >= 0 && since <= now ? since : now
        timers[slot.slot] = slot.lagSince
    }
    database.lagTimers = timers
}

export function restoreSlots(sourceDatabase, previous) {
    const required = new Set(previous)
    for (const slot of sourceDatabase.slots || []) {
        if (slot.walStatus === 'lost') required.add(slot.slot)
        else if (slot.active && slot.lagBytes != null && slot.lagBytes >= 0 && slot.lagBytes <= 1048576) required.delete(slot.slot)
    }
    return [...required].sort()
}

function csvRows(text) {
    const rows = []
    let row = [], cell = '', quoted = false
    for (let index = 0; index < text.length; index++) {
        const char = text[index]
        if (quoted && char === '"' && text[index + 1] === '"') { cell += '"'; index++ }
        else if (char === '"') quoted = !quoted
        else if (!quoted && char === ',') { row.push(cell); cell = '' }
        else if (!quoted && char === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
        else if (char !== '\r' || quoted) cell += char
    }
    if (cell || row.length) { row.push(cell); rows.push(row) }
    const headers = (rows.shift() || []).map(value => value.replace(/^#\s*/, ''))
    return rows.map(values => Object.fromEntries(headers.map((key, index) => [key, values[index] || ''])))
}

function postgresProbe(host, port) {
    return new Promise(resolve => {
        const connection = createConnection({ host, port: Number(port) })
        let done = false
        const finish = result => { if (!done) { done = true; connection.destroy(); resolve(result) } }
        connection.setTimeout(3000, () => finish(false))
        connection.once('connect', () => connection.write(Buffer.from([0, 0, 0, 8, 4, 210, 22, 47])))
        connection.once('data', chunk => finish(chunk[0] === 83 || chunk[0] === 78))
        connection.once('error', () => finish(false))
        connection.once('close', () => finish(false))
    })
}

function proxyCommand(port, service, instance, mode) {
    return new Promise(resolve => {
        const connection = createConnection({ host: '127.0.0.1', port })
        connection.setTimeout(1000, () => { connection.destroy(); resolve() })
        connection.on('connect', () => connection.end(`set server ${service}/${instance} state ${mode}\n`))
        connection.on('error', resolve)
        connection.on('end', resolve)
    })
}

export async function sample(config, previous, now = Date.now() / 1000) {
    let peer = {}
    if (config.peerStatusUrl) {
        try { peer = JSON.parse((await requestBody(config.peerStatusUrl)).toString()) }
        catch { /* A stale or unreachable peer is unavailable. */ }
    }
    if (now - (peer.sampledAt || 0) > 60) peer = {}
    const peerInstances = Object.fromEntries((peer.services || []).flatMap(service => service.instances || []).map(instance => [instance.id, instance]))
    let proxyStatus = {}
    let proxyChecks = {}
    for (const statsUrl of config.statsUrls || [config.statsUrl]) {
        if (!statsUrl) continue
        try {
            const rows = csvRows((await requestBody(statsUrl)).toString().replace(/^# /, ''))
            proxyChecks = Object.fromEntries(rows.filter(row => !['BACKEND', 'FRONTEND'].includes(row.svname)).map(row => [row.svname,
                Object.fromEntries(['status', 'check_status', 'check_code', 'check_duration'].map(key => [key, row[key] || '']))]))
            proxyStatus = Object.fromEntries(rows.filter(row => !['BACKEND', 'FRONTEND'].includes(row.svname)).map(row => [row.svname, row.status.startsWith('UP')]))
            break
        } catch { /* Try another local router. */ }
    }
    const instances = Object.fromEntries(config.services.flatMap(service => service.instances).map(instance => [instance.id, instance]))
    const observations = await Promise.all(Object.entries(instances).map(async ([id, instance]) => {
        const health = instance.health
        if (health.startsWith('peer:')) {
            const healthy = !(id.startsWith('inspur-ti-') && proxyStatus['inspur-ti-1'] === false) && Boolean(peerInstances[health.slice(5)]?.healthy)
            return [id, healthy]
        }
        if (Object.hasOwn(proxyStatus, id)) return [id, proxyStatus[id]]
        if (health.startsWith('postgres://')) {
            const [host, port] = health.slice('postgres://'.length).split(/:(?=[^:]+$)/)
            return [id, await postgresProbe(host, port)]
        }
        try { return [id, Boolean((await requestBody(health)).length)] }
        catch { return [id, false] }
    }))
    const values = Object.fromEntries(observations)
    const counters = { ...(previous.healthCounters || {}) }
    for (const [id, healthy] of observations) {
        const instance = instances[id]
        counters[id] = stableObservation(counters[id], healthy, now)
        const authoritative = Object.hasOwn(proxyStatus, id) || instance.health.startsWith('peer:') && Object.hasOwn(peerInstances, instance.health.slice(5))
        if (authoritative) counters[id].healthy = healthy
    }
    const services = config.services.map(service => chooseService({ ...service, observedFromSite: config.site,
        instances: service.instances.map(instance => instance.health.startsWith('peer:') ? { ...instance, endpoint: peerInstances[instance.id]?.endpoint || instance.endpoint } : instance) },
    Object.fromEntries(Object.keys(values).map(id => [id, counters[id].healthy]))))
    for (const service of services) for (const instance of service.instances) if (proxyChecks[instance.id]) instance.lastProxyCheck = proxyChecks[instance.id]

    const database = databaseStatus(config)
    trackReplicaLag(database, previous.database || {}, now)
    const databaseService = services.find(service => service.id === 'database')
    const readOnly = Boolean(databaseService && databaseService.activeInstance !== 'inspur-db-primary')
    const diskStats = statfsSync(ROOT)
    const diskTotal = diskStats.blocks * diskStats.bsize
    const diskFree = diskStats.bavail * diskStats.bsize
    const affected = services.filter(service => service.status !== 'up').map(service => service.name)
    const compute = { diskTotalBytes: diskTotal, diskFreeBytes: diskFree, loadAverage: loadavg(), standbyMemoryBudgetMb: config.memoryBudgetMb }
    try {
        const memory = Object.fromEntries((await readFile('/proc/meminfo', 'utf8')).split(/\r?\n/).map(line => line.split(':', 2)))
        compute.memoryAvailableBytes = Number(memory.MemAvailable.trim().split(/\s+/)[0]) * 1024
        compute.memoryTotalBytes = Number(memory.MemTotal.trim().split(/\s+/)[0]) * 1024
    } catch { /* Keep the other compute measurements. */ }
    const sites = { [config.site]: { compute, database, fresh: true } }
    const other = config.site === 'inspur' ? 'ovhcloud' : 'inspur'
    sites[other] = { compute: peer.compute, database: peer.database, fresh: Boolean(Object.keys(peer).length) }
    const backup = await readJson(path.join(ROOT, 'backups/status.json'), await readJson(path.join(ROOT, 'backup-status.json'), { status: 'not_verified', restoreRequired: false }))
    if (config.site === 'inspur' && peer.backupReceipt) Object.assign(backup, peer.backupReceipt)
    const receipt = { ...backup }
    const backupJob = config.site === 'inspur' ? await readJson(path.join(ROOT, 'backup-job-status.json'), {}) : peer.backupJob || {}
    let backupStatus = backupJob.status === 'failed' ? { ...backup, status: 'backup_failed', reason: 'The latest backup failed.' } : backup
    const sourceDatabase = config.site === 'inspur' ? database : peer.database || {}
    const localSlot = config.site === 'inspur' ? 'hanasand_inspur_standby' : 'hanasand_ovh_standby'
    const priorDatabase = previous.database || {}
    let eligible
    if (Object.hasOwn(sourceDatabase, 'slots')) {
        const localProof = sourceDatabase.slots.find(slot => slot.slot === localSlot)
        eligible = Boolean(localProof?.active && localProof.lagBytes != null && localProof.lagBytes <= 1048576)
        database.lastVerifiedAt = eligible ? now : priorDatabase.lastVerifiedAt || 0
    } else {
        eligible = Boolean(!values['inspur-db-primary'] && ((priorDatabase.eligible && priorDatabase.recoveryContinuity) || now - (priorDatabase.lastVerifiedAt || 0) <= 60))
        database.lastVerifiedAt = priorDatabase.lastVerifiedAt || 0
        database.recoveryContinuity = eligible
    }
    database.eligible = Boolean(eligible && database.status === 'up' && database.replica === true)
    const peerEligible = Boolean(peer.database?.eligible)
    const eligibility = { 'inspur-db-standby': config.site === 'inspur' ? database.eligible : peerEligible,
        'ovh-db': config.site === 'ovhcloud' ? database.eligible : peerEligible }
    if (config.enforceReplicaReadiness) for (const [instance, allowed] of Object.entries(eligibility)) {
        const mode = allowed && !(config.maintenanceInstances || []).includes(instance) ? 'ready' : 'maint'
        for (const port of [19909, 19910]) await proxyCommand(port, 'database', instance, mode)
    }
    const required = restoreSlots(sourceDatabase, previous.backups?.restoreSlots || [])
    if (required.length) backupStatus = { ...backupStatus, status: 'restore_required', restoreRequired: true, restoreSlots: required, reason: 'WAL replication lost. Restore the replica from a backup.' }
    if (config.requireBackups && !backupStatus.restoreRequired) {
        const received = Date.parse(backupStatus.receivedAt || '') / 1000
        if (!Number.isFinite(received) || now - received > 36 * 3600) backupStatus = { ...backupStatus, status: 'backup_failed', reason: 'No backup taken in 36 hours.' }
    }
    return { sampledAt: now, updatedAt: new Date(now * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z'), site: config.site,
        mode: readOnly ? 'read_only_recovery' : affected.length ? 'service_failover' : 'normal', readOnly, services, database, affected, compute, sites,
        replicaEligibility: eligibility, dns: peer.dns || previous.dns || {}, healthCounters: counters, events: (previous.events || []).slice(-99),
        notifications: (previous.notifications || []).slice(-99), safety: { automaticDatabasePromotion: false, fencingRequired: true, aiOnOvhcloud: false, existingOvhcloudServicesPreserved: true },
        backups: backupStatus, backupReceipt: receipt, backupJob }
}

export function publicState(state, includeHost = false, now = Date.now() / 1000) {
    const result = Object.fromEntries(Object.entries(state).filter(([key]) => !['healthCounters', 'pendingNotifications', 'compute', 'sites', 'replicaEligibility', 'diskDiagnostics'].includes(key)))
    if (includeHost) for (const key of ['compute', 'sites', 'replicaEligibility']) if (key in state) result[key] = state[key]
    if (now - (state.sampledAt || 0) > 60) Object.assign(result, { mode: 'unknown', readOnly: true, stale: true })
    return result
}

export async function runMonitor() {
    let dnsJob = null
    while (true) {
        const started = Date.now() / 1000
        const config = await readJson(CONFIG, {})
        if (!Object.keys(config).length) { await delay(5000); continue }
        const previous = await readJson(STATE, {})
        try {
            const current = await sample(config, previous)
            if (config.dns) {
                current.dns = previous.dns || {}
                if (dnsJob) {
                    const completed = await Promise.race([dnsJob.then(value => ({ value }), error => ({ error })), delay(0).then(() => null)])
                    if (completed) {
                        if (completed.error) current.dns = { ...current.dns, status: 'error', reason: completed.error.constructor.name }
                        else {
                            current.dns = completed.value[0]
                            current.events.push(...completed.value[1].map(event => ({ at: current.updatedAt, service: 'dns', summary: event.description })))
                        }
                        dnsJob = null
                    }
                }
                if (!dnsJob) dnsJob = reconcileDns(config.dns, current, current.dns)
            }
            current.services = applyDnsPlacement(current.services, current.dns || {})
            current.affected = current.services.filter(service => service.status !== 'up').map(service => service.name)
            current.mode = current.readOnly ? 'read_only_recovery' : current.affected.length ? 'service_failover' : 'normal'
            const oldServices = Object.fromEntries((previous.services || []).map(service => [service.id, service]))
            for (const service of current.services) {
                const old = oldServices[service.id]
                if (!old || old.activeInstance === service.activeInstance) continue
                const embed = transitionEmbed(old, service, current.services, config.drill)
                current.events.push({ at: current.updatedAt, service: service.id, from: old.activeInstance, to: service.activeInstance, summary: embed.description })
            }
            const oldBackup = previous.backups || {}
            const backup = current.backups
            const failedBackup = backup.restoreRequired || ['backup_failed', 'restore_required'].includes(backup.status)
            if (Object.keys(oldBackup).length && (oldBackup.status !== backup.status || oldBackup.restoreRequired !== backup.restoreRequired) &&
                (failedBackup || backup.status === 'verified')) current.events.push({ at: current.updatedAt, service: 'backup', summary: backup.reason || 'Backup completed.' })
            current.notificationHealth = 'case_monitoring'
            await atomicJson(STATE, current)
            STATUS_CACHE.clear()
        } catch (error) { console.log(`Recovery sample failed: ${error.constructor.name}`) }
        await delay(Math.max(1000, (config.interval || 5) * 1000 - (Date.now() / 1000 - started) * 1000))
    }
}

export function createHandler(root = ROOT) {
    return async (request, response) => {
        const pathname = new URL(request.url, 'http://localhost').pathname
        if (pathname === '/disk-diagnostics') {
            response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
            response.end(JSON.stringify(await readJson(path.join(root, 'disk-directories.json'), null)))
            return
        }
        if (!['/status', '/health', '/public-status'].includes(pathname)) { response.writeHead(404).end(); return }
        const statePath = path.join(root, 'status/state.json')
        const stateFile = await stat(statePath).catch(() => null)
        const hostFile = pathname === '/status' ? await stat(path.join(root, 'host-metrics.json')).catch(() => null) : null
        const signature = `${stateFile?.mtimeMs || 0}:${hostFile?.mtimeMs || 0}`
        let cached = STATUS_CACHE.get(pathname)
        if (!cached || cached.signature !== signature || Date.now() / 1000 - cached.at > 60) {
            const state = publicState(await readJson(statePath, { mode: 'unknown', readOnly: true, services: [] }), pathname !== '/public-status')
            if (pathname === '/status') state.hostMetrics = await readJson(path.join(root, 'host-metrics.json'), null)
            cached = { signature, at: Date.now() / 1000, body: JSON.stringify(state), status: state.updatedAt && !state.stale ? 200 : 503 }
            STATUS_CACHE.set(pathname, cached)
        }
        response.writeHead(cached.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        response.end(cached.body)
    }
}

if (import.meta.main) {
    await mkdir(path.dirname(STATE), { recursive: true })
    await mkdir(ROOT, { recursive: true })
    const server = createServer((request, response) => { void createHandler()(request, response) })
    server.listen(Number(process.env.RECOVERY_PORT || 19901), '127.0.0.1')
    void runMonitor()
}
