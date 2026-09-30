import assert from 'node:assert/strict'
import { cp, mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const base = 'http://127.0.0.1:3019'
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const date = '2026-09-30T00:30:00.000Z'
const nextDate = '2026-10-01T00:00:00.000Z'
const vm = {
    name: 'hydration-vm', owner: 'test', created_by: 'test', access_users: [], always_running_premium: false,
    always_running_enabled: false, failover_premium: false, failover_enabled: false, primary_host: 'host', failover_host: null,
    status: 'Running', type: 'container', architecture: 'x86_64', created: date, last_used: date, config_image_description: 'Ubuntu',
    config_image_os: 'Ubuntu', config_image_version: '24.04', limits_cpu: '2', limits_memory: '2 GB',
    device_eth0_ipv4_address: '127.0.0.1', last_checked: date,
}
const vms = [vm, {
    ...vm, name: 'hydration-expired-vm', status: 'Deleted', deleted_at: date,
    delete_after: '2000-01-01T00:00:00.000Z',
}, {
    ...vm, name: 'hydration-recoverable-vm', status: 'Deleted', deleted_at: date, delete_after: nextDate,
}]
const automation = {
    id: 'monitor', name: 'Server rendered monitor', prompt: 'Availability check', status: 'active', actionType: 'agent_prompt',
    targetUrl: 'https://example.com', monitoringType: 'fetch', followRedirects: true, userAgent: null, expectedDown: false,
    upsideDown: false, timeoutSeconds: 5, retryCount: 1, certificateStatus: 'valid', certificateSubject: 'example.com',
    certificateIssuer: 'Test CA', certificateExpiresAt: nextDate, notifyWarnings: false, scheduleKind: 'interval',
    intervalMinutes: 15, runAt: null, organizationId: null, timezone: 'UTC', modelName: null,
    notificationDestinations: [], notifyOn: 'failure', nextRunAt: nextDate, lastRunAt: date, lastCompletedAt: date,
    lastStatus: 'completed', lastResult: 'Available', lastError: null, consecutiveFailures: 0, pausedReason: null,
    runCount: 1, createdAt: date, updatedAt: date, history: [{ id: 'history', status: 'completed', warning: false, started_at: date }],
}
const automationDetail = {
    automation,
    runs: [{ id: 'run', automationId: 'monitor', status: 'completed', warning: false, result: 'Available', error: null, provider: null,
        model: null, startedAt: date, completedAt: date, durationMs: 10 }],
    issues: [], total: 1, nextPage: null,
}
const scan = {
    current: null,
    history: [{ scanId: 'scan-1', status: 'completed', startedAt: date, finishedAt: date, durationMs: 10, target: 'example.com',
        targets: [], severityCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 }, error: null }],
    schedule: { enabled: true, intervalMinutes: 15, nextRunAt: nextDate, lastRunAt: date, target: 'example.com', scope: 'global' },
    error: null,
}
const backups = [{ id: 'backup', name: 'Database backup', status: 'healthy', lastAttempt: date, lastSuccess: date, lastFailure: null,
    nextBackup: nextDate, schedule: '0 2 * * *', scheduleTimezone: 'UTC', scheduleEnabled: true, operations: [] }]

const api = Bun.serve({ port: 0, hostname: '127.0.0.1', async fetch(request) {
    const path = new URL(request.url).pathname.replace(/^\/api/, '')
    await delay(120)
    if (path === '/management/organizations' || path === '/management/organizations?access=1') return Response.json({ allowed: false })
    if (path === '/vms/dashboard-render-proof-user') return Response.json(vms)
    if (path === '/vulnerabilities/web-scan') return Response.json(scan)
    if (path === '/backup') return Response.json(backups)
    if (path === '/backup/files') return Response.json([{ service: 'backup', file: 'backup.tar', mtime: date, verified: true }])
    if (path === '/automations') return Response.json({ automations: [automation], canManageSystem: false })
    if (path.startsWith('/automations/monitor')) return Response.json(automationDetail)
    return Response.json({ error: `Unexpected test API request: ${path}` }, { status: 404 })
} })

