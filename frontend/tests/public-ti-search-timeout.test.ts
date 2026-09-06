import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const route = readFileSync(new URL('../src/app/api/ti/search/route.ts', import.meta.url), 'utf8')

test('public TI search has a bounded unavailable boundary', () => {
    const outer = Number(route.match(/PUBLIC_TI_SEARCH_TIMEOUT_MS = ([\d_]+)/)?.[1].replaceAll('_', ''))
    const backend = readFileSync(new URL('../../api/src/utils/ti/search.ts', import.meta.url), 'utf8')
    const inner = Number(backend.match(/options.cachedOnly \? 350 : ([\d_]+)/)?.[1].replaceAll('_', ''))
    assert(outer > inner && outer <= 15_000, 'The browser proxy must allow the bounded upstream lookup to finish')
    assert.match(route, /AbortSignal\.timeout\(PUBLIC_TI_SEARCH_TIMEOUT_MS\)/)
    assert.match(route, /status: 502/)
    assert.match(route, /ti_search_unavailable/)
    assert.doesNotMatch(route, /15_000/)
})
