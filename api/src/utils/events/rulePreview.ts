import run from '#db'
import { eligibleCustomDrop } from './dropEligibility.ts'
import { Worker } from 'node:worker_threads'
import { matchesRule, type Condition } from './conditions.ts'
import { previewPredicate } from './previewPredicate.ts'
import { loadLogRetentionRules, retentionStoreMatches } from './customRetention.ts'
import { cachedRead } from '../readCache.ts'

export type PreviewEvent = { id: string, timestamp: string, normalized: Record<string, unknown>, rank: number, bytes?: number }
type Cursor = { time: string, id: string }
export type PreviewRequest = { from: string | null, until: string, cursor?: Cursor | null, action: 'drop' | 'keep', sample?: boolean, conditions: Condition[] }

// Page database-filtered candidates, then retain the authoritative runtime check.
export async function scanRulePreview(organizationId: string, canReadLogs: boolean, input: PreviewRequest, query = run) {
    if (process.env.NODE_ENV !== 'test' && (query as typeof run & { primaryDatabaseRunner?: boolean }).primaryDatabaseRunner && input.sample) {
        const key = `rule-preview:${organizationId}:${canReadLogs ? 'logs' : 'public'}:${JSON.stringify(input)}`
        return cachedRead(key, 5000, () => scanRulePreviewUncached(organizationId, canReadLogs, input, query), { lane: 'preview' })
    }
    return scanRulePreviewUncached(organizationId, canReadLogs, input, query)
}

async function scanRulePreviewUncached(organizationId: string, canReadLogs: boolean, input: PreviewRequest, query = run) {
    const params: (string | boolean | string[])[] = [organizationId, canReadLogs, input.until]
    const fromParameter = input.from ? `$${params.push(input.from)}` : null
    const cursorTimeParameter = input.cursor ? `$${params.push(input.cursor.time)}` : null
    const cursorIdParameter = input.cursor ? `$${params.push(input.cursor.id)}` : null
    const filter = previewPredicate(input.conditions, params)
    const scope = [
        'organization_id=$1',
        '($2::boolean OR ingestion_id <> \'logs\')',
        'event_timestamp <= $3::timestamptz',
        'received_at <= $3::timestamptz',
        ...(fromParameter ? [`event_timestamp >= ${fromParameter}::timestamptz`] : []),
        ...(cursorTimeParameter && cursorIdParameter ? [`(event_timestamp,id) < (${cursorTimeParameter}::timestamptz,${cursorIdParameter}::text)`] : []),
        filter,
    ].join(' AND ')
    const rules = input.action === 'drop' ? await loadLogRetentionRules(organizationId, query) : []
    const result = await query(`SELECT id, event_timestamp::text AS timestamp, normalized, pg_column_size(events)::bigint AS bytes${input.action === 'drop' ? ', original' : ''}
        FROM events WHERE ${scope} ${input.action === 'drop' ? 'AND normalized->>\'severity\' = \'low\'' : ''}
        ORDER BY event_timestamp DESC, id DESC LIMIT 2000`, params)
    const eligible = result.rows.filter(row => input.action !== 'drop' || eligibleCustomDrop(row.normalized || {})
        && !retentionStoreMatches(row.normalized || {}, rules) && !retentionStoreMatches(row.original || {}, rules)) as PreviewEvent[]
    const matches = input.conditions.some(condition => condition.operator === 'regex')
        ? (await matchRegexPage(eligible, input.conditions)).map(index => eligible[index])
        : eligible.filter(row => matchesRule(row.normalized, input.conditions))
    const bytes = matches.reduce((total, row) => total + Number(row.bytes || 0), 0)
    const events = matches.map(row => ({ id: row.id, timestamp: row.timestamp, rank: Math.random(), normalized: Object.fromEntries(Object.entries(row.normalized)
        .filter(([key]) => ['event_type', 'severity', 'service', 'host', 'action', 'outcome', 'http', 'source', 'user', 'device', 'message'].includes(key) || input.conditions.some(condition => condition.path.split('.')[0] === key))
        .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 500) : value])) }))
    if (input.sample) events.sort((a, b) => a.rank - b.rank)
    const last = result.rows.at(-1)
    return { scanned: result.rows.length, count: matches.length, bytes, events: input.sample ? events.slice(0, 100) : events, cursor: result.rows.length === 2000 && last ? { time: last.timestamp, id: last.id } : null }
}

