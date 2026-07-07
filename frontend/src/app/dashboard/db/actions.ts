'use server'

import { getDatabaseHealth, getDatabaseRows, restoreDatabaseBackup, runDatabaseSql, triggerDatabaseBackup } from '@/utils/db/internal'

export async function triggerBackupAction() {
    return await triggerDatabaseBackup()
}

export async function restoreBackupAction(service: string, file: string) {
    return await restoreDatabaseBackup(service, file)
}

export async function databaseHealthAction() {
    return await getDatabaseHealth()
}

export async function databaseRowsAction(schema: string, table: string, limit: number) {
    return await getDatabaseRows(schema, table, limit)
}

export async function databaseSqlAction(sql: string) {
    return await runDatabaseSql(sql)
}
