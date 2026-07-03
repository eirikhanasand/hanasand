import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { performance } from 'node:perf_hooks'

const baseUrl = trimSlash(process.env.HANASAND_DB_MONITOR_BASE_URL || 'https://hanasand.com')
const dashboardPath = process.env.HANASAND_DB_MONITOR_PATH || '/dashboard/db'
const username = process.env.HANASAND_DB_MONITOR_USER || ''
const password = process.env.HANASAND_DB_MONITOR_PASSWORD || ''
const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL || ''
const discordMention = process.env.HANASAND_DB_MONITOR_DISCORD_MENTION || '@here'
const statePath = process.env.HANASAND_DB_MONITOR_STATE || '/home/hanasand/monitor-state/db-dashboard-monitor.json'
const failureScreenshotPath = process.env.HANASAND_DB_MONITOR_SCREENSHOT || '/home/hanasand/monitor-state/db-dashboard-monitor-failure.png'
const timeoutMs = Number(process.env.HANASAND_DB_MONITOR_TIMEOUT_MS || 30_000)
const repeatAlertMinutes = Number(process.env.HANASAND_DB_MONITOR_REPEAT_ALERT_MINUTES || 15)
const failureThreshold = Math.max(Number(process.env.HANASAND_DB_MONITOR_FAILURE_THRESHOLD || 2), 1)
const now = new Date()

class MonitorFailure extends Error {
    constructor(reason, message, metrics) {
        super(message)
        this.reason = reason
        this.metrics = metrics
    }
}

if (process.argv.includes('--self-test')) {
    runSelfTest()
    process.exit(0)
}

if (!username || !password) {
    await handleResult({
        ok: false,
        reason: 'missing_credentials',
        detail: 'HANASAND_DB_MONITOR_USER and HANASAND_DB_MONITOR_PASSWORD are required.',
        latencyMs: 0,
        metrics: {},
    })
    process.exit(2)
}

const started = performance.now()
let browser

try {
    const { chromium } = await import('playwright')
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
        viewport: { width: 1280, height: 760 },
        ignoreHTTPSErrors: false,
    })
    const page = await context.newPage()
    page.setDefaultTimeout(timeoutMs)

    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
    await page.getByRole('heading', { name: 'Hanasand' }).waitFor({ state: 'visible', timeout: timeoutMs })
    await page.getByLabel('Username', { exact: true }).fill(username)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await Promise.all([
        page.waitForURL(/\/dashboard(?:\/.*)?$/, { waitUntil: 'domcontentloaded', timeout: timeoutMs }),
        page.getByRole('button', { name: 'Log in' }).click(),
    ])

    await page.goto(`${baseUrl}${dashboardPath}`, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
    await page.getByRole('heading', { name: 'Database', exact: true }).waitFor({ state: 'visible', timeout: timeoutMs })

    const bodyText = await page.locator('body').innerText({ timeout: timeoutMs })
    const signal = evaluateDashboardText(bodyText)
    if (!signal.ok) {
        throw new MonitorFailure(signal.reason, signal.detail, signal.metrics)
    }

    await handleResult({
        ok: true,
        reason: 'db_dashboard_ok',
        detail: signal.detail,
        latencyMs: Math.round(performance.now() - started),
        metrics: signal.metrics,
    })
} catch (error) {
    const failure = normalizeFailure(error)
    try {
        const pages = browser?.contexts()?.flatMap(context => context.pages()) || []
        const page = pages[pages.length - 1]
        if (page) {
            await mkdir(dirname(failureScreenshotPath), { recursive: true })
            await page.screenshot({ path: failureScreenshotPath, fullPage: true }).catch(() => {})
        }
    } catch {
        // Best-effort failure evidence only.
    }

    await handleResult({
        ok: false,
        reason: failure.reason,
        detail: failure.detail,
        latencyMs: Math.round(performance.now() - started),
        metrics: failure.metrics,
    })
    process.exit(1)
} finally {
    await browser?.close().catch(() => {})
}

