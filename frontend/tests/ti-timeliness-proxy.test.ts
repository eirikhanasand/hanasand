import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('binds tenant timeliness reads and writes to verified organization membership', () => {
    const route = readFileSync(new URL('../src/app/api/ti/timeliness/route.ts', import.meta.url), 'utf8')
    const auth = readFileSync(new URL('../src/utils/proxy/requireApiSession.ts', import.meta.url), 'utf8')

    assert.match(route, /requireApiSession\(request\)/)
    assert.match(auth, /canViewHanasandInternalRoute\(request\.method, request\.nextUrl\.pathname\)/)
    assert.match(auth, /validation\.canViewInternalPages/)
    assert.doesNotMatch(route, /session\.identity\.roles|system_admin/)
})

test('defaults the client to an explicit tenant and scopes global access through Hanasand membership', () => {
    const client = readFileSync(new URL('../src/app/dashboard/ti/timeliness/timelinessClient.tsx', import.meta.url), 'utf8')
    const route = readFileSync(new URL('../src/app/api/ti/timeliness/route.ts', import.meta.url), 'utf8')

    assert.match(client, /useState<'tenant' \| 'global'>\('global'\)/)
    assert.match(client, /tenantId\.trim\(\)/)
    assert.match(client, /params\.set\('tenantId', tenantId\.trim\(\)\)/)
    assert.match(route, /requireApiSession\(request\)/)
})
