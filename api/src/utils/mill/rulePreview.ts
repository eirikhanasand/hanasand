import run from '#db'
import { eligibleCustomDrop } from './dropEligibility.ts'
import { Worker } from 'node:worker_threads'
import { matchesMillRule, type MillCondition } from './conditions.ts'
import { loadLogRetentionRules, retentionStoreMatches } from './customRetention.ts'

export type PreviewEvent = { id: string, timestamp: string, normalized: Record<string, unknown>, rank: number }
type Cursor = { time: string, id: string }
export type PreviewRequest = { from: string | null, until: string, cursor?: Cursor | null, action: 'drop' | 'keep', sample?: boolean, conditions: MillCondition[] }

// Scan in bounded indexed pages: use the actual rule engine, including JavaScript
// regex semantics. A count is complete only after the last page of the snapshot.
export async function scanRulePreview(organizationId: string, canReadLogs: boolean, input: PreviewRequest, query = run) {
    const scope = `organization_id=$1 AND ($2::boolean OR ingestion_id <> 'logs')
        AND event_timestamp <= $3::timestamptz AND received_at <= $3::timestamptz
        AND ($4::timestamptz IS NULL OR event_timestamp >= $4::timestamptz)
        AND ($5::timestamptz IS NULL OR (event_timestamp,id) < ($5::timestamptz,$6::text))`
    const rules = input.action === 'drop' ? await loadLogRetentionRules(organizationId, query) : []
    const result = await query(`SELECT id, event_timestamp::text AS timestamp, normalized${input.action === 'drop' ? ', original' : ''}
        FROM mill_events WHERE ${scope}
        ORDER BY event_timestamp DESC, id DESC LIMIT 2000`, [organizationId, canReadLogs, input.until, input.from, input.cursor?.time || null, input.cursor?.id || ''])
    const eligible = result.rows.filter(row => input.action !== 'drop' || eligibleCustomDrop(row.normalized || {})
        && !retentionStoreMatches(row.normalized || {}, rules) && !retentionStoreMatches(row.original || {}, rules)) as PreviewEvent[]
    const matches = input.conditions.some(condition => condition.operator === 'regex')
        ? (await matchRegexPage(eligible, input.conditions)).map(index => eligible[index])
        : eligible.filter(row => matchesMillRule(row.normalized, input.conditions))
    const events = matches.map(row => ({ id: row.id, timestamp: row.timestamp, rank: Math.random(), normalized: Object.fromEntries(Object.entries(row.normalized)
        .filter(([key]) => ['event_type', 'severity', 'service', 'host', 'action', 'outcome', 'http', 'source', 'user', 'device', 'message'].includes(key) || input.conditions.some(condition => condition.path.split('.')[0] === key))
        .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 500) : value])) }))
    if (input.sample) events.sort((a, b) => a.rank - b.rank)
    const last = result.rows.at(-1)
    return { scanned: result.rows.length, count: matches.length, events: input.sample ? events.slice(0, 100) : events, cursor: result.rows.length === 2000 && last ? { time: last.timestamp, id: last.id } : null }
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
function matchRegexPage(events: PreviewEvent[], conditions: MillCondition[]): Promise<number[]> {
    return new Promise((resolve, reject) => {
        // A user-supplied regex must not stall the API's event loop.
        const worker = new Worker(new URL('./rulePreviewWorker.ts', import.meta.url), { workerData: { events: events.map(event => event.normalized), conditions } })
        const timer = setTimeout(() => { void worker.terminate(); reject(new PreviewRegexTimeout()) }, 1500)
        worker.once('message', (indices: number[]) => { clearTimeout(timer); void worker.terminate(); resolve(indices) })
        worker.once('error', error => { clearTimeout(timer); reject(error) })
        worker.once('exit', code => { clearTimeout(timer); if (code !== 0) reject(new Error('Expression preview stopped. Try again.')) })
    })
}

export async function matchRulePage(events: Record<string, unknown>[], conditions: MillCondition[]): Promise<number[]> {
    if (!conditions.length) return []
    if (conditions.some(condition => condition.operator === 'regex'))
        return matchRegexPage(events.map((normalized, index) => ({ id: String(index), timestamp: '', normalized, rank: 0 })), conditions)
    return events.flatMap((event, index) => matchesMillRule(event, conditions) ? [index] : [])
}
