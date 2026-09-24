import { expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
if (process.env.DB_HOST !== 'monitor-test-db') throw Error('Requires the disposable monitor-test-db database')
let viewer = 'sindre'
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: viewer }) }))
mock.module('../src/utils/auth/hasRole.ts', () => ({ default: async () => ({ valid: viewer === 'admin' }) }))
mock.module('../src/utils/monitoringIssues.ts', () => ({ loadMonitoringIssues: async () => [] }))
mock.module('../src/utils/monitoringCaseEvents.ts', () => ({ loadMonitoringRelatedChecks: async () => [], monitoringCheckDetails: () => ({}), loadMonitoringCaseEvents: async () => ({ events: [], eventTotal: 0 }) }))
const { queryOnce: query, closeDatabase } = await import('../src/utils/db.ts')
const { default: schema } = await import('../src/utils/db/monitoringIssuesSchema.ts')
const { getMonitoringCases, updateMonitoringCase } = await import('../src/handlers/monitoringCases.ts')
const app = Fastify()
app.get('/cases', getMonitoringCases)
app.get('/cases/:id', getMonitoringCases)
app.patch('/cases/:id', updateMonitoringCase)

test('host cases follow current VM access without granting monitor administration', async () => {
    await query(`CREATE TABLE vms(name text PRIMARY KEY, owner text, created_by text, access_users jsonb, deleted_at timestamptz);
        CREATE TABLE organizations(id text PRIMARY KEY, status text);
        CREATE TABLE organization_members(organization_id text, user_id text, status text, role text DEFAULT 'editor');
        CREATE TABLE agent_automations(id text PRIMARY KEY, name text, owner_id text, organization_id text, action_type text, target_url text, model_name text, notification_destinations text[], updated_at timestamptz, monitoring_type text, timeout_seconds int, retry_count int, follow_redirects boolean, expected_down boolean, upside_down boolean);
        CREATE TABLE agent_automation_runs(id text PRIMARY KEY, automation_id text);`)
    await (await import('../src/utils/db/vmOrganizationSchema.ts')).default()
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
        expect((await app.inject('/cases?organizationId=selected-org')).json().items).toEqual([])
        expect((await app.inject('/cases/HA-1?organizationId=selected-org')).statusCode).toBe(404)
        expect((await app.inject({ method: 'PATCH', url: '/cases/HA-1', payload: { comment: 'Attempt' } })).statusCode).toBe(404)
    }
    viewer = 'unrelated'
    expect(await list()).toEqual([])
    expect((await app.inject('/cases?organizationId=selected-org')).json().items).toEqual([])
    viewer = 'eiriktest'
    await query('UPDATE vms SET access_users=\'[]\'')
    expect((await app.inject('/cases/HA-1')).statusCode).toBe(404)
    viewer = 'sindre'
    await query('UPDATE vms SET deleted_at=NOW()')
    expect(await list()).toEqual([])
    await query('UPDATE vms SET deleted_at=NULL')
    await query('UPDATE agent_automations SET target_url=\'another.example:443\' WHERE id=\'tls\'')
    expect(await list()).toEqual([])
    await query('UPDATE agent_automations SET target_url=\'pengeflyt.com:443\',organization_id=\'private-org\' WHERE id=\'tls\'')
    expect(await list()).toEqual([])
    viewer = 'admin'
    expect((await list()).map((item: any) => item.id)).toEqual(['HA-2'])
    expect((await app.inject('/cases?organizationId=private-org')).json().items.map((item: any) => item.id)).toEqual(['HA-1'])
    expect((await app.inject('/cases?organizationId=selected-org')).json().items).toEqual([])
    expect((await app.inject('/cases/HA-1?organizationId=selected-org')).statusCode).toBe(404)
    expect((await app.inject('/cases/HA-1?organizationId=private-org')).json().case.canManage).toBe(true)
    await query('INSERT INTO organizations VALUES (\'private-org\',\'active\')')
    await query('UPDATE monitoring_issues SET comments=$1::jsonb, disk_diagnostics=$2::jsonb WHERE id=2', [JSON.stringify([{ body: 'Preserve history' }]), JSON.stringify({ host: 'inspur' })])
    const { assignMonitoringOrganization } = await import('../scripts/scope-hanasand-monitoring.ts')
    await expect(assignMonitoringOrganization(['other'], 'wrong-owner', 'private-org', true)).rejects.toThrow()
    expect((await assignMonitoringOrganization(['other'], 'admin', 'private-org')).applied).toBe(false)
    expect((await query('SELECT organization_id FROM agent_automations WHERE id=\'other\'')).rows[0].organization_id).toBeNull()
    await assignMonitoringOrganization(['other'], 'admin', 'private-org', true)
    const saved = (await query('SELECT id,comments,disk_diagnostics,correlation_key FROM monitoring_issues WHERE id=2')).rows[0]
    expect(saved).toMatchObject({ id: '2', comments: [{ body: 'Preserve history' }], disk_diagnostics: { host: 'inspur' } })
    expect(saved.correlation_key).toBeTruthy()
    await assignMonitoringOrganization(['other'], 'admin', 'private-org', true)
    expect((await query('SELECT correlation_key FROM monitoring_issues WHERE id=2')).rows[0].correlation_key).toBe(saved.correlation_key)
    expect(await list()).toEqual([])
    expect((await app.inject('/cases/HA-2?organizationId=private-org')).statusCode).toBe(200)
    expect((await app.inject({ method: 'PATCH', url: '/cases/HA-2?organizationId=selected-org', payload: { comment: 'Wrong organization' } })).statusCode).toBe(404)
    await app.close()
    await closeDatabase()
})
