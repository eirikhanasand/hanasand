import run from '#db'
import { eligibleCustomDrop } from './dropEligibility.ts'
import { Worker } from 'node:worker_threads'
import { matchesRule, type Condition } from './conditions.ts'
import { loadLogRetentionRules, retentionStoreMatches, type RetentionRule } from './customRetention.ts'
import { cachedRead, ReadAdmissionError } from '../readCache.ts'
import { finiteRegexAlternatives, previewPredicate } from './previewPredicate.ts'
import { logFieldTextCandidates } from '../logs/searchText.ts'

export type PreviewEvent = { id: string, timestamp: string, normalized: Record<string, unknown>, rank: number, bytes?: number }
type Cursor = { time: string, id: string }
export type PreviewRequest = { from: string | null, until: string, cursor?: Cursor | null, action: 'drop' | 'keep', sample?: boolean, limit?: 1000 | 2000, conditions: Condition[] }

// Page recent candidates first, then retain the authoritative runtime check.
type ScanOptions = { storedLogsOnly?: boolean, retentionRules?: RetentionRule[] }

export async function scanRulePreview(organizationId: string, canReadLogs: boolean, input: PreviewRequest, query = run, options: ScanOptions = {}) {
    if (process.env.NODE_ENV !== 'test' && (query as typeof run & { primaryDatabaseRunner?: boolean }).primaryDatabaseRunner && input.sample) {
        const key = `rule-preview:${organizationId}:${canReadLogs ? 'logs' : 'public'}:${JSON.stringify(input)}`
        return cachedRead(key, 5000, () => scanRulePreviewUncached(organizationId, canReadLogs, input, query, options), { lane: 'preview' })
    }
    return scanRulePreviewUncached(organizationId, canReadLogs, input, query, options)
}

async function scanRulePreviewUncached(organizationId: string, canReadLogs: boolean, input: PreviewRequest, query = run, options: ScanOptions = {}) {
    const params: (string | string[] | number | boolean | null)[] = [organizationId, input.until]
    const fromParameter = input.from ? `$${params.push(input.from)}` : null
    const cursorTimeParameter = input.cursor ? `$${params.push(input.cursor.time)}` : null
    const cursorIdParameter = input.cursor ? `$${params.push(input.cursor.id)}` : null
    const limitParameter = `$${params.push(input.limit || 2000)}`
    // Bound work by recent candidate rows before evaluating user-supplied conditions.
    // Applying dynamic predicates in SQL can scan an entire event range when matches are rare.
    const scope = [
        'organization_id=$1',
        ...(options.storedLogsOnly ? ['ingestion_id=\'logs\'', 'processing_status=\'processed\''] : []),
        ...(!canReadLogs ? ['ingestion_id <> \'logs\''] : []),
        'event_timestamp <= $2::timestamptz',
        'received_at <= $2::timestamptz',
        ...(fromParameter ? [`event_timestamp >= ${fromParameter}::timestamptz`] : []),
        ...(cursorTimeParameter && cursorIdParameter ? [`(event_timestamp,id) < (${cursorTimeParameter}::timestamptz,${cursorIdParameter}::text)`] : []),
    ]
    // Storage estimates only need likely matches from processed logs. Filter in
    // PostgreSQL before paging, then retain the JS matcher as the source of truth.
    const candidates = options.storedLogsOnly ? storageEstimatePredicate(input.conditions, params) : 'TRUE'
    const rules = input.action === 'drop' ? options.retentionRules ?? await loadLogRetentionRules(organizationId, query) : []
    const result = await query(`SELECT id, event_timestamp::text AS timestamp, normalized, pg_column_size(events)::bigint AS bytes${input.action === 'drop' ? ', original' : ''}
        FROM events WHERE ${scope.join(' AND ')}${input.action === 'drop' ? ' AND normalized->>\'severity\' = \'low\'' : ''} AND (${candidates})
        ORDER BY event_timestamp DESC, id DESC LIMIT ${limitParameter}`, params)
    const eligible = result.rows.filter(row => input.action !== 'drop' || eligibleCustomDrop(row.normalized || {})
        && !retentionStoreMatches(row.normalized || {}, rules) && !retentionStoreMatches(row.original || {}, rules)) as PreviewEvent[]
    const matchedIndices = input.conditions.some(condition => condition.operator === 'regex')
        ? await matchRulePage(eligible.map(row => row.normalized), input.conditions)
        : eligible.flatMap((row, index) => matchesRule(row.normalized, input.conditions) ? [index] : [])
    const matches = matchedIndices.map(index => eligible[index])
    const bytes = matches.reduce((total, row) => total + Number(row.bytes || 0), 0)
    const events = matches.map(row => ({ id: row.id, timestamp: row.timestamp, rank: Math.random(), normalized: Object.fromEntries(Object.entries(row.normalized)
        .filter(([key]) => ['event_type', 'severity', 'service', 'host', 'action', 'outcome', 'http', 'source', 'user', 'device', 'message'].includes(key) || input.conditions.some(condition => condition.path.split('.')[0] === key))
        .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 500) : value])) }))
    if (input.sample) events.sort((a, b) => a.rank - b.rank)
    const last = result.rows.at(-1)
    const pageLimit = input.limit || 2000
    return { scanned: result.rows.length, count: matches.length, bytes, events: input.sample ? events.slice(0, 100) : events, cursor: result.rows.length === pageLimit && last ? { time: last.timestamp, id: last.id } : null }
}

