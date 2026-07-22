'use server'

import { getDatabaseHealth, getDatabaseRows, restoreDatabaseBackup, runDatabaseSql, triggerDatabaseBackup, verifyDatabaseBackup } from '@/utils/db/internal'

export async function triggerBackupAction() {
    return await triggerDatabaseBackup()
}

export async function verifyBackupAction(file: string) {
    return await verifyDatabaseBackup(file)
}

export async function restoreBackupAction(file: string, targetDatabase: string, confirmation: string) {
    return await restoreDatabaseBackup(file, targetDatabase, confirmation)
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
