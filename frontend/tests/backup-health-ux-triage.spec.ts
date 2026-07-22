import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('backup dashboard is an evidence-backed operator workflow', async() => {
    const page = await readFile(path.join(root, 'src/app/dashboard/db/backups/backupPage.tsx'), 'utf8')

    expect(page).toContain('data-backup-operator-console')
    expect(page).toContain('data-backup-primary-action')
    expect(page).toContain('Run verified backup')
    expect(page).toContain('Last attempt')
    expect(page).toContain('Last success')
    expect(page).toContain('Last failure')
    expect(page).toContain('Next automatic run')
    expect(page).toContain('Storage target')
    expect(page).toContain('Latest checksum')
    expect(page).toContain('verifyBackupAction(file)')
    expect(page).toContain('Persistent operation history')
    expect(page).toContain('router.refresh()')
})
