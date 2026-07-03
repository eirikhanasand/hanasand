import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('restore backup keeps restore actions while collapsing secondary filters', async () => {
    const page = await readFile(path.join(root, 'src/app/dashboard/db/restore/restoreClient.tsx'), 'utf8')

    expect(page).toContain('data-restore-primary-flow')
    expect(page).toContain('Recommended next')
    expect(page).toContain('const primaryTitle')
    expect(page).toContain('const primaryHref')
    expect(page).toContain('href={primaryHref}')
    expect(page).toContain('data-restore-primary-action')

    expect(page).toContain('data-restore-filters-disclosure')
    expect(page).toContain('id=\'restore-filters\'')
    expect(page).toContain('open={activeFilterCount > 0}')
    expect(page).toContain('data-restore-service-filter')
    expect(page).toContain('data-restore-date-filter')
    expect(page).toContain('data-restore-clear-filters')
    expect(page).toContain('router.push(query ? `${pathname}?${query}` : pathname)')
    expect(page).toContain('router.push(pathname)')

    expect(page).toContain('data-restore-points')
    expect(page).toContain('restoreBackupAction(backup.service, backup.file)')
    expect(page).toContain('backup.locations.join')
})