function storageEstimatePredicate(conditions: Condition[], params: (string | string[] | number | boolean | null)[]) {
    const predicates = [previewPredicate(conditions, params)]
    // The existing GIN index covers processed logs. One safe, selective literal
    // from this conjunction is enough to exclude non-candidates before paging.
    // The residual predicate and JS matcher still determine exact membership.
    const groups = conditions.flatMap(condition => {
        const values = condition.operator === 'regex' ? finiteRegexAlternatives(condition.value) : [condition.value]
        if (!values || values.some(value => value.length < 3 || !/^[\x20-\x7E]+$/.test(value)
            || (value.match(/[A-Za-z0-9]/g)?.length || 0) < 3)) return []
        return [{ values, shortest: Math.min(...values.map(value => value.length)) }]
    }).sort((left, right) => right.shortest - left.shortest || right.values.reduce((sum, value) => sum + value.length, 0)
        - left.values.reduce((sum, value) => sum + value.length, 0))
    if (groups[0]) {
        const alternatives = groups[0].values.map(value => {
            params.push(value)
            return logFieldTextCandidates(`$${params.length}`)
        })
        predicates.push(alternatives.length === 1 ? alternatives[0] : `(${alternatives.join(' OR ')})`)
    }
    return predicates.filter(predicate => predicate !== 'TRUE').map(predicate => `(${predicate})`).join(' AND ') || 'TRUE'
}

export async function getStoredRuleEstimate(organizationId: string, ruleId: string, version: string, query = run) {
    const row = (await query(`SELECT event_count::text,estimated_bytes::text,scanned_date::text,generated_at
        FROM rule_storage_estimates WHERE organization_id=$1 AND rule_id=$2 AND rule_version=$3 AND generated_at IS NOT NULL`, [organizationId, ruleId, version])).rows[0]
    if (!row) return null
    return { count: Number(row.event_count), bytes: Number(row.estimated_bytes), checkedDate: String(row.scanned_date).slice(0, 10), generatedAt: new Date(row.generated_at).toISOString() }
}

