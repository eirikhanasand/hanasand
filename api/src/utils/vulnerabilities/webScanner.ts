import { connect } from 'node:net'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { requestGptCompletion } from '#utils/ws/handleGptMessage.ts'
import { queryOnce } from '#db'

const STATE_PATH = process.env.WEB_SCAN_STATE_PATH || '/var/lib/hanasand/web-scan.json'
const LOCK_PATH = `${STATE_PATH}.lock`
const RECOVERY_LOCK_PATH = `${LOCK_PATH}.recovery`
const DEFAULT_TARGET = 'https://hanasand.com'
const TARGET_ID = 'primary'
const PORTS = [80, 443, 8080, 8443]
const DEFAULT_INTERVAL_MINUTES = normalizeIntervalMinutes(process.env.WEB_SCAN_INTERVAL_MINUTES, 60)
const MAX_HISTORY = 100
const LOCK_STALE_MS = 10 * 60 * 1000

export type WebScanSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type WebScanCheck = { id: string, status: 'pass' | 'warn' | 'fail' | 'error', severity: WebScanSeverity, title: string, explanation?: string, evidence: Record<string, unknown> }
export type WebScanTargetResult = { target: string, status: string, checks: WebScanCheck[], ports: Array<{ port: number, open: boolean, elapsedMs: number }> }
export type WebScanRun = { scanId: string, status: 'running' | 'completed' | 'failed', startedAt: string, finishedAt: string | null, durationMs: number | null, target: string, targets: WebScanTargetResult[], severityCounts: Record<WebScanSeverity, number>, error: string | null }
export type WebScanSchedule = { enabled: boolean, intervalMinutes: number, nextRunAt: string | null, lastRunAt: string | null, target: string, scope: 'global' }
export type WebScanReport = { current: WebScanRun | null, history: WebScanRun[], schedule: WebScanSchedule, error: string | null }

let active: Promise<WebScanRun> | null = null

const emptyReport = (target = DEFAULT_TARGET): WebScanReport => ({ current: null, history: [], schedule: { enabled: true, intervalMinutes: DEFAULT_INTERVAL_MINUTES, nextRunAt: new Date().toISOString(), lastRunAt: null, target, scope: 'global' }, error: null })

export async function getWebScanReport() { return hydrateReport(await readState()) }

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
        const current: WebScanRun = { scanId, status: 'running', startedAt, finishedAt: null, durationMs: null, target: previous.schedule.target || DEFAULT_TARGET, targets: [], severityCounts: emptySeverityCounts(), error: null }
        await writeState({ ...previous, current, error: null })
        try {
            const targets = [await scanTarget(previous.schedule.target || DEFAULT_TARGET, scanId)]
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
        const checks = await explainChecks(headerChecks(responseHeaders, url.protocol === 'https:'))
        return { target, status: String(response.status), checks, ports: await Promise.all(PORTS.map(port => checkPort(url.hostname, port))) }
    } catch (error) {
        return { target, status: 'error', checks: [{ id: 'http.reachable', status: 'error', severity: 'high', title: 'HTTPS request completed', evidence: { error: error instanceof Error ? error.message : String(error), elapsedMs: Math.round(performance.now() - started) } }], ports: [] }
    }
}

export function headerChecks(headers: Record<string, string>, https: boolean): WebScanCheck[] {
    const check = (id: string, label: string, header: string, required: boolean, severity: WebScanSeverity): WebScanCheck => {
        const present = Boolean(headers[header])
        return { id, title: `${label} is ${present ? 'present' : 'missing'}`, severity, status: present ? 'pass' : required ? 'fail' : 'warn', evidence: { header, value: headers[header] || null } }
    }
    return [
        { id: 'http.reachable', status: 'pass', severity: 'info', title: 'HTTPS request completed', evidence: { status: 'received' } },
        check('header.hsts', 'Strict-Transport-Security', 'strict-transport-security', https, 'high'),
        check('header.csp', 'Content-Security-Policy', 'content-security-policy', false, 'medium'),
        check('header.frame-ancestors', 'Clickjacking protection', 'x-frame-options', false, 'medium'),
        check('header.nosniff', 'MIME sniffing protection', 'x-content-type-options', false, 'low'),
        { id: 'header.server', title: headers.server ? 'Server header reveals implementation detail' : 'Server fingerprint is minimized', severity: 'low', status: headers.server ? 'warn' : 'pass', evidence: { value: headers.server || null } },
    ]
}