export async function estimateStoredRuleEvents(organizationId: string, ruleId: string, version: string, conditions: Condition[], query = run) {
    const claimed = await query(`INSERT INTO rule_storage_estimates(organization_id,rule_id,rule_version,scanned_date)
        VALUES($1,$2,$3,(NOW() AT TIME ZONE 'UTC')::date)
        ON CONFLICT(organization_id,rule_id,rule_version) DO UPDATE
        SET scanned_date=(NOW() AT TIME ZONE 'UTC')::date,scan_started_at=NOW()
        WHERE rule_storage_estimates.scanned_date < (NOW() AT TIME ZONE 'UTC')::date
        RETURNING event_count::text,estimated_bytes::text,scanned_date::text,generated_at,true AS claimed`, [organizationId, ruleId, version])
    const row = claimed.rows[0] || (await query(`SELECT event_count::text,estimated_bytes::text,scanned_date::text,generated_at,false AS claimed
        FROM rule_storage_estimates WHERE organization_id=$1 AND rule_id=$2 AND rule_version=$3`, [organizationId, ruleId, version])).rows[0]
    if (!row) return null
    const previous = row.generated_at ? { count: Number(row.event_count), bytes: Number(row.estimated_bytes), checkedDate: row.scanned_date, generatedAt: new Date(row.generated_at).toISOString() } : null
    if (!row.claimed) return previous

    try {
        const estimate = await cachedRead(`rule-storage-estimate-scan:${organizationId}:${ruleId}:${version}:${row.scanned_date}`, 24 * 60 * 60_000, async () => {
            let cursor: Cursor | null = null
            let count = 0
            let bytes = 0
            const until = new Date().toISOString()
            do {
                const page = await scanRulePreview(organizationId, true, { from: null, until, cursor, action: 'drop', conditions }, query)
                count += page.count
                bytes += page.bytes
                cursor = page.cursor
            } while (cursor)
            return { count, bytes, generatedAt: until }
        }, { lane: 'preview' })
        await query(`UPDATE rule_storage_estimates SET event_count=$4,estimated_bytes=$5,generated_at=NOW()
            WHERE organization_id=$1 AND rule_id=$2 AND rule_version=$3 AND scanned_date=$6::date`,
        [organizationId, ruleId, version, estimate.count, estimate.bytes, row.scanned_date])
        return { ...estimate, checkedDate: row.scanned_date }
    } catch (error) {
        if (previous) return previous
        throw error
    }
}

export function validPreviewWindow(input: Record<string, unknown>): input is Record<string, unknown> & PreviewRequest {
    const validTime = (value: unknown) => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value))
    if (!validTime(input.until) || Date.parse(input.until as string) > Date.now() + 60_000 || (input.from !== null && !validTime(input.from))) return false
    if (input.from && Date.parse(input.from as string) > Date.parse(input.until as string)) return false
    if (input.action !== 'drop' && input.action !== 'keep') return false
    if (input.cursor != null) {
        const cursor = input.cursor as Cursor
        if (!validTime(cursor.time) || typeof cursor.id !== 'string' || !cursor.id || cursor.id.length > 200 || Date.parse(cursor.time) > Date.parse(input.until as string)) return false
    }
    return true
}

export class PreviewRegexTimeout extends Error {
    constructor() { super('This regular expression takes too long to preview. Narrow the expression and try again.') }
}
function matchRegexPage(events: PreviewEvent[], conditions: Condition[]): Promise<number[]> {
    return new Promise((resolve, reject) => {
        // A user-supplied regex must not stall the API's event loop.
        const worker = new Worker(new URL('./rulePreviewWorker.ts', import.meta.url), { workerData: { events: events.map(event => event.normalized), conditions } })
        const timer = setTimeout(() => { void worker.terminate(); reject(new PreviewRegexTimeout()) }, 1500)
        worker.once('message', (indices: number[]) => { clearTimeout(timer); void worker.terminate(); resolve(indices) })
        worker.once('error', error => { clearTimeout(timer); reject(error) })
        worker.once('exit', code => { clearTimeout(timer); if (code !== 0) reject(new Error('Expression preview stopped. Try again.')) })
    })
}

export async function matchRulePage(events: Record<string, unknown>[], conditions: Condition[]): Promise<number[]> {
    if (!conditions.length) return []
    if (conditions.some(condition => condition.operator === 'regex'))
        return matchRegexPage(events.map((normalized, index) => ({ id: String(index), timestamp: '', normalized, rank: 0 })), conditions)
    return events.flatMap((event, index) => matchesRule(event, conditions) ? [index] : [])
}
