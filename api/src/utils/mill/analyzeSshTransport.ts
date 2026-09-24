import { createHash } from 'node:crypto'
import { matchAnalysisEvents } from './analysisMatcher.ts'
import { normalizeLogEvent } from './logEvent.ts'
import type { MillCondition } from './conditions.ts'
import type { RoutineGroup, RoutineLog } from './analyzeRoutineGroups.ts'

export const sshTransportRuleId = 'ssh.transport_debug.v1'
export const sshTransportDefinition = {
    match: 'all' as const, stage: 'analyze' as const, action: 'drop' as const,
    conditions: [
        { path: 'host', operator: 'regex', value: '^(inspur|ovhcloud)$', caseSensitive: true },
        { path: 'service', operator: 'equals', value: 'sshd', caseSensitive: true },
        { path: 'level', operator: 'equals', value: 'debug', caseSensitive: true },
        { path: 'metadata.collector', operator: 'equals', value: 'journal', caseSensitive: true },
        { path: 'metadata.unit', operator: 'regex', value: '^(ssh|sshd)\\.service$', caseSensitive: true },
        { path: 'metadata.user.id', operator: 'regex', value: '^(0|1000)$', caseSensitive: true },
        { path: 'message', operator: 'regex', value: '^(?:debug2: channel [0-9]{1,5}: (?:rcvd adjust [0-9]{1,7}|window [0-9]{1,7} sent adjust [0-9]{1,7})|debug3: (?:send|receive) packet: type 93)$(?![\\s\\S])', caseSensitive: true },
    ] satisfies MillCondition[],
    parameters: { maxDurationMs: 1000, maxAgeMs: 60000, minimumGapMs: 0, maxPerMinute: 600 },
}
export const sshTransportRule = {
    id: sshTransportRuleId, version: '1', name: 'SSH transport debug summaries', family: 'System', severity: 'low', enabled: false,
    explanation: 'Combine exact window adjustments and packet type 93 traces from one SSH process into a lossless summary. Preserve every original, timestamp and source ID. Keep authentication, commands, connections, forwarding, errors, pre-authentication and unexpected content as separate records.',
    evidence: ['host', 'SSH process', 'original records', 'timestamps', 'source IDs'],
}

// Grouping only changes representation: the canonical record stores every input
// verbatim. The saved Mill selectors decide eligibility, including on retries.
export async function sshTransportGroups(entries: RoutineLog[], conditions: MillCondition[], now = Date.now()): Promise<RoutineGroup[]> {
    if (!conditions.length) return []
    const sessions = new Map<string, RoutineLog[]>()
    for (const log of entries) {
        if (log.service !== 'sshd') continue
        const key = `${log.host}:${String(log.metadata?.pid)}`
        const rows = sessions.get(key) || []
        rows.push(log)
        sessions.set(key, rows)
    }
    const groups: RoutineGroup[] = []
    for (const [scope, input] of sessions) {
        const logs = [...input].sort((a, b) => Date.parse(a.timestamp || '') - Date.parse(b.timestamp || '') || String(a.sourceEventId).localeCompare(String(b.sourceEventId)))
        // Unexpected context in this process's batch keeps the entire group raw.
        // Never infer a benign connection from a window adjustment alone.
        if (logs.length < 2 || logs.length > 100 || new Set(logs.map(log => log.sourceEventId)).size !== logs.length) continue
        if (logs.some(log => {
            const metadata = log.metadata, user = metadata?.user as Record<string, unknown> | undefined
            return Object.keys(log).some(key => !['service', 'host', 'level', 'message', 'metadata', 'sourceEventId', 'timestamp'].includes(key))
                || !metadata || Object.keys(metadata).length !== 4 || !['collector', 'pid', 'unit', 'user'].every(key => Object.hasOwn(metadata, key))
                || !user || typeof user !== 'object' || Object.keys(user).length !== 1 || typeof user.id !== 'string'
                || typeof metadata.pid !== 'string' || !/^[1-9][0-9]*$/.test(metadata.pid)
                || typeof log.host !== 'string' || !/^[a-zA-Z0-9._-]{1,253}$/.test(log.host)
                || !/^[a-f0-9]{64}$/.test(log.sourceEventId || '') || !Number.isFinite(Date.parse(log.timestamp || ''))
                || Date.parse(log.timestamp!) > now + 5000
        })) continue
        if (new Set(logs.map(log => `${log.metadata!.unit}:${(log.metadata!.user as { id: string }).id}`)).size !== 1) continue
        const normalized = logs.map(log => normalizeLogEvent({ ...log, id: log.sourceEventId!, service: log.service!, created_at: log.timestamp! }))
        if ((await matchAnalysisEvents(normalized, conditions)).length !== logs.length) continue
        const times = logs.map(log => Date.parse(log.timestamp!))
        groups.push({ ruleId: sshTransportRuleId, key: createHash('sha256').update(JSON.stringify([sshTransportRuleId, logs])).digest('hex'),
            scope, started: Math.min(...times), ended: Math.max(...times), logs, context: logs })
    }
    return groups
}
