import { expect, test } from '@playwright/test'
import { event, openLogs, result } from './fixtures/logs-browser'

test('historical catch-up notice checks every source without losing bigint precision', async ({ page }) => {
    await page.clock.install()
    const sources = [
        { name: 'invalid', last_id: 'not-a-number', recent_id: '100' },
        { name: 'missing', last_id: null, recent_id: '100' },
        { name: 'complete', last_id: '100', recent_id: '100' },
        { name: 'backfill', last_id: '9007199254740992', recent_id: '9007199254740993' },
    ]
    await page.route('**/api/backend/logs/search?*', route => route.fulfill({ json: { ...result(), processing: { ...result().processing, sources } } }))
    await openLogs(page, '/logs')
    await page.clock.runFor(300)
    const notice = page.getByRole('region', { name: 'Historical log catch-up' })
    await expect(notice).toContainText('Counting remaining logs…')
    await expect(notice.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
    sources[3].last_id = sources[3].recent_id
    await page.clock.runFor(5000)
    await expect(notice).toHaveCount(0)
})


test('command queue reports capped counts and clears its delay warning after processing', async ({ page }) => {
    await page.clock.install()
    let pending: { count: number, has_more: boolean, oldest_queued_at: string | null } = { count: 1, has_more: false, oldest_queued_at: '2026-09-19T15:01:30Z' }
    await page.route('**/api/backend/logs/search?*', route => route.fulfill({ json: { ...result(), generated_at: '2026-09-19T15:02:00Z', processing: { ...result().processing, pending_commands: pending } } }))
    await openLogs(page, '/logs')
    await page.clock.runFor(300)
    const notice = page.getByRole('status').filter({ hasText: 'Command checks are delayed.' })
    await expect(notice).toHaveCount(0)
    await page.getByText('Operational counters', { exact: true }).click()
    await expect(page.getByText('Commands awaiting checks: 1', { exact: true })).toBeVisible()
    pending = { count: 10000, has_more: true, oldest_queued_at: '2026-09-19T15:00:00Z' }
    await page.clock.runFor(5000)
    await expect(notice).toContainText(/More than 10[,. ]?000 commands are waiting/)
    await expect(page.getByText(/Commands awaiting checks: more than 10[,. ]?000/)).toBeVisible()
    pending = { count: 0, has_more: false, oldest_queued_at: null }
    await page.clock.runFor(5000)
    await expect(notice).toHaveCount(0)
    await expect(page.getByText('Commands awaiting checks: 0', { exact: true })).toBeVisible()
})

test('dashboard lands on severity counts and keeps active services inside operational counters', async ({ page }) => {
    await page.route('**/api/backend/logs/search?*', route => route.fulfill({ json: result() }))
    await openLogs(page, '/logs?service=audit&hours=168')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Logs')
    await expect(page.getByRole('region', { name: 'Events by severity' }).getByRole('link')).toHaveCount(4)
    await expect(page.getByRole('navigation', { name: 'Log pages' }).getByRole('link')).toHaveText(['Dashboard', 'Realtime', 'Search', 'Errors', 'Traffic'])
    await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByText('Most active services in the selected time range')).not.toBeVisible()
    await page.getByText('Operational counters', { exact: true }).click()
    await expect(page.getByText('Most active services in the selected time range')).toBeVisible()
    await page.getByRole('region', { name: 'Events by severity' }).getByRole('link').filter({ hasText: 'high' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Search logs')
    await expect(page.getByRole('combobox', { name: 'Service', exact: true })).toHaveValue('audit')
    await expect(page.getByRole('combobox', { name: 'Time range' })).toHaveValue('168')
    await expect(page.getByRole('combobox', { name: 'Severity' })).toHaveValue('high')
})

test('basic search sends the chosen log type, service, severity and time range and survives reload', async ({ page }) => {
    const requests: URL[] = []
    await page.route('**/api/backend/logs/search?*', route => { requests.push(new URL(route.request().url())); return route.fulfill({ json: result() }) })
    await openLogs(page, '/logs/search')
    await page.getByRole('searchbox', { name: 'Search logs' }).fill('whoami')
    await page.getByRole('combobox', { name: 'Log type' }).selectOption('ProcessLogs')
    await page.getByRole('combobox', { name: 'Service', exact: true }).selectOption('audit')
    await page.getByRole('combobox', { name: 'Severity' }).selectOption('high')
    await page.getByRole('combobox', { name: 'Time range' }).selectOption('168')
    await expect.poll(() => Object.fromEntries(requests.at(-1)?.searchParams || [])).toEqual({ hours: '168', hql: 'ProcessLogs | take 200', search: 'whoami', service: 'audit', severity: 'high' })
    await page.reload()
    await expect(page.getByRole('searchbox', { name: 'Search logs' })).toHaveValue('whoami')
    await expect(page.getByRole('combobox', { name: 'Log type' })).toHaveValue('ProcessLogs')
    await expect(page.getByRole('combobox', { name: 'Service', exact: true })).toHaveValue('audit')
    await page.getByRole('combobox', { name: 'Service', exact: true }).selectOption('all')
    await expect.poll(() => new URL(page.url()).searchParams.has('service')).toBe(false)
})

test('HQL requires running edited queries, projects fields, summarizes and reports unsupported syntax', async ({ page }) => {
    const queries: string[] = []
    await page.route('**/api/backend/logs/search?*', route => {
        const query = new URL(route.request().url()).searchParams.get('hql')!
        queries.push(query)
        if (query.includes('union')) return route.fulfill({ status: 400, json: { error: 'Unsupported operator union.' } })
        if (query.includes('summarize')) return route.fulfill({ json: { ...result([{ value: 'audit', count: 3 }]), summarize: 'Service' } })
        return route.fulfill({ json: { ...result(), ...(query.includes('project') ? { projection: ['TimeGenerated', 'CommandLine', 'RuleId'] } : {}) } })
    })
    await openLogs(page, '/logs/search')
    await page.getByRole('checkbox', { name: 'HQL' }).check()
    await expect(page.getByRole('searchbox')).toBeDisabled()
    await expect.poll(() => queries.at(-1)).toContain('ProcessLogs | where Severity')
    const projection = 'ProcessLogs | where CommandLine contains "whoami" | project TimeGenerated, CommandLine, RuleId'
    await page.getByRole('textbox', { name: 'HQL query' }).fill(projection)
    await expect(page.getByText('Query edited. Run it to update the results.')).toBeVisible()
    expect(queries).not.toContain(projection)
    await page.getByRole('button', { name: 'Run query' }).click()
    await expect(page.locator('article pre').first()).toHaveText(JSON.stringify({ TimeGenerated: event().event_timestamp, CommandLine: 'whoami', RuleId: ['recon.whoami'] }, null, 2))
    await page.getByText('HQL syntax and tables', { exact: true }).click()
    await expect(page.getByText('Tables: Logs, ProcessLogs, SigninLogs', { exact: false })).toBeVisible()
    await page.getByRole('textbox', { name: 'HQL query' }).fill('Logs | summarize count() by Service')
    await page.getByRole('button', { name: 'Run query' }).click()
    await expect(page.getByRole('table')).toContainText('audit3')
    await page.getByRole('textbox', { name: 'HQL query' }).fill('Logs | union ProcessLogs')
    await page.getByRole('button', { name: 'Run query' }).click()
    await expect(page.getByRole('alert')).toContainText('Unsupported operator union.')
    await expect(page.getByRole('table')).toHaveCount(0)
})

test('errors expand inline, copy JSON and show a recoverable data failure', async ({ page }) => {
    const error = { id: 'error-1', source: 'api', service: 'api', surface: 'api', method: 'GET', path: '/api/example', status_code: 500, error_code: 'EXAMPLE_FAILURE', message: 'Example failure context', request_id: 'request-1', user_id: '', level: 'error', created_at: event().event_timestamp }
    let fail = false
    await page.route('**/api/backend/logs/errors?*', route => fail ? route.fulfill({ status: 503, json: { error: 'Log storage unavailable.' } }) : route.fulfill({ json: { generated_at: '', errors: [error], summary: { total: 1, last_hour: 1, server_errors: 1, client_errors: 0, status_counts: [], surface_counts: [], code_counts: [], project_scans: 0, share_scans: 0 } } }))
    await openLogs(page, '/logs/errors')
    await page.getByRole('button', { name: 'EXAMPLE_FAILURE' }).click()
    await expect(page.getByText('Example failure context', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Copy error JSON' }).click()
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('copied-event')!))).toEqual(error)
    await expect(page).toHaveURL('http://logs.test/logs/errors')
    fail = true
    await page.getByRole('button', { name: 'Refresh errors' }).click()
    await expect(page.getByRole('alert')).toContainText('Log storage unavailable.')
    await expect(page.getByRole('button', { name: 'EXAMPLE_FAILURE' })).toBeVisible()
    fail = false
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.getByRole('alert')).toHaveCount(0)
})

test('legacy KQL links retain their query when renamed to HQL', async ({ page }) => {
    const hql = 'Logs | where Service == "audit" | take 20'
    const queries: string[] = []
    await page.route('**/api/backend/logs/search?*', route => {
        queries.push(new URL(route.request().url()).searchParams.get('hql')!)
        return route.fulfill({ json: result() })
    })
    await openLogs(page, '/logs/search?kql=' + encodeURIComponent(hql))
    await expect(page.getByRole('checkbox', { name: 'HQL', exact: true })).toBeChecked()
    await expect(page.getByRole('textbox', { name: 'HQL query' })).toHaveValue(hql)
    await expect.poll(() => queries.at(-1)).toBe(hql)
    await expect.poll(() => new URL(page.url()).searchParams.get('hql')).toBe(hql)
    expect(new URL(page.url()).searchParams.has('kql')).toBe(false)
})
