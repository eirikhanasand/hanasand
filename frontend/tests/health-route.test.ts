import assert from 'node:assert/strict'
// @ts-expect-error Bun supplies the focused test runtime.
import { test } from 'bun:test'
import { GET } from '../src/app/api/health/route'

test('frontend health succeeds only when the API health endpoint succeeds', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => Response.json({ ok: true, service: 'api', release: 'release-1' })) as typeof fetch
    try {
        const response = await GET()
        assert.equal(response.status, 200)
        assert.deepEqual(await response.json(), {
            ok: true,
            service: 'frontend',
            release: process.env.HANASAND_RELEASE_COMMIT || 'unknown',
            api: { ok: true, service: 'api', release: 'release-1' },
        })
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('frontend health reports an unavailable API as service unavailable', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => new Response('{}', { status: 503 })) as typeof fetch
    try {
        const response = await GET()
        assert.equal(response.status, 503)
        assert.deepEqual(await response.json(), { ok: false, service: 'frontend', error: 'API is unavailable' })
    } finally {
        globalThis.fetch = originalFetch
    }
})
