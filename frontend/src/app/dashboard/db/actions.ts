'use server'

import { restoreDatabaseBackup, triggerDatabaseBackup } from '@/utils/db/internal'

export async function triggerBackupAction() {
    return await triggerDatabaseBackup()
}

export async function restoreBackupAction(service: string, file: string) {
    return await restoreDatabaseBackup(service, file)
}

