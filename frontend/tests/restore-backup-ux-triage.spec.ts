import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('restore page requires an explicit isolated target and confirmation', async() => {
    const page = await readFile(path.join(root, 'src/app/dashboard/db/restore/restoreClient.tsx'), 'utf8')

    expect(page).toContain('data-restore-operator-console')
    expect(page).toContain('data-restore-primary-action')
    expect(page).toContain('Isolated target database')
    expect(page).toContain('confirmation === requiredConfirmation')
    expect(page).toContain('restoreBackupAction(file, target, confirmation)')
    expect(page).toContain('This workflow never restores over the live database')
    expect(page).toContain('creating_isolated_database')
    expect(page).toContain('checking_integrity')
    expect(page).toContain('removing_isolated_database')
    expect(page).toContain('Restore-drill audit history')
})
