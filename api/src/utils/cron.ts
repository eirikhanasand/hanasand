import { schedule } from 'node-cron'
import invalidateOldTokens from './auth/invalidateOldTokens.ts'
import invalidateOldAttempts from './auth/invalidateOldAttempts.ts'
import runSyntheticMonitor from './status/monitor.ts'
import { provisionExistingMailAccounts } from './mail/accounts.ts'
import { mailConfig } from './mail/config.ts'
import purgeDeletedAccounts from './auth/purgeDeletedAccounts.ts'
import ensureAlwaysRunningVms from './vms/ensureAlwaysRunning.ts'
import { runDueAutomations } from './automations.ts'
import runProductionLogMonitors from './status/logMonitors.ts'
import { runTrackedBackgroundJob } from './backgroundJobRuntime.ts'
import { runDueVulnerabilityScan, VULNERABILITY_SCAN_JOB_ID } from './vulnerabilities/scanner.ts'
import { DATABASE_BACKUP_JOB_ID, runDueDatabaseBackup } from './db/backups.ts'
import run, { queryOnce } from '#db'
import { ORGANIZATION_RETENTION_JOB_ID, runOrganizationRetentionWorker } from './organizationPrivacy.ts'

const apiCronRunners: Record<string, () => Promise<unknown> | unknown> = {
    'api-auth-token-cleanup': invalidateOldTokens,
    'api-login-attempt-cleanup': invalidateOldAttempts,
    'api-deleted-account-purge': purgeDeletedAccounts,
    'api-synthetic-monitor': runSyntheticMonitor,
    'api-production-log-monitor': runProductionLogMonitors,
    'api-vm-ensure-running': ensureAlwaysRunningVms,
    [VULNERABILITY_SCAN_JOB_ID]: runDueVulnerabilityScan,
    [DATABASE_BACKUP_JOB_ID]: runDueDatabaseBackup,
    'api-agent-automations': runDueAutomations,
    'api-mail-account-provisioning': provisionExistingMailAccounts,
    [ORGANIZATION_RETENTION_JOB_ID]: async() => {
        const result = await runOrganizationRetentionWorker()
        if ('failed' in result && result.failed) throw new Error(result.error || `Organization retention run ${result.runId} failed and was queued for retry.`)
        return result
    },
}

export function canRunApiCronJobNow(id: string) {
    return Boolean(apiCronRunners[id]) && (id !== 'api-mail-account-provisioning' || Boolean(mailConfig.adminPassword))
}

export function runApiCronJobNow(id: string) {
    if (!canRunApiCronJobNow(id)) {
        throw new Error('API cron job does not expose a safe manual runner.')
    }
    return runTrackedBackgroundJob(id, apiCronRunners[id])
}

export async function isApiCronJobPaused(id: string) {
    if (!canRunApiCronJobNow(id)) return false
    try {
        const result = await queryOnce('SELECT status FROM scheduled_job_controls WHERE id = $1', [id])
        return result.rows[0]?.status === 'paused'
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === '42P01') return false
        if (isDatabaseUnavailable(error)) return false
        throw error
    }
}

export async function setApiCronJobPaused(id: string, paused: boolean) {
    if (!canRunApiCronJobNow(id)) {
        throw new Error('API cron job does not expose safe pause/resume controls.')
    }
    await run(`
        INSERT INTO scheduled_job_controls (id, status, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (id)
        DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
    `, [id, paused ? 'paused' : 'enabled'])
}

async function runDueApiCronJob(id: string) {
    if (id === DATABASE_BACKUP_JOB_ID) return runApiCronJobNow(id)
    if (await isApiCronJobPaused(id)) return undefined
    return runApiCronJobNow(id)
}

function isDatabaseUnavailable(error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    return ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT'].includes(code)
}

export default function cron() {
    schedule('* * * * *', async() => {
        try {
            const jobs = [
                runDueApiCronJob('api-auth-token-cleanup'),
                runDueApiCronJob('api-login-attempt-cleanup'),
                runDueApiCronJob('api-deleted-account-purge'),
                runDueApiCronJob('api-synthetic-monitor'),
                runDueApiCronJob('api-production-log-monitor'),
                runDueApiCronJob('api-vm-ensure-running'),
                runDueApiCronJob(VULNERABILITY_SCAN_JOB_ID),
                runDueApiCronJob(DATABASE_BACKUP_JOB_ID),
                runDueApiCronJob('api-agent-automations'),
                runDueApiCronJob(ORGANIZATION_RETENTION_JOB_ID),
            ]

            if (mailConfig.adminPassword) {
                jobs.push(runDueApiCronJob('api-mail-account-provisioning'))
            }

            await Promise.all(jobs)
        } catch (error) {
            console.error('Failed to run cleanup cron', error)
        }
    })
}
