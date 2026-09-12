import { expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
if (process.env.DB_HOST !== 'monitor-test-db') throw Error('Requires the disposable monitor-test-db database')
let viewer = 'sindre'
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: viewer }) }))
mock.module('../src/utils/auth/hasRole.ts', () => ({ default: async () => ({ valid: viewer === 'admin' }) }))
mock.module('../src/utils/monitoringIssues.ts', () => ({ loadMonitoringIssues: async () => [] }))
mock.module('../src/utils/monitoringCaseEvents.ts', () => ({ monitoringCheckDetails: () => ({}), loadMonitoringCaseEvents: async () => ({ events: [], eventTotal: 0 }) }))
const { queryOnce: query, closeDatabase } = await import('../src/utils/db.ts')
const { default: schema } = await import('../src/utils/db/monitoringIssuesSchema.ts')
const { getMonitoringCases, updateMonitoringCase } = await import('../src/handlers/monitoringCases.ts')
const app = Fastify()
app.get('/cases', getMonitoringCases)
app.get('/cases/:id', getMonitoringCases)
app.patch('/cases/:id', updateMonitoringCase)

test('host cases follow current VM access without granting monitor administration', async () => {
    await query(`CREATE TABLE vms(name text PRIMARY KEY, owner text, created_by text, access_users jsonb, deleted_at timestamptz);
        CREATE TABLE organizations(id text, status text);
        CREATE TABLE organization_members(organization_id text, user_id text, status text);
        CREATE TABLE agent_automations(id text PRIMARY KEY, name text, owner_id text, organization_id text, action_type text, target_url text, model_name text, notification_destinations text[], monitoring_type text, timeout_seconds int, retry_count int, follow_redirects boolean, expected_down boolean, upside_down boolean);
        CREATE TABLE agent_automation_runs(id text PRIMARY KEY, automation_id text);`)
    await schema()
    await query(`INSERT INTO vms VALUES ('cashflow','sindre','creator','["eiriktest"]',NULL);
        INSERT INTO agent_automations(id,name,owner_id,action_type,target_url,model_name) VALUES
            ('tls','TLS','admin','agent_prompt','pengeflyt.com:443','discord-webhook-file:monitoring'),
            ('other','Other host','admin','agent_prompt','other.example:443',NULL);
        INSERT INTO monitoring_case_vms VALUES ('tls','cashflow','pengeflyt.com:443');
        INSERT INTO monitoring_issues(automation_id,fingerprint,kind,summary) VALUES ('tls','tls-expired','failure','Certificate expired'),('other','other-failure','failure','Unrelated host');`)
    const list = async () => (await app.inject('/cases')).json().items
    for (const id of ['sindre', 'eiriktest', 'creator']) {
        viewer = id
        expect((await list()).map((item: any) => item.id)).toEqual(['HA-1'])
        expect((await app.inject('/cases/HA-1')).json().case.canManage).toBe(false)
        expect((await app.inject('/cases/HA-2')).statusCode).toBe(404)
        expect((await app.inject({ method: 'PATCH', url: '/cases/HA-1', payload: { comment: 'Attempt' } })).statusCode).toBe(404)
    }
    viewer = 'unrelated'
    expect(await list()).toEqual([])
    viewer = 'eiriktest'
    await query("UPDATE vms SET access_users='[]'")
    expect((await app.inject('/cases/HA-1')).statusCode).toBe(404)
    viewer = 'sindre'
    await query('UPDATE vms SET deleted_at=NOW()')
    expect(await list()).toEqual([])
    await query('UPDATE vms SET deleted_at=NULL')
    await query("UPDATE agent_automations SET target_url='another.example:443' WHERE id='tls'")
    expect(await list()).toEqual([])
    await query("UPDATE agent_automations SET target_url='pengeflyt.com:443',organization_id='private-org' WHERE id='tls'")
    expect(await list()).toEqual([])
    viewer = 'admin'
    expect((await list()).length).toBe(2)
    expect((await app.inject('/cases/HA-1')).json().case.canManage).toBe(true)
    await app.close()
    await closeDatabase()
})
