import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import type { AutomationRow } from '../src/utils/automations.ts'

let failSave = 0, saveCount = 0, denied = false, probeFails = false, slow = false, clockOffset = 0, probeCount = 0
const statements: string[] = [], outcomes: Array<{ kind: unknown, message: string }> = []
const persistenceError = new Error('timeout exceeded when trying to connect')
const actualNow = Date.now
const query = async (sql: string) => {
    statements.push(sql)
    if (sql.includes('SET status = \'completed\'') || sql.includes('last_status = CASE WHEN $8')) {
        if (++saveCount === failSave) throw persistenceError
    }
    return { rows: [] }
}
mock.module('../src/utils/db.ts', () => ({ default: query, queryOnce: query, withTransaction: async (work: (q: typeof query) => unknown) => work(query) }))
mock.module('../src/utils/automationAccess.ts', () => ({ checkScheduledAutomationAccess: async () => { if (denied) throw new Error('Access denied.') } }))
mock.module('../src/utils/monitoringIssues.ts', () => ({ recordMonitoringOutcome: async (_automation: unknown, _run: string, kind: unknown, message: string) => { outcomes.push({ kind, message }) } }))
mock.module('../src/utils/publicMonitoringRequest.ts', () => ({
    monitoringUrl: (url: URL) => url,
    monitoringLookup: () => () => {}, resolveMonitoringAddresses: async () => [],
    publicMonitoringRequest: async () => {
        probeCount++
        if (slow) clockOffset += 1500
        return { status: probeFails ? 503 : 200, body: '' }
    },
}))
const { executeAutomation } = await import('../src/utils/automations.ts')
const automation = { id: 'persistence-test', owner_id: 'owner', name: 'Backup check', action_type: 'agent_prompt',
    target_url: 'http://example.test/health', monitoring_type: 'fetch', timeout_seconds: 5, retry_count: 0,
    schedule_kind: 'interval', interval_minutes: 1, organization_id: 'organization', notification_destinations: [],
} as AutomationRow
beforeEach(() => {
    failSave = 0; saveCount = 0; denied = false; probeFails = false; slow = false; clockOffset = 0; probeCount = 0
    statements.length = 0; outcomes.length = 0
    Date.now = () => actualNow() + clockOffset
})
afterEach(() => { Date.now = actualNow })

for (const save of [1, 2]) for (const warning of [false, true]) {
    test(`save ${save} failure after ${warning ? 'warning' : 'healthy'} probe does not create a failure case`, async () => {
        failSave = save; slow = warning
        await expect(executeAutomation(automation)).rejects.toBe(persistenceError)
        expect(probeCount).toBe(1)
        expect(outcomes).toEqual([])
        expect(statements.some(sql => sql.includes('SET status = \'failed\''))).toBe(false)
    })
}
test('a real probe failure retains its result and failure scheduling', async () => {
    probeFails = true
    await executeAutomation(automation)
    expect(outcomes).toHaveLength(1)
    expect(outcomes[0]?.kind).toBe('failure')
    expect(outcomes[0]?.message).toContain('HTTP 503')
    expect(statements.some(sql => sql.includes('consecutive_failures = consecutive_failures + 1'))).toBe(true)
})
test('access denial does not run the probe or create a monitoring case', async () => {
    denied = true
    await executeAutomation(automation)
    expect(probeCount).toBe(0)
    expect(outcomes).toEqual([])
})
test('successful persistence records recovery and resets failure scheduling', async () => {
    await executeAutomation(automation)
    expect(outcomes[0]?.kind).toBeNull()
    expect(saveCount).toBe(2)
    expect(statements.some(sql => sql.includes('consecutive_failures = 0'))).toBe(true)
})
test('non-monitoring actions retain their existing save-failure handling', async () => {
    failSave = 1
    await executeAutomation({ ...automation, action_type: 'echo' })
    expect(probeCount).toBe(0)
    expect(outcomes).toEqual([])
    expect(statements.some(sql => sql.includes('SET status = \'failed\''))).toBe(true)
})
