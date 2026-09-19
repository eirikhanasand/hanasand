// Opt-in integration check: all fixtures use temporary tables and roll back.
// LOG_PIPELINE_TEST_DATABASE=1 DB_* bun tests/log-pipeline-postgres.ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mock } from 'bun:test'
import pg from 'pg'

assert.equal(process.env.LOG_PIPELINE_TEST_DATABASE, '1', 'Use an isolated PostgreSQL test database.')
const client = new pg.Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB, user: process.env.DB_USER, password: process.env.DB_PASSWORD })
await client.connect()
await client.query('BEGIN')
let queryObserver: ((sql: string, values: unknown[]) => Promise<void>) | undefined
const query = async (sql: string, values: unknown[] = []) => {
    await queryObserver?.(sql, values)
    return client.query(sql, values)
}
mock.module('#db', () => ({ default: query, withTransaction: async (work: (run: typeof query) => Promise<unknown>) => work(query),
    withDatabaseAdvisoryLock: async (_key: string, work: () => Promise<unknown>) => work() }))
try {
    await query('CREATE TEMP TABLE organizations (id text PRIMARY KEY, status text, audit_safe_metadata jsonb DEFAULT \'{}\', name text, created_at timestamptz DEFAULT NOW())')
    await query('CREATE TEMP TABLE users (id text PRIMARY KEY)')
    await query("INSERT INTO organizations (id, status, name) VALUES ('fixture', 'active', 'Hanasand'), ('other', 'active', 'Other')")
    const schema = readFileSync(new URL('../src/utils/db/ensureSchema.ts', import.meta.url), 'utf8')
    for (const table of ['service_logs', 'mill_events', 'mill_findings', 'mill_rules', 'login_events', 'traffic_events', 'system_events']) {
        const definition = schema.match(new RegExp('CREATE TABLE IF NOT EXISTS ' + table + ' \\([\\s\\S]*?\\n        \\)'))?.[0]
        assert.ok(definition, `Actual schema for ${table} must be found`)
        await query(definition.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE'))
    }
    await query('ALTER TABLE service_logs ADD COLUMN source_event_id text UNIQUE')
    await query('ALTER TABLE mill_events ADD COLUMN log_key text UNIQUE')
    await query('ALTER TABLE mill_findings ADD COLUMN case_id text')
    await query('ALTER TABLE mill_findings ADD COLUMN case_delivery_attempted_at timestamptz')
    await query(`INSERT INTO mill_events (id, ingestion_id, organization_id, event_timestamp, normalized)
        VALUES ('legacy-a', 'logs', 'fixture', NOW(), '{"severity":"low","service":"legacy","log_type":"ApplicationLogs"}'),
            ('legacy-z', 'logs', 'fixture', NOW()-INTERVAL '25 hours', '{"severity":"high","service":null}')`)
    const { logDimensionsSchema } = await import('../src/utils/db/logDimensionsSchema.ts')
    for (const statement of logDimensionsSchema) await query(statement.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE'))
    const { backfillLogDimensions, dimensionLogWhere, foldLogCounts } = await import('../src/utils/logs/dimensions.ts')
    const { processLogBatch, processStoredLogs } = await import('../src/utils/mill/processLogs.ts')
    const { MILL_RULES, millDefaultDefinition, createMillFindings, normalizeMillEvent } = await import('../src/handlers/mill.ts')
    const { securityRules } = await import('../src/utils/mill/securityRules.ts')
    const { compileLogQuery } = await import('../src/utils/logs/kql.ts')
    const rules = MILL_RULES.map(rule => ({ ...rule, enabled: true, source: 'hanasand' as const, definition: millDefaultDefinition(rule.id) }))
    const time = Date.now() - 60_000
    const rows = securityRules.flatMap((rule, index) => [true, false].map(positive => {
        const command = positive ? rule.positive : rule.negative
        return { id: `${rule.id}-${positive}`, service: 'audit', host: 'fixture-host', level: 'info',
            message: command, created_at: new Date(time + index * 10).toISOString(),
            metadata: { process: { executable: rule.field === 'executable' ? command : '/bin/bash', command_line: command } } }
    }))
    await processLogBatch(rows, 'fixture', rules)
    const restricted = await query("SELECT COUNT(*)::int AS count FROM mill_findings WHERE evidence->>'restrictedLog' IS DISTINCT FROM 'true'")
    assert.equal(restricted.rows[0].count, 0, 'Every collected-log finding must carry the durable administrator-only flag')
    for (const rule of securityRules) {
        for (const positive of [true, false]) {
            const { rows: [row] } = await query('SELECT * FROM mill_events WHERE log_key = $1', [`service:${rule.id}-${positive}`])
            assert.equal(row.processing_status, 'processed')
            assert.equal(row.normalized.level, 'info')
            assert.equal(row.normalized.detections.some((match: { rule_id: string }) => match.rule_id === rule.id), positive, `${rule.id} ${positive}`)
        }
    }
    const before = Number((await query('SELECT count(*) AS count FROM mill_findings')).rows[0].count)
    await processLogBatch(rows, 'fixture', rules)
    assert.equal(Number((await query('SELECT count(*) AS count FROM mill_findings')).rows[0].count), before, 'Retry must not duplicate findings')

    const auth = (id: string, user: string, outcome: string, second: number) => ({ id, service: 'sshd', host: 'fixture-host', level: 'info',
        message: `${outcome === 'success' ? 'Accepted' : 'Failed'} password for ${user} from 192.0.2.10 port 22 ssh2`,
        created_at: new Date(time + second * 1000).toISOString(), metadata: {} })
    await processLogBatch([auth('failed-a', 'alice', 'failure', 1), auth('failed-b', 'alice', 'failure', 2),
        auth('failed-c', 'alice', 'failure', 3), auth('success-a', 'alice', 'success', 4),
        auth('spray-b', 'bob', 'failure', 5), auth('spray-c', 'charlie', 'failure', 6)], 'fixture', rules)
    for (const id of ['auth.brute_force_success.v1', 'auth.password_spray.v1']) {
        assert.ok((await query('SELECT 1 FROM mill_findings WHERE rule_id = $1', [id])).rowCount, `${id} real SQL correlation`)
    }
    const { rows: [authRow] } = await query("SELECT source_ip, normalized FROM mill_events WHERE log_key = 'service:success-a'")
    assert.equal(authRow.source_ip, '192.0.2.10')
    assert.equal(authRow.normalized.severity, 'high')

    await processLogBatch([auth('late-success', 'late-user', 'success', 30)], 'fixture', rules)
    const lateFailures = [auth('late-failure-a', 'late-user', 'failure', 21), auth('late-failure-b', 'late-user', 'failure', 22), auth('late-failure-c', 'late-user', 'failure', 23)]
    await processLogBatch(lateFailures, 'fixture', rules)
    const { rows: [lateSuccess] } = await query("SELECT normalized FROM mill_events WHERE log_key = 'service:late-success'")
    assert.equal(lateSuccess.normalized.severity, 'high', 'Late historical failures must update the previously processed success')
    assert.ok(lateSuccess.normalized.detections.some((finding: {rule_id:string}) => finding.rule_id === 'auth.brute_force_success.v1'))
    const lateCount = Number((await query('SELECT count(*) AS count FROM mill_findings')).rows[0].count)
    await processLogBatch(lateFailures, 'fixture', rules)
    assert.equal(Number((await query('SELECT count(*) AS count FROM mill_findings')).rows[0].count), lateCount)

    // Original non-process rules run against persisted native Mill events too.
    async function native(id: string, content: Record<string, unknown>, second: number) {
        const event = normalizeMillEvent({ ...content, timestamp: new Date(time + second * 1000).toISOString() }, {})
        await query(`INSERT INTO mill_events (id, ingestion_id, organization_id, event_timestamp, event_type, action, outcome,
            user_id, source_ip, source_country, normalized) VALUES ($1, 'fixture', 'fixture', $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, event.timestamp, event.eventType, event.action, event.outcome, event.userId, event.sourceIp, event.sourceCountry, JSON.stringify(event.normalized)])
        await createMillFindings('fixture', id, event, rules)
    }
    await native('country-a', { event_type: 'authentication', action: 'login', outcome: 'success', user: { id: 'traveller' },
        source: { country: 'NO', latitude: 59.9, longitude: 10.7 }, device: { id: 'one' } }, 1)
    await native('country-b', { event_type: 'authentication', action: 'login', outcome: 'success', user: { id: 'traveller' },
        source: { country: 'US', latitude: 40.7, longitude: -74 }, device: { id: 'two' } }, 2)
    await native('network', { event_type: 'network', action: 'alert', signature: 'Fixture signature' }, 3)
    await native('vulnerability', { event_type: 'vulnerability', cve: 'CVE-2026-12345', asset: { id: 'fixture-host', version: '1' } }, 4)
    for (const rule of MILL_RULES) assert.ok((await query('SELECT 1 FROM mill_findings WHERE rule_id = $1', [rule.id])).rowCount, `Persisted finding for ${rule.id}`)
    for (const text of ['ProcessLogs | where Executable endswith "whoami"', 'SigninLogs | where Severity == "high"',
        'Logs | where RuleId == "process.recon.whoami.v1"', 'Logs | where Message contains "whoami"']) {
        const compiled = compileLogQuery(text)
        const result = await query(`SELECT id FROM mill_events WHERE ${compiled.where.join(' AND ')} ORDER BY ${compiled.order} LIMIT ${compiled.limit}`, compiled.params)
        assert.ok(result.rowCount, `KQL returned stored events: ${text}`)
    }
    await query('CREATE TEMP TABLE log_processing_cursors (name text PRIMARY KEY, last_id bigint DEFAULT 0, recent_id bigint, updated_at timestamptz DEFAULT NOW(), last_error text)')
    const { logProcessQueueSchema, processLogIndex } = await import('../src/utils/db/logProcessQueueSchema.ts')
    for (const statement of logProcessQueueSchema) await query(statement.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE IF NOT EXISTS'))
    await query(processLogIndex)
    await query("INSERT INTO login_events (user_id, ip, status, reason) VALUES ('web-user', '192.0.2.55', 'failed', 'bad_password')")
    await query("INSERT INTO traffic_events (domain, path, method, status) VALUES ('hanasand.com', '/fixture', 'GET', 503)")
    await query("INSERT INTO system_events (event_type, severity, organization_id) VALUES ('fixture.audit', 'critical', 'fixture')")
    const { processAdditionalLogSources } = await import('../src/utils/mill/storedSources.ts')
    await processAdditionalLogSources(logs => processLogBatch(logs, 'fixture', rules))
    for (const [source, type, severity] of [['login_events', 'SigninLogs', 'low'], ['traffic_events', 'HttpLogs', 'high'], ['system_events', 'SystemLogs', 'critical']]) {
        const { rows: [event] } = await query('SELECT normalized FROM mill_events WHERE log_key = $1', [`service:${source}:1`])
        assert.equal(event.normalized.log_type, type)
        assert.equal(event.normalized.severity, severity)
    }
    // A replayed collector batch must not hide newly executed commands behind its
    // FIFO. Use the actual priority SQL, processor, configured rules and cursors.
    await query(`INSERT INTO service_logs (service, host, level, message, created_at)
        SELECT 'fixture', 'fixture-host', 'info', 'Historical replay', NOW() - INTERVAL '1 hour'
        FROM generate_series(1, 1101)`)
    const commandMetadata = { process: { executable: '/usr/bin/whoami', command_line: 'whoami', arguments: ['whoami'] } }
    const insertCommand = `INSERT INTO service_logs (service, host, level, message, metadata)
        VALUES ('audit', 'fixture-host', 'info', 'whoami', $1) RETURNING id::text`
    const liveId = (await query(insertCommand, [commandMetadata])).rows[0].id
    await query("INSERT INTO log_processing_cursors (name, last_id, recent_id) VALUES ('service_logs', 0, 0)")
    let afterWatermarkId = '', observedPriorityBeforeFifo = false
    queryObserver = async (sql, values) => {
        if (sql.includes('SELECT s.* FROM service_logs s') && !afterWatermarkId) {
            assert.equal(String(values[0]), liveId, 'Priority selection uses the stable source watermark')
            afterWatermarkId = (await client.query(insertCommand, [commandMetadata])).rows[0].id
        }
        if (sql.includes('SELECT * FROM service_logs') && String(values[0]) === '0' && String(values[1]) === liveId) {
            const priority = await client.query('SELECT processing_status, normalized FROM mill_events WHERE log_key = $1', [`service:${liveId}`])
            assert.equal(priority.rows[0]?.processing_status, 'processed', 'Live command completes before older FIFO logs are read')
            assert.equal(priority.rows[0].normalized.severity, 'high')
            observedPriorityBeforeFifo = true
        }
    }
    const previousPlatform = process.env.PLATFORM_LOG_ORGANIZATION_ID
    process.env.PLATFORM_LOG_ORGANIZATION_ID = 'fixture'
    try {
        await processStoredLogs()
        queryObserver = undefined
        assert.ok(observedPriorityBeforeFifo)
        const firstCursor = (await query("SELECT last_id, recent_id FROM log_processing_cursors WHERE name = 'service_logs'")).rows[0]
        assert.equal(String(firstCursor.recent_id), '1000', 'Priority cannot jump the FIFO checkpoint')
        assert.equal(String(firstCursor.last_id), '0')
        assert.equal((await query('SELECT 1 FROM mill_events WHERE log_key = $1', [`service:${afterWatermarkId}`])).rowCount, 0,
            'An insertion after the watermark is excluded from this entire service tick')
        await processStoredLogs()
        const findingCount = (await query('SELECT count(*)::int AS count FROM mill_findings')).rows[0].count
        await processStoredLogs()
        assert.equal((await query('SELECT count(*)::int AS count FROM mill_findings')).rows[0].count, findingCount,
            'Later FIFO and historical overlap must not duplicate priority findings')
        assert.equal((await query(`SELECT count(*)::int AS count FROM service_logs s
            JOIN mill_events e ON e.log_key = 'service:' || s.id::text WHERE e.processing_status = 'processed'`)).rows[0].count, 1103,
            'Priority and both cursors together preserve every old and live event')
        const commandEvents = await query('SELECT normalized FROM mill_events WHERE log_key = ANY($1::text[])', [[`service:${liveId}`, `service:${afterWatermarkId}`]])
        assert.equal(commandEvents.rowCount, 2)
        assert.ok(commandEvents.rows.every(event => event.normalized.detections.some((finding: { rule_id: string }) => finding.rule_id === 'process.recon.whoami.v1')))
    } finally {
        queryObserver = undefined
        if (previousPlatform === undefined) delete process.env.PLATFORM_LOG_ORGANIZATION_ID
        else process.env.PLATFORM_LOG_ORGANIZATION_ID = previousPlatform
    }
    console.log('PostgreSQL worker verification passed: live priority before replay, stable watermark bounds, complete FIFO catch-up and finding deduplication.')
    // Upgrade fixture: pre-existing process events were never admitted to the
    // new queue. A fixed recovery snapshot must reach an aged command even as
    // newer commands continue arriving through the trigger.
    const { processQueuedLogs, recoverProcessLogs, readPendingProcessLogs } = await import('../src/utils/mill/processQueue.ts')
    await query('DROP TRIGGER log_process_queue_insert ON service_logs')
    const oldCommand = (await query(`INSERT INTO service_logs (service, host, level, message, metadata, created_at)
        VALUES ('audit', 'old-vm', 'info', 'whoami', $1, NOW() - INTERVAL '2 hours') RETURNING id::text`, [commandMetadata])).rows[0].id
    const benignProcess = { process: { executable: '/bin/true', command_line: 'true', arguments: ['true'] } }
    await query(`INSERT INTO service_logs (service, host, level, message, metadata, created_at)
        SELECT 'audit', 'old-host', 'info', 'true', $1, NOW() - INTERVAL '1 hour' FROM generate_series(1, 1101)`, [benignProcess])
    await query("DELETE FROM log_processing_cursors WHERE name = 'process_logs_recovery'")
    for (const statement of logProcessQueueSchema) await query(statement.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE IF NOT EXISTS'))
    const snapshot = (await query("SELECT recent_id FROM log_processing_cursors WHERE name = 'process_logs_recovery'")).rows[0].recent_id
    await query(`INSERT INTO service_logs (service, host, level, message, metadata)
        SELECT 'audit', 'busy-host', 'info', 'true', $1 FROM generate_series(1, 1101)`, [benignProcess])
    const delayedCommand = (await query(`INSERT INTO service_logs (service, host, level, message, metadata, created_at)
        VALUES ('audit', 'delayed-vm', 'info', 'whoami', $1, NOW() - INTERVAL '1 day') RETURNING id::text`, [commandMetadata])).rows[0].id
    const structuredCommand = (await query(`INSERT INTO service_logs (service, host, level, message, metadata)
        VALUES ('application', 'structured-host', 'info', 'whoami', $1) RETURNING id::text`, [{ structured: commandMetadata }])).rows[0].id
    const malformed = (await query(`INSERT INTO service_logs (service, host, level, message, metadata)
        VALUES ('application', 'untyped-host', 'info', 'plain', '{"process":[]}') RETURNING id::text`)).rows[0].id
    assert.equal((await query('SELECT 1 FROM log_process_queue WHERE log_id=$1', [malformed])).rowCount, 0)
    await query('SAVEPOINT rejected_insertion')
    const rolledBack = (await query(insertCommand, [commandMetadata])).rows[0].id
    await query('ROLLBACK TO SAVEPOINT rejected_insertion')
    assert.equal((await query('SELECT 1 FROM log_process_queue WHERE log_id=$1', [rolledBack])).rowCount, 0, 'Admission rolls back with its source insertion')
    const pendingBefore = await readPendingProcessLogs()
    assert.equal(pendingBefore.count, 1103)
    const startedQueue = performance.now()
    let queuePages = 0
    await processQueuedLogs(async logs => {
        await processLogBatch(logs, 'fixture', rules)
        queuePages++
        await query(`INSERT INTO service_logs (service, host, level, message, metadata)
            SELECT 'audit', 'busy-host', 'info', 'true', $1 FROM generate_series(1, 1000)`, [benignProcess])
    })
    assert.equal(queuePages, 2)
    for (const id of [delayedCommand, structuredCommand]) {
        const row = (await query('SELECT normalized, processing_status FROM mill_events WHERE log_key=$1', [`service:${id}`])).rows[0]
        assert.equal(row?.processing_status, 'processed')
        assert.equal(row.normalized.severity, 'high')
        assert.equal(row.normalized.rules_checked, 105)
    }
    assert.equal((await readPendingProcessLogs()).count, 2000, 'Later arrivals remain queued without displacing older admitted work')
    await recoverProcessLogs(logs => processLogBatch(logs, 'fixture', rules))
    assert.equal((await query('SELECT 1 FROM mill_events WHERE log_key=$1', [`service:${oldCommand}`])).rowCount, 0, 'Recovery page stays bounded')
    assert.ok(BigInt((await query("SELECT recent_id FROM log_processing_cursors WHERE name='process_logs_recovery'")).rows[0].recent_id) < BigInt(snapshot))
    const durableRecoveryId = (await query("SELECT recent_id FROM log_processing_cursors WHERE name='process_logs_recovery'")).rows[0].recent_id
    for (const statement of logProcessQueueSchema) await query(statement.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE IF NOT EXISTS'))
    assert.equal((await query("SELECT recent_id FROM log_processing_cursors WHERE name='process_logs_recovery'")).rows[0].recent_id, durableRecoveryId, 'Restart/redeploy preserves recovery progress')
    await recoverProcessLogs(logs => processLogBatch(logs, 'fixture', rules))
    const recoveredCommand = (await query('SELECT normalized, processing_status FROM mill_events WHERE log_key=$1', [`service:${oldCommand}`])).rows[0]
    assert.equal(recoveredCommand?.processing_status, 'processed', 'Aged pre-upgrade command recovers automatically despite newer arrivals')
    assert.equal(recoveredCommand.normalized.severity, 'high')
    assert.equal(recoveredCommand.normalized.rules_checked, 105)
    const finalFindingCount = (await query('SELECT COUNT(*)::int AS count FROM mill_findings')).rows[0].count
    await recoverProcessLogs(logs => processLogBatch(logs, 'fixture', rules))
    assert.equal((await query('SELECT COUNT(*)::int AS count FROM mill_findings')).rows[0].count, finalFindingCount)
    await query("INSERT INTO organizations (id, status, name) VALUES ('archived-priority', 'active', 'Archived fixture')")
    const retryMetadata = { ...commandMetadata, organizationId: 'archived-priority', user: { id: 'private-user', email: 'private@example.test' } }
    const archivedLog = (await query(`INSERT INTO service_logs (service, host, level, message, metadata)
        VALUES ('audit', 'archived-host', 'info', 'whoami', $1) RETURNING *`, [retryMetadata])).rows[0]
    queryObserver = async sql => { if (sql.startsWith('SELECT rule_id, severity')) throw new Error('Fixture interrupted before completion') }
    await assert.rejects(processLogBatch([archivedLog], 'archived-priority', rules), /Fixture interrupted/)
    queryObserver = undefined
    await query("UPDATE organizations SET status='inactive' WHERE id='archived-priority'")
    await processStoredLogs()
    const skippedRetry = (await query('SELECT * FROM mill_events WHERE log_key=$1', [`service:${archivedLog.id}`])).rows[0]
    assert.equal(skippedRetry.processing_status, 'skipped')
    assert.equal(skippedRetry.organization_id, 'fixture')
    assert.equal(skippedRetry.user_id, null)
    assert.equal(skippedRetry.user_email, null)
    assert.deepEqual(skippedRetry.original, {})
    assert.ok(!JSON.stringify(skippedRetry.normalized).includes('private-user'))
    assert.equal((await query('SELECT 1 FROM log_process_queue WHERE log_id=$1', [archivedLog.id])).rowCount, 0,
        'An organization becoming inactive during retry cannot poison the command FIFO')
    console.log(`Process queue PostgreSQL verification passed: transactional admission, delayed VM detection, FIFO under sustained arrivals, bounded recovery, deduplication; 1,103 queued events processed in ${Math.round(performance.now()-startedQueue)} ms including recovery checks.`)
    assert.equal((await query('SELECT ready FROM mill_log_dimensions_state')).rows[0].ready, true)
    async function assertProjectionParity() {
        const differences = await query(`WITH source AS (
            SELECT id AS event_id, organization_id, event_timestamp, normalized->>'severity' AS severity,
                normalized->>'service' AS service, normalized->>'log_type' AS log_type
            FROM mill_events WHERE ingestion_id='logs' AND processing_status='processed')
            (SELECT * FROM source EXCEPT SELECT * FROM mill_log_dimensions)
            UNION ALL (SELECT * FROM mill_log_dimensions EXCEPT SELECT * FROM source)`)
        assert.equal(differences.rowCount, 0, 'Compact projection must match every currently processed collected event')
    }
    await assertProjectionParity() // Includes late-auth severity changes, replay and all 105 detections.
    await query("UPDATE mill_log_dimensions_state SET ready=FALSE,last_event_id=''")
    assert.deepEqual(await backfillLogDimensions(1), { processed: 1, ready: false })
    assert.equal((await query('SELECT ready FROM mill_log_dimensions_state')).rows[0].ready, false, 'Partial backfill is never reported as ready')
    while (!(await backfillLogDimensions(1000)).ready) { /* bounded resumable initialization */ }
    await assertProjectionParity()
    const inserted = `INSERT INTO mill_events (id, ingestion_id, organization_id, event_timestamp, normalized)
        VALUES ('!after-cursor', 'logs', 'other', NOW(), '{"severity":"low","service":"temporary","log_type":"ApplicationLogs"}')`
    await query(inserted)
    await assertProjectionParity() // New IDs below the completed cursor are maintained by the trigger.
    await query(`UPDATE mill_events SET normalized=normalized || '{"severity":"critical","service":null}',
        organization_id='fixture',event_timestamp=NOW()-INTERVAL '2 hours' WHERE id='!after-cursor'`)
    await assertProjectionParity()
    await query("UPDATE mill_events SET processing_status='pending' WHERE id='!after-cursor'")
    await assertProjectionParity()
    await query("UPDATE mill_events SET processing_status='processed',ingestion_id='native' WHERE id='!after-cursor'")
    await assertProjectionParity()
    await query("UPDATE mill_events SET ingestion_id='logs',id='!renamed' WHERE id='!after-cursor'")
    await assertProjectionParity()
    await query('SAVEPOINT projection_retry')
    await query("UPDATE mill_events SET normalized='{}'::jsonb WHERE id='!renamed'")
    await assertProjectionParity()
    await query('ROLLBACK TO SAVEPOINT projection_retry')
    await assertProjectionParity()
    await query("WITH removed AS (DELETE FROM mill_events WHERE id='!renamed' RETURNING id) SELECT * FROM removed")
    await assertProjectionParity()
    await query("INSERT INTO organizations (id,status,name) VALUES ('projection-delete','active','Fixture')")
    await query(`INSERT INTO mill_events (id,ingestion_id,organization_id,event_timestamp,normalized)
        VALUES ('!delete-org','logs','projection-delete',NOW(),'{"severity":"critical","service":"private"}')`)
    await query("UPDATE organizations SET status='archived' WHERE id='projection-delete'")
    for (const kql of ['Logs', 'ApplicationLogs | where Severity != "critical"', 'Logs | where Service == "private"', 'Logs | where TimeGenerated > ago(1h)']) {
        const compiled = compileLogQuery(kql)
        const predicates = ["ingestion_id = 'logs'", "processing_status = 'processed'", "event_timestamp >= NOW()-INTERVAL '24 hours'",
            ...compiled.where, "EXISTS (SELECT 1 FROM organizations o WHERE o.id=mill_events.organization_id AND o.status='active')"]
        const original = await query(`SELECT normalized->>'severity' AS severity, normalized->>'service' AS service, COUNT(*)::int AS count
            FROM mill_events WHERE ${predicates.join(' AND ')} GROUP BY 1,2 ORDER BY 1,2`, compiled.params)
        const compact = await query(`SELECT severity,service,COUNT(*)::int AS count FROM mill_log_dimensions mill_events
            WHERE ${dimensionLogWhere(predicates)!.join(' AND ')} GROUP BY 1,2 ORDER BY 1,2`, compiled.params)
        assert.deepEqual(compact.rows, original.rows, `Exact projected counters, including active organizations: ${kql}`)
        assert.deepEqual(foldLogCounts(compact.rows), foldLogCounts(original.rows))
    }
    await query("DELETE FROM organizations WHERE id='projection-delete'")
    await assertProjectionParity()
    await query('SAVEPOINT projection_truncate')
    await query('TRUNCATE mill_events CASCADE')
    assert.equal((await query('SELECT COUNT(*)::int AS count FROM mill_log_dimensions')).rows[0].count, 0)
    await query('ROLLBACK TO SAVEPOINT projection_truncate')
    await assertProjectionParity()
    console.log('PostgreSQL projection verification passed: exact counter parity, bounded readiness, trigger updates, rollback, late correlation and cascading deletion.')
    const started = performance.now()
    await processLogBatch(Array.from({ length: 5000 }, (_, index) => ({ id: `volume-${index}`, service: 'fixture', host: 'fixture', level: 'info', message: 'Ordinary service log', created_at: new Date().toISOString() })), 'fixture', rules)
    console.log(`Ordinary-event throughput: ${Math.round(5000000 / (performance.now() - started))} events/second`)
    const deliverySource = readFileSync(new URL('../src/utils/millCases.ts', import.meta.url), 'utf8')
    const claimSql = deliverySource.match(/await run\(`(UPDATE mill_findings[\s\S]*?RETURNING \*)`\)/)?.[1]
    assert.ok(claimSql, 'Actual case-delivery claim SQL must be found')
    const claimed = await query(claimSql)
    assert.ok(claimed.rowCount, 'Ordinary organization findings remain eligible for shared cases')
    assert.ok(claimed.rows.every(row => row.evidence.restrictedLog === false), 'Restricted collected-log evidence must never be claimed for shared cases')
    const other = await query("SELECT count(*)::int AS count FROM mill_findings WHERE organization_id = 'other'")
    assert.equal(other.rows[0].count, 0, 'No findings in another organization')
    console.log(`PostgreSQL verification passed: all ${MILL_RULES.length} rules, ${securityRules.length} negatives, retry deduplication, auth correlation, and KQL.`)
} finally {
    await client.query('ROLLBACK')
    await client.end()
}
