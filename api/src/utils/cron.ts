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
