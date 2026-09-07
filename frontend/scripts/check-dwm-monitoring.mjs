import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const route = await readFile('src/app/dashboard/dwm/page.tsx', 'utf8')
assert.match(route, /: 'overview'/, 'Default DWM route must open the monitoring overview')
const now = '2026-09-07T12:00:00Z'
const actorOverviews = Array.from({ length: 25 }, (_, i) => ({ actor: `Actor ${i + 1}`, aliases: [], sourceFamilies: ['darkweb_metadata'], sourceCount: 1, captureCount: 0, confidence: 99, watchState: 'metadata_only', summary: '' }))
const snapshot = { schemaVersion: 'dwm.product.v1', generatedAt: now, tenantId: 'org-one', watchlist: [{ value: 'acme.com', kind: 'domain' }], alerts: [], sourceCoverage: [], actorOverviews, onDemandQueue: [], readiness: { decision: 'blocked_missing_live_sources', blockers: [], advantages: [], nextWorkItem: '' } }
const evidence = { id: 'evidence-one', sourceName: 'Recorded source', sourceFamily: 'darkweb_metadata', captureMode: 'metadata_only', redactionState: 'metadata_only', contentHash: 'verified-hash', excerpt: 'acme.com appeared in the recorded source post.', observedAt: now, provenance: { captureId: 'capture-one', sourceId: 'source-one', collectedAt: '2026-09-07T12:10:00Z', metadataOnly: true } }
const finding = { id: 'finding-one', eventType: 'darkweb.monitoring.match', company: 'Acme', matchedTerm: snapshot.watchlist[0], actor: 'Actor 1', severity: 'high', confidence: 90, artifactType: 'ransomware_claim', sourceFamily: 'darkweb_metadata', sourceCount: 1, firstSeenAt: now, lastSeenAt: now, claimSummary: 'A source mentioned Acme.', observedMatchSummary: 'acme.com appeared in a source post.', reviewState: 'new', recommendedAction: 'Review the source evidence.', evidence: [evidence], matchTiming: { kind: 'new_evidence' }, webhookDelivery: { recommendedRoute: 'analyst_review', payloadHash: 'hash', dedupeKey: 'dedupe' }, organizationId: 'org-one' }
const alerts = [finding, { ...finding, id: 'finding-two', company: 'Resolved match', reviewState: 'resolved', evidence: [], firstSeenAt: '2026-09-06T12:00:00Z' }]
const sourceHealth = Array.from({ length: 25 }, (_, i) => ({ sourceId: `source-${i}`, sourceName: `Source ${i}`, family: 'darkweb_metadata', status: 'active', approvedMetadataOnly: true, collectionStatus: i === 0 ? 'failed' : i === 1 ? 'succeeded' : 'not_collected', lastSuccessAt: i < 2 ? now : undefined, lastAttemptAt: i < 2 ? now : undefined }))
const operations = { counts: { sourceCount: 25, activeSourceCount: 25, captureCount: 1, watchlistMatchCount: 1 }, sourceHealth, latestCaptures: [], zeroAlertExplanation: { message: '' } }
const health = Object.fromEntries(['snapshot', 'operations', 'alerts', 'deliveries'].map(key => [key, { state: 'missing', label: '', detail: '' }]))
let bundle = ''
let failReads = false
let failCase = true
let caseBody
const calls = []
const cssDirectory = process.env.DWM_CSS_DIR || '.next/static/css'
const css = (await Promise.all((await readdir(cssDirectory)).filter(file => file.endsWith('.css')).map(file => readFile(`${cssDirectory}/${file}`, 'utf8')))).join('\n')
const server = Bun.serve({ port: 0, async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/app.js') return new Response(bundle, { headers: { 'content-type': 'text/javascript' } })
    if (url.pathname === '/app.css') return new Response(css, { headers: { 'content-type': 'text/css' } })
    if (url.pathname.startsWith('/api/dwm/')) {
        calls.push(url)
        if (url.pathname.endsWith('/case-handoff')) {
            caseBody = await request.json()
            return failCase ? Response.json({ error: { message: 'Case service unavailable. Try again.' } }, { status: 503 }) : Response.json({ case: { id: 'case-one' } })
        }
        if (failReads) return Response.json({ error: { message: 'Service unavailable' } }, { status: 503 })
        if (url.pathname.endsWith('/product')) return Response.json(snapshot)
        if (url.pathname.endsWith('/operations')) return Response.json(operations)
        if (url.pathname.endsWith('/alerts')) return Response.json({ alerts })
        return Response.json({ deliveries: [] })
    }
    return new Response('<html class="dark"><head><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>', { headers: { 'content-type': 'text/html' } })
} })
const build = await Bun.build({ entrypoints: ['monitoring-fixture'], target: 'browser', plugins: [{ name: 'fixture', setup(builder) {
    builder.onResolve({ filter: /^(monitoring-fixture|next\/link|next\/navigation)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', resolveDir: process.cwd(), contents: args.path === 'next/link' ? 'export default function Link(props){return <a {...props}/>}' : args.path === 'next/navigation' ? 'export const useRouter=()=>({push:href=>{window.caseNavigation=href},refresh:()=>{}});export const useSearchParams=()=>new URLSearchParams(location.search);' : `import {createRoot} from 'react-dom/client';import {DwmAnalystPortal} from './src/app/dashboard/dwm/dwm-analyst-portal';createRoot(document.getElementById('root')).render(<DwmAnalystPortal tenantId="org-one" organizationId="org-one" view={location.pathname.includes('actors')?'actors':location.pathname.includes('alerts')?'alerts':location.pathname.includes('actions')?'actions':'overview'} snapshot={${JSON.stringify({ ...snapshot, watchlist: [], actorOverviews: [] })}} operations={null} alerts={[]} deliveries={[]} dataHealth={${JSON.stringify(health)}}/>);` }))
} }] })
assert(build.success, build.logs.join('\n'))
bundle = await build.outputs[0].text()
const browser = await chromium.launch()
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${server.url}dwm`)
    await page.getByRole('heading', { name: 'Dark web monitoring', exact: true }).waitFor()
    await page.getByText('2 findings · 1 needing review', { exact: true }).waitFor()
    await page.getByText('Collection failed', { exact: false }).waitFor()
    await page.getByText('Last attempt succeeded', { exact: false }).waitFor()
    assert.equal(await page.getByRole('heading', { name: 'Monitored actors' }).count(), 0)
    await page.getByLabel('Filter findings').selectOption('review')
    assert.equal(await page.locator('[data-finding-id]').count(), 1)
    await page.getByText('Investigate finding', { exact: true }).click()
    await page.getByText('acme.com appeared in the recorded source post.', { exact: true }).waitFor()
    await page.getByText('Capture: capture-one', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Open case', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Case service unavailable' }).waitFor()
    failCase = false
    await page.getByRole('button', { name: 'Open case', exact: true }).click()
    await page.waitForFunction(() => window.caseNavigation?.includes('case-one'))
    assert.equal(caseBody.organizationId, 'org-one')
    assert.equal(caseBody.tenantId, 'org-one')
    assert.equal(caseBody.idempotencyKey, 'dashboard-alert-case:finding-one')
    await page.getByLabel('Filter findings').selectOption('all')
    assert(await page.locator('[data-finding-id="finding-two"]').getByRole('button', { name: 'Open case' }).isDisabled())
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.getByText('Source 24', { exact: true }).waitFor()
    for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 })
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Monitoring overflow at ${width}`)
        if (process.env.DWM_SCREENSHOT_PREFIX && [390, 1440].includes(width)) await page.screenshot({ path: `${process.env.DWM_SCREENSHOT_PREFIX}-${width}.png`, fullPage: true })
    }
    assert(calls.filter(url => !url.pathname.endsWith('case-handoff')).every(url => url.searchParams.get('organizationId') === 'org-one' && url.searchParams.get('tenantId') === 'org-one'))
    await page.goto(`${server.url}dwm/actors`)
    await page.getByText('25 actor profiles', { exact: true }).waitFor()
    assert.equal(await page.getByText('Strong', { exact: true }).count(), 0)
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    assert.equal(await page.getByRole('link', { name: 'Open Actor 25 profile', exact: true }).getAttribute('href'), '/ti/Actor%2025')
    await page.getByLabel('Search actors').fill('Actor 25')
    assert.equal(await page.getByRole('link', { name: /^Open Actor .* profile$/ }).count(), 1)
    failReads = true
    await page.goto(`${server.url}dwm`)
    await page.getByRole('alert').filter({ hasText: 'Findings could not be loaded' }).waitFor()
    assert.equal(await page.getByText('No saved findings', { exact: false }).count(), 0)
    failReads = false
    await page.getByRole('alert').filter({ hasText: 'Findings could not be loaded' }).getByRole('button', { name: 'Retry' }).click()
    await page.getByText('2 findings · 1 needing review', { exact: true }).waitFor()
    await page.goto(`${server.url}dwm/actions`)
    assert.equal(await page.getByRole('heading', { name: 'Matched alerts', exact: true }).count(), 0)
    await page.goto(`${server.url}dwm/alerts`)
    await page.getByRole('heading', { name: 'Matched alerts', exact: true }).waitFor()
    await page.getByText('Acme', { exact: true }).waitFor()
    assert.equal(await page.locator('#dwm-workflow-actions').count(), 0)
    assert(await page.getByRole('button', { name: 'Open case', exact: true }).nth(1).isDisabled())
    failCase = true
    await page.getByRole('button', { name: 'Open case', exact: true }).first().click()
    await page.getByRole('alert').filter({ hasText: 'Case service unavailable' }).waitFor()
    failCase = false
    await page.getByRole('button', { name: 'Open case', exact: true }).first().click()
    await page.waitForFunction(() => window.caseNavigation?.includes('case-one'))
    assert.equal(caseBody.organizationId, 'org-one')
    for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Alerts overflow at ${width}`)
    }
    failReads = true
    await page.goto(`${server.url}dwm/alerts`)
    await page.getByRole('alert').filter({ hasText: 'Alerts could not be loaded' }).waitFor()
    assert.equal(await page.getByText('No alerts yet.', { exact: true }).count(), 0)
    failReads = false
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await page.getByText('Acme', { exact: true }).waitFor()
    assert.deepEqual(errors, [])
    console.log('DWM browser passed: overview, scoped requests, review filter, retained evidence, case failure/retry, pagination, complete actor links, API failure states and responsive layout.')
} finally { await browser.close(); server.stop(true) }
