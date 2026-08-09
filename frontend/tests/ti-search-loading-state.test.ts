import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync(new URL('../src/app/ti/pageClient.tsx', import.meta.url), 'utf8')
const loadingState = source.match(/function searchingResult\(query: string\): TiSearchResponse \{([\s\S]*?)\n\}/)?.[1] || ''

test('public TI loading state has no synthetic evidence timestamp', () => {
    assert.match(loadingState, /generatedAt: ''/)
    assert.match(loadingState, /status: 'searching'/)
    assert.doesNotMatch(loadingState, /new Date\(\)/)
})
