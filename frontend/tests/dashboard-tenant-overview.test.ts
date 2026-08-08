import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

test('customer overview separates tenant monitoring from platform traffic', async () => {
    const root = process.cwd().endsWith(`${path.sep}frontend`) ? process.cwd() : path.join(process.cwd(), 'frontend')
    const page = await readFile(path.join(root, 'src/app/dashboard/overview/page.tsx'), 'utf8')
    const panel = await readFile(path.join(root, 'src/app/dashboard/overview/dwmOverviewPanel.tsx'), 'utf8')

    assert.match(page, /DwmOverviewPanel/)
    assert.match(page, /Platform traffic/)
    assert.match(panel, /fetch\('\/api\/dwm\/product'/)
    assert.match(panel, /Tenant-scoped DWM state/)
    assert.match(panel, /snapshot\.watchlist\.length/)
    assert.match(panel, /snapshot\.alerts\.length/)
})
