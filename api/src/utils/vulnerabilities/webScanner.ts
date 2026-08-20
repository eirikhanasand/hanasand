import { lookup } from 'node:dns/promises'
import { connect } from 'node:net'
import { connect as tlsConnect } from 'node:tls'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { requestGptCompletion } from '#utils/ws/handleGptMessage.ts'
import { queryOnce, withTransaction } from '#db'

const STATE_PATH = process.env.WEB_SCAN_STATE_PATH || '/var/lib/hanasand/web-scan.json'
const LOCK_PATH = `${STATE_PATH}.lock`
const RECOVERY_LOCK_PATH = `${LOCK_PATH}.recovery`
const TARGET_ID = 'primary'
const PORTS = [80, 443, 8080, 8443]
const DEFAULT_INTERVAL_MINUTES = normalizeIntervalMinutes(process.env.WEB_SCAN_INTERVAL_MINUTES, 60)
const MAX_HISTORY = 100
const LOCK_STALE_MS = 10 * 60 * 1000

export type WebScanSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type WebScanCheck = { id: string, status: 'pass' | 'warn' | 'fail' | 'error', severity: WebScanSeverity, title: string, explanation?: string, evidence: Record<string, unknown> }
export type WebScanTargetResult = { target: string, status: string, checks: WebScanCheck[], ports: Array<{ port: number, open: boolean, elapsedMs: number }> }
export type WebScanRun = { scanId: string, status: 'running' | 'completed' | 'failed', startedAt: string, finishedAt: string | null, durationMs: number | null, target: string, targets: WebScanTargetResult[], severityCounts: Record<WebScanSeverity, number>, error: string | null }
export type WebScanSchedule = { enabled: boolean, intervalMinutes: number, nextRunAt: string | null, lastRunAt: string | null, target: string | null, scope: 'global' }
export type WebScanReport = { current: WebScanRun | null, history: WebScanRun[], schedule: WebScanSchedule, error: string | null }

type ConfiguredTarget = { target: string | null, error: string | null }
type StoredRun = { scan_id: string, target_url: string, status: WebScanRun['status'], target_status: string, started_at: string, finished_at: string | null, duration_ms: number | null, severity_counts: Record<WebScanSeverity, number>, error: string | null }
type StoredFinding = { scan_id: string, target_url: string, kind: 'check' | 'port', check_id: string, status: string, severity: WebScanSeverity, title: string, explanation: string | null, evidence: Record<string, unknown>, port: number | null, elapsed_ms: number | null }

let active: Promise<WebScanRun> | null = null

export async function getWebScanReport() {
    return hydrateReport(await readReport())
}

export function startWebScan() {
    if (active) return active
    active = runWebScan().finally(() => { active = null })
    return active
}

export async function runDueWebScan() {
    const report = await readReport()
    if (report.error || !report.schedule.target || !report.schedule.enabled || active) return report
    const next = report.schedule.nextRunAt ? Date.parse(report.schedule.nextRunAt) : 0
    if (next > Date.now()) return report
    void startWebScan().catch(error => console.error('Scheduled Hanasand web scan failed', error))
    return report
}

