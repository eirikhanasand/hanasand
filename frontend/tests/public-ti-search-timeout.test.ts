import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const route = readFileSync(new URL('../src/app/api/ti/search/route.ts', import.meta.url), 'utf8')

test('public TI search has a bounded unavailable boundary', () => {
    assert.match(route, /PUBLIC_TI_SEARCH_TIMEOUT_MS = 3_500/)
    assert.match(route, /AbortSignal\.timeout\(PUBLIC_TI_SEARCH_TIMEOUT_MS\)/)
    assert.match(route, /status: 502/)
    assert.match(route, /ti_search_unavailable/)
    assert.doesNotMatch(route, /15_000/)
})
