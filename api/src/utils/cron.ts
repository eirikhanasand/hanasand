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

export default function cron() {
    schedule('* * * * *', async() => {
        try {
            const jobs = [
                runTrackedBackgroundJob('api-auth-token-cleanup', invalidateOldTokens),
                runTrackedBackgroundJob('api-login-attempt-cleanup', invalidateOldAttempts),
                runTrackedBackgroundJob('api-deleted-account-purge', purgeDeletedAccounts),
                runTrackedBackgroundJob('api-synthetic-monitor', runSyntheticMonitor),
                runTrackedBackgroundJob('api-production-log-monitor', runProductionLogMonitors),
                runTrackedBackgroundJob('api-vm-ensure-running', ensureAlwaysRunningVms),
                runTrackedBackgroundJob(VULNERABILITY_SCAN_JOB_ID, runDueVulnerabilityScan),
                runTrackedBackgroundJob('api-agent-automations', runDueAutomations),
                runTrackedBackgroundJob('api-ti-profile-cache-warm', () => warmThreatActorProfileCache()).catch(error => {
                    recordThreatActorProfileWarmFailure(error)
                    throw error
                }),
                runTrackedBackgroundJob('api-ti-autonomous-pipeline', () => runDueThreatIntelPipeline()).catch(error => {
                    console.error('Failed to run autonomous threat intelligence pipeline', error)
                    throw error
                }),
            ]

            if (mailConfig.adminPassword) {
                jobs.push(runTrackedBackgroundJob('api-mail-account-provisioning', provisionExistingMailAccounts))
            }

            await Promise.all(jobs)
        } catch (error) {
            console.error('Failed to run cleanup cron', error)
        }
    })
}