export function evaluateDashboardText(text) {
    const lines = linesFromText(text)
    const fullText = lines.join('\n')
    const unavailablePattern = /Database telemetry is reconnecting|Database metrics unavailable|Query telemetry unavailable|Inventory stream retrying|Cluster stream retrying|Missing system_admin|Unauthorized/i
    const unavailableMatch = fullText.match(unavailablePattern)
    const metrics = {
        clusters: parseIntegerMetric(lines, 'Clusters'),
        databases: parseIntegerMetric(lines, 'Databases'),
        storageBytes: parseStorageMetric(lines, 'Storage'),
        activeQueries: parseIntegerMetric(lines, 'Active queries'),
        longRunning: parseIntegerMetric(lines, 'Long-running'),
    }

    if (unavailableMatch) {
        return {
            ok: false,
            reason: 'db_dashboard_unavailable',
            detail: `Database dashboard showed unavailable state: ${unavailableMatch[0]}.`,
            metrics,
        }
    }

    if (metrics.clusters === null || metrics.clusters < 1) {
        return {
            ok: false,
            reason: 'db_dashboard_missing_clusters',
            detail: 'Database dashboard did not show at least one PostgreSQL cluster.',
            metrics,
        }
    }

    if (metrics.databases === null || metrics.databases < 1) {
        return {
            ok: false,
            reason: 'db_dashboard_missing_databases',
            detail: 'Database dashboard did not show at least one database.',
            metrics,
        }
    }

    if (metrics.storageBytes === null || metrics.storageBytes <= 0) {
        return {
            ok: false,
            reason: 'db_dashboard_missing_storage',
            detail: 'Database dashboard did not show non-zero PostgreSQL storage.',
            metrics,
        }
    }

    if (!/No long-running queries right now|Long-running/i.test(fullText)) {
        return {
            ok: false,
            reason: 'db_dashboard_missing_query_state',
            detail: 'Database dashboard did not show an explicit long-running query state.',
            metrics,
        }
    }

    return {
        ok: true,
        reason: 'db_dashboard_ok',
        detail: `Database dashboard live: ${metrics.clusters} cluster(s), ${metrics.databases} database(s), ${formatBytes(metrics.storageBytes)} storage.`,
        metrics,
    }
}

async function handleResult(result) {
    const previous = await readState()
    const alertErrors = []
    const next = {
        ...result,
        checkedAt: now.toISOString(),
        baseUrl,
        dashboardPath,
        username,
        failureScreenshotPath: result.ok ? undefined : failureScreenshotPath,
        lastAlertAt: previous.lastAlertAt || null,
        failureCount: result.ok ? 0 : Number(previous.failureCount || 0) + 1,
        failureThreshold,
        alertErrors,
    }

    if (result.ok && previous.ok === false) {
        const sent = await trySendDiscord({
            status: 'RECOVERED',
            color: 0x22c55e,
            title: 'Hanasand database dashboard recovered',
            description: result.detail,
            fields: resultFields(result),
        })
        if (sent) next.lastAlertAt = now.toISOString()
    }

    if (!result.ok) {
        const shouldAlert = next.failureCount >= failureThreshold
            && (previous.ok !== false || minutesSince(previous.lastAlertAt) >= repeatAlertMinutes)
        if (shouldAlert) {
            const sent = await trySendDiscord({
                status: 'DOWN',
                color: 0xef4444,
                title: 'Hanasand database dashboard failed',
                description: result.detail,
                fields: resultFields(result),
            })
            if (sent) next.lastAlertAt = now.toISOString()
        }
    }

    await writeState(next)
    console.log(JSON.stringify(next))

    async function trySendDiscord(payload) {
        try {
            await sendDiscord(payload)
            return true
        } catch (error) {
            alertErrors.push(error instanceof Error ? error.message : String(error))
            return false
        }
    }
}

async function sendDiscord({ status, color, title, description, fields }) {
    if (!discordWebhookUrl) {
        throw new Error(`DISCORD_WEBHOOK_URL is required to alert database dashboard monitor status=${status}`)
    }

    const response = await fetch(discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content: status === 'DOWN' ? `${discordMention} Hanasand database dashboard check failed.` : undefined,
            embeds: [{
                title,
                description: truncate(description, 900),
                color,
                timestamp: now.toISOString(),
                fields,
            }],
        }),
    })

    if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`Discord webhook failed ${response.status}: ${truncate(body, 300)}`)
    }
}

