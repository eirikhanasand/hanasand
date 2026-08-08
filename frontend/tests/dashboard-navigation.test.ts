import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

test('authenticated dashboard exposes the organization workspace in Settings', async () => {
    const root = process.cwd().endsWith(`${path.sep}frontend`) ? process.cwd() : path.join(process.cwd(), 'frontend')
    const sidebar = await readFile(path.join(root, 'src/components/dashboard/dashboardSidebar.tsx'), 'utf8')

    assert.match(sidebar, /href: '\/organizations', label: 'Organizations'/)
    assert.match(sidebar, /title=\{item\.label\}/)
})