export async function setWebScanSchedule(input: { enabled?: boolean, intervalMinutes?: number }) {
    return withWebScanLock(async() => {
        const report = await readReport()
        const intervalMinutes = input.intervalMinutes === undefined ? report.schedule.intervalMinutes : normalizeIntervalMinutes(input.intervalMinutes, report.schedule.intervalMinutes)
        const enabled = input.enabled === undefined ? report.schedule.enabled : input.enabled
        const nextRunAt = enabled ? new Date(Date.now() + intervalMinutes * 60_000).toISOString() : null
        const schedule = { ...report.schedule, enabled, intervalMinutes, nextRunAt, scope: 'global' as const }
        await writeSchedule(schedule, report.error)
        return { ...report, schedule }
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
                    if ((recoveryError as NodeJS.ErrnoException).code === 'EEXIST') throw Object.assign(new Error('Hanasand web scan is already running.'), { cause: recoveryError })
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
                    if (currentAge <= LOCK_STALE_MS) throw Object.assign(new Error('Hanasand web scan is already running.'), { cause: error })
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
        const report = await readReport()
        if (report.error || !report.schedule.target) throw new Error(report.error || 'No enabled scanner target is configured.')
        const scanId = `webscan_${randomUUID()}`
        const startedAt = new Date().toISOString()
        const current: WebScanRun = { scanId, status: 'running', startedAt, finishedAt: null, durationMs: null, target: report.schedule.target, targets: [], severityCounts: emptySeverityCounts(), error: null }
        await insertRun(current)
        try {
            const targets = [await scanTarget(report.schedule.target, scanId)]
            const finishedAt = new Date().toISOString()
            const completed: WebScanRun = { ...current, status: 'completed', finishedAt, durationMs: Date.parse(finishedAt) - Date.parse(startedAt), targets, severityCounts: countSeverities(targets), error: null }
            return await finishRun(report.schedule, completed)
        } catch (error) {
            const finishedAt = new Date().toISOString()
            const failed: WebScanRun = { ...current, status: 'failed', finishedAt, durationMs: Date.parse(finishedAt) - Date.parse(startedAt), error: error instanceof Error ? error.message : String(error) }
            return await finishRun(report.schedule, failed)
        }
    })
}

async function insertRun(run: WebScanRun) {
    await queryOnce(`INSERT INTO web_scan_runs (scan_id, target_id, target_url, status, target_status, started_at, finished_at, duration_ms, severity_counts, error)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
        ON CONFLICT (scan_id) DO NOTHING`, [run.scanId, TARGET_ID, run.target, run.status, run.targets[0]?.status || 'pending', run.startedAt, run.finishedAt, run.durationMs, JSON.stringify(run.severityCounts), run.error])
}

async function finishRun(previousSchedule: WebScanSchedule, run: WebScanRun, updateSchedule = true) {
    const schedule = { ...previousSchedule, lastRunAt: run.finishedAt, nextRunAt: previousSchedule.enabled ? new Date(Date.now() + previousSchedule.intervalMinutes * 60_000).toISOString() : null }
    await withTransaction(async query => {
        await query('UPDATE web_scan_runs SET status = $2, target_status = $3, finished_at = $4, duration_ms = $5, severity_counts = $6::jsonb, error = $7 WHERE scan_id = $1', [run.scanId, run.status, run.targets[0]?.status || 'error', run.finishedAt, run.durationMs, JSON.stringify(run.severityCounts), run.error])
        for (const target of run.targets) {
            for (const check of target.checks) {
                await query('INSERT INTO web_scan_findings (scan_id, target_url, kind, check_id, status, severity, title, explanation, evidence) VALUES ($1, $2, \'check\', $3, $4, $5, $6, $7, $8::jsonb) ON CONFLICT (scan_id, check_id) DO UPDATE SET status = EXCLUDED.status, severity = EXCLUDED.severity, title = EXCLUDED.title, explanation = EXCLUDED.explanation, evidence = EXCLUDED.evidence', [run.scanId, target.target, check.id, check.status, check.severity, check.title, check.explanation || null, JSON.stringify(check.evidence)])
            }
            for (const port of target.ports) {
                await query('INSERT INTO web_scan_findings (scan_id, target_url, kind, check_id, status, severity, title, evidence, port, elapsed_ms) VALUES ($1, $2, \'port\', $3, $4, \'info\', $5, $6::jsonb, $7, $8) ON CONFLICT (scan_id, check_id) DO UPDATE SET status = EXCLUDED.status, title = EXCLUDED.title, evidence = EXCLUDED.evidence, port = EXCLUDED.port, elapsed_ms = EXCLUDED.elapsed_ms', [run.scanId, target.target, `service.port.${port.port}`, port.open ? 'warn' : 'pass', `Port ${port.port} ${port.open ? 'is open' : 'is closed'}`, JSON.stringify({ open: port.open }), port.port, port.elapsedMs])
            }
        }
    })
    if (updateSchedule) await writeSchedule(schedule, run.error)
    return run
}

