import { withTransaction } from '#db'

export type LogSource = 'service_logs' | 'login_events' | 'traffic_events' | 'system_events'

// Sequence IDs can be allocated before another transaction commits. Reading MAX
// under a brief writer barrier ensures advancing a cursor cannot skip a lower ID
// that is still uncommitted. Never hold this table lock while evaluating events.
export async function stableLogWatermark(source: LogSource): Promise<string | null> {
    try {
        return await withTransaction(async query => {
            await query(`LOCK TABLE ${source} IN SHARE MODE NOWAIT`)
            const result = await query(`SELECT COALESCE(MAX(id), 0)::text AS last_id FROM ${source}`)
            return String(result.rows[0].last_id)
        })
    } catch (error) {
        if ((error as { code?: string }).code === '55P03') return null
        throw error
    }
}
