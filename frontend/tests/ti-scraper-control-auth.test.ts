// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

test('scraper control preserves auth and reports unavailable health as failure', async () => {
    const source = await readFile(path.join(process.cwd(), 'src/app/api/ti/scraper/control/route.ts'), 'utf8')

    assert.match(source, /requireApiSession\(request, \['system_admin', 'admin', 'administrator'\]\)/)
    assert.match(source, /system_admin/)
    assert.match(source, /authorization: `Bearer \$\{identity\.token\}`/)
    assert.match(source, /tenantId: 'default'/)
    assert.match(source, /const scraperUnavailable = !health\.ok/)
    assert.match(source, /ok: !scraperUnavailable/)
    assert.match(source, /status: scraperUnavailable \? 503 : 200/)
})
