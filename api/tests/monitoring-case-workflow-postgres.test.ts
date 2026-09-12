import { expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
if (process.env.DB_HOST !== 'monitor-test-db') throw Error('Requires the disposable monitor-test-db database')
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'owner', authenticatedId: 'reviewer' }) }))
mock.module('../src/utils/auth/hasRole.ts', () => ({ default: async () => ({ valid: true }) }))
const { queryOnce: query } = await import('../src/utils/db.ts')
const { default: schema } = await import('../src/utils/db/monitoringIssuesSchema.ts')
const { recordMonitoringOutcome } = await import('../src/utils/monitoringIssues.ts')
const { getMonitoringCases, updateMonitoringCase } = await import('../src/handlers/monitoringCases.ts')
const app = Fastify()
app.addHook('preHandler', async req => { if (req.headers['x-test-machine']) (req as any).apiKeyAuth = { serviceAccount: true } })
app.get('/cases/:id', getMonitoringCases)
app.patch('/cases/:id', updateMonitoringCase)

test('durable recovery history, comments, progress, AI review and stale-review rejection', async () => {
    await query(`CREATE TABLE organizations(id text, status text); CREATE TABLE organization_members(organization_id text, user_id text, status text);
        CREATE TABLE agent_automations(id text PRIMARY KEY, name text, owner_id text, organization_id text, action_type text, target_url text, model_name text, notification_destinations text[]);
        CREATE TABLE agent_automation_runs(id text PRIMARY KEY, automation_id text);`)
    await schema()
    await schema()
    await query("INSERT INTO agent_automations(id,name,owner_id,action_type) VALUES ('workflow','Test monitor','owner','agent_prompt')")
    const automation = { id: 'workflow', monitoring_type: 'fetch', target_url: 'https://example.com', notify_on: 'never' } as any
    async function outcome(id: string, kind: 'failure' | null, message: string) {
        await query('INSERT INTO agent_automation_runs(id,automation_id) VALUES ($1,$2)', [id, automation.id])
        await recordMonitoringOutcome(automation, id, kind, message)
    }
    await outcome('failure1', 'failure', 'HTTP 503')
    const get = async () => (await app.inject('/cases/HA-1')).json().case
    const patch = (payload: unknown, machine = false) => app.inject({ method: 'PATCH', url: '/cases/HA-1', payload, headers: machine ? { 'x-test-machine': '1' } : {} })
    expect((await patch({ status: 'closed' })).statusCode).toBe(400)
    expect((await patch({ status: 'in_progress' })).statusCode).toBe(200)
    expect((await get()).history.at(-1)).toMatchObject({ actor: 'reviewer', fromStatus: 'open', toStatus: 'in_progress' })
    await outcome('recovery1', null, 'HTTP 200; request succeeded')
    expect((await get()).status).toBe('in_progress')
    expect((await get()).history.at(-1)).toMatchObject({ action: 'recovered', actor: 'Health monitoring', note: 'HTTP 200; request succeeded' })
    expect((await patch({ status: 'resolved', comment: 'AI repaired the dependency and verified the response.', resolutionMethod: 'ai' })).statusCode).toBe(200)
    const resolution = (await get()).resolution
    expect(resolution).toMatchObject({ type: 'ai', actor: 'reviewer' })
    expect((await patch({ confirmResolutionId: resolution.id }, true)).statusCode).toBe(403)
    expect((await patch({ confirmResolutionId: 'outdated' })).statusCode).toBe(409)
    const confirmations = await Promise.all([patch({ confirmResolutionId: resolution.id }), patch({ confirmResolutionId: resolution.id })])
    expect(confirmations.map(result => result.statusCode).sort()).toEqual([200, 409])
    expect((await get()).resolution).toMatchObject({ confirmedBy: 'reviewer', confirmedAt: expect.any(String) })
    expect((await get()).history.filter((event: any) => event.action === 'confirmed')).toHaveLength(1)
    expect((await patch({ status: 'open', comment: 'New evidence' })).statusCode).toBe(200)
    expect((await get()).resolution).toBeNull()
    expect((await patch({ confirmResolutionId: resolution.id })).statusCode).toBe(409)
    await outcome('failure2', 'failure', 'HTTP 503')
    expect((await get()).history.at(-1).action).toBe('recurred')
    expect((await get()).comments.some((comment: any) => comment.author === 'reviewer' && comment.body === 'New evidence')).toBe(true)
    // A separate automatically managed case records recovery and a new failure invalidates review.
    await outcome('failure3', 'failure', 'HTTP 404')
    await outcome('recovery2', null, 'HTTP 200 again')
    const automatic = (await app.inject('/cases/HA-3')).json().case
    expect(automatic.resolution.type).toBe('automation')
    expect(automatic.comments.at(-1).body).toBe('HTTP 200 again')
    await outcome('failure4', 'failure', 'HTTP 404')
    expect((await app.inject('/cases/HA-3')).json().case.resolution).toBeNull()
})
