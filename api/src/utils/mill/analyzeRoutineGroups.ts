import { createHash } from 'node:crypto'
import ipaddr from 'ipaddr.js'
import type { MillCondition } from './conditions.ts'

export const telemetryRuleId = 'system.completed_telemetry_cycles.v1'
export const sshWindowRuleId = 'ssh.completed_session_windows.v1'
export const routineGroupDefinition = { match: 'all' as const, conditions: [], stage: 'analyze' as const, action: 'drop' as 'drop' | 'keep', parameters: {} }
export const telemetryDefinition = { ...routineGroupDefinition, conditions: [
    { path: 'host', operator: 'regex', value: '^(inspur|ovhcloud)$' },
    { path: 'service', operator: 'equals', value: 'systemd' },
    { path: 'metadata.unit', operator: 'equals', value: 'init.scope' },
    { path: 'message', operator: 'regex', value: '^(?:(?:Starting|Finished) )?hanasand-(?:ovh-)?host-metrics\\.service(?: - |:)' },
] as MillCondition[], parameters: { maxDurationMs: 5000, maxAgeMs: 60000, minimumGapMs: 900, maxPerMinute: 65 } }
export const sshWindowDefinition = { ...routineGroupDefinition, conditions: [
    { path: 'host', operator: 'regex', value: '^(inspur|ovhcloud)$' },
    { path: 'service', operator: 'equals', value: 'sshd' },
    { path: 'metadata.unit', operator: 'regex', value: '^(ssh|sshd)\\.service$' },
] as MillCondition[], parameters: { maxDurationMs: 30000, maxAgeMs: 60000, minimumGapMs: 30000, maxPerMinute: 2 } }
export function validateRoutineGroupParameters(ruleId: string, parameters: unknown): string | null {
    if (![telemetryRuleId, sshWindowRuleId].includes(ruleId) || !parameters || typeof parameters !== 'object' || Array.isArray(parameters)) return 'Invalid routine group parameters.'
    const telemetry = ruleId === telemetryRuleId
    const bounds: Record<string, [number, number]> = { maxDurationMs: [1, telemetry ? 5000 : 30000], maxAgeMs: [1, 60000], minimumGapMs: [telemetry ? 900 : 30000, 60000], maxPerMinute: [1, telemetry ? 65 : 2] }
    for (const [name, value] of Object.entries(parameters)) {
        if (!bounds[name] || !Number.isSafeInteger(value) || value < bounds[name][0] || value > bounds[name][1]) return `Invalid ${name}.`
    }
    return null
}
export function routineGroupParameters(ruleId: string, parameters: unknown) {
    if (validateRoutineGroupParameters(ruleId, parameters)) return null
    return { ...(ruleId === telemetryRuleId ? telemetryDefinition : sshWindowDefinition).parameters, ...parameters as Partial<typeof telemetryDefinition.parameters> }
}
export const telemetryRule = {
    id: telemetryRuleId, version: '1', name: 'Completed host telemetry cycles', family: 'System', severity: 'low', enabled: false,
    explanation: 'Consolidate complete, short, normal-rate host telemetry cycles into one record containing every original event. Keep failures, unknown content, incomplete cycles and abnormal timing. No telemetry values are discarded.',
    evidence: ['host', 'systemd process', 'unit', 'cycle timestamps', 'original records'],
}
export const sshWindowRule = {
    id: sshWindowRuleId, version: '1', name: 'Completed SSH session window adjustments', family: 'System', severity: 'low', enabled: false,
    explanation: 'Consolidate exact channel-window adjustments only within a complete, short public-key SSH session containing no other messages. Keep authentication and disconnect records separately and preserve every adjustment in the summary. Unknown, incomplete, failed and unusual sessions remain unchanged.',
    evidence: ['host', 'SSH process', 'user', 'source address', 'session boundaries', 'original window records'],
}
export type RoutineLog = { service?: string, host?: string, level: string, message: string, metadata?: Record<string, unknown>, sourceEventId?: string, timestamp?: string }
export type RoutineGroup = { ruleId: string, key: string, scope: string, started: number, ended: number, logs: RoutineLog[], context: RoutineLog[] }
const hash = (v: string) => createHash('sha256').update(v).digest('hex')
const ordered = (value: unknown): unknown => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)])) : value
const fingerprint = (value: unknown) => hash(JSON.stringify(ordered(value)))
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).length === allowed.length && allowed.every(k => Object.hasOwn(v, k))
function envelope(log: RoutineLog, service: string, now: number) {
    const m = object(log.metadata), u = object(m.user), time = Date.parse(log.timestamp || '')
    return Object.keys(log).every(k => ['service', 'host', 'level', 'message', 'metadata', 'sourceEventId', 'timestamp'].includes(k))
        && typeof log.host === 'string' && /^[a-zA-Z0-9._-]{1,253}$/.test(log.host) && log.service === service && /^[a-f0-9]{64}$/.test(log.sourceEventId || '')
        && keys(m, ['collector', 'pid', 'user', 'unit']) && m.collector === 'journal' && keys(u, ['id']) && u.id === '0'
        && typeof m.pid === 'string' && /^[1-9]\d*$/.test(m.pid)
        && Number.isFinite(time) && time >= now - 60_000 && time <= now + 5000
}
export function completedTelemetryCycles(entries: RoutineLog[], now = Date.now()): RoutineGroup[] {
    const groups: RoutineGroup[] = []
    const starts = new Map<string, { host: string, unit: string, description: string }>()
    for (const log of entries) {
        const match = /^Starting ([a-zA-Z0-9@_.-]{1,200}\.service) - ([^\r\n]{1,500})\.\.\.$/.exec(log.message)
        if (log.host && match) starts.set(`${log.host}:${match[1]}:${match[2]}`, { host: log.host, unit: match[1], description: match[2] })
    }
    for (const { host, unit, description } of starts.values()) {
        // Unexpected records naming the unit invalidate its entire batch. Never
        // buffer unmatched starts outside the ordinary log/detection pipeline.
        const rows = entries.filter(l => l.host === host && l.message.includes(unit)).sort((a, b) => Date.parse(a.timestamp || '') - Date.parse(b.timestamp || ''))
        const messages = [`Starting ${unit} - ${description}...`, `${unit}: Deactivated successfully.`, `Finished ${unit} - ${description}.`]
        if (!rows.length || rows.some(l => !envelope(l, 'systemd', now) || l.level !== 'info' || l.metadata!.pid !== '1'
            || l.metadata!.unit !== 'init.scope' || !messages.includes(l.message))) continue
        if (new Set(rows.map(l => l.sourceEventId)).size !== rows.length) continue
        for (let i = 0; i + 2 < rows.length; i++) {
            const cycle = rows.slice(i, i + 3)
            if (cycle.some((l, n) => l.message !== messages[n])) continue
            const started = Date.parse(cycle[0].timestamp!), ended = Date.parse(cycle[2].timestamp!)
            if (ended - started < 0 || ended - started > 5000) continue
            groups.push({ ruleId: telemetryRuleId, key: fingerprint(cycle), scope: `${host}:${unit}`, started, ended, logs: cycle, context: cycle })
            i += 2
        }
    }
    return groups
}
const windowMessage = /^debug2: channel (\d{1,5}): (?:rcvd adjust (\d{1,10})|window (\d{1,10}) sent adjust (\d{1,10}))$/
export function completedSshWindows(entries: RoutineLog[], now = Date.now()): RoutineGroup[] {
    const grouped = new Map<string, RoutineLog[]>()
    for (const log of entries) {
        if (log.service !== 'sshd') continue
        const key = `${log.host}:${String(log.metadata?.pid)}`
        grouped.set(key, [...(grouped.get(key) || []), log])
    }
    const groups: RoutineGroup[] = []
    for (const [scope, input] of grouped) {
        const rows = [...input].sort((a, b) => Date.parse(a.timestamp || '') - Date.parse(b.timestamp || ''))
        if (rows.length < 4 || rows.some(l => !envelope(l, 'sshd', now) || !/^[a-zA-Z0-9@_.-]{1,200}\.service$/.test(String(l.metadata!.unit)))
            || new Set(rows.map(l => l.sourceEventId)).size !== rows.length || new Set(rows.map(l => l.metadata!.unit)).size !== 1) continue
        const first = rows[0], last = rows.at(-1)!
        const accepted = /^Accepted publickey for ([a-z_][a-z0-9_-]{0,31}) from ([0-9a-fA-F:.]+) port (\d{1,5}) ssh2: (?:ED25519|RSA|ECDSA) SHA256:[A-Za-z0-9+/]{43}$/.exec(first.message)
        if (!accepted || first.level !== 'info' || last.level !== 'info' || !ipaddr.isValid(accepted[2]) || Number(accepted[3]) < 1 || Number(accepted[3]) > 65535
            || last.message !== `Disconnected from user ${accepted[1]} ${accepted[2]} port ${accepted[3]}`) continue
        const windows = rows.slice(1, -1)
        // Unknown messages, commands, pre-authentication, packet traces, errors,
        // forwarding and authentication failures prevent the whole consolidation.
        if (windows.some(l => l.level !== 'debug' || !windowMessage.test(l.message)
            || [...l.message.matchAll(/\d+/g)].some(m => Number(m[0]) > 4294967295))) continue
        const started = Date.parse(first.timestamp!), ended = Date.parse(last.timestamp!)
        if (ended - started < 0 || ended - started > 30_000) continue
        groups.push({ ruleId: sshWindowRuleId, key: fingerprint(rows), scope, started, ended, logs: windows, context: rows })
    }
    return groups
}
export function routineReceipt(ruleId: string, log: RoutineLog) { return fingerprint([ruleId, log]) }
export function routineEvidence(group: RoutineGroup) {
    return { collector: 'routine-group-analyzer', rule_id: group.ruleId, scope: group.scope,
        started_at: new Date(group.started).toISOString(), ended_at: new Date(group.ended).toISOString(),
        duration_ms: group.ended - group.started, original_count: group.logs.length,
        original_records: group.logs, context_source_ids: group.context.map(l => l.sourceEventId) }
}
