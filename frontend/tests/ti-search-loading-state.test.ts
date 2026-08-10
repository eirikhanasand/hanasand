import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync(new URL('../src/app/ti/pageClient.tsx', import.meta.url), 'utf8')
test('public TI loading state uses the standard loader without synthetic evidence', () => {
    assert.match(source, /function SearchLoading\(\{ query \}: \{ query: string \}\)/)
    assert.match(source, /<Loader2 className='h-5 w-5 animate-spin/)
    assert.doesNotMatch(source, /function searchingResult\(/)
})