async function explainChecks(checks: WebScanCheck[]): Promise<WebScanCheck[]> {
    const relevant = checks.filter(check => check.id !== 'http.reachable')
    const fallback = new Map(checks.map(check => [check.id, fallbackExplanation(check)]))
    try {
        const completion = await requestGptCompletion('gpt', {
            maxTokens: 700,
            temperature: 0,
            messages: [
                { role: 'system', content: 'You explain web security scan checks for a non-expert operator. Return only a JSON object mapping each supplied check id to one concise sentence. Use the observed header presence and supplied evidence. Say what the browser or attacker can do as a result and give the practical next step. Never say the explanation is unavailable, never describe the pipeline, and do not invent a weakness that the supplied evidence does not show.' },
                { role: 'user', content: JSON.stringify(relevant.map(check => ({ id: check.id, status: check.status, severity: check.severity, title: check.title, header: check.evidence.header, present: Boolean(check.evidence.value) }))) },
            ],
        }, 15_000)
        const generated = parseExplanationObject(completion.content || '')
        return checks.map(check => ({ ...check, explanation: isUsefulExplanation(generated[check.id]) ? generated[check.id] : fallback.get(check.id) }))
    } catch {
        return checks.map(check => ({ ...check, explanation: fallback.get(check.id) }))
    }
}

function isUsefulExplanation(value: string | undefined) {
    return Boolean(value && value.length >= 40 && !/explanation is not available|completed this check/i.test(value))
}

function parseExplanationObject(content: string): Record<string, string> {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) return {}
    try {
        const parsed = JSON.parse(match[0]) as Record<string, unknown>
        return Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === 'string').map(([key, value]) => [key, String(value).trim().slice(0, 360)]))
    } catch {
        return {}
    }
}

export function fallbackExplanation(check: WebScanCheck): string {
    const present = Boolean(check.evidence.value)
    if (check.id === 'http.reachable') return check.status === 'pass' ? 'The target accepted an HTTPS request during this scan, so encrypted transport was reachable.' : `The scanner could not complete an HTTPS request to the target: ${String(check.evidence.error || 'the connection failed')}.`
    if (check.id === 'header.hsts') return present ? 'The response included Strict-Transport-Security, telling browsers to keep using HTTPS for this host.' : 'The response did not include Strict-Transport-Security, so browsers are not instructed to enforce HTTPS on future visits.'
    if (check.id === 'header.csp') return present ? 'The response included Content-Security-Policy. The retained scan confirms the header is present but does not assess whether its directives are restrictive enough.' : 'The response did not include Content-Security-Policy, so the browser has no explicit policy limiting where scripts and other resources may load from.'
    if (check.id === 'header.frame-ancestors') return present ? `The response included ${String(check.evidence.header || 'a framing policy')}, which gives browsers a clickjacking protection rule.` : 'The response did not include a framing restriction, so the site may be embeddable in an attacker-controlled frame.'
    if (check.id === 'header.nosniff') return present ? 'The response included X-Content-Type-Options, telling browsers to respect declared content types instead of guessing.' : 'The response did not include X-Content-Type-Options: nosniff, so browsers may interpret content using MIME sniffing.'
    if (check.id === 'header.server') return present ? `The response included a Server header (${String(check.evidence.value)}), which reveals an implementation detail useful for fingerprinting.` : 'The response did not expose a Server header, so this scan found no server implementation detail to fingerprint.'
    return check.status === 'pass' ? `The scan observed the condition described by “${check.title}”; no immediate change is indicated by this result.` : `The scan observed “${check.title}” as needing attention; inspect the retained evidence for the next action.`
}

function hydrateReport(report: WebScanReport): WebScanReport {
    const hydrateRun = (run: WebScanRun | null): WebScanRun | null => run ? { ...run, targets: run.targets.map(target => ({ ...target, checks: target.checks.map(check => ({ ...check, explanation: isUsefulExplanation(check.explanation) ? check.explanation : fallbackExplanation(check) })) })) } : null
    return { ...report, current: hydrateRun(report.current), history: report.history.map(hydrateRun).filter((run): run is WebScanRun => Boolean(run)) }
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
    const target = await getConfiguredTarget()
    try {
        const parsed = JSON.parse(await readFile(STATE_PATH, 'utf8')) as Partial<WebScanReport> & { scanId?: string, startedAt?: string, finishedAt?: string, running?: boolean, targets?: WebScanTargetResult[], error?: string | null }
        if (parsed.current || parsed.history || parsed.schedule) return { ...emptyReport(target), ...parsed, schedule: { ...emptyReport(target).schedule, ...(parsed.schedule || {}), target, scope: 'global' } }
        if (parsed.scanId) return { ...emptyReport(target), history: [{ scanId: parsed.scanId, status: parsed.running ? 'running' : 'completed', startedAt: parsed.startedAt || new Date().toISOString(), finishedAt: parsed.finishedAt || null, durationMs: null, target, targets: parsed.targets || [], severityCounts: countSeverities(parsed.targets || []), error: parsed.error || null }] }
        return emptyReport(target)
    } catch { return emptyReport(target) }
}

async function getConfiguredTarget() {
    try {
        const result = await queryOnce('SELECT target_url FROM web_scan_targets WHERE id = $1 AND enabled = TRUE', [TARGET_ID])
        return normalizeTarget(result.rows[0]?.target_url) || DEFAULT_TARGET
    } catch {
        return DEFAULT_TARGET
    }
}

export function normalizeTarget(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) return null
    try {
        const url = new URL(value.trim())
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null
        return url.toString().replace(/\/$/, '')
    } catch {
        return null
    }
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
