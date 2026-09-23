import type { MillRule } from '../src/app/dashboard/mill/rules/detection-rules'
import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
let output: string, bundle: string, css: string, serverHtml: string
const rule = { id: 'http.routine_access.v1', version: '1', name: 'Routine requests', hitCount: 12345, family: 'HTTP', severity: 'high', explanation: 'Count routine requests.', evidence: [], enabled: true, definition: { stage: 'analyze', action: 'drop' } }
test.beforeAll(async () => {
    output = mkdtempSync(path.join(tmpdir(), 'mill-rules-'))
    execFileSync('bun', ['-e', `const result = await Bun.build({entrypoints:['tests/fixtures/mill-rules.tsx'], outdir:${JSON.stringify(output)}, target:'browser', define:{'process.env':JSON.stringify({NODE_ENV:'production'})}, plugins:[{name:'workspace',setup(build){build.onLoad({filter:/workspaceProvider\\.tsx$/},()=>({contents:'export const useWorkspace = () => ({organizationId:"org-a", organizations:[{id:"org-a",role:"owner"}]})',loader:'tsx'}))}}]}); if(!result.success) throw new Error(result.logs.join('\\n'))`])
    serverHtml = execFileSync('bun', ['-e', `
        import { mock } from 'bun:test';
        mock.module('./src/components/organizations/workspaceProvider', () => ({useWorkspace: () => ({organizationId:'org-a', organizations:[{id:'org-a',role:'owner'}]})}));
        const {createElement} = await import('react');
        const {renderToString} = await import('react-dom/server');
        const {default: DetectionRules} = await import('./src/app/dashboard/mill/rules/detection-rules');
        console.log(renderToString(createElement(DetectionRules, {category:'analysis',initial:{organizationId:'org-a',category:'analysis',rules:[${JSON.stringify(rule)}],canManageRetention:true}})));
    `], { encoding: 'utf8' }).trim()
    css = (await postcss([tailwind()]).process(readFileSync('src/app/globals.css', 'utf8'), { from: path.resolve('src/app/globals.css') })).css
    bundle = readFileSync(path.join(output, 'mill-rules.js'), 'utf8')
})
test.afterAll(() => rmSync(output, { recursive: true, force: true }))
test.beforeEach(async ({ page }) => {
    await page.route('**/api/backend/mill/rules/preview?*', route => route.fulfill({ json: { count: 0, scanned: 0, events: [], cursor: null } }))
    await page.route('**/api/backend/mill/events?*', route => route.fulfill({ json: { events: [{ event_type: 'custom_health', normalized: { action: 'heartbeat' } }] } }))
    await page.route('http://mill.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('http://mill.test/mill/rules/*', route => route.fulfill({ contentType: 'text/html', body: `<html class="dark"><head><style>${css}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>` }))
})
for (const category of ['match', 'analysis', 'detection']) test(`${category} has Create before Import and opens the creation form`, async ({ page }) => {
    await page.route('**/api/backend/mill/rules?*', route => route.fulfill({ json: { canManageRetention: true, rules: [rule] } }))
    await page.goto(`http://mill.test/mill/rules/${category}`)
    const create = page.getByRole('button', { name: 'Create', exact: true })
    const names = await page.getByRole('button').allTextContents()
    expect(names.indexOf('Create')).toBeLessThan(names.indexOf('Import'))
    await create.click()
    await expect(page.getByLabel('Rule name', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create rule', exact: true })).toBeDisabled()
    await expect(page.getByRole('dialog', { name: 'Create rule', exact: true })).toBeVisible()
    if (category === 'analysis') {
        await page.screenshot({ path: '/tmp/mill-create-desktop.png' })
        await page.setViewportSize({ width: 390, height: 844 })
        await page.screenshot({ path: '/tmp/mill-create-mobile.png' })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await page.getByRole('button', { name: 'Close create rule' }).click()
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expect(page.getByText('Import JSON pack', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Rule name', { exact: true })).toHaveCount(0)
})
test('analysis separates configured retention from enabled state', async ({ page }) => {
    let enabled = true
    await page.route('**/api/backend/mill/rules?*', route => route.fulfill({ json: { canManageRetention: true, rules: [{ ...rule, enabled }, { ...rule, id: 'auth.new_country.v1', name: 'New country', definition: undefined }] } }))
    await page.route('**/api/backend/mill/rules/*/actions?*', route => { expect(route.request().postDataJSON()).toEqual({ action: 'disable' }); enabled = false; return route.fulfill({ json: {} }) })
    await page.goto('http://mill.test/mill/rules/analysis')
    await expect(page.getByRole('columnheader', { name: 'Action', exact: true })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Controls', exact: true })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Hits', exact: true })).toBeVisible()
    await expect(page.getByRole('row').filter({ has: page.getByRole('link', { name: /Routine requests/ }) }).getByRole('cell', { name: '12,345', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Drop', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Drop', exact: true }).locator('a, button, [tabindex]')).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Routine requests/ })).toHaveAttribute('href', '/mill/rules/analysis/http.routine_access')
    await expect(page.getByRole('cell', { name: 'Store', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Disable Routine requests', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Enable Routine requests', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Drop', exact: true })).toBeVisible()
})


test('searchable event types, JSON and Drop creation preserve drafts on failure', async ({ page }) => {
    let saved: MillRule | undefined, attempts = 0
    await page.route('**/api/backend/mill/rules?*', route => {
        if (route.request().method() === 'POST') {
            attempts++
            if (attempts === 1) return route.fulfill({ status: 403, json: { error: 'System administrator access is required.' } })
            const body = route.request().postDataJSON()
            expect(body).toMatchObject({ severity: 'low', stage: 'analyze', action: 'drop', conditions: [{ path: 'event_type', operator: 'equals', value: 'custom_health' }] })
            saved = { ...rule, ...body, id: 'custom.health.v1', source: 'owned', definition: { stage: body.stage, action: body.action, conditions: body.conditions } }
            return route.fulfill({ json: { rule: saved } })
        }
        return route.fulfill({ json: { canManageRetention: true, rules: saved ? [saved] : [] } })
    })
    await page.goto('http://mill.test/mill/rules/analysis')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await page.getByLabel('Rule name', { exact: true }).fill('Drop health events')
    await page.getByLabel('Rule explanation').fill('Discard routine health events from this source.')
    await page.getByLabel('Rule action').selectOption('drop')
    const value = page.getByRole('combobox', { name: 'Condition 1 value', exact: true })
    await value.fill('')
    await expect(page.getByRole('option', { name: 'authentication', exact: true })).toBeVisible()
    await value.fill('cust')
    await expect(page.getByRole('option', { name: 'authentication', exact: true })).toHaveCount(0)
    await expect(page.getByRole('option', { name: 'custom_health', exact: true })).toBeVisible()
    await value.press('ArrowDown')
    await value.press('Enter')
    await expect(value).toHaveValue('custom_health')
    await page.getByLabel('Condition 1 operator').selectOption('regex')
    await value.fill('[')
    await expect(page.getByRole('alert')).toContainText('Invalid regular expression')
    await expect(page.getByRole('button', { name: 'Create rule', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Edit JSON', exact: true }).click()
    await page.getByLabel('Conditions JSON').fill(JSON.stringify([{ path: 'event_type', operator: 'equals', value: 'custom_health' }]))
    await page.getByRole('button', { name: 'Apply JSON' }).click()
    await expect(page.getByLabel('Rule JSON preview')).toContainText('"action": "drop"')
    await page.getByRole('button', { name: 'Create rule', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('System administrator')
    await expect(value).toHaveValue('custom_health')
    await page.getByRole('button', { name: 'Create rule', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('cell', { name: 'Drop', exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('cell', { name: 'Drop', exact: true })).toBeVisible()
})

test('Drop locks Low; broad previews require confirmation and buffered scrolling stays below 20ms', async ({ page }) => {
    await page.route('**/api/backend/mill/rules?*', route => route.fulfill({ json: { canManageRetention: true, rules: [] } }))
    const events = Array.from({ length: 250 }, (_, index) => ({ id: String(index), timestamp: '2026-09-23T12:00:00Z', rank: ((index * 137) % 251) / 251, normalized: { severity: 'low', service: `service-${index % 5}`, event_type: 'network', http: { status_code: 200, path: `/path-${index % 9}` }, source: { ip: `192.0.2.${index % 250}` } } }))
    let finishCount = () => {}
    const pendingCount = new Promise<void>(resolve => { finishCount = resolve })
    await page.route('**/api/backend/mill/rules/preview?*', async route => {
        const body = route.request().postDataJSON()
        expect(body.action).toBe('drop')
        if (body.sample && body.cursor) { await pendingCount; return route.fulfill({ json: { count: 0, scanned: 0, events: [], cursor: null } }) }
        return route.fulfill({ json: { count: 10001, scanned: 20000, events: body.sample ? events.slice(0, 100) : events, cursor: body.sample ? { time: '2026-09-23T12:00:00Z', id: '250' } : null } })
    })
    await page.goto('http://mill.test/mill/rules/analysis')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await page.getByLabel('Rule name', { exact: true }).fill('Drop successful traffic')
    await page.getByLabel('Rule explanation').fill('Drop low severity successful HTTP traffic.')
    await page.getByLabel('Rule severity').selectOption('critical')
    await page.getByLabel('Rule action').selectOption('drop')
    await expect(page.getByLabel('Rule severity')).toBeDisabled()
    await expect(page.getByLabel('Rule severity')).toHaveValue('low')
    await page.getByLabel('Condition 1 field', { exact: true }).fill('http.status_code')
    await page.getByLabel('Condition 1 value', { exact: true }).fill('200')
    await page.getByLabel('Rule name', { exact: true }).click()
    await expect(page.getByText('Very many events match this rule. Is this intended?')).toBeVisible()
    const create = page.getByRole('button', { name: 'Create rule', exact: true })
    await expect(create).toBeDisabled()
    await page.getByRole('checkbox', { name: 'Yes, I intend to match this many events.' }).check()
    await expect(create).toBeEnabled()
    const table = page.getByRole('region', { name: 'Matching event rows' })
    await expect(table.locator('[data-event-id]')).toHaveCount(8)
    expect(await page.getByRole('checkbox', { name: 'Yes, I intend to match this many events.' }).evaluate(input => Boolean(document.querySelector('[aria-label="Matching event rows"]')!.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true)
    const first = await table.locator('[data-event-id]').evaluateAll(rows => rows.slice(0, 5).map(row => row.getAttribute('data-event-id')))
    expect(first).not.toEqual(['0', '1', '2', '3', '4'])
    const durations: number[] = []
    for (const top of [320, 640, 960, 1280, 1600]) {
        await table.evaluate((element, value) => { element.scrollTop = value; element.dispatchEvent(new Event('scroll', { bubbles: true })) }, top)
        durations.push(Number(await table.getAttribute('data-render-ms')))
    }
    expect(Math.max(...durations)).toBeLessThan(20)
    await expect(page.getByText(/Checking events…/)).toBeVisible()
    finishCount()
    await expect(page.getByText(/Checking events…/)).toHaveCount(0)
    console.log('Buffered row update milliseconds:', durations)
    expect(await table.locator('[data-event-id]').count()).toBeLessThanOrEqual(8)
    await page.getByRole('checkbox', { name: 'Yes, I intend to match this many events.' }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: '/tmp/mill-preview-desktop.png' })
    await page.getByLabel('Preview range').selectOption('1')
    await expect(page.getByRole('checkbox', { name: 'Yes, I intend to match this many events.' })).not.toBeChecked()
    await expect(create).toBeDisabled()
    await page.setViewportSize({ width: 390, height: 844 })
    await table.scrollIntoViewIfNeeded()
    await expect(table.locator('[data-event-id]').first()).toBeVisible()
    await page.getByRole('checkbox', { name: 'Yes, I intend to match this many events.' }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: '/tmp/mill-preview-mobile.png' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('server rows hydrate without fetching again and still refresh after edits', async ({ page }) => {
    expect(serverHtml).toContain('Routine requests')
    expect(serverHtml).not.toContain('Loading rules')
    let reads = 0
    await page.route('**/api/backend/mill/rules?*', route => {
        reads++
        return route.fulfill({ json: { canManageRetention: true, rules: [{ ...rule, enabled: false }] } })
    })
    await page.route('**/api/backend/mill/rules/*/actions?*', route => route.fulfill({ json: {} }))
    const initial = { organizationId: 'org-a', category: 'analysis', rules: [rule], canManageRetention: true }
    await page.route('http://mill.test/mill/rules/analysis', route => route.fulfill({ contentType: 'text/html', body: `<html><body><div id="root">${serverHtml}</div><script>window.initialRules=${JSON.stringify(initial)}</script><script type="module" src="/fixture.js"></script></body></html>` }))
    await page.goto('http://mill.test/mill/rules/analysis')
    await page.getByPlaceholder('Filter by title').fill('Routine')
    expect(reads).toBe(0)
    await page.getByRole('button', { name: 'Disable Routine requests', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Enable Routine requests', exact: true })).toBeVisible()
    expect(reads).toBe(1)
})

test('server loader forwards scoped authentication, requests only list data and handles failures', () => {
    execFileSync('bun', ['-e', `
        import {mock} from 'bun:test';
        import assert from 'node:assert/strict';
        mock.module('next/headers', () => ({cookies: async () => ({get: name => ({value: {access_token:'test-token', id:'test-user', impersonation_token:'test-impersonation'}[name]})})}));
        mock.module('./src/utils/organizations/serverWorkspace', () => ({activeOrganizationId: async () => 'org-a'}));
        const {default: ServerRules} = await import('./src/app/dashboard/mill/rules/server-rules');
        globalThis.fetch = async (url, options) => {
            assert.equal(new URL(url).searchParams.get('organizationId'), 'org-a');
            assert.equal(new URL(url).searchParams.get('view'), 'list');
            assert.equal(new URL(url).searchParams.get('category'), 'analysis');
            assert.equal(options.cache, 'no-store');
            assert.equal(options.headers.get('Authorization'), 'Bearer test-token');
            assert.equal(options.headers.get('id'), 'test-user');
            assert.equal(options.headers.get('x-impersonation-token'), 'test-impersonation');
            return Response.json({rules:[${JSON.stringify(rule)}],canManageRetention:true});
        };
        let result = await ServerRules({category:'analysis'});
        assert.equal(result.props.initial.rules.length, 1);
        assert.equal(result.props.initial.canManageRetention, true);
        assert.ok(!JSON.stringify(result.props).includes('test-token'));
        globalThis.fetch = async () => new Response('', {status:403});
        result = await ServerRules({category:'analysis'});
        assert.deepEqual(result.props.initial.rules, []);
        assert.equal(result.props.initial.canManageRetention, false);
        assert.match(result.props.initial.error, /Unable to load/);
    `])
})