async function scanTarget(target: string, scanId: string): Promise<WebScanTargetResult> {
    const url = new URL(target)
    const headers = { 'user-agent': 'Hanasand-Security-Scanner/1.0 (+https://hanasand.com/security-scanner)', 'x-hanasand-scan-id': scanId }
    const checks = [await dnsCheck(url.hostname), await tlsCertificateCheck(url.hostname)]
    let status = 'error'
    try {
        const started = performance.now()
        const response = await fetch(url, { method: 'GET', headers, redirect: 'manual', signal: AbortSignal.timeout(12_000) })
        status = String(response.status)
        const responseHeaders = Object.fromEntries(response.headers.entries())
        checks.push({ id: 'http.reachable', status: 'pass', severity: 'info', title: 'HTTPS request completed', evidence: { status: response.status, elapsedMs: Math.round(performance.now() - started) } })
        checks.push(...redirectChecks(response.status, responseHeaders.location, url))
        checks.push(...headerChecks(responseHeaders, url.protocol === 'https:'))
        checks.push(...cookieChecks(responseHeaders['set-cookie']))
    } catch (error) {
        checks.push({ id: 'http.reachable', status: 'error', severity: 'high', title: 'HTTPS request completed', evidence: { error: error instanceof Error ? error.message : String(error) } })
    }
    const ports = await Promise.all(PORTS.map(port => checkPort(url.hostname, port)))
    return { target, status, checks: await explainChecks(checks), ports }
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
        check('header.referrer-policy', 'Referrer-Policy', 'referrer-policy', false, 'low'),
        check('header.permissions-policy', 'Permissions-Policy', 'permissions-policy', false, 'low'),
        { id: 'header.server', title: headers.server ? 'Server header reveals implementation detail' : 'Server fingerprint is minimized', severity: 'low', status: headers.server ? 'warn' : 'pass', evidence: { value: headers.server || null } },
    ]
}

export function redirectChecks(status: number, location: string | undefined, target: URL): WebScanCheck[] {
    if (status < 300 || status >= 400 || !location) return [{ id: 'http.redirect', status: 'pass', severity: 'info', title: 'HTTPS endpoint does not redirect', evidence: { status, location: null } }]
    const redirected = new URL(location, target)
    const secure = redirected.protocol === 'https:'
    return [{ id: 'http.redirect', status: secure ? 'pass' : 'fail', severity: secure ? 'info' : 'high', title: secure ? 'Redirect stays on HTTPS' : 'Redirect downgrades to HTTP', evidence: { status, location: redirected.toString(), protocol: redirected.protocol } }]
}

export function cookieChecks(setCookie: string | undefined): WebScanCheck[] {
    if (!setCookie) return [{ id: 'cookie.security', status: 'pass', severity: 'info', title: 'No response cookies set', evidence: { count: 0 } }]
    const cookies = setCookie.split(/,(?=\s*[^;=,]+\s*=)/).map(cookie => cookie.trim())
    const lower = cookies.map(cookie => cookie.toLowerCase())
    const missingSecure = lower.filter(cookie => !cookie.includes('; secure')).length
    const missingHttpOnly = lower.filter(cookie => !cookie.includes('; httponly')).length
    const missingSameSite = lower.filter(cookie => !cookie.includes('; samesite=')).length
    const issues = [missingSecure ? `${missingSecure} missing Secure` : '', missingHttpOnly ? `${missingHttpOnly} missing HttpOnly` : '', missingSameSite ? `${missingSameSite} missing SameSite` : ''].filter(Boolean)
    return [{ id: 'cookie.security', status: issues.length ? missingSecure ? 'fail' : 'warn' : 'pass', severity: missingSecure ? 'high' : 'medium', title: issues.length ? `Cookie attributes need review (${issues.join(', ')})` : 'Response cookies include baseline security attributes', evidence: { count: cookies.length, missingSecure, missingHttpOnly, missingSameSite } }]
}

