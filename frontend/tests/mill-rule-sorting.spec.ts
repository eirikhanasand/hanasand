import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
let output: string, bundle: string, css: string
const rule = { id: 'http.routine_access.v1', version: '1', name: 'Routine requests', hitCount: 12345, family: 'HTTP', severity: 'high', explanation: 'Count routine requests.', evidence: [], enabled: true, definition: { stage: 'analyze', action: 'drop' } }
test.beforeAll(async () => {
    output = mkdtempSync(path.join(tmpdir(), 'mill-rules-'))
    execFileSync('bun', ['-e', `const result = await Bun.build({entrypoints:['tests/fixtures/mill-rules.tsx'], outdir:${JSON.stringify(output)}, target:'browser', define:{'process.env':JSON.stringify({NODE_ENV:'production'})}, plugins:[{name:'workspace',setup(build){build.onLoad({filter:/workspaceProvider\\.tsx$/},()=>({contents:'export const useWorkspace = () => ({organizationId:"org-a", organizations:[{id:"org-a",role:"owner"}]})',loader:'tsx'}))}}]}); if(!result.success) throw new Error(result.logs.join('\\n'))`])
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

for (const category of ['match', 'analysis', 'detection']) test(`${category} sorts columns and reveals inactive arrows only on hover or focus`, async ({ page }) => {
    const definition = { stage: category === 'analysis' ? 'analyze' : category === 'detection' ? 'detect' : 'match', action: 'drop' }
    const rows = [
        { ...rule, id: 'custom.zulu', name: 'Zulu', hitCount: 9, definition, source: 'owned' },
        { ...rule, id: 'custom.alpha', name: 'Alpha', hitCount: 100, definition, source: 'owned' },
        { ...rule, id: 'custom.beta', name: 'Beta', hitCount: 0, definition, source: 'owned' },
        { ...rule, id: 'custom.unknown', name: 'Unknown', hitCount: null, definition, source: 'owned' },
    ]
    await page.route('**/api/backend/mill/rules?*', route => route.fulfill({ json: { canManageRetention: true, rules: rows } }))
    await page.goto(`http://mill.test/mill/rules/${category}`)
    const titles = page.locator('tbody tr th span:first-child')
    await expect(titles).toHaveText(['Alpha', 'Zulu', 'Beta', 'Unknown'])
    const hits = page.getByRole('columnheader', { name: 'Hits', exact: true })
    await expect(hits).toHaveAttribute('aria-sort', 'descending')
    const headings = page.getByRole('columnheader')
    for (const heading of await headings.all()) {
        await expect(heading.getByRole('button')).toHaveCount(1)
        await expect(heading.locator('svg')).toHaveCount(1)
        await expect(heading.locator('svg path')).toHaveCount(1)
        await expect(heading.locator('svg')).toHaveCSS('opacity', await heading.getAttribute('aria-sort') === 'none' ? '0' : '1')
    }
    const inactive = page.getByRole('columnheader', { name: category === 'analysis' ? 'Action' : 'Title', exact: true })
    await inactive.hover()
    await expect(inactive.locator('svg')).toHaveCSS('opacity', '0.4')
    await expect(hits.locator('svg')).toHaveCSS('opacity', '1')
    await page.mouse.move(0, 0)
    await expect(inactive.locator('svg')).toHaveCSS('opacity', '0')
    await inactive.getByRole('button').focus()
    await expect(inactive.locator('svg')).toHaveCSS('opacity', '0.4')
    await hits.getByRole('button').click()
    await expect(titles).toHaveText(['Beta', 'Zulu', 'Alpha', 'Unknown'])
    await expect(hits).toHaveAttribute('aria-sort', 'ascending')
    const title = page.getByRole('columnheader', { name: 'Title', exact: true })
    await title.getByRole('button').click()
    await expect(titles).toHaveText(['Alpha', 'Beta', 'Unknown', 'Zulu'])
    await expect(title).toHaveAttribute('aria-sort', 'ascending')
    await expect(hits).toHaveAttribute('aria-sort', 'none')
    await expect(hits.locator('svg')).toHaveCSS('opacity', '0')
    await expect(title.locator('svg')).toHaveCSS('opacity', '1')
    await title.getByRole('button').press('Enter')
    await expect(titles).toHaveText(['Zulu', 'Unknown', 'Beta', 'Alpha'])
    await hits.getByRole('button').click()
    await expect(titles).toHaveText(['Alpha', 'Zulu', 'Beta', 'Unknown'])
    await expect(hits).toHaveAttribute('aria-sort', 'descending')
    if (category === 'analysis') await page.screenshot({ path: '/tmp/mill-rule-sorting.png', fullPage: true })
})
