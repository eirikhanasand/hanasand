import { connect } from 'node:net'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const STATE_PATH = process.env.WEB_SCAN_STATE_PATH || '/var/lib/hanasand/web-scan.json'
const LOCK_PATH = `${STATE_PATH}.lock`
const RECOVERY_LOCK_PATH = `${LOCK_PATH}.recovery`
const TARGET = 'https://hanasand.com'
const PORTS = [80, 443, 8080, 8443]
const DEFAULT_INTERVAL_MINUTES = normalizeIntervalMinutes(process.env.WEB_SCAN_INTERVAL_MINUTES, 60)
const MAX_HISTORY = 100
const LOCK_STALE_MS = 10 * 60 * 1000

export type WebScanSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type WebScanCheck = { id: string, status: 'pass' | 'warn' | 'fail' | 'error', severity: WebScanSeverity, title: string, evidence: Record<string, unknown> }
export type WebScanTargetResult = { target: string, status: string, checks: WebScanCheck[], ports: Array<{ port: number, open: boolean, elapsedMs: number }> }
export type WebScanRun = { scanId: string, status: 'running' | 'completed' | 'failed', startedAt: string, finishedAt: string | null, durationMs: number | null, target: string, targets: WebScanTargetResult[], severityCounts: Record<WebScanSeverity, number>, error: string | null }
export type WebScanSchedule = { enabled: boolean, intervalMinutes: number, nextRunAt: string | null, lastRunAt: string | null, target: string, scope: 'global' }
export type WebScanReport = { current: WebScanRun | null, history: WebScanRun[], schedule: WebScanSchedule, error: string | null }

let active: Promise<WebScanRun> | null = null

const emptyReport = (): WebScanReport => ({ current: null, history: [], schedule: { enabled: true, intervalMinutes: DEFAULT_INTERVAL_MINUTES, nextRunAt: new Date().toISOString(), lastRunAt: null, target: TARGET, scope: 'global' }, error: null })

export async function getWebScanReport() { return readState() }

export function startWebScan() {
    if (active) return active
    active = runWebScan().finally(() => { active = null })
    return active
}

export async function runDueWebScan() {
    const report = await readState()
    if (!report.schedule.enabled || active) return report
    const next = report.schedule.nextRunAt ? Date.parse(report.schedule.nextRunAt) : 0
    if (next > Date.now()) return report
    void startWebScan().catch(error => console.error('Scheduled Hanasand web scan failed', error))
    return report
}

export async function setWebScanSchedule(input: { enabled?: boolean, intervalMinutes?: number }) {
    return withWebScanLock(async() => {
        const report = await readState()
        const intervalMinutes = input.intervalMinutes === undefined ? report.schedule.intervalMinutes : normalizeIntervalMinutes(input.intervalMinutes, report.schedule.intervalMinutes)
        const enabled = input.enabled === undefined ? report.schedule.enabled : input.enabled
        const nextRunAt = enabled ? new Date(Date.now() + intervalMinutes * 60_000).toISOString() : null
        const next = { ...report, schedule: { ...report.schedule, enabled, intervalMinutes, nextRunAt, scope: 'global' as const } }
        await writeState(next)
        return next
    })
}

export function normalizeIntervalMinutes(value: unknown, fallback = 60) {
    const parsed = Number(value)
    const safeFallback = Number.isFinite(fallback) ? Math.floor(fallback) : 60
    return Math.min(Math.max(Number.isFinite(parsed) ? Math.floor(parsed) : safeFallback, 5), 1440)
}

export async function withWebScanLock<T>(work: () => Promise<T>): Promise<T> {
    let reclaimedPath: string | undefined
    while (true) {
        try {
            await mkdir(LOCK_PATH)
            break
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
            let lockAge: number
            try {
                lockAge = Date.now() - (await stat(LOCK_PATH)).mtimeMs
            } catch (statError) {
                if ((statError as NodeJS.ErrnoException).code === 'ENOENT') continue
                throw statError
            }
            if (lockAge > LOCK_STALE_MS) {
                try {
                    await mkdir(RECOVERY_LOCK_PATH)
                } catch (recoveryError) {
                    if ((recoveryError as NodeJS.ErrnoException).code === 'EEXIST') {
                        throw Object.assign(new Error('Hanasand web scan is already running.'), { cause: recoveryError })
                    }
                    throw recoveryError
                }
                try {
                    let currentAge: number
                    try {
                        currentAge = Date.now() - (await stat(LOCK_PATH)).mtimeMs
                    } catch (statError) {
                        if ((statError as NodeJS.ErrnoException).code === 'ENOENT') continue
                        throw statError
                    }
                    if (currentAge <= LOCK_STALE_MS) {
                        throw Object.assign(new Error('Hanasand web scan is already running.'), { cause: error })
                    }
                    const candidate = `${LOCK_PATH}.reclaim-${randomUUID()}`
                    await rename(LOCK_PATH, candidate)
                    reclaimedPath = candidate
                    await mkdir(LOCK_PATH)
                    break
                } finally {
                    await rm(RECOVERY_LOCK_PATH, { recursive: true, force: true })
                }
            }
            throw Object.assign(new Error('Hanasand web scan is already running.'), { cause: error })
        }
    }
    try {
        return await work()
    } finally {
        await rm(LOCK_PATH, { recursive: true, force: true })
        if (reclaimedPath) await rm(reclaimedPath, { recursive: true, force: true })
    }
}