const apiBase = new URL('api', api.url).href.replace(/\/$/, '')
const measureResponseTime = process.env.DASHBOARD_HYDRATION_MEASURE === '1'
const serverEnv = { ...process.env, TZ: 'UTC', FRONTEND_INTERNAL_API: apiBase, FRONTEND_AUTH_API: apiBase, NEXT_PUBLIC_API: apiBase }
let server
if (measureResponseTime) {
    await cp('public', '.next/standalone/public', { recursive: true })
    await mkdir('.next/standalone/.next', { recursive: true })
    await cp('.next/static', '.next/standalone/.next/static', { recursive: true })
    server = Bun.spawn(['node', 'server.js'], {
        cwd: '.next/standalone',
        env: { ...serverEnv, PORT: '3019', HOSTNAME: '127.0.0.1' },
        stdout: 'ignore', stderr: 'inherit',
    })
} else {
    server = Bun.spawn(['bun', '--bun', 'next', 'dev', '--webpack', '-p', '3019'], {
        env: { ...serverEnv, NEXT_DIST_DIR: '.next/dashboard-hydration-test' },
        stdout: 'ignore', stderr: 'inherit',
    })
}
let browser
const cookie = 'id=dashboard-render-proof-user; access_token=local-dashboard-render-proof-token; dashboard_view_mode=normal'
const headers = { cookie, 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' }
const routes = [
    { path: '/scanner', heading: 'Runs' },
    { path: '/vms', heading: 'Virtual machines' },
    { path: '/db/backups', heading: 'Backups' },
    { path: '/automation/health', heading: 'Server rendered monitor' },
]

async function firstByteMs(path) {
    const started = performance.now()
    const response = await fetch(base + path, { headers })
    assert.equal(response.status, 200, `${path} should return HTTP 200`)
    const reader = response.body.getReader()
    await reader.read()
    const elapsed = performance.now() - started
    await reader.cancel()
    return elapsed
}

try {
    for (let attempt = 0; attempt < 120; attempt++) {
        if (server.exitCode !== null) throw new Error('Test frontend failed to start')
        if (await fetch(base).then(() => true).catch(() => false)) break
        await delay(500)
    }

    if (measureResponseTime) {
        // Warm the route bundles as deployment does, while keeping the stub API
        // slow so response streaming cannot depend on those upstream requests.
        for (const route of routes) {
            const response = await fetch(base + route.path, { headers })
            await response.text()
        }

        for (const route of routes) {
            const first = await firstByteMs(route.path)
            assert(first < 20, `${route.path} first byte after warmup was ${first.toFixed(1)}ms`)
            for (let warmup = 0; warmup < 2; warmup++) await firstByteMs(route.path)
            const samples = []
            for (let sample = 0; sample < 3; sample++) samples.push(await firstByteMs(route.path))
            const median = samples.sort((a, b) => a - b)[1]
            assert(median < 20, `${route.path} TTFB was ${median.toFixed(1)}ms (samples: ${samples.map(value => value.toFixed(1)).join(', ')})`)
            console.log(`${route.path}: first byte ${first.toFixed(1)}ms, warm median ${median.toFixed(1)}ms`)
        }
    }

    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ timezoneId: 'America/Los_Angeles', extraHTTPHeaders: { 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' } })
    await context.addCookies(Object.entries({
        id: 'dashboard-render-proof-user', access_token: 'local-dashboard-render-proof-token',
        dashboard_view_mode: 'normal',
    }).map(([name, value]) => ({ name, value, url: base })))
    await context.route('**/api/backend/**', route => {
        const path = new URL(route.request().url()).pathname
        const body = path.includes('/vms/') ? vms : path.endsWith('/automations') ? { automations: [automation] } : automationDetail
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })

    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => {
        if (message.type() === 'error' && /hydration|didn't match|error #418/i.test(message.text())) errors.push(message.text())
    })

    for (const route of routes) {
        await page.goto(base + route.path, { waitUntil: 'load' })
        await page.getByRole('heading', { name: route.heading, exact: true }).waitFor()
        await page.waitForTimeout(250)
    }

    assert.deepEqual(errors, [])
    console.log(`Dashboard hydration passed in UTC server and America/Los_Angeles browser timezones${measureResponseTime ? ' with first-byte timing under 20ms' : ''}.`)
} finally {
    await browser?.close()
    server.kill()
    await server.exited
    api.stop(true)
}
