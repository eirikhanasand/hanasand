import { beforeEach, expect, mock, test } from 'bun:test'
let locked = true, fail = false, watermark: string | null = '200', additionalRuns = 0
let cursor: any, statements: string[], checked: string[], stored: Record<string, any>, pending: any[]
const makeLog = (id: string, metadata: any = {}) => ({ id, service: 'audit', host: 'inspur', level: 'info', message: id, created_at: '2026-09-19T00:00:00Z', metadata })
let priority: any[], fresh: any[], backlog: any[]
const query = async (sql: string, p: any[] = []): Promise<any> => {
    statements.push(sql)
    if (sql.includes('pg_try_advisory_xact_lock')) return { rows: [{ locked }] }
    if (sql.startsWith('SELECT id FROM organizations')) return { rows: p[0] === 'inactive' ? [] : [{ id: 'platform' }] }
    if (sql.includes('INSERT INTO log_processing_cursors')) return { rows: [] }
    if (sql.includes('SELECT last_id, recent_id')) return { rows: [{ ...cursor }] }
    if (sql.includes('UPDATE log_processing_cursors')) {
        if (sql.includes('recent_id = $1')) cursor.recent_id = p[0]
        if (sql.includes('last_id = GREATEST')) cursor.last_id = p[0]
        if (sql.includes('last_error = $1')) cursor.last_error = p[0]
        if (sql.includes('last_error = NULL')) cursor.last_error = null
        return { rows: [] }
    }
    if (sql.includes('SELECT s.* FROM service_logs s')) return { rows: priority
        .filter(row => BigInt(row.id) <= BigInt(p[0]) && Date.parse(row.created_at) >= Date.now() - 300_000
            && !Object.values(stored).some(event => event.key === `service:${row.id}` && ['processed', 'skipped'].includes(event.processing_status)))
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || Number(b.id) - Number(a.id))
        .slice(0, 1000) }
    if (sql.includes('SELECT * FROM service_logs')) return { rows: p[1] === watermark ? fresh : backlog }
    if (sql.includes('INSERT INTO mill_events')) {
        for (const item of JSON.parse(p[0])) stored[item.id] ||= { ...item, organization_id: p[1], processing_status: sql.includes("'skipped'") ? 'skipped' : 'pending' }
        return { rows: [] }
    }
    if (sql.includes('SELECT id FROM mill_events')) return { rows: Object.values(stored).filter(row => p[0].includes(row.id) && row.processing_status !== 'processed') }
    if (sql.includes('SELECT rule_id, severity')) return { rows: [] }
    if (sql.includes('SELECT e.* FROM mill_events')) return { rows: pending }
    if (sql.includes('UPDATE mill_events e SET')) {
        for (const item of JSON.parse(p[0])) { stored[item.id].processing_status = 'processed'; stored[item.id].normalized = { ...stored[item.id].normalized, ...item.result } }
        return { rows: [] }
    }
    if (sql.includes('UPDATE mill_events SET')) { pending = pending.filter(row => row.id !== p[0]); return { rows: [] } }
    throw new Error(sql)
}
mock.module('#db', () => ({ default: query, withTransaction: async (work: any) => work(query) }))
mock.module('../src/utils/mill/storedSources.ts', () => ({ processAdditionalLogSources: async () => { additionalRuns++ } }))
mock.module('../src/utils/mill/logWatermark.ts', () => ({ stableLogWatermark: async () => watermark }))
mock.module('../src/handlers/mill.ts', () => ({
    loadConfiguredMillRules: async () => [],
    normalizeMillEvent: (event: any) => ({ timestamp: event.timestamp, eventType: event.event_type, action: event.action, outcome: event.outcome, normalized: event }),
    createMillFindings: async (_scope: string, _id: string, event: any) => { if (fail) throw new Error('Finding storage unavailable'); checked.push(event.normalized.message) },
}))
const { processStoredLogs } = await import('../src/utils/mill/processLogs.ts')
beforeEach(() => { watermark = '200'; additionalRuns = 0; locked = true; fail = false; cursor = { last_id: '0', recent_id: '100' }; statements = []; checked = []; stored = {}; pending = []; priority = []; fresh = [makeLog('101')]; backlog = [makeLog('1')] })
test('a replica that does not hold the shared lock performs no work', async () => {
    locked = false; await processStoredLogs()
    expect(statements).toHaveLength(1)
    expect(checked).toEqual([])
})
test('fresh events complete before bounded historical work and both cursors advance', async () => {
    await processStoredLogs()
    expect(checked).toEqual(['101', '1'])
    expect(cursor).toMatchObject({ last_id: '1', recent_id: '101' })
    expect(statements.filter(sql => sql.includes('SELECT * FROM service_logs')).every(sql => sql.includes('LIMIT 1000'))).toBe(true)
    expect(Object.values(stored).every(row => row.processing_status === 'processed')).toBe(true)
})
test('failed findings retain pending event and cursors for successful retry', async () => {
    fail = true
    await expect(processStoredLogs()).rejects.toThrow('Finding storage unavailable')
    expect(cursor).toMatchObject({ last_id: '0', recent_id: '100', last_error: 'Finding storage unavailable' })
    expect(Object.values(stored)[0].processing_status).toBe('pending')
    fail = false; await processStoredLogs()
    expect(checked).toEqual(['101', '1'])
    expect(Object.values(stored)).toHaveLength(2)
})
test('inactive scopes produce safe skipped markers and direct Mill pending events retry', async () => {
    fresh = [makeLog('101', { organizationId: 'inactive', password: 'never-copy-this' })]
    pending = [{ id: 'native', organization_id: 'platform', normalized: { timestamp: '2026-09-19T00:00:00Z', message: 'native' } }]
    await processStoredLogs()
    expect(Object.values(stored).some(row => row.processing_status === 'skipped')).toBe(true)
    expect(JSON.stringify(stored)).not.toContain('never-copy-this')
    expect(checked).toEqual(['native', '1'])
    expect(pending).toHaveLength(0)
})