async function dnsCheck(host: string): Promise<WebScanCheck> {
    try {
        const addresses = await lookup(host, { all: true })
        return { id: 'dns.resolution', status: 'pass', severity: 'info', title: 'DNS resolution completed', evidence: { host, addresses: addresses.map(address => address.address) } }
    } catch (error) {
        return { id: 'dns.resolution', status: 'error', severity: 'high', title: 'DNS resolution completed', evidence: { host, error: error instanceof Error ? error.message : String(error) } }
    }
}

async function tlsCertificateCheck(host: string): Promise<WebScanCheck> {
    return new Promise(resolve => {
        const socket = tlsConnect({ host, port: 443, servername: host, rejectUnauthorized: false })
        let settled = false
        const finish = (check: WebScanCheck) => { if (settled) return; settled = true; socket.destroy(); resolve(check) }
        socket.setTimeout(5000, () => finish({ id: 'tls.certificate', status: 'error', severity: 'high', title: 'TLS certificate inspection completed', evidence: { host, error: 'TLS connection timed out' } }))
        socket.once('secureConnect', () => {
            const certificate = socket.getPeerCertificate()
            const expiresAt = certificate.valid_to ? new Date(certificate.valid_to) : null
            const daysRemaining = expiresAt ? Math.floor((expiresAt.getTime() - Date.now()) / 86_400_000) : null
            const status = daysRemaining === null ? 'error' : daysRemaining <= 0 ? 'fail' : daysRemaining <= 30 ? 'warn' : 'pass'
            finish({ id: 'tls.certificate', status, severity: status === 'pass' ? 'info' : 'high', title: status === 'fail' ? 'TLS certificate is expired' : status === 'warn' ? 'TLS certificate expires soon' : 'TLS certificate is valid', evidence: { host, subject: certificate.subject?.CN || null, issuer: certificate.issuer?.CN || null, expiresAt: expiresAt?.toISOString() || null, daysRemaining } })
        })
        socket.once('error', error => finish({ id: 'tls.certificate', status: 'error', severity: 'high', title: 'TLS certificate inspection completed', evidence: { host, error: error.message } }))
    })
}

async function explainChecks(checks: WebScanCheck[]): Promise<WebScanCheck[]> {
    const fallback = new Map(checks.map(check => [check.id, fallbackExplanation(check)]))
    try {
        const completion = await requestGptCompletion('gpt', { maxTokens: 700, temperature: 0, messages: [{ role: 'system', content: 'Explain each web security check in one concise sentence. Return only a JSON object keyed by check id. Use only supplied evidence.' }, { role: 'user', content: JSON.stringify(checks.map(check => ({ id: check.id, status: check.status, severity: check.severity, title: check.title, evidence: check.evidence }))) }] }, 15_000)
        const generated = parseExplanationObject(completion.content || '')
        return checks.map(check => ({ ...check, explanation: isUsefulExplanation(generated[check.id]) ? generated[check.id] : fallback.get(check.id) }))
    } catch {
        return checks.map(check => ({ ...check, explanation: fallback.get(check.id) }))
    }
}

function isUsefulExplanation(value: string | undefined) { return Boolean(value && value.length >= 40 && !/explanation is not available|completed this check/i.test(value)) }

function parseExplanationObject(content: string): Record<string, string> {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) return {}
    try {
        const parsed = JSON.parse(match[0]) as Record<string, unknown>
        return Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === 'string').map(([key, value]) => [key, String(value).trim().slice(0, 360)]))
    } catch { return {} }
}

