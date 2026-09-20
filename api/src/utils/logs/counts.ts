// Sum complete days, hours and minutes; inspect only the partial boundary minute.
// Every bucket is maintained in the same transaction as its source records.
export function rollupLogCountsSql(where: string[], timeWhere: string) {
    const filters = where.filter(clause => clause !== timeWhere)
    if (filters.some(clause => /\bevent_timestamp\b|\bnormalized\b|\buser_id\b/.test(clause))) return null
    if (!timeWhere.startsWith('event_timestamp >= ')) return null
    const cutoff = timeWhere.slice('event_timestamp >= '.length)
    const minute = `(date_trunc('minute', ${cutoff}, 'UTC') + INTERVAL '1 minute')`
    const hour = `(date_trunc('hour', ${cutoff}, 'UTC') + INTERVAL '1 hour')`
    const day = `(date_trunc('day', ${cutoff}, 'UTC') + INTERVAL '24 hours')`
    const filter = filters.length ? ' AND ' + filters.join(' AND ') : ''
    return `SELECT severity, service, SUM(count)::int AS count FROM (
        SELECT severity,service,event_count AS count FROM mill_log_counts mill_events
            WHERE bucket_seconds = 86400 AND bucket >= ${day}${filter}
        UNION ALL
        SELECT severity,service,event_count AS count FROM mill_log_counts mill_events
            WHERE bucket_seconds = 3600 AND bucket >= ${hour} AND bucket < ${day}${filter}
        UNION ALL
        SELECT severity,service,event_count AS count FROM mill_log_counts mill_events
            WHERE bucket_seconds = 60 AND bucket >= ${minute} AND bucket < ${hour}${filter}
        UNION ALL
        SELECT severity,service,COUNT(*)::bigint AS count FROM mill_log_dimensions mill_events
            WHERE ${timeWhere} AND event_timestamp < ${minute}${filter} GROUP BY 1, 2
    ) counts GROUP BY 1, 2 HAVING SUM(count) <> 0`
}
