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

export default function cron() {
    schedule('* * * * *', async() => {
        try {
            const jobs = [
                invalidateOldTokens(),
                invalidateOldAttempts(),
                purgeDeletedAccounts(),
                runSyntheticMonitor(),
                runProductionLogMonitors(),
                ensureAlwaysRunningVms(),
                runDueAutomations(),
                warmThreatActorProfileCache().catch(error => {
                    recordThreatActorProfileWarmFailure(error)
                    throw error
                }),
                runDueThreatIntelPipeline().catch(error => {
                    console.error('Failed to run autonomous threat intelligence pipeline', error)
                    throw error
                }),
            ]

            if (mailConfig.adminPassword) {
                jobs.push(provisionExistingMailAccounts())
            }

            await Promise.all(jobs)
        } catch (error) {
            console.error('Failed to run cleanup cron', error)
        }
    })
}