export function fallbackExplanation(check: WebScanCheck): string {
    const present = Boolean(check.evidence.value)
    if (check.id === 'http.reachable') return check.status === 'pass' ? 'The target accepted an HTTPS request during this scan, so encrypted transport was reachable.' : `The scanner could not complete an HTTPS request to the target: ${String(check.evidence.error || 'the connection failed')}.`
    if (check.id === 'dns.resolution') return check.status === 'pass' ? 'DNS returned one or more addresses for the configured host.' : `DNS could not resolve the configured host: ${String(check.evidence.error || 'resolution failed')}.`
    if (check.id === 'tls.certificate') return check.status === 'pass' ? `The TLS certificate is valid for the target and expires in ${String(check.evidence.daysRemaining)} days.` : `The scanner could not confirm a healthy TLS certificate: ${String(check.evidence.error || check.title)}.`
    if (check.id === 'http.redirect') return check.status === 'pass' ? 'The target did not downgrade an HTTPS request during its redirect handling.' : `The target redirects to ${String(check.evidence.location || 'an insecure endpoint')}.`
    if (check.id === 'cookie.security') return check.status === 'pass' ? 'The response did not set cookies without baseline security attributes.' : 'At least one response cookie is missing a baseline security attribute; review the cookie flags before shipping it to browsers.'
    if (check.id === 'header.hsts') return present ? 'The response included Strict-Transport-Security, telling browsers to keep using HTTPS for this host.' : 'The response did not include Strict-Transport-Security, so browsers are not instructed to enforce HTTPS on future visits.'
    if (check.id === 'header.csp') return present ? 'The response included Content-Security-Policy; this scan confirms presence but does not assess directive quality.' : 'The response did not include Content-Security-Policy, so the browser has no explicit resource-loading policy.'
    if (check.id === 'header.frame-ancestors') return present ? `The response included ${String(check.evidence.header || 'a framing policy')}, which gives browsers a clickjacking protection rule.` : 'The response did not include a framing restriction, so the site may be embeddable in an attacker-controlled frame.'
    if (check.id === 'header.nosniff') return present ? 'The response included X-Content-Type-Options, telling browsers to respect declared content types.' : 'The response did not include X-Content-Type-Options: nosniff, so browsers may MIME-sniff content.'
    if (check.id === 'header.referrer-policy') return present ? 'The response declares a referrer-sharing policy for outbound requests.' : 'The response does not declare how much referrer information browsers should send.'
    if (check.id === 'header.permissions-policy') return present ? 'The response declares browser feature restrictions through Permissions-Policy.' : 'The response does not declare restrictions for browser features such as camera, microphone, or geolocation.'
    if (check.id === 'header.server') return present ? `The response included a Server header (${String(check.evidence.value)}), which reveals an implementation detail useful for fingerprinting.` : 'The response did not expose a Server header, so this scan found no server implementation detail to fingerprint.'
    return check.status === 'pass' ? `The scan observed the condition described by “${check.title}”; no immediate change is indicated.` : `The scan observed “${check.title}” as needing attention; inspect the retained evidence next.`
}

async function readReport(): Promise<WebScanReport> {
    const configured = await getConfiguredTarget()
    const schedule = await readSchedule(configured.target)
    if (configured.error) return { current: null, history: [], schedule, error: configured.error }
    try {
        await migrateLegacyHistory(configured.target!)
        const runs = await loadRuns()
        return { current: runs.find(run => run.status === 'running') || null, history: runs.filter(run => run.status !== 'running'), schedule, error: null }
    } catch (error) {
        return { current: null, history: [], schedule, error: error instanceof Error ? error.message : 'Web scan database is unavailable.' }
    }
}

async function getConfiguredTarget(): Promise<ConfiguredTarget> {
    try {
        const result = await queryOnce('SELECT target_url FROM web_scan_targets WHERE id = $1 AND enabled = TRUE', [TARGET_ID])
        if (!result.rows[0]) return { target: null, error: 'No enabled web scan target is configured.' }
        const target = normalizeTarget(result.rows[0].target_url)
        return target ? { target, error: null } : { target: null, error: 'The configured web scan target is invalid.' }
    } catch {
        return { target: null, error: 'Web scan target configuration is unavailable.' }
    }
}

export function normalizeTarget(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) return null
    try {
        const url = new URL(value.trim())
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null
        return url.toString().replace(/\/$/, '')
    } catch { return null }
}

async function readSchedule(target: string | null): Promise<WebScanSchedule> {
    const empty: WebScanSchedule = { enabled: true, intervalMinutes: DEFAULT_INTERVAL_MINUTES, nextRunAt: new Date().toISOString(), lastRunAt: null, target, scope: 'global' }
    try {
        const parsed = JSON.parse(await readFile(STATE_PATH, 'utf8')) as { schedule?: Partial<WebScanSchedule> }
        return { ...empty, ...(parsed.schedule || {}), target, scope: 'global' }
    } catch { return empty }
}

