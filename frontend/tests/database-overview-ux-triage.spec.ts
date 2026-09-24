import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

test('database page prioritizes storage and uses full-width disclosures', async () => {
    const dashboard = await readFile(path.join(process.cwd(), 'src/app/dashboard/db/databaseDashboard.tsx'), 'utf8')
    const page = await readFile(path.join(process.cwd(), 'src/app/dashboard/db/page.tsx'), 'utf8')
    expect(page).not.toContain('ResiliencePanel')
    expect(dashboard).toContain('aria-label=\'Storage health\'')
    expect(dashboard).toContain('title=\'Queries\'')
    expect(dashboard).toContain('title=\'Longest running query\'')
    expect(dashboard).toContain('<details')
    expect(dashboard).not.toContain('Active and long-running queries')
    expect(dashboard.indexOf('id=\'storage-inventory\'')).toBeLessThan(dashboard.indexOf('<DatabaseWorkbench'))
    expect(dashboard).toContain('storage?.instances')
    expect(dashboard).toContain('data-db-monitor-metrics')
    expect(dashboard).toContain('href=\'/db/backups\'')
    expect(dashboard).toContain('href=\'/db/restore\'')
})
