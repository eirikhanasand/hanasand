import config from '#constants'
import { withTransaction } from '#db'

// Searches can scan millions of events. Do not let them occupy every connection
// needed by authentication, rule reads and ingestion. Reject excess work before
// checking out a connection instead of adding another unbounded waiting queue.
export const logSearchCapacity = Math.max(1, Math.min(4, Math.floor((Number(config.DB_MAX_CONN) || 20) / 4)))
let active = 0

export async function withLogSearchTransaction<T>(work: Parameters<typeof withTransaction<T>>[0]): Promise<T> {
    if (active >= logSearchCapacity) {
        throw Object.assign(new Error('Log searches are busy. Please retry shortly.'), { statusCode: 503, code: 'LOG_SEARCH_BUSY' })
    }
    active++
    try {
        return await withTransaction(work)
    } finally {
        active--
    }
}
