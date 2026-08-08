import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

test('customer overview keeps tenant monitoring separate from unscoped platform metrics', async () => {
    const root = process.cwd().endsWith(`${path.sep}frontend`) ? process.cwd() : path.join(process.cwd(), 'frontend')
    const page = await readFile(path.join(root, 'src/app/dashboard/overview/page.tsx'), 'utf8')
    const panel = await readFile(path.join(root, 'src/app/dashboard/overview/dwmOverviewPanel.tsx'), 'utf8')

    assert.match(page, /DwmOverviewPanel/)
    assert.doesNotMatch(page, /Platform traffic|Domains watched|getMonitoringOverview/)
    assert.match(panel, /fetch\('\/api\/dwm\/product'/)
    assert.match(panel, /Tenant-scoped DWM state/)
    assert.match(panel, /snapshot\.watchlist\.length/)
    assert.match(panel, /snapshot\.alerts\.length/)
})
