import type { BackupService } from '@/utils/db/internal'

export type BackupPresentation = {
    healthLabel: 'Healthy' | 'Attention' | 'Unavailable'
    healthTone: 'ok' | 'warn' | 'bad'
    summary: string
    safeError?: string
    rawDetails?: string
    restoreReady: boolean
    restoreDisabledReason?: string
    retention: string
    storageTarget: string
    latestFile: string
    latestSize: string
    duration: string
    healthCheck: string
}

export function presentBackup(backup: BackupService): BackupPresentation {
    const safeError = backup.error ? summarizeBackupError(backup.error) : undefined
    const hasLastBackup = Boolean(backup.lastBackup)
    const status = backup.status.toLowerCase()
    const isUnavailable = Boolean(safeError) || status.includes('unavailable') || status.includes('down') || status.includes('fail')
    const isHealthy = !isUnavailable && (status.includes('up') || status.includes('ok') || status.includes('healthy') || status.includes('available'))
    const restoreReady = hasLastBackup && !isUnavailable

    return {
        healthLabel: isHealthy ? 'Healthy' : isUnavailable ? 'Unavailable' : 'Attention',
        healthTone: isHealthy ? 'ok' : isUnavailable ? 'bad' : 'warn',
        summary: safeError
            ? 'Backup status cannot be verified until the internal database connection is fixed.'
            : hasLastBackup
                ? 'Backup status is reporting a restore point.'
                : 'Backup state is updating for the first restore point.',
        safeError,
        rawDetails: backup.error ? redactBackupDetails(backup.error) : undefined,
        restoreReady,
        restoreDisabledReason: restoreReady
            ? undefined
            : safeError
                ? 'Restore is disabled until backup status and files can be verified.'
                : 'Restore is disabled until at least one backup file exists.',
        retention: backup.retention || 'Not reported',
        storageTarget: backup.storageTarget || backup.totalStorage || 'Not reported',
        latestFile: backup.latestFile || 'Not reported',
        latestSize: backup.latestSize || backup.dbSize || 'Not reported',
        duration: backup.latestDuration || 'Not reported',
        healthCheck: safeError ? 'Unavailable' : backup.healthCheck || (hasLastBackup ? 'Verified' : 'No restore point yet'),
    }
}

export function summarizeBackupError(message: string) {
    const lower = message.toLowerCase()

    if (lower.includes('password authentication failed') || lower.includes('28p01')) {
        return 'The backup service cannot authenticate to the database. Check the internal API database credentials and retry the status check.'
    }

    if (lower.includes('econnrefused') || lower.includes('connection refused') || lower.includes('timeout') || lower.includes('enotfound')) {
        return 'The backup service cannot reach the database from the internal API. Check network access, DB_HOST, and service health.'
    }

    if (lower.includes('permission denied') || lower.includes('role') || lower.includes('privilege')) {
        return 'The backup service does not have enough database permission to inspect or create backups.'
    }

    if (lower.includes('backup storage directory') || lower.includes('db_backup_dir')) {
        return 'Backup storage is not configured for the API service. Set DB_BACKUP_DIR or create the configured backup directory before running backups.'
    }

    if (lower.includes('pg_dump')) {
        return 'The backup service cannot run pg_dump. Install PostgreSQL client tools in the API runtime before running backups.'
    }

    if (lower.includes('restore is disabled')) {
        return 'Restore is disabled in the API service until an operator enables DB_RESTORE_ENABLED after reviewing the backup file.'
    }

    return 'The backup service needs attention. Open the service logs for the exact failure before running another backup.'
}

export function redactBackupDetails(message: string) {
    return message
        .replace(/password authentication failed for user\s+"[^"]+"/gi, 'password authentication failed for configured database user')
        .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, 'postgres://[redacted]')
        .replace(/password=([^\s"'<>]+)/gi, 'password=[redacted]')
}

export function presentBackupLoadError(error: string) {
    return {
        safeError: summarizeBackupError(error),
        rawDetails: redactBackupDetails(error),
    }
}
