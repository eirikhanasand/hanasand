import { schedule } from 'node-cron'
import invalidateOldTokens from './auth/invalidateOldTokens.ts'
import invalidateOldAttempts from './auth/invalidateOldAttempts.ts'

export default function cron() {
    schedule('* * * * *', async() => {
        invalidateOldTokens()
        invalidateOldAttempts()
    })
}
