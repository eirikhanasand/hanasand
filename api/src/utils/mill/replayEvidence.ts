import type run from '#db'

// Call inside the replay transaction, after locking source rows and while holding
// both ingestion worker locks. Canonical evidence must survive with its projection.
export async function canonicalReplayKeys(keys: string[], query: typeof run): Promise<Set<string>> {
    if (!keys.length) return new Set()
    const ids = keys.filter(key => /^service:\d+$/.test(key)).map(key => key.slice(8))
    const rows = (await query(`SELECT 'service:' || service_log_id::text AS key FROM log_proxy_requests
        WHERE service_log_id=ANY($1::bigint[])
        UNION SELECT canonical_log_key AS key FROM log_ingestion_canonical
        WHERE canonical_log_key=ANY($2::text[])`, [ids, keys])).rows
    return new Set(rows.map(row => row.key))
}
