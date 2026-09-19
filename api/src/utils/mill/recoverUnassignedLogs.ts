import run from '#db'
import type { LogInput } from './logEvent.ts'
import { storedSourceLog } from './storedSources.ts'

// Revisit old exclusion markers using the original retained log, not the
// sanitized marker. Finding keys and processing status make retries idempotent.
export async function recoverUnassignedLogs(process: (logs: LogInput[]) => Promise<void>) {
    const markers = (await run(`SELECT log_key FROM mill_events
        WHERE ingestion_id='logs' AND processing_status='skipped'
          AND normalized->>'processing_reason'='Organization is missing or inactive'
        ORDER BY normalized->>'organization_retry_at' NULLS FIRST, id LIMIT 100`)).rows
    if (!markers.length) return
    for (const source of ['service_logs', 'login_events', 'traffic_events', 'system_events'] as const) {
        const prefix = source === 'service_logs' ? 'service:' : `service:${source}:`
        const ids = markers.map(row => String(row.log_key).slice(prefix.length)).filter((id, index) => String(markers[index].log_key).startsWith(prefix) && /^\d+$/.test(id))
        if (!ids.length) continue
        const rows = (await run(`SELECT * FROM ${source} WHERE id = ANY($1::bigint[])`, [ids])).rows
        const logs: LogInput[] = source === 'service_logs' ? rows : rows.map(row => storedSourceLog(source, row))
        await process(logs)
    }
    await run(`UPDATE mill_events SET normalized=normalized || jsonb_build_object('organization_retry_at', clock_timestamp())
        WHERE log_key=ANY($1::text[]) AND processing_status='skipped'`, [markers.map(row => row.log_key)])
}
