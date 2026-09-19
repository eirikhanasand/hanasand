import { beforeEach, expect, mock, test } from 'bun:test'
let checkpoints: Array<unknown[]> = [], skipped: string[] = []
let busy: string | null = null
let recentId = '100', watermark = '200', historyRows = 1, recentRows = 1, reads: Array<{ sql: string, values: unknown[] }>
mock.module('../src/utils/mill/logWatermark.ts', () => ({ stableLogWatermark: async (source: string) => source === busy ? null : watermark }))
const query = async (sql: string, values: unknown[] = []) => {
    if (sql.includes('SELECT last_id, recent_id')) return { rows: [{ last_id: '0', recent_id: recentId }] }
    if (sql.startsWith('SELECT *')) {
        reads.push({ sql, values })
        return { rows: Array.from({ length: Math.min(values[1] === watermark ? recentRows : historyRows, Number(values[2] || 1000)) }, (_, index) => ({ id: values[1] === watermark ? String(BigInt(recentId) + BigInt(index + 1)) : String(index + 1), created_at: '2026-09-19T12:00:00Z', status: 'success' })) }
    }
    if (sql.startsWith('UPDATE log_processing_cursors SET last_error = $2')) skipped.push(String(values[0]))
    if (sql.startsWith('UPDATE log_processing_cursors SET recent_id = $2') || sql.startsWith('UPDATE log_processing_cursors SET last_id')) checkpoints.push(values)
    return { rows: [] }
}
mock.module('#db', () => ({ default: query }))
const { storedSourceLog, processAdditionalLogSources } = await import('../src/utils/mill/storedSources.ts')
const { normalizeLogEvent } = await import('../src/utils/mill/logEvent.ts')
const row = { id: 1, created_at: '2026-09-19T12:00:00Z' }
beforeEach(() => { checkpoints = []; skipped = []; busy = null; recentId = '100'; watermark = '200'; historyRows = 1; recentRows = 1; reads = [] })
test('website sign-ins retain real correlation fields without session credentials', () => {
    const log = normalizeLogEvent(storedSourceLog('login_events', { ...row, user_id: 'user-a', status: 'failed', ip: '192.0.2.1', token_id: 123, reason: 'bad_password' }))
    expect(log).toMatchObject({ log_type: 'SigninLogs', event_type: 'authentication', action: 'login', outcome: 'failure', user: { id: 'user-a' }, source: { ip: '192.0.2.1' } })
    expect(JSON.stringify(log)).not.toContain('token_id')
})
test('HTTP errors are high severity and requests have structured HTTP fields', () => {
    const log = normalizeLogEvent(storedSourceLog('traffic_events', { ...row, domain: 'hanasand.com', method: 'GET', path: '/example', status: 503 }))
    expect(log).toMatchObject({ log_type: 'HttpLogs', severity: 'high', http: { path: '/example', method: 'GET', status_code: 503 } })
})
test('audit events preserve organization scope and structured object context', () => {
    const log = storedSourceLog('system_events', { ...row, organization_id: 'org-a', actor_id: 'user-a', severity: 'critical', event_type: 'configuration.changed', object_id: 'setting', context: { key: 'value' } })
    expect(log.metadata).toMatchObject({ organizationId: 'org-a', user: { id: 'user-a' }, object: { id: 'setting' }, context: { key: 'value' } })
    expect(normalizeLogEvent(log)).toMatchObject({ log_type: 'SystemLogs', severity: 'critical' })
})
test('source identities cannot collide with each other or service-log IDs', () => {
    expect(new Set(['login_events', 'traffic_events', 'system_events'].map(source => storedSourceLog(source as 'login_events', row).id)).size).toBe(3)
    expect(storedSourceLog('login_events', row).id).not.toBe(row.id)
})
test('all fresh streams precede backfill and checkpoints follow successful processing', async () => {
    const received: string[] = []
    await processAdditionalLogSources(async logs => { received.push(String(logs[0].id)) })
    expect(received).toEqual(['login_events:101', 'traffic_events:101', 'system_events:101', 'login_events:1', 'traffic_events:1', 'system_events:1'])
    expect(checkpoints).toHaveLength(6)
})
test('failed evaluation leaves its delivery cursor unchanged for retry', async () => {
    await expect(processAdditionalLogSources(async () => { throw new Error('Evaluation failed') })).rejects.toThrow('Evaluation failed')
    expect(checkpoints).toHaveLength(0)
})
test('throttled history keeps every recent stream and advances only the evaluated historical rows', async () => {
    recentId = '1000'; watermark = '2000'; historyRows = 250
    const received: Array<{ first: string, last: string, count: number }> = []
    await processAdditionalLogSources(async logs => { received.push({ first: String(logs[0].id), last: String(logs.at(-1)!.id), count: logs.length }) }, 100)
    expect(received.map(batch => batch.count)).toEqual([1, 1, 1, 100, 100, 100])
    expect(received.slice(3).map(batch => batch.last)).toEqual(['login_events:100', 'traffic_events:100', 'system_events:100'])
    expect(reads.slice(0, 3).every(read => read.values[2] === 1000)).toBe(true)
    expect(reads.slice(3).every(read => read.values[2] === 100)).toBe(true)
    expect(checkpoints).toEqual([['login_events', '1001'], ['traffic_events', '1001'], ['system_events', '1001'], ['login_events', '100', 100], ['traffic_events', '100', 100], ['system_events', '100', 100]])
})
test('throttled historical failure leaves that cursor unchanged after fresh streams succeed', async () => {
    let runs = 0
    await expect(processAdditionalLogSources(async () => { if (++runs === 4) throw new Error('History evaluation failed') }, 100)).rejects.toThrow('History evaluation failed')
    expect(checkpoints).toEqual([['login_events', '101'], ['traffic_events', '101'], ['system_events', '101']])
})

test('a busy source is visibly retried without starving other sources', async () => {
    busy = 'traffic_events'
    const received: string[] = []
    await processAdditionalLogSources(async logs => { received.push(String(logs[0].id)) })
    expect(received).toEqual(['login_events:101', 'system_events:101', 'login_events:1', 'system_events:1'])
    expect(skipped).toEqual(['traffic_events'])
    expect(checkpoints).toHaveLength(4)
})

test('delayed command scheduling bounds all forward streams without jumping remaining source IDs', async () => {
    recentId = '1000'; watermark = '2000'; historyRows = 250; recentRows = 250
    const batches: string[][] = []
    await processAdditionalLogSources(async logs => { batches.push(logs.map(log => String(log.id))) }, 100, 100)
    expect(batches.map(rows => rows.length)).toEqual([100, 100, 100, 100, 100, 100])
    expect(batches.slice(0, 3).map(rows => rows.at(-1))).toEqual(['login_events:1100', 'traffic_events:1100', 'system_events:1100'])
    expect(checkpoints.slice(0, 3)).toEqual([['login_events', '1100'], ['traffic_events', '1100'], ['system_events', '1100']])
})