async function runWebScan(): Promise<WebScanRun> {
    return withWebScanLock(async() => {
        const previous = await readState()
        const scanId = `webscan_${randomUUID()}`
        const startedAt = new Date().toISOString()
        const current: WebScanRun = { scanId, status: 'running', startedAt, finishedAt: null, durationMs: null, target: TARGET, targets: [], severityCounts: emptySeverityCounts(), error: null }
        await writeState({ ...previous, current, error: null })
        try {
            const targets = [await scanTarget(TARGET, scanId)]
            const finishedAt = new Date().toISOString()
            const completed: WebScanRun = { ...current, status: 'completed', finishedAt, durationMs: Date.parse(finishedAt) - Date.parse(startedAt), targets, severityCounts: countSeverities(targets), error: null }
            return await finishRun(previous, completed)
        } catch (error) {
            const finishedAt = new Date().toISOString()
            const failed: WebScanRun = { ...current, status: 'failed', finishedAt, durationMs: Date.parse(finishedAt) - Date.parse(startedAt), error: error instanceof Error ? error.message : String(error) }
            return await finishRun(previous, failed)
        }
    })
}

async function finishRun(previous: WebScanReport, run: WebScanRun) {
    const schedule = { ...previous.schedule, lastRunAt: run.finishedAt, nextRunAt: previous.schedule.enabled ? new Date(Date.now() + previous.schedule.intervalMinutes * 60_000).toISOString() : null }
    const next = { current: null, history: [run, ...previous.history].slice(0, MAX_HISTORY), schedule, error: run.error }
    await writeState(next)
    return run
}

async function scanTarget(target: string, scanId: string): Promise<WebScanTargetResult> {
    const url = new URL(target)
    const started = performance.now()
    const headers = { 'user-agent': 'Hanasand-Security-Scanner/1.0 (+https://hanasand.com/security-scanner)', 'x-hanasand-scan-id': scanId }
    try {
        const response = await fetch(url, { method: 'GET', headers, redirect: 'manual', signal: AbortSignal.timeout(12_000) })
        const responseHeaders = Object.fromEntries(response.headers.entries())
        return { target, status: String(response.status), checks: headerChecks(responseHeaders, url.protocol === 'https:'), ports: await Promise.all(PORTS.map(port => checkPort(url.hostname, port))) }
    } catch (error) {
        return { target, status: 'error', checks: [{ id: 'http.reachable', status: 'error', severity: 'high', title: 'HTTPS request completed', evidence: { error: error instanceof Error ? error.message : String(error), elapsedMs: Math.round(performance.now() - started) } }], ports: [] }
    }
}

export function headerChecks(headers: Record<string, string>, https: boolean): WebScanCheck[] {
    const check = (id: string, title: string, header: string, required: boolean, severity: WebScanSeverity): WebScanCheck => ({ id, title, severity, status: headers[header] ? 'pass' : required ? 'fail' : 'warn', evidence: { header, value: headers[header] || null } })
    return [
        { id: 'http.reachable', status: 'pass', severity: 'info', title: 'HTTPS request completed', evidence: { status: 'received' } },
        check('header.hsts', 'Strict-Transport-Security is present', 'strict-transport-security', https, 'high'),
        check('header.csp', 'Content-Security-Policy is present', 'content-security-policy', false, 'medium'),
        check('header.frame-ancestors', 'Clickjacking protection is present', 'x-frame-options', false, 'medium'),
        check('header.nosniff', 'MIME sniffing protection is present', 'x-content-type-options', false, 'low'),
        { id: 'header.server', title: 'Server fingerprint is minimized', severity: 'low', status: headers.server ? 'warn' : 'pass', evidence: { value: headers.server || null } },
    ]
}

export function countSeverities(targets: WebScanTargetResult[]) {
    const counts = emptySeverityCounts()
    for (const check of targets.flatMap(target => target.checks)) if (check.status !== 'pass') counts[check.severity] += 1
    for (const port of targets.flatMap(target => target.ports)) if (port.open && ![80, 443].includes(port.port)) counts.medium += 1
    return counts
}

function emptySeverityCounts(): Record<WebScanSeverity, number> { return { critical: 0, high: 0, medium: 0, low: 0, info: 0 } }

function checkPort(host: string, port: number): Promise<{ port: number, open: boolean, elapsedMs: number }> {
    return new Promise(resolve => {
        const started = performance.now()
        const socket = connect({ host, port })
        const finish = (open: boolean) => { socket.destroy(); resolve({ port, open, elapsedMs: Math.round(performance.now() - started) }) }
        socket.setTimeout(2500, () => finish(false)); socket.once('connect', () => finish(true)); socket.once('error', () => finish(false))
    })
}

async function readState(): Promise<WebScanReport> {
    try {
        const parsed = JSON.parse(await readFile(STATE_PATH, 'utf8')) as Partial<WebScanReport> & { scanId?: string, startedAt?: string, finishedAt?: string, running?: boolean, targets?: WebScanTargetResult[], error?: string | null }
        if (parsed.current || parsed.history || parsed.schedule) return { ...emptyReport(), ...parsed, schedule: { ...emptyReport().schedule, ...(parsed.schedule || {}), target: TARGET, scope: 'global' } }
        if (parsed.scanId) return { ...emptyReport(), history: [{ scanId: parsed.scanId, status: parsed.running ? 'running' : 'completed', startedAt: parsed.startedAt || new Date().toISOString(), finishedAt: parsed.finishedAt || null, durationMs: null, target: TARGET, targets: parsed.targets || [], severityCounts: countSeverities(parsed.targets || []), error: parsed.error || null }] }
        return emptyReport()
    } catch { return emptyReport() }
}

async function writeState(report: WebScanReport) {
    await mkdir(path.dirname(STATE_PATH), { recursive: true })
    const temporaryPath = `${STATE_PATH}.${process.pid}.${randomUUID()}.tmp`
    try {
        await writeFile(temporaryPath, JSON.stringify(report, null, 2), 'utf8')
        await rename(temporaryPath, STATE_PATH)
    } finally {
        await rm(temporaryPath, { force: true })
    }
}
