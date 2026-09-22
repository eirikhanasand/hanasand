import { withTransaction } from '#db'

// Live and catch-up passes may read concurrently, but detection/correlation
// writes remain serialized in short pages, including across worker replicas.
export function withLogBatch<T>(work: () => Promise<T>, transaction = withTransaction) {
    return transaction(async query => {
        await query('SELECT pg_advisory_xact_lock(hashtextextended(\'mill:log-batch\', 0))')
        return work()
    })
}
