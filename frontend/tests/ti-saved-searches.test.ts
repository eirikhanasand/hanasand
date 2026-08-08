import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

test('threat intelligence search exposes bounded browser-local save and reopen controls', async () => {
    const clientPath = process.cwd().endsWith(`${path.sep}frontend`)
        ? path.join(process.cwd(), 'src/app/ti/pageClient.tsx')
        : path.join(process.cwd(), 'frontend/src/app/ti/pageClient.tsx')
    const client = await readFile(clientPath, 'utf8')

    assert.match(client, /hanasand:ti:saved-searches/)
    assert.match(client, /TI_SAVED_SEARCH_LIMIT = 8/)
    assert.match(client, /Stored only in this browser/)
    assert.match(client, /executeSearch\(item\.query\)/)
    assert.match(client, /Remove saved search/)
})
