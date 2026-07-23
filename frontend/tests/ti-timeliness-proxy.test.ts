import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('binds tenant timeliness reads and writes to verified organization membership', () => {
    const route = readFileSync(new URL('../src/app/api/ti/timeliness/route.ts', import.meta.url), 'utf8')

    assert.match(route, /organizationScopeError\(tenantId!, session\.identity\.token, session\.identity\.id, request\.method !== 'GET'\)/)
    assert.match(route, /if \(scopeError\) return scopeError/)
})
