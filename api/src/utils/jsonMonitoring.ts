import { createHash } from 'node:crypto'
import run, { withTransaction } from '#db'
import { certificateTarget, checkCertificate } from './automations.ts'
import getStats from './refresh/queries/stats.ts'

export type JsonRule = { path: string, operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne', value: number | boolean | string, aggregate: 'max' | 'min' | 'avg' | 'first' }
export type JsonSource = { owner_id: string, target_url: string | null, user_agent: string | null, follow_redirects: boolean, timeout_seconds: number }

export function normalizeJsonRule(value: unknown): JsonRule {
    if (!value || typeof value !== 'object') throw new Error('JSON checks need a field and comparison.')
    const rule = value as JsonRule
    if (typeof rule.path !== 'string' || rule.path.length > 300 || !/^[\w*-]+(?:\.[\w*-]+)*$/.test(rule.path) || rule.path.split('.').some(part => ['__proto__', 'constructor', 'prototype'].includes(part))) throw new Error('Use a dot-separated JSON field, with * for array items.')
    if (!['gt', 'gte', 'lt', 'lte', 'eq', 'ne'].includes(rule.operator)) throw new Error('Invalid JSON comparison.')
    if (!['max', 'min', 'avg', 'first'].includes(rule.aggregate)) throw new Error('Invalid JSON aggregation.')
    if (!['number', 'boolean', 'string'].includes(typeof rule.value) || typeof rule.value === 'number' && !Number.isFinite(rule.value) || typeof rule.value === 'string' && rule.value.length > 500) throw new Error('Invalid comparison value.')
    if (!['eq', 'ne'].includes(rule.operator) && typeof rule.value !== 'number') throw new Error('This comparison needs a number.')
    return { path: rule.path, operator: rule.operator, value: rule.value, aggregate: rule.aggregate }
}

export function evaluateJsonRule(payload: unknown, rule: JsonRule) {
    let values: unknown[] = [payload]
    for (const part of rule.path.split('.')) {
        values = values.flatMap(value => part === '*' ? Array.isArray(value) ? value : [] : value && typeof value === 'object' && Object.hasOwn(value, part) ? [(value as Record<string, unknown>)[part]] : [])
    }
    // Missing sensors are not zero. A configured check must report missing telemetry.
    const present = values.filter(value => value !== null && value !== undefined)
    if (!present.length) throw new Error(`JSON field unavailable: ${rule.path}.`)
    let observed = present[0]
    if (rule.aggregate !== 'first') {
        if (!present.every(value => typeof value === 'number' && Number.isFinite(value))) throw new Error(`JSON field is not numeric: ${rule.path}.`)
        const numbers = present as number[]
        observed = rule.aggregate === 'avg' ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : rule.aggregate === 'max' ? Math.max(...numbers) : Math.min(...numbers)
    }
    if (typeof observed !== typeof rule.value) throw new Error(`JSON field type does not match the comparison: ${rule.path}.`)
    const numeric = observed as number
    const threshold = rule.value as number
    const exceeded = rule.operator === 'gt' ? numeric > threshold : rule.operator === 'gte' ? numeric >= threshold : rule.operator === 'lt' ? numeric < threshold : rule.operator === 'lte' ? numeric <= threshold : rule.operator === 'eq' ? observed === rule.value : observed !== rule.value
    return { exceeded, observed }
}

async function fetchJson(source: JsonSource) {
    if (source.target_url === 'system:metrics') {
        const result = await getStats()
        if (!result.data.host) throw new Error(result.data.hostUnavailableReason || 'Host telemetry is unavailable.')
        return { payload: result.data, certificate: { status: 'not_applicable' as const, subject: null, issuer: null, expiresAt: null } }
    }
    const tls = certificateTarget({ target_url: source.target_url, monitoring_type: 'json' })
    const certificate = tls ? await checkCertificate(tls, source.timeout_seconds * 1000) : { status: 'not_applicable' as const, subject: null, issuer: null, expiresAt: null }
    if (certificate.status === 'invalid') throw new Error(`TLS certificate validation failed for ${tls!.hostname}.`)
    const response = await fetch(source.target_url!, { redirect: source.follow_redirects ? 'follow' : 'manual', headers: source.user_agent ? { 'user-agent': source.user_agent } : undefined, signal: AbortSignal.timeout(source.timeout_seconds * 1000) })
    if (!response.ok) { await response.body?.cancel(); throw new Error(`JSON source returned HTTP ${response.status}.`) }
    const reader = response.body?.getReader()
    if (!reader) throw new Error('JSON source returned no body.')
    let size = 0
    const chunks: Uint8Array[] = []
    try {
        while (true) {
            const { value, done } = await reader.read()
            if (done) break
            size += value.byteLength
            if (size > 1_048_576) throw new Error('JSON source exceeds the 1 MiB response limit.')
            chunks.push(value)
        }
        return { payload: JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown, certificate }
    } finally { await reader.cancel().catch(() => {}) }
}

const pending = new Map<string, Promise<Awaited<ReturnType<typeof fetchJson>>>>()

export async function sharedJsonSnapshot(source: JsonSource) {
    const key = createHash('sha256').update(JSON.stringify([source.owner_id, source.target_url, source.user_agent, source.follow_redirects, source.timeout_seconds])).digest('hex')
    const existing = pending.get(key)
    if (existing) return existing
    const promise = loadSnapshot(source, key).finally(() => pending.delete(key))
    pending.set(key, promise)
    return promise
}

async function loadSnapshot(source: JsonSource, key: string) {
    const read = async (query = run) => (await query('SELECT payload, error FROM monitoring_json_snapshots WHERE id = $1 AND expires_at > NOW()', [key])).rows[0]
    const cached = await read()
    const snapshot = cached || await withTransaction(async query => {
        await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`json-monitor:${key}`])
        const existing = await read(query)
        if (existing) return existing
        let payload: unknown = null
        let error: string | null = null
        try { payload = await fetchJson(source) } catch (failure) { error = failure instanceof Error ? failure.message : 'JSON source unavailable.' }
        await query(`INSERT INTO monitoring_json_snapshots(id, payload, error, sampled_at, expires_at)
            VALUES ($1, $2::jsonb, $3, NOW(), date_trunc('minute', NOW()) + INTERVAL '1 minute')
            ON CONFLICT(id) DO UPDATE SET payload = EXCLUDED.payload, error = EXCLUDED.error, sampled_at = EXCLUDED.sampled_at, expires_at = EXCLUDED.expires_at`, [key, JSON.stringify(payload), error])
        return { payload, error }
    })
    if (snapshot.error) throw new Error(snapshot.error)
    const result = snapshot.payload as Awaited<ReturnType<typeof fetchJson>>
    if (source.target_url === 'system:metrics') {
        const host = (result.payload as { host?: { sampledAt?: string } }).host
        const age = Date.now() - Date.parse(host?.sampledAt || '')
        if (!Number.isFinite(age) || age > 90_000 || age < -5_000) throw new Error('Host telemetry is stale.')
    }
    return result
}
