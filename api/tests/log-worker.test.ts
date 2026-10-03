import { beforeEach, expect, mock, test } from 'bun:test'

let pending: any[] = []
let stored: Record<string, any> = {}
let statements: string[] = []
let failInsert = false
let additionalRuns = 0
const query = async (sql: string, params: any[] = []): Promise<any> => {
    statements.push(sql)
    if (sql.includes('pg_try_advisory_xact_lock')) return { rows: [{ locked: true }] }
    if (sql.startsWith('SELECT id FROM organizations')) return { rows: [{ id: 'platform' }] }
    if (sql.includes('SELECT e.id, e.event_timestamp, e.normalized FROM events')) {
        return { rows: pending.map(row => ({ id: row.id, event_timestamp: row.timestamp, normalized: row.normalized })) }
    }
    if (sql.includes("processing_status = 'processed'")) return { rows: pending.filter(row => stored[row.id]?.processing_status === 'processed').map(row => ({ id: row.id })) }
    if (sql.includes('INSERT INTO events')) {
        if (failInsert) throw new Error('Event storage failed')
        const rows = JSON.parse(params[0])
        for (const row of rows) stored[row.id] = { ...row, processing_status: row.processing_status }
        return { rows: rows.map((row: any) => ({ id: row.id })) }
    }
    if (sql.includes('SELECT id FROM events')) return { rows: pending.filter(row => stored[row.id]?.processing_status !== 'processed').map(row => ({ id: row.id })) }
    if (sql.includes('SELECT rule_id, severity')) return { rows: [] }
    if (sql.includes('FROM events e JOIN organizations')) return { rows: [] }
    if (sql.includes('UPDATE events e SET')) return { rows: [] }
    if (sql.includes('COUNT(*)') && sql.includes('events')) return { rows: [{ remaining: pending.length, oldest_received_at: null }] }
    if (sql.startsWith('UPDATE log_catchup_progress')) return { rows: [] }
    throw new Error(`Unexpected SQL: ${sql}`)
}
mock.module('#db', () => ({ default: query, withTransaction: async (work: (query: typeof query) => Promise<unknown>) => work(query) }))
mock.module('../src/utils/events/catchupProgress.ts', () => ({ refreshLogCatchupProgress: async () => {} }))
mock.module('../src/utils/logs/dimensions.ts', () => ({ backfillLogDimensions: async () => ({ processed: 0, ready: true }) }))
mock.module('../src/utils/events/pruneAccessLogs.ts', () => ({ pruneAccessLogs: async () => new Set() }))
mock.module('../src/utils/events/storedSources.ts', () => ({ processAdditionalLogSources: async () => { additionalRuns++ } }))
mock.module('../src/handlers/events.ts', () => ({
    loadConfiguredRules: async () => [],
    collectEventFindings: () => ({ findings: [] }),
    persistEventFindings: async () => {},
    createFindings: async () => {},
    normalizeEvent: (event: any) => ({ timestamp: event.timestamp, eventType: event.event_type, action: event.action,
        outcome: event.outcome, normalized: event }),
}))
const { processLiveLogs, processStoredLogs } = await import('../src/utils/events/processLogs.ts')
const raw = { schema_version: 'logs.v1', timestamp: '2026-10-03T12:00:00Z', event_type: 'process', action: 'exec', outcome: 'success',
    service: 'audit', host: 'inspur', level: 'info', message: 'whoami', metadata: { process: { executable: '/usr/bin/whoami' } } }
const makePending = (id: string) => ({ id, timestamp: raw.timestamp, normalized: raw })

beforeEach(() => { pending = [makePending('event-1')]; stored = {}; statements = []; failInsert = false; additionalRuns = 0 })

test('stored log worker processes pending Events and no longer reads service_logs', async () => {
    await processStoredLogs()
    expect(stored['event-1']?.processing_status).toBe('processed')
    expect(additionalRuns).toBe(1)
    expect(statements.some(sql => sql.includes("ingestion_id='logs' AND e.processing_status='pending'"))).toBe(true)
    expect(statements.some(sql => sql.includes('service_logs') || sql.includes('log_process_queue'))).toBe(false)
})

test('live worker processes recent pending Events through the same durable event ID', async () => {
    expect(await processLiveLogs()).toBe(true)
    expect(stored['event-1']?.processing_status).toBe('processed')
    expect(statements.some(sql => sql.includes('received_at >= statement_timestamp()'))).toBe(true)
    expect(statements.some(sql => sql.includes('service_logs') || sql.includes('log_process_queue'))).toBe(false)
})

test('event storage failure is surfaced so the pending log can retry', async () => {
    failInsert = true
    await expect(processLiveLogs()).rejects.toThrow('Event storage failed')
    expect(stored).toEqual({})
})