function resultFields(result) {
    const metrics = result.metrics || {}
    return [
        { name: 'URL', value: `${baseUrl}${dashboardPath}`, inline: true },
        { name: 'User', value: username, inline: true },
        { name: 'Latency', value: `${result.latencyMs}ms`, inline: true },
        { name: 'Reason', value: result.reason, inline: true },
        { name: 'Clusters', value: String(metrics.clusters ?? 'unknown'), inline: true },
        { name: 'Databases', value: String(metrics.databases ?? 'unknown'), inline: true },
        ...(result.ok ? [] : [{ name: 'Failure screenshot', value: failureScreenshotPath, inline: false }]),
    ]
}

async function readState() {
    try {
        return JSON.parse(await readFile(statePath, 'utf8'))
    } catch {
        return {}
    }
}

async function writeState(state) {
    await mkdir(dirname(statePath), { recursive: true })
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`)
}

function normalizeFailure(error) {
    if (error instanceof MonitorFailure) {
        return {
            reason: error.reason,
            detail: error.message,
            metrics: error.metrics,
        }
    }
    return {
        reason: 'db_dashboard_failed',
        detail: error instanceof Error ? error.message : String(error),
        metrics: {},
    }
}

function linesFromText(text) {
    return String(text || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
}

function parseIntegerMetric(lines, label) {
    const value = metricValue(lines, label)
    if (!value) return null
    const parsed = Number(value.replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : null
}

function parseStorageMetric(lines, label) {
    const value = metricValue(lines, label)
    if (!value) return null
    const match = value.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i)
    if (!match) return null
    const amount = Number(match[1])
    const unit = match[2].toUpperCase()
    const multiplier = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 }[unit]
    return Number.isFinite(amount) ? amount * multiplier : null
}

function metricValue(lines, label) {
    const index = lines.findIndex(line => line.toLowerCase() === label.toLowerCase())
    if (index === -1) return null
    return lines[index + 1] || null
}

function minutesSince(value) {
    if (!value) return Number.POSITIVE_INFINITY
    const then = new Date(value).getTime()
    if (!Number.isFinite(then)) return Number.POSITIVE_INFINITY
    return (Date.now() - then) / 60_000
}

function trimSlash(value) {
    return value.replace(/\/$/, '')
}

function truncate(value, max) {
    const text = String(value || '')
    return text.length > max ? `${text.slice(0, max - 1)}...` : text
}

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let value = bytes
    let index = 0
    while (value >= 1024 && index < units.length - 1) {
        value /= 1024
        index++
    }
    return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`
}

function runSelfTest() {
    const healthy = evaluateDashboardText(`
        Operations
        Database
        Live
        Database metrics loaded from the live PostgreSQL telemetry views.
        Query watcher
        0 active
        No long-running queries right now
        Clusters
        1
        Databases
        2
        Storage
        108.00 MB
        Active queries
        0
        Long-running
        0
    `)
    assert.equal(healthy.ok, true)
    assert.equal(healthy.metrics.clusters, 1)
    assert.equal(healthy.metrics.databases, 2)
    assert.ok(healthy.metrics.storageBytes > 0)

    const unavailable = evaluateDashboardText(`
        Operations
        Database
        Unavailable
        Database metrics unavailable: the internal API cannot authenticate to PostgreSQL.
        Clusters
        Connecting
        Databases
        Connecting
        Storage
        Metering
    `)
    assert.equal(unavailable.ok, false)
    assert.equal(unavailable.reason, 'db_dashboard_unavailable')

    const shell = evaluateDashboardText(`
        Operations
        Database
        Clusters
        0
        Databases
        0
        Storage
        0 B
        Active queries
        0
        Long-running
        0
    `)
    assert.equal(shell.ok, false)
    assert.equal(shell.reason, 'db_dashboard_missing_clusters')

    console.log('Database dashboard monitor self-test passed.')
}
