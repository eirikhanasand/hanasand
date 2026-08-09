import { readFileSync } from 'node:fs'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'

const page = readFileSync(new URL('../src/app/ti/darkweb/index/page.tsx', import.meta.url), 'utf8')
const route = readFileSync(new URL('../src/app/api/ti/darkweb/[[...path]]/route.ts', import.meta.url), 'utf8')

test('dark web index uses the public frontend proxy instead of the private scraper hostname', () => {
    assert.match(page, /\/api\/ti\/darkweb\//)
    assert.doesNotMatch(page, /TI_SCRAPER_API_BASE|ti-scraper:8097/)
    assert.match(route, /\/v1\/darkweb\//)
    assert.match(route, /no-store/)
})
