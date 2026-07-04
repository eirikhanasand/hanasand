import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

test('automations keeps the primary alert route workflow calm and wired', async ({ context, page, baseURL }) => {
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

    const runRequests: string[] = []
    const saveRequests: unknown[] = []
    const createRequests: unknown[] = []

    await page.route('**/api/backend/automations**', async route => {
        const request = route.request()
        const url = new URL(request.url())
        const path = url.pathname

        if (request.method() === 'GET' && path.endsWith('/api/backend/automations')) {
            await route.fulfill({ json: { automations: fixtureAutomations } })
            return
        }

        if (request.method() === 'GET' && path.endsWith('/api/backend/automations/failing-route')) {
            await route.fulfill({ json: { automation: fixtureAutomations[0], runs: fixtureRuns } })
            return
        }

        if (request.method() === 'POST' && path.endsWith('/api/backend/automations/failing-route/run')) {
            runRequests.push(path)
            await route.fulfill({ json: { ok: true, message: 'queued' } })
            return
        }

        if (request.method() === 'PUT' && path.endsWith('/api/backend/automations/failing-route')) {
            saveRequests.push(await request.postDataJSON())
            await route.fulfill({ json: { automation: fixtureAutomations[0] } })
            return
        }

        if (request.method() === 'POST' && path.endsWith('/api/backend/automations')) {
            createRequests.push(await request.postDataJSON())
            await route.fulfill({ status: 201, json: { automation: { ...fixtureAutomations[1], id: 'created-route', name: 'Mail path health alert' } } })
            return
        }

        await route.fulfill({ status: 404, json: { error: `Unhandled automation fixture path: ${path}` } })
    })

    await page.goto('/dashboard/automations', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: 'Alerts' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '1 route needs attention' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mail delivery route' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Healthy system alert' })).toBeVisible()
    await expect(page.getByText('Mail, Discord')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mail health' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Delete' })).toBeHidden()

    await expect(page.getByText('Schedule and notification policy')).toBeVisible()
    await expect(page.getByText('Matching rules')).toBeVisible()
    await expect(page.getByText('Run history')).toBeVisible()
    await expect(page.getByText('Prompt and match policy')).toBeHidden()

    await page.getByText('Templates').click()
    await expect(page.getByRole('button', { name: 'Mail health' })).toBeVisible()

    await page.getByText('Matching rules').click()
    await expect(page.getByText('Prompt and match policy')).toBeVisible()

    await page.getByRole('button', { name: 'Check now' }).click()
    await expect.poll(() => runRequests.length).toBe(1)

    await page.getByRole('button', { name: 'Save alert' }).click()
    await expect.poll(() => saveRequests.length).toBe(1)
    expect(saveRequests[0]).toMatchObject({ name: 'Mail delivery route', actionType: 'mail_health_check' })

    await expect(page.getByRole('button', { name: 'Delete' })).toBeHidden()
    await page.getByText('More route actions').click()
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible()

    await page.getByText('Templates').click()
    await page.getByRole('button', { name: 'Mail health' }).click()
    await expect(page.getByRole('heading', { name: 'New alert' })).toBeVisible()
    await expect(page.getByText('Route is paused; reactivate to resume checks.')).toBeVisible()
    await page.getByText('Schedule and notification policy').click()
    await page.getByLabel('Status').selectOption('active')
    await expect(page.getByText('Add a Discord webhook-file destination before activating this alert.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create alert' })).toBeDisabled()

    await page.getByLabel('Destination').fill('discord-webhook-file:/secure/ops/discord-alerts.url')
    await expect(page.getByRole('button', { name: 'Create alert' })).toBeEnabled()
    await page.getByRole('button', { name: 'Create alert' }).click()
    await expect.poll(() => createRequests.length).toBe(1)
    expect(createRequests[0]).toMatchObject({
        actionType: 'mail_health_check',
        status: 'active',
        modelName: 'discord-webhook-file:/secure/ops/discord-alerts.url',
    })
})

test('automation delivery templates do not ship developer-local destinations', async () => {
    const root = process.cwd()
    const pageClient = await readFile(path.join(root, 'src/app/dashboard/automations/pageClient.tsx'), 'utf8')
    const automationUtils = await readFile(path.join(root, '../api/src/utils/automations.ts'), 'utf8')

    expect(pageClient).not.toContain('/Users/eirikhanasand/Desktop/webhooktoday.txt')
    expect(pageClient).not.toContain('const discordWebhookFileDestination')
    expect(pageClient).toContain('status: \'paused\'')
    expect(pageClient).toContain('activeRouteSaveBlocker(draft)')
    expect(pageClient).toContain('Add a delivery destination or keep the route paused before saving.')
    expect(automationUtils).toContain('status === \'active\' && actionType === \'system_alert\' && !modelName')
    expect(automationUtils).toContain('status === \'active\' && actionType === \'mail_health_check\' && notifyOn !== \'never\' && !modelName')
})

const fixtureAutomations = [
    {
        id: 'failing-route',
        name: 'Mail delivery route',
        prompt: 'Check the Hanasand Mail dashboard path and mail service health.',
        scheduleKind: 'interval',
        intervalMinutes: 5,
        runAt: null,
        status: 'active',
        actionType: 'mail_health_check',
        timezone: 'Europe/Oslo',
        modelName: 'discord-webhook-file:/secure/ops/discord-alerts.url',
        notifyOn: 'failure',
        nextRunAt: '2026-07-03T18:15:00.000Z',
        lastRunAt: '2026-07-03T18:10:00.000Z',
        lastCompletedAt: '2026-07-03T18:10:02.000Z',
        lastStatus: 'failed',
        lastResult: null,
        lastError: 'SMTP health check failed',
        consecutiveFailures: 1,
        pausedReason: null,
        runCount: 12,
        createdAt: '2026-07-01T10:00:00.000Z',
        updatedAt: '2026-07-03T18:10:02.000Z',
    },
    {
        id: 'healthy-route',
        name: 'Healthy system alert',
        prompt: 'Hanasand alert portal smoke.',
        scheduleKind: 'once',
        intervalMinutes: null,
        runAt: '2026-07-03T19:00:00.000Z',
        status: 'active',
        actionType: 'system_alert',
        timezone: 'Europe/Oslo',
        modelName: 'discord-webhook-file:/secure/ops/discord-alerts.url',
        notifyOn: 'always',
        nextRunAt: '2026-07-03T19:00:00.000Z',
        lastRunAt: '2026-07-03T17:00:00.000Z',
        lastCompletedAt: '2026-07-03T17:00:01.000Z',
        lastStatus: 'completed',
        lastResult: 'ok',
        lastError: null,
        consecutiveFailures: 0,
        pausedReason: null,
        runCount: 1,
        createdAt: '2026-07-01T10:00:00.000Z',
        updatedAt: '2026-07-03T17:00:01.000Z',
    },
]

const fixtureRuns = [
    {
        id: 'run-1',
        automationId: 'failing-route',
        status: 'failed',
        result: null,
        error: 'SMTP health check failed',
        provider: 'local',
        model: null,
        startedAt: '2026-07-03T18:10:00.000Z',
        completedAt: '2026-07-03T18:10:02.000Z',
        durationMs: 2000,
    },
]
