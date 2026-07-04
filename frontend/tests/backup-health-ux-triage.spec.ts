import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('backup dashboard focuses next action while preserving run and restore workflows', async () => {
    const page = await readFile(path.join(root, 'src/app/dashboard/db/backups/backupPage.tsx'), 'utf8')

    expect(page).toContain('data-backup-primary-flow')
    expect(page).toContain('Recommended next')
    expect(page).toContain('const primaryTitle')
    expect(page).toContain('const primaryRestoreHref')
    expect(page).toContain('data-backup-primary-action')
    expect(page).toContain('href=\'#backup-targets\'')

    expect(page).toContain('data-backup-summary-disclosure')
    expect(page).toContain('data-backup-summary-metrics')
    expect(page.indexOf('data-backup-summary-disclosure')).toBeLessThan(page.indexOf('data-backup-summary-metrics'))

    expect(page).toContain('data-backup-targets')
    expect(page).toContain('data-backup-target-details')
    expect(page).toContain('data-backup-restore-proof')
    expect(page).toContain('Restore checks')
    expect(page).toContain('triggerBackupAction()')
    expect(page).toContain('/dashboard/db/restore?service=${encodeURIComponent(backupServiceSlug(backup))}')
    expect(page).toContain('presentation.safeError')
    expect(page).toContain('presentation.restoreDisabledReason')
})
