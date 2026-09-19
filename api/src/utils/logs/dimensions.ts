import { withTransaction } from '#db'

// New writes are projected by database triggers. This cursor only fills legacy
// rows; source locks prevent concurrent changes/deletion racing the copied fields.
export async function backfillLogDimensions(limit = 5000) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 10000) throw new Error('Projection batch must contain 1–10000 events.')
    try { return await withTransaction(async query => {
        const state = (await query('SELECT last_event_id, ready FROM mill_log_dimensions_state WHERE id = TRUE FOR UPDATE SKIP LOCKED')).rows[0]
        if (!state || state.ready) return { processed: 0, ready: Boolean(state?.ready) }
        const batch = await query(`SELECT id, organization_id, event_timestamp::text AS event_timestamp, ingestion_id, processing_status,
            normalized->>'severity' AS severity, normalized->>'service' AS service, normalized->>'log_type' AS log_type
            FROM mill_events WHERE id > $1 ORDER BY id LIMIT $2 FOR SHARE`, [state.last_event_id, limit])
        await query(`INSERT INTO mill_log_dimensions (event_id, organization_id, event_timestamp, severity, service, log_type)
            SELECT id, organization_id, event_timestamp, severity, service, log_type
            FROM jsonb_to_recordset($1::jsonb) AS e(id text, organization_id text, event_timestamp timestamptz,
                ingestion_id text, processing_status text, severity text, service text, log_type text)
            WHERE ingestion_id = 'logs' AND processing_status = 'processed'
            ON CONFLICT (event_id) DO UPDATE SET organization_id = EXCLUDED.organization_id,
                event_timestamp = EXCLUDED.event_timestamp, severity = EXCLUDED.severity,
                service = EXCLUDED.service, log_type = EXCLUDED.log_type`, [JSON.stringify(batch.rows)])
        const ready = batch.rows.length < limit
        if (ready) await query('ANALYZE mill_log_dimensions')
        await query('UPDATE mill_log_dimensions_state SET last_event_id = $1, ready = $2, last_error = NULL WHERE id = TRUE', [batch.rows.at(-1)?.id || state.last_event_id, ready])
        return { processed: batch.rows.length, ready }
    }) } catch (error) {
        await withTransaction(query => query('UPDATE mill_log_dimensions_state SET last_error = $1 WHERE id = TRUE',
            [(error instanceof Error ? error.message : 'Counter backfill failed').slice(0, 500)])).catch(() => {})
        throw error
    }
}

// These are compiler-generated SQL fragments; all user values remain parameters.
// Queries needing JSON or user identity retain the exact original-table fallback.
export function dimensionLogWhere(where: string[]) {
    const translated = where.filter(clause => !['ingestion_id = \'logs\'', 'processing_status = \'processed\''].includes(clause))
        .map(clause => clause.replaceAll('normalized->>\'severity\'', 'severity')
            .replaceAll('normalized->>\'service\'', 'service').replaceAll('normalized->>\'log_type\'', 'log_type'))
    return translated.some(clause => /\bnormalized\b|\buser_id\b/.test(clause)) ? null : translated
}

export function foldLogCounts(groups: Array<{ severity: string | null, service: string | null, count: number }>) {
    const counts = new Map<string | null, number>(), services = new Map<string | null, number>()
    for (const row of groups) {
        counts.set(row.severity, (counts.get(row.severity) || 0) + row.count)
        services.set(row.service, (services.get(row.service) || 0) + row.count)
    }
    return {
        counts: [...counts].map(([severity, count]) => ({ severity, count })),
        services: [...services].map(([service, count]) => ({ service, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    }
}