test('busy service-log writers do not block other streams and do not advance service cursors', async () => {
    watermark = null
    pending = [{ id: 'native', organization_id: 'platform', normalized: { timestamp: '2026-09-19T00:00:00Z', message: 'native' } }]
    await processStoredLogs()
    expect(checked).toEqual(['native'])
    expect(additionalRuns).toBe(1)
    expect(cursor).toMatchObject({ last_id: '0', recent_id: '100', last_error: 'Waiting for active log writes; will retry.' })
    expect(statements.some(sql => sql.includes('FROM service_logs'))).toBe(false)
})

test('recent event times are checked before replayed FIFO events without jumping the cursor', async () => {
    priority = [{ ...makeLog('190'), created_at: new Date().toISOString() },
        { ...makeLog('201'), created_at: new Date().toISOString() },
        { ...makeLog('180'), created_at: new Date(Date.now() - 600_000).toISOString() }]
    await processStoredLogs()
    expect(checked).toEqual(['190', '101', '1'])
    expect(cursor).toMatchObject({ last_id: '1', recent_id: '101' })
    const sql = statements.find(value => value.includes('SELECT s.* FROM service_logs s'))!
    expect(sql).toContain("s.created_at >= NOW() - INTERVAL '5 minutes'")
    expect(sql).toContain('s.id <= $1')
    expect(sql).toContain("e.log_key = 'service:' || s.id::text")
    expect(sql).toContain("e.processing_status IN ('processed', 'skipped')")
    expect(sql).toContain('ORDER BY s.created_at DESC, s.id DESC LIMIT 1000')
    // When FIFO catches up it advances normally, without reevaluating the same log.
    fresh = [priority[0]]; backlog = []
    await processStoredLogs()
    expect(checked).toEqual(['190', '101', '1'])
    expect(cursor.recent_id).toBe('190')
    expect(Object.values(stored)).toHaveLength(3)
})

test('a failed priority check remains pending and retries before the FIFO advances', async () => {
    priority = [{ ...makeLog('190'), created_at: new Date().toISOString() }]
    fail = true
    await expect(processStoredLogs()).rejects.toThrow('Finding storage unavailable')
    expect(cursor).toMatchObject({ last_id: '0', recent_id: '100' })
    expect(Object.values(stored)).toHaveLength(1)
    expect(Object.values(stored)[0].processing_status).toBe('pending')
    fail = false
    await processStoredLogs()
    expect(checked).toEqual(['190', '101', '1'])
    expect(Object.values(stored)).toHaveLength(3)
})