export async function estimateStoredRuleEvents(
    organizationId: string,
    ruleId: string,
    version: string,
    conditions: Condition[],
    query = run,
    shouldContinue: () => Promise<boolean> = async() => true,
) {
    const claimed = await query(`INSERT INTO rule_storage_estimates(organization_id,rule_id,rule_version,scanned_date)
        VALUES($1,$2,$3,(NOW() AT TIME ZONE 'UTC')::date)
        ON CONFLICT(organization_id,rule_id,rule_version) DO UPDATE
        SET scanned_date=(NOW() AT TIME ZONE 'UTC')::date,scan_started_at=NOW(),scan_finished_at=NULL
        WHERE rule_storage_estimates.scanned_date < (NOW() AT TIME ZONE 'UTC')::date
            OR (rule_storage_estimates.scanned_date=(NOW() AT TIME ZONE 'UTC')::date
                AND rule_storage_estimates.generated_at IS NULL
                AND rule_storage_estimates.scan_finished_at IS NULL
                AND rule_storage_estimates.scan_started_at < NOW() - INTERVAL '15 minutes')
        RETURNING event_count::text,estimated_bytes::text,scanned_date::text,generated_at,true AS claimed`, [organizationId, ruleId, version])
    const row = claimed.rows[0] || (await query(`SELECT event_count::text,estimated_bytes::text,scanned_date::text,generated_at,false AS claimed
        FROM rule_storage_estimates WHERE organization_id=$1 AND rule_id=$2 AND rule_version=$3`, [organizationId, ruleId, version])).rows[0]
    if (!row) return null
    const previous = row.generated_at ? { count: Number(row.event_count), bytes: Number(row.estimated_bytes), checkedDate: row.scanned_date, generatedAt: new Date(row.generated_at).toISOString() } : null
    if (!row.claimed) return previous

    try {
        const estimate = await cachedRead(`rule-storage-estimate-scan:${organizationId}:${ruleId}:${version}:${row.scanned_date}`, 24 * 60 * 60_000, async () => {
            const retentionRules = await loadLogRetentionRules(organizationId, query)
            let cursor: Cursor | null = null
            let count = 0
            let bytes = 0
            const until = new Date().toISOString()
            do {
                if (!(await shouldContinue())) throw new ReadAdmissionError()
                const page = await scanRulePreview(organizationId, true, { from: null, until, cursor, action: 'drop', conditions }, query,
                    { storedLogsOnly: true, retentionRules })
                count += page.count
                bytes += page.bytes
                cursor = page.cursor
            } while (cursor)
            return { count, bytes, generatedAt: until }
        }, { lane: 'preview' })
        await query(`UPDATE rule_storage_estimates SET event_count=$4,estimated_bytes=$5,generated_at=NOW(),scan_finished_at=NOW()
            WHERE organization_id=$1 AND rule_id=$2 AND rule_version=$3 AND scanned_date=$6::date`,
        [organizationId, ruleId, version, estimate.count, estimate.bytes, row.scanned_date])
        return { ...estimate, checkedDate: row.scanned_date }
    } catch (error) {
        await query(`UPDATE rule_storage_estimates SET scan_finished_at=NOW()
            WHERE organization_id=$1 AND rule_id=$2 AND rule_version=$3 AND scanned_date=$4::date`,
        [organizationId, ruleId, version, row.scanned_date]).catch(() => {})
        if (previous) return previous
        throw error
    }
}

export function validPreviewWindow(input: Record<string, unknown>): input is Record<string, unknown> & PreviewRequest {
    const validTime = (value: unknown) => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value))
    if (!validTime(input.until) || Date.parse(input.until as string) > Date.now() + 60_000 || (input.from !== null && !validTime(input.from))) return false
    if (input.from && Date.parse(input.from as string) > Date.parse(input.until as string)) return false
    if (input.limit !== undefined && input.limit !== 1000 && input.limit !== 2000) return false
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
    const finite = conditions.map(condition => condition.operator === 'regex' ? finiteRegexAlternatives(condition.value) : null)
    if (conditions.some(condition => condition.operator === 'regex') && finite.every((values, index) => conditions[index].operator !== 'regex' || values)) {
        return events.flatMap((event, index) => conditions.every((condition, conditionIndex) => {
            const value = condition.path.split('.').reduce<unknown>((item, key) => item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>)[key] : undefined, event)
            if (value === undefined || value === null || typeof value === 'object') return false
            const actual = String(value)
            const comparable = condition.caseSensitive ? actual : actual.toLowerCase()
            if (condition.operator === 'regex') {
                const alternatives = finite[conditionIndex] || []
                return alternatives.some(expected => comparable === (condition.caseSensitive ? expected : expected.toLowerCase()))
            }
            const expected = condition.caseSensitive ? condition.value : condition.value.toLowerCase()
            return condition.operator === 'equals' ? comparable === expected : comparable.includes(expected)
        }) ? [index] : [])
    }
    if (conditions.some(condition => condition.operator === 'regex'))
        return matchRegexPage(events.map((normalized, index) => ({ id: String(index), timestamp: '', normalized, rank: 0 })), conditions)
    return events.flatMap((event, index) => matchesRule(event, conditions) ? [index] : [])
}
