import type run from '#db'
import { createHash } from 'node:crypto'

// Call inside the replay transaction, after locking source rows and while holding
// both ingestion worker locks. Canonical evidence must survive with its projection.
export async function canonicalReplayKeys(keys: string[], query: typeof run): Promise<Set<string>> {
    if (!keys.length) return new Set()
    const ids = new Map(keys.map(key => [/^[a-f0-9]{64}$/.test(key) ? key : createHash('sha256').update(key).digest('hex'), key]))
    const rows = (await query(`SELECT canonical_event_id AS id FROM log_proxy_receipts
        WHERE canonical_event_id=ANY($1::text[])
        UNION SELECT canonical_event_id AS id FROM log_ingestion_canonical
        WHERE canonical_event_id=ANY($1::text[])`, [[...ids.keys()]])).rows
    return new Set(rows.map(row => ids.get(String(row.id))).filter((key): key is string => Boolean(key)))
}
