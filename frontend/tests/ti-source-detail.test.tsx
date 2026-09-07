import assert from 'node:assert/strict'
// @ts-expect-error Bun supplies this module for focused checks.
import { mock } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
mock.module('../src/app/dashboard/ti/manualRunButton', () => ({ default: () => null }))
const originalFetch = globalThis.fetch
let failed: string[] = []
let empty = false
globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (failed.some(resource => url.pathname.endsWith(resource))) return new Response('', { status: 503 })
    if (url.pathname.endsWith('/source-operations')) {
        assert.equal(url.searchParams.get('includeCandidates'), 'true')
        return Response.json({ sources: [{ id: 'example', name: 'Example source', status: 'paused', type: 'rss', health: { state: 'failed', lastFailureReason: 'Connection refused' }, collection: { cadenceSeconds: 3600 }, coverage: { captureCount: 2 } }] })
    }
    if (url.pathname.endsWith('/collection-runs')) return Response.json({ collectionRuns: [] })
    return Response.json({ captures: empty ? [] : [{ id: 'capture', sourceId: 'example', collectedAt: '2026-09-07T10:00:00Z', url: 'https://example.com/article', metadata: { title: 'Example article' } }] })
}) as typeof fetch
const { default: Page } = await import('../src/app/dashboard/ti/sources/[id]/page')
async function render() { return renderToStaticMarkup(await Page({ params: Promise.resolve({ id: 'example' }) })) }
try {
    let html = await render()
    for (const text of ['Hits', 'Recent runs', 'Recent evidence', 'Connection refused', 'Example article', 'Open original', 'Paused']) assert(html.includes(text), text)
    for (const text of ['Worker output', 'Safety rules', 'Yield', 'Source healthy', 'Collector checking']) assert(!html.includes(text), text)
    failed = ['captures', 'collection-runs']
    html = await render()
    assert(html.includes('Evidence unavailable.'))
    assert(html.includes('Run history unavailable.'))
    assert(!html.includes('No evidence collected yet.'))
    failed = []
    empty = true
    html = await render()
    assert(html.includes('No evidence collected yet.'))
    failed = ['source-operations']
    html = await render()
    assert(html.includes('Source unavailable'), html)
    assert(!html.includes('Healthy'))
    console.log('Source detail: real states, paused source, hits, evidence links, empty and failed loads passed.')
} finally { globalThis.fetch = originalFetch }
