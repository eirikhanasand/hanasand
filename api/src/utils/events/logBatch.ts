import { withTransaction } from '#db'

// Serialize pages that depend on shared event-time state. Independent process
// pages can run outside this lock because log and finding writes are idempotent.
export function withLogBatch<T>(work: () => Promise<T>, transaction = withTransaction) {
    return transaction(async query => {
        await query('SELECT pg_advisory_xact_lock(hashtextextended(\'event:log-batch\', 0))')
        return work()
    })
}
