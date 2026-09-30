import { afterAll, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

// A disposable embedded PostgreSQL engine is opt-in; no application database is used.
const modulePath = process.env.PUSH_TEST_PGLITE_MODULE
if (!modulePath) {
    test.skip('external monitoring PostgreSQL integration (set PUSH_TEST_PGLITE_MODULE)', () => {})
} else {
    const { PGlite } = await import(modulePath)
    const database = new PGlite()
    const query = (sql: string, params: unknown[] = []) => database.query(sql, params)
    let beforeTransaction: (() => Promise<void>) | undefined
    mock.module('../src/utils/db.ts', () => ({ default: query, queryOnce: query,
        withTransaction: async (work: (q: typeof query) => unknown) => {
            const before = beforeTransaction
            beforeTransaction = undefined
            if (before) await before()
            return database.transaction((tx: { query: typeof query }) => work(tx.query.bind(tx)))
        } }))
    mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async (req: { headers: Record<string, string> }) => ({ valid: Boolean(req.headers.id), id: req.headers.id }) }))
    mock.module('../src/utils/auth/hasRole.ts', () => ({ default: async () => ({ valid: false }) }))
    mock.module('../src/utils/systemEvent.ts', () => ({ recordSystemEvent: async () => {} }))

    const { default: caseSchema } = await import('../src/utils/db/monitoringIssuesSchema.ts')
    const { default: pushSchema } = await import('../src/utils/db/pushMonitoringSchema.ts')
    const { ingestPushEvent, checkPushMonitor, parsePushEvent } = await import('../src/utils/pushMonitoring.ts')
    const { postPushMonitoringEvent, postPushMonitoringKey } = await import('../src/handlers/pushMonitoring.ts')
    const { validateApiKey, matchApiKeyScope } = await import('../src/utils/auth/apiKeys.ts')
    const { loadMonitoringCaseEvents } = await import('../src/utils/monitoringCaseEvents.ts')
    const { deleteAutomation } = await import('../src/handlers/automations.ts')
    const app = Fastify()
    app.addHook('preHandler', async req => {
        const secret = req.headers['x-api-key']
        if (typeof secret === 'string') {
            const key = await validateApiKey(secret)
            if (key && matchApiKeyScope(key.apiKey.scopes, req.method, req.routeOptions.url)) {
                Object.assign(req, { apiKeyAuth: key })
            }
        }
    })
    app.post('/api/automations/:id/events', postPushMonitoringEvent)
    app.post('/api/automations/:id/sender-key', postPushMonitoringKey)
    app.delete('/api/automations/:id', deleteAutomation)
    afterAll(async () => { await app.close(); await database.close() })

    test('durable events, scoped keys, retries, ordering, rollback, offline detection and HA case recovery', async () => {
        await database.exec(`
            CREATE TABLE users (id text PRIMARY KEY, active boolean DEFAULT true, deletion_scheduled_at timestamptz, account_type text DEFAULT 'user');
            CREATE TABLE organizations (id text PRIMARY KEY, status text);
            CREATE TABLE organization_members (organization_id text, user_id text, role text, status text);
            CREATE TABLE roles (id text PRIMARY KEY, name text, description text, priority int);
            CREATE TABLE user_roles (user_id text, role_id text);
            CREATE TABLE vms (name text PRIMARY KEY);
            CREATE TABLE api_keys (id text PRIMARY KEY, owner_id text, organization_id text, name text, tier text, description text,
                enabled boolean, key_prefix text UNIQUE, secret_hash text, expires_at timestamptz, last_used_at timestamptz,
                created_at timestamptz DEFAULT NOW(), updated_at timestamptz DEFAULT NOW());
            CREATE TABLE api_key_scopes (id text PRIMARY KEY, api_key_id text REFERENCES api_keys(id), method text, route text,
                enabled boolean, per_second int, per_minute int, per_hour int, per_day int,
                created_at timestamptz DEFAULT NOW(), updated_at timestamptz DEFAULT NOW());
            CREATE TABLE agent_automations (id text PRIMARY KEY, owner_id text, name text, prompt text, action_type text DEFAULT 'agent_prompt',
                target_url text, monitoring_type text DEFAULT 'push', status text DEFAULT 'active', timeout_seconds int DEFAULT 180,
                retry_count int DEFAULT 0, follow_redirects boolean DEFAULT false, expected_down boolean DEFAULT false, upside_down boolean DEFAULT false,
                schedule_kind text DEFAULT 'interval', interval_minutes int DEFAULT 1, model_name text, organization_id text,
                notification_destinations text[] DEFAULT '{}', notify_on text DEFAULT 'never', notify_warnings boolean DEFAULT false,
                consecutive_failures int DEFAULT 0, run_count int DEFAULT 0, last_status text, last_run_at timestamptz,
                last_completed_at timestamptz, next_run_at timestamptz, last_result text, last_error text, updated_at timestamptz DEFAULT NOW());
            CREATE TABLE agent_automation_runs (id text PRIMARY KEY, automation_id text REFERENCES agent_automations(id), owner_id text,
                status text, warning boolean DEFAULT false, result text, error text, provider text, model text, artifacts jsonb,
                started_at timestamptz DEFAULT NOW(), completed_at timestamptz, duration_ms int);
            INSERT INTO users(id) VALUES ('test-owner');
            INSERT INTO agent_automations(id,owner_id,name,target_url) VALUES ('sensor','test-owner','Basement moisture','home-1/moisture'),
                ('other','test-owner','Other sensor','home-2/moisture');
        `)
        await caseSchema()
        await pushSchema()
        // Re-running the new schema must preserve state and history.
        await pushSchema()
        const keyResponse = await app.inject({ method: 'POST', url: '/api/automations/sensor/sender-key', headers: { id: 'test-owner' } })
        expect(keyResponse.statusCode).toBe(201)
        const key = keyResponse.json().secret
        const keyId = (await validateApiKey(key))!.apiKey.id
        let sequence = 0
        const makeEvent = (type: 'incident' | 'recovery' | 'heartbeat') => parsePushEvent({ eventId: `event-${++sequence}`, sequence,
            source: 'home-1/moisture', type, observedAt: new Date().toISOString(),
            ...(type === 'heartbeat' ? {} : { message: type === 'incident' ? 'Moisture detected. Check for a leak.' : 'A fresh reading confirms the sensor is dry.' }),
            details: { podId: 'pod-1', sensorId: 'moisture', value: type === 'incident' } })
        const incident = makeEvent('incident')
        expect((await app.inject({ method: 'POST', url: '/api/automations/sensor/events', payload: incident })).statusCode).toBe(401)
        expect((await app.inject({ method: 'POST', url: '/api/automations/sensor/sender-key', headers: { id: 'other-owner' } })).statusCode).toBe(404)
        const headers = { 'x-api-key': key }
        const delivered = await app.inject({ method: 'POST', url: '/api/automations/sensor/events', headers, payload: incident })
        expect(delivered.statusCode).toBe(201)
        const caseNumber = delivered.json().caseNumber
        expect(caseNumber).toMatch(/^HA-\d+$/)
        expect((await query('SELECT run_count,last_status FROM agent_automations WHERE id=\'sensor\'')).rows[0]).toMatchObject({ run_count: 1, last_status: 'failed' })
        expect(new Date((await query('SELECT next_run_at FROM agent_automations WHERE id=\'sensor\'')).rows[0].next_run_at).getSeconds()).toBe(0)
        const duplicate = await app.inject({ method: 'POST', url: '/api/automations/sensor/events', headers, payload: incident })
        expect(duplicate.json().duplicate).toBe(true)
        expect((await query('SELECT COUNT(*)::int AS count FROM agent_automation_runs')).rows[0].count).toBe(1)
        expect((await app.inject({ method: 'POST', url: '/api/automations/other/events', headers, payload: incident })).statusCode).toBe(403)
        expect((await app.inject({ method: 'POST', url: '/api/automations/sensor/events', headers, payload: { ...incident, message: 'Changed' } })).statusCode).toBe(409)

        await ingestPushEvent('sensor', keyId, makeEvent('heartbeat'))
        expect((await query('SELECT resolved_at FROM monitoring_issues')).rows[0].resolved_at).toBeNull()
        expect((await query('SELECT last_error FROM agent_automations WHERE id=\'sensor\'')).rows[0].last_error).toContain('Moisture detected')
        await ingestPushEvent('sensor', keyId, makeEvent('recovery'))
        expect((await query('SELECT resolved_at FROM monitoring_issues')).rows[0].resolved_at).not.toBeNull()
        const recurred = await ingestPushEvent('sensor', keyId, makeEvent('incident'))
        expect(recurred.caseNumber).toBe(caseNumber)
        await ingestPushEvent('sensor', keyId, makeEvent('recovery'))
        const stale = { ...incident, eventId: 'delayed-older-event', sequence: 2 }
        await expect(ingestPushEvent('sensor', keyId, stale)).rejects.toThrow('already been used')
        // A previously unseen old sequence can be acknowledged without changing state.
        sequence += 2
        await ingestPushEvent('sensor', keyId, makeEvent('heartbeat'))
        const late = { ...incident, eventId: 'delayed-event', sequence: sequence - 1 }
        expect((await ingestPushEvent('sensor', keyId, late)).applied).toBe(false)
        expect((await query('SELECT incident FROM monitoring_push_sources WHERE automation_id=\'sensor\'')).rows[0].incident).toBe(false)

        await query('UPDATE monitoring_push_sources SET observed_at=NOW()-INTERVAL \'10 minutes\' WHERE automation_id=\'sensor\'')
        await checkPushMonitor('sensor')
        expect((await query('SELECT last_status FROM agent_automations WHERE id=\'sensor\'')).rows[0].last_status).toBe('failed')
        await ingestPushEvent('sensor', keyId, makeEvent('heartbeat'))
        expect((await query('SELECT last_status FROM agent_automations WHERE id=\'sensor\'')).rows[0].last_status).toBe('completed')
        const evidence = await loadMonitoringCaseEvents(caseNumber.slice(3), 0)
        expect(evidence.events.length).toBeGreaterThan(0)
        expect(evidence.events.some((entry: { details: { event?: { type: string } } }) => entry.details.event?.type === 'incident')).toBe(true)

        // Force a real constraint failure after state/run writes; the transaction must roll back all three.
        await query('ALTER TABLE monitoring_push_events ADD CONSTRAINT reject_test_event CHECK (event_id <> \'rollback\')')
        const before = (await query('SELECT sequence,incident FROM monitoring_push_sources WHERE automation_id=\'sensor\'')).rows[0]
        const beforeRuns = (await query('SELECT COUNT(*)::int AS count FROM agent_automation_runs')).rows[0].count
        await expect(ingestPushEvent('sensor', keyId, { ...makeEvent('incident'), eventId: 'rollback' })).rejects.toThrow()
        expect((await query('SELECT sequence,incident FROM monitoring_push_sources WHERE automation_id=\'sensor\'')).rows[0]).toEqual(before)
        expect((await query('SELECT COUNT(*)::int AS count FROM agent_automation_runs')).rows[0].count).toBe(beforeRuns)
        expect((await query('SELECT resolved_at FROM monitoring_issues')).rows[0].resolved_at).not.toBeNull()

        const rotated = await app.inject({ method: 'POST', url: '/api/automations/sensor/sender-key', headers: { id: 'test-owner' } })
        expect(rotated.statusCode).toBe(201)
        expect(await validateApiKey(key)).toBeNull()
        const newKey = rotated.json().secret
        await query('UPDATE agent_automations SET status=\'paused\' WHERE id=\'sensor\'')
        expect((await app.inject({ method: 'POST', url: '/api/automations/sensor/events', headers: { 'x-api-key': newKey }, payload: makeEvent('heartbeat') })).statusCode).toBe(409)
        await query('UPDATE agent_automations SET status=\'active\' WHERE id=\'sensor\'')
        const simultaneous = makeEvent('heartbeat')
        const concurrent = await Promise.all([0, 1].map(() => app.inject({ method: 'POST', url: '/api/automations/sensor/events', headers: { 'x-api-key': newKey }, payload: simultaneous })))
        expect(concurrent.map(response => response.json().duplicate).sort()).toEqual([false, true])
        // Archive after key authorization but before the transaction locks the check.
        const beforeKeys = (await query('SELECT COUNT(*)::int AS count FROM api_keys')).rows[0].count
        beforeTransaction = async () => {
            expect((await app.inject({ method: 'DELETE', url: '/api/automations/sensor', headers: { id: 'test-owner' } })).statusCode).toBe(200)
        }
        expect((await app.inject({ method: 'POST', url: '/api/automations/sensor/sender-key', headers: { id: 'test-owner' } })).statusCode).toBe(404)
        expect((await query('SELECT COUNT(*)::int AS count FROM api_keys')).rows[0].count).toBe(beforeKeys)
        expect(await validateApiKey(newKey)).toBeNull()
        expect((await query('SELECT COUNT(*)::int AS count FROM monitoring_issues')).rows[0].count).toBe(1)
    }, 30_000)
}
