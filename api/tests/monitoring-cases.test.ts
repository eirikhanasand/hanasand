import { beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

let authorized = true
let admin = false
let rows: Record<string, unknown>[] = []
let values: unknown[] = []
let sql = ''
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: authorized, id: authorized ? 'owner' : null }) }))
mock.module('../src/utils/auth/hasRole.ts', () => ({ default: async () => ({ valid: admin }) }))
mock.module('../src/utils/db.ts', () => ({ default: async (query: string, params: unknown[]) => { sql = query; values = params; return { rows } } }))
mock.module('../src/utils/monitoringIssues.ts', () => ({ loadMonitoringIssues: async () => [{ caseNumber: 'HA-3', notifications: [{ messageId: 'receipt' }] }] }))
const { getMonitoringCases, updateMonitoringCase } = await import('../src/handlers/monitoringCases.ts')
const app = Fastify()
app.get('/cases/monitoring', getMonitoringCases)
app.get('/cases/monitoring/:id', getMonitoringCases)
app.patch('/cases/monitoring/:id', updateMonitoringCase)
beforeEach(() => { authorized = true; admin = false; rows = []; values = []; sql = '' })

test('authentication is required before querying cases', async () => {
    authorized = false
    expect((await app.inject('/cases/monitoring')).statusCode).toBe(401)
    expect(sql).toBe('')
})
test('list preserves owner and organization boundaries; elevated access is checked server-side', async () => {
    await app.inject('/cases/monitoring?organizationId=org-1&tenantId=org-1')
    expect(values).toEqual([false, 'owner', 'org-1', null])
    expect(sql).toContain('a.owner_id = $2')
    expect(sql).toContain('a.organization_id = $3')
    admin = true
    await app.inject('/cases/monitoring')
    expect(values).toEqual([true, 'owner', null, null])
    expect((await app.inject('/cases/monitoring?tenantId=someone-else')).statusCode).toBe(403)
})
test('existing MON references expose persisted lifecycle and notification details', async () => {
    rows = [{ id: '3', monitor_name: 'Inference', summary: 'HTTP 503', kind: 'failure', occurrences: 53, automation_id: 'monitor', resolved_at: null }]
    let result = await app.inject('/cases/monitoring/HA-3')
    expect(result.json().case).toMatchObject({ id: 'HA-3', title: 'HA-3 · Inference', status: 'open', occurrences: 53, notifications: [{ messageId: 'receipt' }] })
    expect(values).toEqual([false, 'owner', null, '3'])
    const legacy = await app.inject('/cases/monitoring/MON-3')
    expect(legacy.json().case).toEqual(result.json().case)
    rows[0].resolved_at = '2026-09-07T10:00:00Z'
    result = await app.inject('/cases/monitoring/HA-3')
    expect(result.json().case.status).toBe('resolved')
    rows = []
    expect((await app.inject('/cases/monitoring/HA-3')).statusCode).toBe(404)
    expect((await app.inject('/cases/monitoring/HA-invalid')).statusCode).toBe(404)
})

const patch = (payload: unknown, suffix = '') => app.inject({ method: 'PATCH', url: `/cases/monitoring/HA-3${suffix}`, payload })
test('case mutations require authentication, valid input and the same owner scope as reads', async () => {
    authorized = false
    expect((await patch({ status: 'closed' })).statusCode).toBe(401)
    expect(sql).toBe('')
    authorized = true
    for (const payload of [{}, { status: 'invalid' }, { severity: 'urgent' }, { notificationsEnabled: 'yes' }, { comment: ' ' }, { comment: 'a'.repeat(5001) }, { author: 'someone' }]) {
        expect((await patch(payload)).statusCode).toBe(400)
    }
    expect(sql).toBe('')
    expect((await patch({ status: 'closed' }, '?tenantId=other')).statusCode).toBe(403)
    expect((await patch({ status: 'closed' })).statusCode).toBe(404)
    expect(sql).toContain('a.owner_id = $2')
    expect(sql).toContain('a.organization_id = $3')
})
test('updates preserve recovery timestamps and append comments with authenticated attribution', async () => {
    rows = [{ id: '3' }]
    expect((await patch({ status: 'closed', severity: 'critical', notificationsEnabled: false, comment: ' Investigating ' }, '?organizationId=org-1')).statusCode).toBe(200)
    expect(values.slice(0, 7)).toEqual([false, 'owner', 'org-1', '3', 'closed', 'critical', false])
    expect(JSON.parse(values[7] as string)[0]).toMatchObject({ author: 'owner', body: 'Investigating' })
    expect(sql).toContain('comments = i.comments || $8::jsonb')
    expect(sql).not.toContain('resolved_at =')
    expect((await patch({ status: 'open' })).statusCode).toBe(200)
    expect(values[4]).toBe('open')
    expect(values[7]).toBe('[]')
})
