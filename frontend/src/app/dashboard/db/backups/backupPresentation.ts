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
    restoreProof: BackupRestoreProof
}

export type BackupRestoreProof = {
    schemaVersion: 'hanasand.backup.restore_readiness.v1'
    state: 'ready' | 'needs_action'
    checks: Array<{
        id: 'status' | 'last_backup' | 'indexed_file' | 'storage'
        label: string
        value: string
        state: 'ready' | 'needs_action' | 'unknown'
    }>
    blockers: string[]
}

export function presentBackup(backup: BackupService): BackupPresentation {
    const safeError = backup.error ? summarizeBackupError(backup.error) : undefined
    const hasLastBackup = Boolean(backup.lastBackup)
    const hasIndexedFile = Boolean(backup.latestFile)
    const status = backup.status.toLowerCase()
    const isUnavailable = Boolean(safeError) || status.includes('unavailable') || status.includes('down') || status.includes('fail')
    const isHealthy = !isUnavailable && (status.includes('up') || status.includes('ok') || status.includes('healthy') || status.includes('available'))
    const restoreReady = hasLastBackup && hasIndexedFile && !isUnavailable
    const restoreProof = buildRestoreProof({
        backup,
        safeError,
        hasLastBackup,
        hasIndexedFile,
        isUnavailable,
        restoreReady,
    })

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
                ? 'Fix backup status and refresh files before restoring.'
                : hasLastBackup
                    ? 'Refresh restore files so the indexed backup file can be selected.'
                    : 'Run backup now to create the first restore point.',
        retention: backup.retention || 'Not reported',
        storageTarget: backup.storageTarget || backup.totalStorage || 'Not reported',
        latestFile: backup.latestFile || 'Not reported',
        latestSize: backup.latestSize || backup.dbSize || 'Not reported',
        duration: backup.latestDuration || 'Not reported',
        healthCheck: safeError ? 'Unavailable' : backup.healthCheck || (hasLastBackup ? 'Verified' : 'No restore point yet'),
        restoreProof,
    }
}

function buildRestoreProof(input: {
    backup: BackupService
    safeError?: string
    hasLastBackup: boolean
    hasIndexedFile: boolean
    isUnavailable: boolean
    restoreReady: boolean
}): BackupRestoreProof {
    const storageTarget = input.backup.storageTarget || input.backup.totalStorage || ''
    const blockers = [
        input.safeError,
        input.hasLastBackup ? '' : 'No completed backup timestamp is reported.',
        input.hasIndexedFile ? '' : 'No indexed backup file is reported.',
        storageTarget ? '' : 'No backup storage target is reported.',
    ].filter((item): item is string => Boolean(item))

    return {
        schemaVersion: 'hanasand.backup.restore_readiness.v1',
        state: input.restoreReady ? 'ready' : 'needs_action',
        blockers,
        checks: [
            {
                id: 'status',
                label: 'Backup status',
                value: input.safeError ? 'Unavailable' : input.backup.status || 'Not reported',
                state: input.isUnavailable ? 'needs_action' : 'ready',
            },
            {
                id: 'last_backup',
                label: 'Completed backup',
                value: input.backup.lastBackup || 'Not reported',
                state: input.hasLastBackup ? 'ready' : 'needs_action',
            },
            {
                id: 'indexed_file',
                label: 'Indexed file',
                value: input.backup.latestFile || 'Not reported',
                state: input.hasIndexedFile ? 'ready' : 'needs_action',
            },
            {
                id: 'storage',
                label: 'Storage target',
                value: storageTarget || 'Not reported',
                state: storageTarget ? 'ready' : 'unknown',
            },
        ],
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
        return 'Enable DB_RESTORE_ENABLED=true after reviewing the selected backup file, then run restore.'
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
