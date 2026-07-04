import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('database overview focuses operator triage without removing telemetry actions', async () => {
    const page = await readFile(path.join(root, 'src/app/dashboard/db/databaseDashboard.tsx'), 'utf8')

    expect(page).toContain('data-db-primary-triage')
    expect(page).toContain('Recommended next')
    expect(page).toContain('const primaryHref')
    expect(page).toContain('Review long-running queries now')
    expect(page).toContain('href={primaryHref}')
    expect(page).toContain('data-db-primary-action')
    expect(page).toContain('data-db-long-running-state')
    expect(page).toContain('Long-running query state: no long-running queries right now.')

    expect(page).toContain('data-db-telemetry-disclosure')
    expect(page).toContain('data-db-operation-lanes')
    expect(page).toContain('data-db-metrics')
    expect(page.indexOf('data-db-telemetry-disclosure')).toBeLessThan(page.indexOf('data-db-operation-lanes'))
    expect(page.indexOf('data-db-telemetry-disclosure')).toBeLessThan(page.indexOf('data-db-metrics'))

    expect(page).toContain('id=\'active-queries\'')
    expect(page).toContain('id=\'storage-inventory\'')
    expect(page).toContain('href=\'/dashboard/db/backups\'')
    expect(page).toContain('href=\'/dashboard/db/restore\'')
})
