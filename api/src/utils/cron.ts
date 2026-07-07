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
import { recordThreatActorProfileWarmFailure, warmThreatActorProfileCache } from './ti/search.ts'
import { runDueThreatIntelPipeline } from './ti/autonomousPipeline.ts'
import { runTrackedBackgroundJob } from './backgroundJobRuntime.ts'
import { runDueVulnerabilityScan, VULNERABILITY_SCAN_JOB_ID } from './vulnerabilities/scanner.ts'
import run, { queryOnce } from '#db'

const apiCronRunners: Record<string, () => Promise<unknown> | unknown> = {
    'api-auth-token-cleanup': invalidateOldTokens,
    'api-login-attempt-cleanup': invalidateOldAttempts,
    'api-deleted-account-purge': purgeDeletedAccounts,
    'api-synthetic-monitor': runSyntheticMonitor,
    'api-production-log-monitor': runProductionLogMonitors,
    'api-vm-ensure-running': ensureAlwaysRunningVms,
    [VULNERABILITY_SCAN_JOB_ID]: runDueVulnerabilityScan,
    'api-agent-automations': runDueAutomations,
    'api-mail-account-provisioning': provisionExistingMailAccounts,
    'api-ti-profile-cache-warm': async() => {
        try {
            return await warmThreatActorProfileCache()
        } catch (error) {
            recordThreatActorProfileWarmFailure(error)
            throw error
        }
    },
    'api-ti-autonomous-pipeline': async() => {
        try {
            return await runDueThreatIntelPipeline()
        } catch (error) {
            console.error('Failed to run autonomous threat intelligence pipeline', error)
            throw error
        }
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
                runDueApiCronJob('api-agent-automations'),
                runDueApiCronJob('api-ti-profile-cache-warm'),
                runDueApiCronJob('api-ti-autonomous-pipeline'),
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
