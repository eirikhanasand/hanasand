import { schedule } from 'node-cron'
import invalidateOldTokens from './invalidateOldTokens.ts'
import invalidateOldAttempts from './invalidateOldAttempts.ts'

export default function cron() {
    schedule('* * * * *', async() => {
        invalidateOldTokens()
        invalidateOldAttempts()
    })
}
