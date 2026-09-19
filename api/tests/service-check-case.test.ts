import { expect, test } from 'bun:test'
import { recordServiceCheckCase } from '../src/utils/status/serviceCheckCase.ts'

test('database observations create scoped case events for failures, warnings and recovery without scheduling duplicate checks', async () => {
    const writes: { sql: string, values: unknown[] }[] = []
    const outcomes: unknown[][] = []
    const query = async (sql: string, values: unknown[] = []) => {
        writes.push({ sql, values })
        return { rows: sql.startsWith('SELECT') ? [{ id: values[0], owner_id: 'owner', organization_id: 'org' }] : [] }
    }
    for (const status of ['down', 'degraded', 'up'] as const) {
        await recordServiceCheckCase('database', 'Database dashboard', { status, checkedAt: `2026-09-19T10:00:0${outcomes.length}Z`, latencyMs: 50, message: status }, query as never, async (...args) => { outcomes.push(args) })
    }
    expect(outcomes.map(args => args[2])).toEqual(['failure', 'warning', null])
    expect(new Set(outcomes.map(args => (args[0] as { id: string }).id)).size).toBe(1)
    expect(writes[0].sql).toContain('organization_id IS NOT NULL')
    expect(writes[0].sql).toContain('notification_destinations, NULL')
    expect(writes.filter(w => w.sql.includes('INSERT INTO agent_automation_runs'))).toHaveLength(3)
})

test('missing monitoring owner is a visible error, not a silently dropped case', async () => {
    await expect(recordServiceCheckCase('database', 'Database dashboard', { status: 'down', checkedAt: new Date().toISOString(), latencyMs: 0, message: 'Failed' }, (async () => ({ rows: [] })) as never)).rejects.toThrow('Case monitoring is not configured')
})

test('scheduled job identity survives display-name changes and uses the system-only target', async () => {
    const writes: unknown[][] = []
    const query = async (sql: string, values: unknown[] = []) => {
        if (sql.startsWith('INSERT INTO agent_automations')) writes.push(values)
        return { rows: sql.startsWith('SELECT') ? [{ id: values[0], owner_id: 'owner', organization_id: 'org' }] : [] }
    }
    for (const name of ['Old name', 'New name']) await recordServiceCheckCase('scheduled-jobs', name, {
        checkId: 'job-a', status: 'down', checkedAt: new Date().toISOString(), latencyMs: 0, message: 'Blocked',
    }, query as never, async () => {})
    expect(writes[0][0]).toBe(writes[1][0])
    expect(writes[0][3]).toBe('system:cron:job-a')
})
