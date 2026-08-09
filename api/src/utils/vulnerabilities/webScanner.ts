import { connect } from 'node:net'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const STATE_PATH = process.env.WEB_SCAN_STATE_PATH || '/var/lib/hanasand/web-scan.json'
const TARGETS = ['https://hanasand.com']
const PORTS = [80, 443, 8080, 8443]

export type WebScanCheck = {
    id: string
    status: 'pass' | 'warn' | 'fail' | 'error'
    title: string
    evidence: Record<string, unknown>
}
export type WebScanReport = {
    scanId: string | null
    startedAt: string | null
    finishedAt: string | null
    running: boolean
    targets: Array<{ target: string, status: string, checks: WebScanCheck[], ports: Array<{ port: number, open: boolean, elapsedMs: number }> }>
    error: string | null
}

let active: Promise<WebScanReport> | null = null

const emptyReport = (): WebScanReport => ({ scanId: null, startedAt: null, finishedAt: null, running: false, targets: [], error: null })

export async function getWebScanReport() {
    return readState()
}

export function startWebScan() {
    if (active) return active
    active = runWebScan().finally(() => { active = null })
    return active
}

async function runWebScan(): Promise<WebScanReport> {
    const scanId = `webscan_${randomUUID()}`
    const startedAt = new Date().toISOString()
    const running = { ...await readState(), scanId, startedAt, finishedAt: null, running: true, error: null }
    await writeState(running)
    try {
        const targets = await Promise.all(TARGETS.map(target => scanTarget(target, scanId)))
        const report = { scanId, startedAt, finishedAt: new Date().toISOString(), running: false, targets, error: null }
        await writeState(report)
        return report
    } catch (error) {
        const report = { ...running, finishedAt: new Date().toISOString(), running: false, error: error instanceof Error ? error.message : String(error) }
        await writeState(report)
        return report
    }
}

async function scanTarget(target: string, scanId: string): Promise<WebScanReport['targets'][number]> {
    const url = new URL(target)
    const started = performance.now()
    const headers = {
        'user-agent': 'Hanasand-Security-Scanner/1.0 (+https://hanasand.com/security-scanner)',
        'x-hanasand-scan-id': scanId,
    }
    try {
        const response = await fetch(url, { method: 'GET', headers, redirect: 'manual', signal: AbortSignal.timeout(12_000) })
        const responseHeaders = Object.fromEntries(response.headers.entries())
        const checks = headerChecks(responseHeaders, url.protocol === 'https:')
        return { target, status: String(response.status), checks, ports: await Promise.all(PORTS.map(port => checkPort(url.hostname, port))) }
    } catch (error) {
        return { target, status: 'error', checks: [{ id: 'http.reachable', status: 'error' as const, title: 'HTTPS request completed', evidence: { error: error instanceof Error ? error.message : String(error), elapsedMs: Math.round(performance.now() - started) } }], ports: [] }
    }
}

export function headerChecks(headers: Record<string, string>, https: boolean): WebScanCheck[] {
    const check = (id: string, title: string, header: string, required: boolean): WebScanCheck => ({ id, title, status: headers[header] ? 'pass' : required ? 'fail' : 'warn', evidence: { header, value: headers[header] || null } })
    return [
        { id: 'http.reachable', status: 'pass', title: 'HTTPS request completed', evidence: { status: headers[':status'] || 'received' } },
        check('header.hsts', 'Strict-Transport-Security is present', 'strict-transport-security', https),
        check('header.csp', 'Content-Security-Policy is present', 'content-security-policy', false),
        check('header.frame-ancestors', 'Clickjacking protection is present', 'x-frame-options', false),
        check('header.nosniff', 'MIME sniffing protection is present', 'x-content-type-options', false),
        { id: 'header.server', title: 'Server fingerprint is minimized', status: headers.server ? 'warn' : 'pass', evidence: { value: headers.server || null } },
    ]
}

function checkPort(host: string, port: number): Promise<{ port: number, open: boolean, elapsedMs: number }> {
    return new Promise(resolve => {
        const started = performance.now()
        const socket = connect({ host, port })
        const finish = (open: boolean) => { socket.destroy(); resolve({ port, open, elapsedMs: Math.round(performance.now() - started) }) }
        socket.setTimeout(2500, () => finish(false))
        socket.once('connect', () => finish(true))
        socket.once('error', () => finish(false))
    })
}

async function readState(): Promise<WebScanReport> {
    try { return JSON.parse(await readFile(STATE_PATH, 'utf8')) as WebScanReport } catch { return emptyReport() }
}

async function writeState(report: WebScanReport) {
    await mkdir(path.dirname(STATE_PATH), { recursive: true })
    await writeFile(STATE_PATH, JSON.stringify(report, null, 2), 'utf8')
}
