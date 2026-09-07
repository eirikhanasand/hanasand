import { afterAll, expect, mock, test } from 'bun:test'
import pg from 'pg'
import Fastify from 'fastify'
if (process.env.PERSONAL_AUTOMATION_TEST_DB !== '1') throw Error('Requires the disposable local personal_automation_test database on port 55439')
const db = new pg.Pool({ host: '127.0.0.1', port: 55439, database: 'personal_automation_test', user: process.env.USER })
const query = (sql: string, values?: unknown[]) => db.query(sql, values)
let recordedOutcomes = 0
let admin = false
let user = 'alice'
mock.module('../src/utils/db.ts', () => ({ default: query, queryOnce: query, withTransaction: async () => { throw Error("Unexpected transaction") } }))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: user }) }))
mock.module('../src/utils/auth/hasRole.ts', () => ({ default: async () => ({ valid: admin }) }))
mock.module('../src/utils/monitoringIssues.ts', () => ({ loadMonitoringIssues: async () => [], recordMonitoringOutcome: async () => { recordedOutcomes++ } }))
mock.module('../src/utils/systemCron.ts', () => ({ hasUnifiedScheduledJobsCache: () => true, listUnifiedScheduledJobs: async () => { throw Error('System registry must not be read') }, updateManagedCronJob: async () => { throw Error('System registry must not be changed') } }))
const { executeAutomation } = await import('../src/utils/automations.ts')
const handlers = await import('../src/handlers/automations.ts')
const { getSystemCronJobs, putSystemCronJob } = await import('../src/handlers/systemCron.ts')
const { checkScheduledAutomationAccess } = await import('../src/utils/automationAccess.ts')
const { discordWebhookFileModelLabel, isDiscordWebhookUrl } = await import('../src/utils/alerts/discordWebhookFile.ts')
const app = Fastify()
app.get('/automations', handlers.getAutomations)
app.post('/automations', handlers.postAutomation)
app.get('/automations/:id', handlers.getAutomation)
app.put('/automations/:id', handlers.putAutomation)
app.delete('/automations/:id', handlers.deleteAutomation)
app.post('/automations/:id/run', handlers.postAutomationRunNow)
app.get('/system/cron', getSystemCronJobs)
app.put('/system/cron/:id', putSystemCronJob)
afterAll(async () => { await app.close(); await db.end() })

