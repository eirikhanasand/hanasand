import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { getTiEnrichmentOverview } from '../src/utils/tiAdmin/enrichment'
import TiActivityPage from '../src/app/dashboard/ti/activity/page'

const originalFetch = globalThis.fetch
let mode = 'populated'
let failure = ''
let calls = 0
const now = new Date().toISOString()
globalThis.fetch = (async (input: string | URL | Request) => {
    calls++
    await new Promise(resolve => setTimeout(resolve, 5))
    const path = new URL(String(input)).pathname
    if (path.endsWith(failure) && failure) return new Response('', { status: 503 })
    return Response.json({
        status: { worker: { state: 'idle', lastRunAt: null, lastSuccessfulRunAt: null, currentFailure: null, snapshotFresh: false }, latestRun: null },
        profiles: mode === 'empty' ? [] : [{ id: 'actor-1', canonicalName: 'Example actor', updatedAt: now }],
        updates: mode === 'empty' || mode === 'profiles-only' ? [] : Array.from({ length: mode === 'many' ? 60 : 1 }, (_, i) => ({ id: `update-${i}`, subjectId: 'actor-1', subjectType: 'actor_profile', observedAt: now })),
    })
}) as typeof fetch

try {
    const first = await getTiEnrichmentOverview()
    assert.equal(calls, 1)
    assert.equal(first.dataAvailable, true)
    assert.equal(first.activity.length, 1, 'Cold requests must await their actual data')
    assert.equal(first.updatedActors[0].name, 'Example actor')
    let html = renderToStaticMarkup(await TiActivityPage({}))
    assert.ok(html.includes('Example actor'))
    assert.ok(!html.includes('Checking'))
    assert.ok(html.includes('name="q"'))
    assert.ok(html.includes('>Age</th>'))
    mode = 'many'
    html = renderToStaticMarkup(await TiActivityPage({ searchParams: Promise.resolve({ q: 'Example', page: '2' }) }))
    assert.equal((html.match(/<tr class=/g) || []).length, 25)
    assert.ok(html.includes('q=Example&amp;page=3'))
    assert.ok(html.includes('q=Example&amp;page=1'))
    mode = 'populated'
    for (const endpoint of ['/overview']) {
        failure = endpoint
        assert.equal((await getTiEnrichmentOverview()).dataAvailable, false)
        html = renderToStaticMarkup(await TiActivityPage({}))
        assert.ok(html.includes('Activity is temporarily unavailable.'))
        assert.ok(!html.includes('Welcome to activity'))
        assert.ok(!html.includes('No monitoring issues'))
    }
    failure = ''
    mode = 'empty'
    html = renderToStaticMarkup(await TiActivityPage({}))
    assert.ok(html.includes('Welcome to activity'))
    assert.ok(!html.includes('<table'))
    assert.ok(!html.includes('unavailable'))
    mode = 'profiles-only'
    html = renderToStaticMarkup(await TiActivityPage({}))
    assert.ok(html.includes('No events yet'))
    assert.ok(html.includes('Example actor'))
    assert.ok(!html.includes('Checking'))
    mode = 'populated'
    assert.equal((await getTiEnrichmentOverview()).activity.length, 1, 'A failed request must recover')
    console.log('Activity cold load, populated, empty, partial failure and recovery checks passed')
} finally {
    globalThis.fetch = originalFetch
}
