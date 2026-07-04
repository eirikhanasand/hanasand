import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('load testing dashboard keeps launch primary and advanced evidence collapsed', async () => {
    const pageSource = await readFile(path.join(root, 'src/app/dashboard/load-testing/page.tsx'), 'utf8')
    const clientSource = await readFile(path.join(root, 'src/app/dashboard/load-testing/pageClient.tsx'), 'utf8')

    expect(pageSource).toContain('<LoadTestingOperations />')
    expect(pageSource).toContain('data-load-test-allowance-disclosure')
    expect(pageSource).toContain('Run allowance lanes')

    expect(clientSource).toContain('postTest({ url: targetUrl')
    expect(clientSource).toContain('fetchRecentTests(\'recent\', 8)')
    expect(clientSource).toContain('fetchRecentTests(\'mine\', 8)')
    expect(clientSource).toContain('router.push(`/test/${result.test.id}`)')
    expect(clientSource).toContain('permissionConfirmed')
    expect(clientSource).toContain('data-load-test-permission-gate')
    expect(clientSource).toContain('I own this endpoint or have written permission to test it.')
    expect(clientSource).toContain('data-load-test-scenario-disclosure')
    expect(clientSource).toContain('data-load-test-policy-disclosure')
    expect(clientSource).toContain('Operations snapshot')
    expect(clientSource).toContain('historyView === \'mine\' ? myScans : recentScans')
    expect(clientSource).toContain('aria-label=\'Choose result history\'')
    expect(clientSource).not.toContain('Global endpoint checks\' readyMessage')
    expect(clientSource).not.toContain('What returned')
})

test('load testing dashboard renders one primary launch flow and switchable history', async ({ context, page, baseURL }) => {
    const origin = baseURL || 'http://127.0.0.1:3000'
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies([
        { name: 'id', value: 'dashboard-render-proof-user', url: origin },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', url: origin },
        { name: 'id', value: 'dashboard-render-proof-user', domain: 'localhost', path: '/' },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', domain: 'localhost', path: '/' },
        { name: 'id', value: 'dashboard-render-proof-user', domain: '127.0.0.1', path: '/' },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', domain: '127.0.0.1', path: '/' },
    ])

    const startedChecks: unknown[] = []
    await page.route('**/api/tests/mine**', async route => {
        await route.fulfill({ json: [fixtureMineCheck] })
    })
    await page.route('**/api/tests/recent**', async route => {
        await route.fulfill({ json: [fixtureGlobalCheck] })
    })
    await page.route('**/api/test', async route => {
        startedChecks.push(await route.request().postDataJSON())
        await route.fulfill({ json: { ...fixtureMineCheck, id: 'new-check-123' } })
    })

    await page.goto('/dashboard/load-testing', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: 'Load testing and endpoint evidence' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Check an endpoint you control' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Operations snapshot' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start check' })).toBeDisabled()
    await expect(page.getByText('I own this endpoint or have written permission to test it.')).toBeVisible()
    await expect(page.getByText('Ramp: Capacity smoke test')).toBeHidden()
    await expect(page.getByText('Allowed target')).toBeHidden()
    await expect(page.getByText('Starter')).toBeHidden()
    await expect(page.getByText('https://api.example.com/healthz')).toBeVisible()
    await expect(page.getByText('https://status.example.net/ping')).toBeHidden()

    await page.getByRole('button', { name: 'Global' }).click()
    await expect(page.getByText('https://status.example.net/ping')).toBeVisible()
    await expect(page.getByText('https://api.example.com/healthz')).toBeHidden()

    await page.getByText('Scenario settings').click()
    await page.getByRole('button', { name: /Ramp/ }).click()
    await expect(page.getByText('Ramp: Capacity smoke test')).toBeVisible()

    await page.getByPlaceholder('https://api.example.com/health').fill('https://api.example.com/ready')
    await expect(page.getByRole('button', { name: 'Start check' })).toBeDisabled()
    await page.getByLabel('I own this endpoint or have written permission to test it.').check()
    await page.getByRole('button', { name: 'Start check' }).click()
    await expect.poll(() => startedChecks.length).toBe(1)
    expect(startedChecks[0]).toMatchObject({ url: 'https://api.example.com/ready', timeout: 45000 })
})

const fixtureMineCheck = {
    id: 'mine-check-1',
    url: 'https://api.example.com/healthz',
    status: 'done',
    visits: 3,
    created_at: '2026-07-03T09:00:00.000Z',
    latest_run_summary: {
        requests: 120,
        duration: { p95: 184 },
        failureRate: 0,
    },
    summary: null,
    p95_delta_ms: 12,
}

const fixtureGlobalCheck = {
    id: 'global-check-1',
    url: 'https://status.example.net/ping',
    status: 'running',
    visits: 7,
    created_at: '2026-07-03T09:02:00.000Z',
    latest_run_summary: {
        requests: 80,
        duration: { p95: 1280 },
        failureRate: 0.02,
    },
    summary: null,
    p95_delta_ms: -96,
}