async function writeSchedule(schedule: WebScanSchedule, error: string | null) {
    await mkdir(path.dirname(STATE_PATH), { recursive: true })
    const temporaryPath = `${STATE_PATH}.${process.pid}.${randomUUID()}.tmp`
    try {
        await writeFile(temporaryPath, JSON.stringify({ schedule, error }, null, 2), 'utf8')
        await rename(temporaryPath, STATE_PATH)
    } finally { await rm(temporaryPath, { force: true }) }
}

async function migrateLegacyHistory(target: string) {
    const count = await queryOnce('SELECT COUNT(*)::int AS count FROM web_scan_runs')
    if (Number(count.rows[0]?.count || 0) > 0) return
    let parsed: { history?: WebScanRun[] }
    try { parsed = JSON.parse(await readFile(STATE_PATH, 'utf8')) as { history?: WebScanRun[] } } catch { return }
    for (const run of (parsed.history || []).slice(0, MAX_HISTORY)) {
        const migrated = { ...run, target, targets: run.targets.map(item => ({ ...item, target })) }
        await insertRun(migrated)
        await finishRun({ enabled: false, intervalMinutes: DEFAULT_INTERVAL_MINUTES, nextRunAt: null, lastRunAt: run.finishedAt, target, scope: 'global' }, migrated, false)
    }
}

async function loadRuns(): Promise<WebScanRun[]> {
    const runs = await queryOnce('SELECT scan_id, target_url, status, target_status, started_at, finished_at, duration_ms, severity_counts, error FROM web_scan_runs ORDER BY started_at DESC LIMIT $1', [MAX_HISTORY])
    if (!runs.rows.length) return []
    const findings = await queryOnce('SELECT scan_id, target_url, kind, check_id, status, severity, title, explanation, evidence, port, elapsed_ms FROM web_scan_findings WHERE scan_id = ANY($1::text[]) ORDER BY id', [runs.rows.map(row => row.scan_id)])
    return runs.rows.map(row => runFromRows(row as StoredRun, findings.rows.filter(finding => finding.scan_id === row.scan_id) as StoredFinding[]))
}

function runFromRows(row: StoredRun, findings: StoredFinding[]): WebScanRun {
    const checks = findings.filter(finding => finding.kind === 'check').map(finding => ({ id: finding.check_id, status: finding.status as WebScanCheck['status'], severity: finding.severity, title: finding.title, explanation: finding.explanation || undefined, evidence: finding.evidence }))
    const ports = findings.filter(finding => finding.kind === 'port' && finding.port !== null).map(finding => ({ port: finding.port!, open: finding.status !== 'pass', elapsedMs: finding.elapsed_ms || 0 }))
    return { scanId: row.scan_id, status: row.status, startedAt: new Date(row.started_at).toISOString(), finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null, durationMs: row.duration_ms, target: row.target_url, targets: [{ target: row.target_url, status: row.target_status, checks, ports }], severityCounts: row.severity_counts || emptySeverityCounts(), error: row.error }
}

function hydrateReport(report: WebScanReport): WebScanReport {
    const hydrateRun = (run: WebScanRun | null): WebScanRun | null => run ? { ...run, targets: run.targets.map(target => ({ ...target, checks: target.checks.map(check => ({ ...check, explanation: isUsefulExplanation(check.explanation) ? check.explanation : fallbackExplanation(check) })) })) } : null
    return { ...report, current: hydrateRun(report.current), history: report.history.map(run => hydrateRun(run)!).filter(Boolean) }
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
        let settled = false
        const finish = (open: boolean) => { if (settled) return; settled = true; socket.destroy(); resolve({ port, open, elapsedMs: Math.round(performance.now() - started) }) }
        socket.setTimeout(2500, () => finish(false)); socket.once('connect', () => finish(true)); socket.once('error', () => finish(false))
    })
}
