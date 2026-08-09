import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('binds tenant timeliness reads and writes to verified organization membership', () => {
    const route = readFileSync(new URL('../src/app/api/ti/timeliness/route.ts', import.meta.url), 'utf8')

    assert.match(route, /organizationScopeError\(organizationId \|\| tenantId!, session\.identity\.token, session\.identity\.id, request\.method !== 'GET'\)/)
    assert.match(route, /if \(scopeError\) return scopeError/)
})

test('defaults the client to an explicit tenant and reserves global scope for system administrators', () => {
    const client = readFileSync(new URL('../src/app/dashboard/ti/timeliness/timelinessClient.tsx', import.meta.url), 'utf8')
    const route = readFileSync(new URL('../src/app/api/ti/timeliness/route.ts', import.meta.url), 'utf8')

    assert.match(client, /useState<'tenant' \| 'global'>\('tenant'\)/)
    assert.match(client, /setTenantId\(organization\.tenantId \|\| organization\.id\)/)
    assert.match(client, /params\.set\('organizationId', organizationId\.trim\(\)\)/)
    assert.match(route, /scope === 'global' && !session\.identity\.roles\.includes\('system_admin'\)/)
    assert.match(route, /organizationScopeError\(organizationId \|\| tenantId!\,/)
})
