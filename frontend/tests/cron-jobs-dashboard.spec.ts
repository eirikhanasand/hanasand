import { expect, test } from '@playwright/test'

test('cron jobs dashboard renders unified scheduled operations and controls', async ({ context, page, baseURL }) => {
    const origin = baseURL || 'http://127.0.0.1:3000'
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies([
        { name: 'id', value: 'dashboard-render-proof-user', url: origin },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', url: origin },
        { name: 'id', value: 'dashboard-render-proof-user', domain: 'localhost', path: '/' },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', domain: 'localhost', path: '/' },
        { name: 'id', value: 'dashboard-render-proof-user', domain: '127.0.0.1', path: '/' },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', domain: '127.0.0.1', path: '/' },
        { name: 'roles', value: encodeURIComponent(JSON.stringify(['system_admin'])), url: origin },
        { name: 'roles', value: encodeURIComponent(JSON.stringify(['system_admin'])), domain: 'localhost', path: '/' },
        { name: 'roles', value: encodeURIComponent(JSON.stringify(['system_admin'])), domain: '127.0.0.1', path: '/' },
    ])

    const updates: unknown[] = []
    await page.route('**/api/backend/system/cron**', async route => {
        if (route.request().method() === 'GET') {
            await route.fulfill({ json: { jobs: fixtureJobs } })
            return
        }
        await route.fallback()
    })
    await page.route('**/api/backend/system/cron/ti-public-canary-collection**', async route => {
        const body = await route.request().postDataJSON()
        updates.push(body)
        const nextJob = body.action === 'run_now'
            ? { ...fixtureJobs[0], running: true, status: 'running' }
            : { ...fixtureJobs[0], enabled: false, status: 'paused' }
        await route.fulfill({ json: { job: nextJob, jobs: [nextJob, ...fixtureJobs.slice(1)] } })
    })
    await page.route('**/api/backend/system/cron/api-vulnerability-scanner**', async route => {
        updates.push(await route.request().postDataJSON())
        const scanner = fixtureJobs.find(job => job.id === 'api-vulnerability-scanner')!
        const nextScanner = { ...scanner, status: 'running', running: true }
        await route.fulfill({ json: { job: nextScanner, jobs: fixtureJobs.map(job => job.id === 'api-vulnerability-scanner' ? nextScanner : job) } })
    })

    await page.goto('/dashboard/cron-jobs', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: 'Cron jobs' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '1 job needs review' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Needs attention' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Next safe action' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Public TI collection loop' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Exposure parser bridge' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'DWM alert generation readiness' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Vulnerability image scanner' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Vulnerability image scanner/ })).toContainText('Docker socket is unavailable at /var/run/docker.sock')
    await expect(page.getByText('blocked', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'DWM exposure queue collection' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Forgejo standby sync' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Alerts' })).toBeVisible()
    await expect(page.getByText('Observable only')).toHaveCount(4)
    await expect(page.getByText('$0.0037/hr').first()).toBeHidden()

    await page.getByText('Runtime, cost, and log details').first().click()
    await expect(page.getByText('$0.0037/hr').first()).toBeVisible()
    await expect(page.getByText('ok').first()).toBeVisible()

    await page.getByRole('button', { name: 'Pause' }).first().click()
    await expect.poll(() => updates.length).toBe(1)
    expect(updates[0]).toMatchObject({ enabled: false })

    await page.getByRole('button', { name: 'Run now' }).first().click()
    await expect.poll(() => updates.length).toBe(2)
    expect(updates[1]).toMatchObject({ action: 'run_now' })
    await expect(page.locator('span').filter({ hasText: /^running$/ })).toBeVisible()
})

const baseJob = {
    description: 'test',
    service: 'ti-scraper',
    source: 'test',
    cadenceSeconds: 300,
    running: false,
    installed: true,
    lastRunAt: '2026-07-02T10:00:00.000Z',
    lastSuccessAt: '2026-07-02T10:00:00.000Z',
    lastFinishedAt: '2026-07-02T10:00:10.000Z',
    nextRunAt: '2026-07-02T10:05:00.000Z',
    currentRunDurationMs: null,
    averageRuntimeMs: 10000,
    failureCount: 0,
    lastError: null,
    logExcerpt: 'ok',
    resourceUsage: { scope: 'service', cpuPercent: null, memoryRssMb: 512, memoryUsedMb: 128, queueDepth: 2, note: 'service-level' },
    costEstimate: { scope: 'service', electricityUsdPerKwh: 0.05, powerWatts: 75, hourlyUsd: 0.0037, dailyUsd: 0.09, assumption: 'shared service estimate' },
    assumptions: ['test'],
} as const

const fixtureJobs = [
    {
        ...baseJob,
        id: 'ti-public-canary-collection',
        name: 'Public TI collection loop',
        category: 'TI / Exposure',
        schedule: 'Every 5 minutes',
        enabled: true,
        status: 'enabled',
        controls: ['pause', 'run_now'],
        controlMode: 'safe_control',
    },
    {
        ...baseJob,
        id: 'ti-exposure-queue-collection',
        name: 'DWM exposure queue collection',
        category: 'TI / Exposure',
        schedule: 'Every 5 minutes',
        enabled: true,
        status: 'observable',
        controls: [],
        controlMode: 'observable_only',
    },
    {
        ...baseJob,
        id: 'ti-exposure-parser',
        name: 'Exposure parser bridge',
        category: 'TI / Exposure',
        schedule: 'On exposure ingest',
        enabled: true,
        status: 'enabled',
        controls: [],
        controlMode: 'observable_only',
    },
    {
        ...baseJob,
        id: 'ti-dwm-alert-generation',
        name: 'DWM alert generation readiness',
        category: 'Alerts',
        schedule: 'On watchlist/source changes; manually runnable',
        enabled: true,
        status: 'enabled',
        controls: ['run_now'],
        controlMode: 'run_only',
    },
    {
        ...baseJob,
        id: 'api-vulnerability-scanner',
        name: 'Vulnerability image scanner',
        category: 'Other/System',
        service: 'hanasand-api',
        schedule: 'Every 60 minutes',
        enabled: true,
        status: 'blocked',
        lastError: 'Docker socket is unavailable at /var/run/docker.sock',
        logExcerpt: 'Docker socket is unavailable at /var/run/docker.sock',
        failureCount: 1,
        controls: ['pause', 'run_now'],
        controlMode: 'safe_control',
        resourceUsage: { ...baseJob.resourceUsage, queueDepth: 2 },
    },
    {
        ...baseJob,
        id: 'forgejo-standby-sync',
        name: 'Forgejo standby sync',
        category: 'Forgejo',
        service: 'forgejo',
        schedule: '*/5 * * * *',
        enabled: true,
        status: 'enabled',
        controls: ['edit_schedule', 'pause'],
        controlMode: 'editable',
        command: 'sync-to-ovh.sh',
    },
]
