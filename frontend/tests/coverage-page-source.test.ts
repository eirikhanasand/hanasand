import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const source = readFileSync(new URL('../src/app/coverage/page.tsx', import.meta.url), 'utf8')

test('public coverage page uses the same proxy as its production route', () => {
    assert.match(source, /headers\(\)/)
    assert.match(source, /new URL\('\/api\/coverage', `\$\{protocol\}:\/\/\$\{host\}`\)/)
    assert.doesNotMatch(source, /tiScraperApiBase|\/v1\/public\/coverage/)
})
