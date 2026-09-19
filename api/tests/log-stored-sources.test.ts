import { beforeEach, expect, mock, test } from 'bun:test'
let checkpoints: Array<unknown[]> = []
const query = async (sql: string, values: unknown[] = []) => {
    if (sql.includes('SELECT last_id, recent_id')) return { rows: [{ last_id: '0', recent_id: '100' }] }
    if (sql.startsWith('SELECT *')) return { rows: [{ id: values.length === 1 ? '101' : '1', created_at: '2026-09-19T12:00:00Z', status: 'success' }] }
    if (sql.startsWith('UPDATE log_processing_cursors SET recent_id = $2') || sql.startsWith('UPDATE log_processing_cursors SET last_id')) checkpoints.push(values)
    return { rows: [] }
}
mock.module('#db', () => ({ default: query }))
const { storedSourceLog, processAdditionalLogSources } = await import('../src/utils/mill/storedSources.ts')
const { normalizeLogEvent } = await import('../src/utils/mill/logEvent.ts')
const row = { id: 1, created_at: '2026-09-19T12:00:00Z' }
beforeEach(() => { checkpoints = [] })
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
