import { schedule } from 'node-cron'
import invalidateOldTokens from './auth/invalidateOldTokens.ts'
import invalidateOldAttempts from './auth/invalidateOldAttempts.ts'
import runSyntheticMonitor from './status/monitor.ts'
import { provisionExistingMailAccounts } from './mail/accounts.ts'

export default function cron() {
    schedule('* * * * *', async() => {
        try {
            await Promise.all([
                invalidateOldTokens(),
                invalidateOldAttempts(),
                runSyntheticMonitor(),
                provisionExistingMailAccounts(),
            ])
        } catch (error) {
            console.error('Failed to run cleanup cron', error)
        }
    })
}
