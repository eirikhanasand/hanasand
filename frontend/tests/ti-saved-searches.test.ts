import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

test('threat intelligence search exposes bounded browser-local save and reopen controls', async () => {
    const frontend = process.cwd().endsWith(`${path.sep}frontend`)
        ? process.cwd()
        : path.join(process.cwd(), 'frontend')
    const [shared, page, controls] = await Promise.all([
        readFile(path.join(frontend, 'src/app/ti/pageClientShared.ts'), 'utf8'),
        readFile(path.join(frontend, 'src/app/ti/components/ti-page-client.tsx'), 'utf8'),
        readFile(path.join(frontend, 'src/app/ti/components/search-workspace-controls.tsx'), 'utf8'),
    ])
    const client = `${shared}\n${page}\n${controls}`

    assert.match(client, /hanasand:ti:saved-searches/)
    assert.match(client, /TI_SAVED_SEARCH_LIMIT = 8/)
    assert.match(client, /Stored only in this browser/)
    assert.match(client, /onSearch\(item\.query\)/)
    assert.match(client, /onSearch=\{value => void executeSearch\(value\)\}/)
    assert.match(client, /Remove saved search/)
})