test('personal automation persistence, owner and organization isolation, privileged actions and revoked scheduled access', async () => {
    await query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;
        CREATE TABLE organizations(id text PRIMARY KEY,status text);
        CREATE TABLE organization_members(organization_id text,user_id text,status text);
        CREATE TABLE user_roles(user_id text,role_id text);
        CREATE TABLE agent_automations(id text PRIMARY KEY,owner_id text,name text,prompt text,target_url text,monitoring_type text,follow_redirects boolean,user_agent text,expected_down boolean,upside_down boolean,timeout_seconds int,retry_count int,schedule_kind text,interval_minutes int,run_at timestamptz,status text,action_type text,organization_id text,timezone text,model_name text,notify_on text,notify_warnings boolean,next_run_at timestamptz,notification_destinations text[],json_rule jsonb,consecutive_failures int DEFAULT 0,paused_reason text,last_status text,last_run_at timestamptz,last_error text,last_completed_at timestamptz,last_result text,run_count int DEFAULT 0,certificate_status text,certificate_subject text,certificate_issuer text,certificate_expires_at timestamptz,created_at timestamptz DEFAULT NOW(),updated_at timestamptz DEFAULT NOW());
        CREATE TABLE agent_automation_runs(id text,automation_id text,owner_id text,status text,warning boolean,started_at timestamptz,result text,error text,provider text,model text,completed_at timestamptz,duration_ms int,artifacts jsonb);
        CREATE TABLE monitoring_issues(id bigint,automation_id text,last_seen_at timestamptz);
        INSERT INTO organizations VALUES ('org-a','active'),('org-b','active');
        INSERT INTO organization_members VALUES ('org-a','alice','active'),('org-b','bob','active');`)
    const payload = { name: 'Private reminder', prompt: 'Renew certificate', actionType: 'echo', scheduleKind: 'interval', intervalMinutes: 10, notifyOn: 'never' }
    expect((await app.inject('/automations')).json()).toEqual({ canManageSystem: false, automations: [] })
    const created = await app.inject({ method: 'POST', url: '/automations', payload })
    expect(created.statusCode).toBe(201)
    const id = created.json().automation.id
    expect((await app.inject(`/automations/${id}`)).json().automation).toMatchObject({ ownerId: 'alice', organizationId: null, intervalMinutes: 10 })
    await executeAutomation((await query('SELECT * FROM agent_automations WHERE id=$1', [id])).rows[0])
    expect((await query('SELECT last_status,next_run_at,last_result FROM agent_automations WHERE id=$1', [id])).rows[0]).toMatchObject({ last_status: 'completed', next_run_at: expect.any(Date), last_result: expect.stringContaining('Renew certificate') })
    user = 'bob'
    expect((await app.inject('/automations')).json().automations).toEqual([])
    for (const method of ['GET', 'PUT', 'DELETE', 'POST'] as const) {
        const response = await app.inject({ method, url: `/automations/${id}${method === 'POST' ? '/run' : ''}`, ...(method === 'PUT' ? { payload } : {}) })
        expect(response.statusCode).toBe(404)
    }
    user = 'alice'
    expect((await app.inject({ method: 'PUT', url: `/automations/${id}`, payload: { ...payload, name: 'Updated reminder' } })).statusCode).toBe(200)
    expect((await app.inject(`/automations/${id}`)).json().automation.name).toBe('Updated reminder')
    for (const extra of [{ organizationId: 'org-b' }, { actionType: 'mail_health_check' }, { modelName: 'discord-webhook-file:/tmp/private' }, { notificationDestinations: ['discord-webhook-file:/tmp/private'] }, { actionType: 'agent_prompt', targetUrl: 'system:metrics', monitoringType: 'json', jsonRule: { path: 'cpu', operator: 'gt', value: 80, aggregate: 'max' } }]) {
        expect((await app.inject({ method: 'POST', url: '/automations', payload: { ...payload, ...extra } })).statusCode).toBe(403)
    }
    const ownOrg = await app.inject({ method: 'POST', url: '/automations', payload: { ...payload, organizationId: 'org-a' } })
    expect(ownOrg.statusCode).toBe(201)
    const orgJob = ownOrg.json().automation.id
    const scheduled = { actionType: 'echo', organizationId: 'org-a', targetUrl: null, modelName: null }
    await checkScheduledAutomationAccess(scheduled, 'alice')
    await query("UPDATE organization_members SET status='removed' WHERE user_id='alice'")
    expect((await app.inject(`/automations/${orgJob}`)).statusCode).toBe(404)
    expect((await app.inject('/automations')).json().automations.map((row: { id: string }) => row.id)).toEqual([id])
    await expect(checkScheduledAutomationAccess(scheduled, 'alice')).rejects.toThrow('no longer have access')
    await expect(checkScheduledAutomationAccess({ ...scheduled, organizationId: null, actionType: 'mail_health_check' }, 'alice')).rejects.toThrow('administrator access')
    const revoked = (await query('SELECT * FROM agent_automations WHERE id=$1', [orgJob])).rows[0]
    await executeAutomation({ ...revoked, action_type: 'agent_prompt', target_url: 'https://example.com', notification_destinations: ['discord-webhook-file:/tmp/private'] })
    expect((await query('SELECT status,error FROM agent_automation_runs WHERE automation_id=$1', [orgJob])).rows[0]).toMatchObject({ status: 'failed', error: 'System monitoring and server notification files require administrator access.' })
    expect(recordedOutcomes).toBe(0)
    expect((await app.inject('/system/cron')).statusCode).toBe(403)
    expect((await app.inject({ method: 'PUT', url: '/system/cron/job', payload: {} })).statusCode).toBe(403)
    const webhook = 'https://discord.com/api/webhooks/123456/example_token'
    const once = await app.inject({ method: 'POST', url: '/automations', payload: { ...payload, actionType: 'system_alert', modelName: webhook, scheduleKind: 'once', runAt: new Date(Date.now() + 60000).toISOString() } })
    expect(once.statusCode).toBe(201)
    expect(once.json().automation.scheduleKind).toBe('once')
    expect(discordWebhookFileModelLabel(webhook)).toBe('discord-webhook')
    expect(isDiscordWebhookUrl('https://discord.com.evil.test/api/webhooks/123/a')).toBe(false)
    expect(isDiscordWebhookUrl('https://discord.com/api/webhooks/123/a/../../other')).toBe(false)
    admin = true
    user = 'administrator'
    expect((await app.inject('/automations')).json().automations).toHaveLength(3)
    expect((await app.inject('/automations?scope=personal')).json()).toEqual({ canManageSystem: true, automations: [] })
    admin = false
    user = 'alice'
    expect((await app.inject({ method: 'DELETE', url: `/automations/${id}` })).statusCode).toBe(200)
    expect((await app.inject('/automations')).json().automations).toHaveLength(1)
})
