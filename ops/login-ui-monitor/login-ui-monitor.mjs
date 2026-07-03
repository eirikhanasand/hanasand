import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { performance } from 'node:perf_hooks'

const baseUrl = trimSlash(process.env.HANASAND_BASE_URL || 'https://hanasand.com')
const username = process.env.HANASAND_LOGIN_MONITOR_USER || ''
const password = process.env.HANASAND_LOGIN_MONITOR_PASSWORD || ''
const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL || ''
const statePath = process.env.HANASAND_LOGIN_MONITOR_STATE || '/home/hanasand/monitor-state/login-ui-monitor.json'
const failureScreenshotPath = process.env.HANASAND_LOGIN_MONITOR_SCREENSHOT || '/home/hanasand/monitor-state/login-ui-monitor-failure.png'
const timeoutMs = Number(process.env.HANASAND_LOGIN_MONITOR_TIMEOUT_MS || 25_000)
const repeatAlertMinutes = Number(process.env.HANASAND_LOGIN_MONITOR_REPEAT_ALERT_MINUTES || 15)
const now = new Date()

if (process.argv.includes('--self-test')) {
    runSelfTest()
    process.exit(0)
}

if (!username || !password) {
    await handleResult({
        ok: false,
        reason: 'missing_credentials',
        detail: 'HANASAND_LOGIN_MONITOR_USER and HANASAND_LOGIN_MONITOR_PASSWORD are required.',
        latencyMs: 0,
    })
    process.exit(2)
}

const started = performance.now()
let browser

try {
    const { chromium } = await import('playwright')
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: false,
    })
    const page = await context.newPage()
    page.setDefaultTimeout(timeoutMs)

    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
    await page.getByRole('heading', { name: 'Hanasand' }).waitFor({ state: 'visible', timeout: timeoutMs })
    await page.getByLabel('Username', { exact: true }).fill(username)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await Promise.all([
        page.waitForURL(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: timeoutMs }),
        page.getByRole('button', { name: 'Log in' }).click(),
    ])

    await page.getByText('Operations Workbench', { exact: false }).waitFor({ state: 'visible', timeout: timeoutMs })
    const title = await page.title()
    const bodyText = await page.locator('body').innerText({ timeout: timeoutMs }).catch(() => '')
    const signal = evaluateLoginDashboard(title, bodyText)
    if (!signal.ok) throw new Error(signal.detail)

    await handleResult({
        ok: true,
        reason: 'login_ui_ok',
        detail: `Logged in as ${username} and reached /dashboard.`,
        latencyMs: Math.round(performance.now() - started),
    })
} catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
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
        reason: 'login_ui_failed',
        detail,
        latencyMs: Math.round(performance.now() - started),
    })
    process.exit(1)
} finally {
    await browser?.close().catch(() => {})
}

async function handleResult(result) {
    const previous = await readState()
    const alertErrors = []
    const next = {
        ...result,
        checkedAt: now.toISOString(),
        baseUrl,
        username,
        failureScreenshotPath: result.ok ? undefined : failureScreenshotPath,
        lastAlertAt: previous.lastAlertAt || null,
        alertErrors,
    }

    if (result.ok && previous.ok === false) {
        const sent = await trySendDiscord({
            status: 'RECOVERED',
            color: 0x22c55e,
            title: 'Hanasand login UI recovered',
            description: result.detail,
            fields: resultFields(result),
        })
        if (sent) {
            next.lastAlertAt = now.toISOString()
        }
    }

    if (!result.ok) {
        const shouldAlert = previous.ok !== false || minutesSince(previous.lastAlertAt) >= repeatAlertMinutes
        if (shouldAlert) {
            const sent = await trySendDiscord({
                status: 'DOWN',
                color: 0xef4444,
                title: 'Hanasand login UI failed',
                description: result.detail,
                fields: resultFields(result),
            })
            if (sent) {
                next.lastAlertAt = now.toISOString()
            }
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
        throw new Error(`DISCORD_WEBHOOK_URL is required to alert login monitor status=${status}`)
    }

    const response = await fetch(discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content: status === 'DOWN' ? '@here Hanasand login UI check failed.' : undefined,
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
    return [
        { name: 'URL', value: baseUrl, inline: true },
        { name: 'User', value: username, inline: true },
        { name: 'Latency', value: `${result.latencyMs}ms`, inline: true },
        { name: 'Reason', value: result.reason, inline: true },
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

export function evaluateLoginDashboard(title, bodyText) {
    const text = `${title}\n${bodyText}`.toLowerCase()
    if (!text.includes('operations workbench')) {
        return { ok: false, detail: `Dashboard did not show Operations Workbench. Title: ${title || 'untitled'}` }
    }
    if (/unauthorized|forbidden|sign in|log in|missing system_admin/i.test(bodyText)) {
        return { ok: false, detail: 'Dashboard rendered an authentication or authorization failure after login.' }
    }
    return { ok: true, detail: 'Login reached Operations Workbench.' }
}

function runSelfTest() {
    const healthy = evaluateLoginDashboard('Operations Workbench | Hanasand', 'Operations Workbench\nDashboard')
    assert.equal(healthy.ok, true)

    const wrongTitle = evaluateLoginDashboard('Hanasand', 'Dashboard')
    assert.equal(wrongTitle.ok, false)

    const authFailure = evaluateLoginDashboard('Operations Workbench | Hanasand', 'Unauthorized')
    assert.equal(authFailure.ok, false)

    console.log('Login UI monitor self-test passed.')
}
