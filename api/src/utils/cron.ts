import { schedule } from 'node-cron'
import invalidateOldTokens from './auth/invalidateOldTokens.ts'
import invalidateOldAttempts from './auth/invalidateOldAttempts.ts'

export default function cron() {
    schedule('* * * * *', async() => {
        try {
            await Promise.all([
                invalidateOldTokens(),
                invalidateOldAttempts(),
            ])
        } catch (error) {
            console.error('Failed to run cleanup cron', error)
        }
    })
}
