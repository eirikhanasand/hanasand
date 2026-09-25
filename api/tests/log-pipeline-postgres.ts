// Opt-in integration check: all fixtures use temporary tables and roll back.
// LOG_PIPELINE_TEST_DATABASE=1 DB_* bun tests/log-pipeline-postgres.ts
// Keep the repository layout; containers mounting api at /app also need scripts at /scripts:ro.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
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
let transactionId = 0, atomicTransactions = false
mock.module('#db', () => ({ default: query, queryOnce: query, withTransaction: async (work: (run: typeof query) => Promise<unknown>) => {
    if (!atomicTransactions) return work(query)
    const name = `batch_${++transactionId}`; await client.query(`SAVEPOINT ${name}`)
    try { const result = await work(query); await client.query(`RELEASE SAVEPOINT ${name}`); return result }
    catch (error) { await client.query(`ROLLBACK TO SAVEPOINT ${name}`); await client.query(`RELEASE SAVEPOINT ${name}`); throw error }
},
withDatabaseAdvisoryLock: async (_key: string, work: () => Promise<unknown>) => work() }))
try {
    await query('CREATE TEMP TABLE organizations (id text PRIMARY KEY, status text, audit_safe_metadata jsonb DEFAULT \'{}\', name text, created_at timestamptz DEFAULT NOW())')
    await query('CREATE TEMP TABLE users (id text PRIMARY KEY)')
    await query('INSERT INTO organizations (id, status, name) VALUES (\'fixture\', \'active\', \'Hanasand\'), (\'other\', \'active\', \'Other\')')
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
    const { logCountsSchema } = await import('../src/utils/db/logCountsSchema.ts')
    for (const statement of logCountsSchema) await query(statement.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE IF NOT EXISTS'))
    const { backfillLogDimensions, dimensionLogWhere, foldLogCounts } = await import('../src/utils/logs/dimensions.ts')
    const { processLogBatch, processStoredLogs } = await import('../src/utils/mill/processLogs.ts')
    const { MILL_RULES, millDefaultDefinition, createMillFindings, normalizeMillEvent, loadConfiguredMillRules } = await import('../src/handlers/mill.ts')
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
    const detectionUpdates: Array<{ sql: string, values: unknown[] }> = []
    queryObserver = async (sql, values) => {
        if (sql.startsWith('UPDATE mill_events e SET normalized')) detectionUpdates.push({ sql, values })
    }
    await processLogBatch(rows, 'fixture', rules)
    queryObserver = undefined
    assert.equal(detectionUpdates.length, 0, 'Stateless detections must finish without a second event/index write')
    const restricted = await query('SELECT COUNT(*)::int AS count FROM mill_findings WHERE evidence->>\'restrictedLog\' IS DISTINCT FROM \'true\'')
    assert.equal(restricted.rows[0].count, 0, 'Every collected-log finding must carry the durable administrator-only flag')
    for (const rule of securityRules) {
        for (const positive of [true, false]) {
            const { rows: [row] } = await query('SELECT * FROM mill_events WHERE log_key = $1', [`service:${rule.id}-${positive}`])
            assert.equal(row.processing_status, 'processed')
            assert.equal(row.normalized.level, 'info')
            assert.equal(row.normalized.detections.some((match: { rule_id: string }) => match.rule_id === rule.id), positive, `${rule.id} ${positive}`)
        }
    }
    const cleanWrites: string[] = []
    queryObserver = async sql => { if (/^(INSERT INTO mill_events|UPDATE mill_events)/.test(sql.trim())) cleanWrites.push(sql) }
    await processLogBatch([{ id: 'single-write-http', service: 'http-traffic', host: 'fixture.test', level: 'info',
        message: 'GET /help → 200', created_at: new Date(time).toISOString(), metadata: { category: 'http' } }], 'fixture', rules)
    queryObserver = undefined
    assert.equal(cleanWrites.length, 1, 'Clean stateless events finish in one durable write')
    const clean = (await query('SELECT normalized, processing_status FROM mill_events WHERE log_key=\'service:single-write-http\'')).rows[0]
    assert.equal(clean.processing_status, 'processed')
    assert.equal(clean.normalized.rules_checked, rules.length)
    assert.deepEqual(clean.normalized.detections, [])
    const projectionLock = (await query('SELECT xmax::text FROM mill_log_dimensions WHERE event_id=(SELECT id FROM mill_events WHERE log_key=\'service:single-write-http\')')).rows[0].xmax
    await query('UPDATE mill_events SET normalized=normalized||jsonb_build_object(\'evaluated_at\',clock_timestamp()) WHERE log_key=\'service:single-write-http\'')
    assert.equal((await query('SELECT xmax::text FROM mill_log_dimensions WHERE event_id=(SELECT id FROM mill_events WHERE log_key=\'service:single-write-http\')')).rows[0].xmax,
        projectionLock, 'An evidence-only update must not lock or rewrite the unchanged reporting projection')

    // Enable real rollback for this failure fixture. The broader cursor suite
    // shares one outer transaction and deliberately interleaves background work.
    atomicTransactions = true
    const atomicLog = { ...rows[0], id: 'atomic-stateless-failure' }
    const atomicId = createHash('sha256').update(`service:${atomicLog.id}`).digest('hex')
    await query(`CREATE FUNCTION pg_temp.reject_atomic_finding() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.event_ids @> ARRAY['${atomicId}'] THEN RAISE EXCEPTION 'injected finding failure'; END IF; RETURN NEW; END $$`)
    await query('CREATE TRIGGER reject_atomic_finding BEFORE INSERT ON mill_findings FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_atomic_finding()')
    await assert.rejects(processLogBatch([atomicLog], 'fixture', rules), /injected finding failure/)
    assert.equal((await query('SELECT count(*)::int AS count FROM mill_events WHERE id=$1', [atomicId])).rows[0].count, 0,
        'A failed finding write must not publish a processed event')
    assert.equal((await query('SELECT count(*)::int AS count FROM mill_findings WHERE event_ids @> ARRAY[$1]', [atomicId])).rows[0].count, 0)
    await query('DROP TRIGGER reject_atomic_finding ON mill_findings')
    await processLogBatch([atomicLog], 'fixture', rules)
    const retriedAtomic = (await query('SELECT processing_status,normalized FROM mill_events WHERE id=$1', [atomicId])).rows[0]
    assert.equal(retriedAtomic.processing_status, 'processed')
    assert.ok(retriedAtomic.normalized.detections.length)
    assert.ok(retriedAtomic.normalized.detections.every((finding: any) => finding.evidence.restrictedLog === true))

    atomicTransactions = false
    const before = Number((await query('SELECT count(*) AS count FROM mill_findings')).rows[0].count)
    await processLogBatch(rows, 'fixture', rules)
    assert.equal(Number((await query('SELECT count(*) AS count FROM mill_findings')).rows[0].count), before, 'Retry must not duplicate findings')

    const auth = (id: string, user: string, outcome: string, second: number) => ({ id, service: 'sshd', host: 'fixture-host', level: 'info',
        message: `${outcome === 'success' ? 'Accepted' : 'Failed'} password for ${user} from 192.0.2.10 port 22 ssh2`,
        created_at: new Date(time + second * 1000).toISOString(), metadata: {} })
    queryObserver = async (sql, values) => { if (sql.startsWith('UPDATE mill_events e SET normalized')) detectionUpdates.push({ sql, values }) }
    await processLogBatch([auth('failed-a', 'alice', 'failure', 1), auth('failed-b', 'alice', 'failure', 2),
        auth('failed-c', 'alice', 'failure', 3), auth('success-a', 'alice', 'success', 4),
        auth('spray-b', 'bob', 'failure', 5), auth('spray-c', 'charlie', 'failure', 6)], 'fixture', rules)
    queryObserver = undefined
    const detectionUpdate = detectionUpdates.at(-1)
    assert.ok(detectionUpdate)
    assert.equal((await query(detectionUpdate.sql, detectionUpdate.values)).rowCount, 0,
        'Identical authentication detection updates must not rewrite events or their indexes')
    for (const id of ['auth.brute_force_success.v1', 'auth.password_spray.v1']) {
        assert.ok((await query('SELECT 1 FROM mill_findings WHERE rule_id = $1', [id])).rowCount, `${id} real SQL correlation`)
    }
    const { rows: [authRow] } = await query('SELECT source_ip, normalized FROM mill_events WHERE log_key = \'service:success-a\'')
    assert.equal(authRow.source_ip, '192.0.2.10')
    assert.equal(authRow.normalized.severity, 'high')

    await processLogBatch([auth('late-success', 'late-user', 'success', 30)], 'fixture', rules)
    const lateFailures = [auth('late-failure-a', 'late-user', 'failure', 21), auth('late-failure-b', 'late-user', 'failure', 22), auth('late-failure-c', 'late-user', 'failure', 23)]
    await processLogBatch(lateFailures, 'fixture', rules)
    const { rows: [lateSuccess] } = await query('SELECT normalized FROM mill_events WHERE log_key = \'service:late-success\'')
    assert.equal(lateSuccess.normalized.severity, 'high', 'Late historical failures must update the previously processed success')
    assert.ok(lateSuccess.normalized.detections.some((finding: {rule_id: string}) => finding.rule_id === 'auth.brute_force_success.v1'))
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
    // Pre-storage Analyze rules have their own threshold/retention integration
    // check; a single stored fixture must not trigger their aggregate alert.
    for (const rule of MILL_RULES.filter(rule => millDefaultDefinition(rule.id).stage !== 'analyze')) assert.ok((await query('SELECT 1 FROM mill_findings WHERE rule_id = $1', [rule.id])).rowCount, `Persisted finding for ${rule.id}`)
    for (const text of ['ProcessLogs | where Executable endswith "whoami"', 'SigninLogs | where Severity == "high"',
        'Logs | where RuleId == "process.recon.whoami.v1"', 'Logs | where Message contains "whoami"']) {
        const compiled = compileLogQuery(text)
        const result = await query(`SELECT id FROM mill_events WHERE ${compiled.where.join(' AND ')} ORDER BY ${compiled.order} LIMIT ${compiled.limit}`, compiled.params)
        assert.ok(result.rowCount, `KQL returned stored events: ${text}`)
    }
    await query('CREATE TEMP TABLE log_processing_cursors (name text PRIMARY KEY, last_id bigint DEFAULT 0, recent_id bigint, updated_at timestamptz DEFAULT NOW(), last_error text)')
    const { logCatchupSchema } = await import('../src/utils/db/logCatchupSchema.ts')
    for (const statement of logCatchupSchema) await query(statement.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE IF NOT EXISTS'))
    const { logProcessQueueSchema, processLogIndex } = await import('../src/utils/db/logProcessQueueSchema.ts')
    for (const statement of logProcessQueueSchema) await query(statement.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE IF NOT EXISTS'))
    await query(processLogIndex)
    await query('INSERT INTO login_events (user_id, ip, status, reason) VALUES (\'web-user\', \'192.0.2.55\', \'failed\', \'bad_password\')')
    await query('INSERT INTO traffic_events (domain, path, method, status) VALUES (\'hanasand.com\', \'/fixture\', \'GET\', 503)')
    await query('INSERT INTO system_events (event_type, severity, organization_id) VALUES (\'fixture.audit\', \'critical\', \'fixture\')')
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
    await query('INSERT INTO log_processing_cursors (name, last_id, recent_id) VALUES (\'service_logs\', 0, 0)')
    let afterWatermarkId = '', observedPriorityBeforeFifo = false
    queryObserver = async (sql, values) => {
        if (sql.includes('SELECT s.* FROM service_logs s') && !afterWatermarkId) {
            assert.equal(values.length, 0, 'Priority reads visible rows without advancing a sequence cursor')
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
        const firstCursor = (await query('SELECT last_id, recent_id FROM log_processing_cursors WHERE name = \'service_logs\'')).rows[0]
        assert.equal(String(firstCursor.recent_id), '1000', 'Priority cannot jump the FIFO checkpoint')
        assert.equal(String(firstCursor.last_id), '0')
        assert.equal((await query('SELECT processing_status FROM mill_events WHERE log_key = $1', [`service:${afterWatermarkId}`])).rows[0]?.processing_status, 'processed',
            'A visible insertion after the watermark is processed without moving the FIFO cursor past that watermark')
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
    const { acknowledgeProcessedLogs, processQueuedLogs, recoverProcessLogs, readPendingProcessLogs } = await import('../src/utils/mill/processQueue.ts')
    await query('DROP TRIGGER log_process_queue_insert ON service_logs')
    const oldCommand = (await query(`INSERT INTO service_logs (service, host, level, message, metadata, created_at)
        VALUES ('audit', 'old-vm', 'info', 'whoami', $1, NOW() - INTERVAL '2 hours') RETURNING id::text`, [commandMetadata])).rows[0].id
    const benignProcess = { process: { executable: '/bin/true', command_line: 'true', arguments: ['true'] } }
    await query(`INSERT INTO service_logs (service, host, level, message, metadata, created_at)
        SELECT 'audit', 'old-host', 'info', 'true', $1, NOW() - INTERVAL '1 hour' FROM generate_series(1, 1101)`, [benignProcess])
    await query('DELETE FROM log_processing_cursors WHERE name = \'process_logs_recovery\'')
    for (const statement of logProcessQueueSchema) await query(statement.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE IF NOT EXISTS'))
    const snapshot = (await query('SELECT recent_id FROM log_processing_cursors WHERE name = \'process_logs_recovery\'')).rows[0].recent_id
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
    await query('SAVEPOINT queue_limit_fixture')
    await query('DELETE FROM log_process_queue')
    const cappedRows = (await query(`INSERT INTO service_logs(service,host,level,message,metadata,created_at)
        SELECT 'audit','cap-fixture','info','true',$1,NOW()-INTERVAL '1 day' FROM generate_series(1,20) RETURNING *`, [benignProcess])).rows
    const cappedPages: number[] = []
    await processQueuedLogs(async logs => { cappedPages.push(logs.length); await processLogBatch(logs, 'fixture', rules) }, true, 2)
    assert.deepEqual(cappedPages, [2,2,2,2])
    assert.equal((await readPendingProcessLogs()).count, 12)
    await processLogBatch([cappedRows[19]], 'fixture', rules)
    await acknowledgeProcessedLogs([String(cappedRows[18].id), String(cappedRows[19].id)])
    assert.equal((await readPendingProcessLogs()).count, 11, 'Live ACK removes only the completed event while the older pending event remains queued')
    assert.equal((await query('SELECT count(*)::int AS count FROM log_process_queue WHERE log_id=$1', [cappedRows[18].id])).rows[0].count, 1)
    await query('ROLLBACK TO SAVEPOINT queue_limit_fixture')
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
        assert.equal(row.normalized.rules_checked, rules.filter(rule => rule.enabled !== false).length)
    }
    assert.equal((await readPendingProcessLogs()).count, 2000, 'Later arrivals remain queued without displacing older admitted work')
    await recoverProcessLogs(logs => processLogBatch(logs, 'fixture', rules))
    assert.equal((await query('SELECT 1 FROM mill_events WHERE log_key=$1', [`service:${oldCommand}`])).rowCount, 0, 'Recovery page stays bounded')
    assert.ok(BigInt((await query('SELECT recent_id FROM log_processing_cursors WHERE name=\'process_logs_recovery\'')).rows[0].recent_id) < BigInt(snapshot))
    const durableRecoveryId = (await query('SELECT recent_id FROM log_processing_cursors WHERE name=\'process_logs_recovery\'')).rows[0].recent_id
    for (const statement of logProcessQueueSchema) await query(statement.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE IF NOT EXISTS'))
    assert.equal((await query('SELECT recent_id FROM log_processing_cursors WHERE name=\'process_logs_recovery\'')).rows[0].recent_id, durableRecoveryId, 'Restart/redeploy preserves recovery progress')
    await recoverProcessLogs(logs => processLogBatch(logs, 'fixture', rules))
    const recoveredCommand = (await query('SELECT normalized, processing_status FROM mill_events WHERE log_key=$1', [`service:${oldCommand}`])).rows[0]
    assert.equal(recoveredCommand?.processing_status, 'processed', 'Aged pre-upgrade command recovers automatically despite newer arrivals')
    assert.equal(recoveredCommand.normalized.severity, 'high')
    assert.equal(recoveredCommand.normalized.rules_checked, rules.filter(rule => rule.enabled !== false).length)
    const finalFindingCount = (await query('SELECT COUNT(*)::int AS count FROM mill_findings')).rows[0].count
    await recoverProcessLogs(logs => processLogBatch(logs, 'fixture', rules))
    assert.equal((await query('SELECT COUNT(*)::int AS count FROM mill_findings')).rows[0].count, finalFindingCount)
    await query('INSERT INTO organizations (id, status, name) VALUES (\'archived-priority\', \'active\', \'Archived fixture\')')
    const retryMetadata = { ...commandMetadata, organizationId: 'archived-priority', user: { id: 'private-user', email: 'private@example.test' } }
    const archivedLog = (await query(`INSERT INTO service_logs (service, host, level, message, metadata)
        VALUES ('audit', 'archived-host', 'info', 'whoami', $1) RETURNING *`, [retryMetadata])).rows[0]
    queryObserver = async sql => { if (sql.startsWith('SELECT rule_id, severity')) throw new Error('Fixture interrupted before completion') }
    await assert.rejects(processLogBatch([archivedLog], 'archived-priority', rules), /Fixture interrupted/)
    queryObserver = undefined
    await query('UPDATE organizations SET status=\'inactive\' WHERE id=\'archived-priority\'')
    await processStoredLogs()
    const reassignedRetry = (await query('SELECT * FROM mill_events WHERE log_key=$1', [`service:${archivedLog.id}`])).rows[0]
    assert.equal(reassignedRetry.processing_status, 'processed')
    assert.equal(reassignedRetry.organization_id, 'fixture')
    assert.equal(reassignedRetry.user_id, 'private-user')
    assert.equal(reassignedRetry.user_email, 'private@example.test')
    assert.equal(reassignedRetry.original.service_log_id, String(archivedLog.id))
    assert.ok(JSON.stringify(reassignedRetry.normalized).includes('private-user'))
    assert.equal((await query('SELECT 1 FROM log_process_queue WHERE log_id=$1', [archivedLog.id])).rowCount, 0,
        'An organization becoming inactive during retry cannot poison the command FIFO')
    console.log(`Process queue PostgreSQL verification passed: transactional admission, delayed VM detection, FIFO under sustained arrivals, bounded recovery, deduplication; 1,103 queued events processed in ${Math.round(performance.now()-startedQueue)} ms including recovery checks.`)
    // Exercise the real oldest-receipt query, all four forward/history limits and
    // durable cursors without changing the surrounding fixture's source state.
    await query('SAVEPOINT historical_throttle')
    await query('TRUNCATE service_logs CASCADE')
    await query('TRUNCATE login_events, traffic_events, system_events')
    await query('UPDATE log_processing_cursors SET recent_id=0 WHERE name=\'process_logs_recovery\'')
    const throttleSources = [
        ['service_logs', 'service,host,level,message,created_at', '\'throttle\',\'fixture-host\',\'info\',\'ordinary history\''],
        ['login_events', 'user_id,ip,status,created_at', '\'throttle-user-\'||n,\'192.0.2.201\',\'success\''],
        ['traffic_events', 'domain,path,method,status,created_at', '\'fixture.test\',\'/throttle\',\'GET\',200'],
        ['system_events', 'event_type,severity,organization_id,created_at', '\'fixture.throttle\',\'info\',\'fixture\''],
    ]
    const histories: Array<{ source: string, ids: string[] }> = []
    for (const [source, columns, values] of throttleSources) {
        const inserted = await query(`INSERT INTO ${source} (${columns}) SELECT ${values},
            CASE WHEN n=501 THEN clock_timestamp() ELSE clock_timestamp()-INTERVAL '1 hour' END
            FROM generate_series(1,501) n RETURNING id::text`)
        const ids = inserted.rows.map(row => row.id as string).sort((a,b) => BigInt(a) < BigInt(b) ? -1 : 1)
        histories.push({ source, ids })
        await query(`INSERT INTO log_processing_cursors(name,last_id,recent_id) VALUES($1,$2,$3)
            ON CONFLICT(name) DO UPDATE SET last_id=EXCLUDED.last_id,recent_id=EXCLUDED.recent_id,history_end_id=NULL`,
        [source, String(BigInt(ids[0])-1n), ids[249]])
    }
    const previousCatchupLimit = process.env.LOG_CATCHUP_BATCH_LIMIT
    let delayedReceipt = ''
    queryObserver = async sql => {
        if (sql.includes('AS delayed') && !delayedReceipt) {
            // The indexed age snapshot chooses this tick's allocation before the queue drains.
            delayedReceipt = (await client.query(insertCommand, [benignProcess])).rows[0].id
            await client.query('UPDATE log_process_queue SET queued_at=clock_timestamp()-INTERVAL \'61 seconds\' WHERE log_id=$1', [delayedReceipt])
        }
    }
    try {
        await processStoredLogs()
        queryObserver = undefined
        for (const { source, ids } of histories) {
            const state = (await query('SELECT last_id::text,recent_id::text FROM log_processing_cursors WHERE name=$1', [source])).rows[0]
            assert.equal(state.last_id, ids[99], `${source} history advances by exactly100 acknowledged rows`)
            assert.equal(state.recent_id, ids[349], `${source} forward cursor advances exactly100 rows without jumping the remaining151`)
            const keys = ids.map(id => `service:${source==='service_logs'?'':source+':'}${id}`)
            assert.equal((await query('SELECT COUNT(*)::int AS count FROM mill_events WHERE log_key=ANY($1::text[]) AND processing_status=\'processed\'', [keys])).rows[0].count,source === 'service_logs' ? 201 : 200,
                `${source} has100 historical rows and100 forward rows; service event-time priority also checks the newest row`)
        }
        assert.equal((await query('SELECT COUNT(*)::int AS count FROM log_process_queue WHERE log_id=$1', [delayedReceipt])).rows[0].count,0, 'The aged command is acknowledged without changing the fixed allocation for this tick')
        // An operator cap remains effective even after the command queue clears.
        // Add an upgrade-recovery stream without trigger admission, then verify
        // its actual SQL page/cursor independently of forward-source overlap.
        await query('DROP TRIGGER log_process_queue_insert ON service_logs')
        const recoveryRows = await query(`INSERT INTO service_logs (service,host,level,message,metadata,created_at)
            SELECT 'audit','limited-recovery','info','true',$1,NOW()-INTERVAL '1 day'
            FROM generate_series(1,251) RETURNING id::text`, [benignProcess])
        const recoveryIds = recoveryRows.rows.map(row => row.id as string).sort((a,b) => BigInt(a)<BigInt(b)?-1:1)
        for (const statement of logProcessQueueSchema) await query(statement.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE IF NOT EXISTS'))
        await query('UPDATE log_processing_cursors SET recent_id=$1 WHERE name=\'process_logs_recovery\'', [recoveryIds.at(-1)])
        process.env.LOG_CATCHUP_BATCH_LIMIT = '100'
        await processStoredLogs()
        for (const { source, ids } of histories) {
            const state = (await query('SELECT last_id::text,recent_id::text FROM log_processing_cursors WHERE name=$1', [source])).rows[0]
            assert.equal(state.last_id, ids[199], `${source} history stays capped while the command queue is clear`)
            assert.equal(state.recent_id, ids[449], `${source} forward work stays capped while the command queue is clear`)
        }
        const recoveryKeys = recoveryIds.map(id => `service:${id}`)
        assert.equal((await query('SELECT COUNT(*)::int AS count FROM mill_events WHERE log_key=ANY($1::text[]) AND processing_status=\'processed\'', [recoveryKeys])).rows[0].count,100)
        assert.equal((await query('SELECT recent_id::text FROM log_processing_cursors WHERE name=\'process_logs_recovery\'')).rows[0].recent_id,recoveryIds[150],
            'The recovery cap preserves the first unprocessed ID for the next page')
        delete process.env.LOG_CATCHUP_BATCH_LIMIT
        await processStoredLogs() // Clearing the operator control restores full capacity.
        const recovered = await query('SELECT normalized FROM mill_events WHERE log_key=ANY($1::text[]) AND processing_status=\'processed\'', [recoveryKeys])
        assert.equal(recovered.rowCount,251, 'Recovery resumes without losing any capped remainder')
        const enabledRules = (await loadConfiguredMillRules('fixture')).filter(rule => rule.enabled !== false).length
        assert.ok(enabledRules > 0)
        assert.ok(recovered.rows.every(row => row.normalized.rules_checked === enabledRules))
        for (const { source, ids } of histories) {
            const state = (await query('SELECT last_id::text,recent_id::text FROM log_processing_cursors WHERE name=$1', [source])).rows[0]
            assert.equal(state.last_id, ids[249], `${source} finishes its fixed historical range without rechecking forward rows`)
            assert.ok(BigInt(state.recent_id) >= BigInt(ids[500]), `${source} resumes full forward capacity`)
            const keys = ids.map(id => `service:${source==='service_logs'?'':source+':'}${id}`)
            assert.equal((await query('SELECT COUNT(*)::int AS count FROM mill_events WHERE log_key=ANY($1::text[]) AND processing_status=\'processed\'', [keys])).rows[0].count,501, `${source} retains complete coverage through cursor overlap`)
        }
    } finally {
        queryObserver=undefined
        if (previousCatchupLimit === undefined) delete process.env.LOG_CATCHUP_BATCH_LIMIT
        else process.env.LOG_CATCHUP_BATCH_LIMIT = previousCatchupLimit
        await query('ROLLBACK TO SAVEPOINT historical_throttle')
    }
    console.log('PostgreSQL adaptive scheduling passed: indexed aged queue, four100-row forward/history pages, newest-event priority retained, operator recovery100 cap with exact cursors, complete coverage and defaults restored.')
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
    await assertProjectionParity() // Includes late-auth severity changes, replay and all configured detections.
    await query('UPDATE mill_log_dimensions_state SET ready=FALSE,last_event_id=\'\'')
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
    await query('UPDATE mill_events SET processing_status=\'pending\' WHERE id=\'!after-cursor\'')
    await assertProjectionParity()
    await query('UPDATE mill_events SET processing_status=\'processed\',ingestion_id=\'native\' WHERE id=\'!after-cursor\'')
    await assertProjectionParity()
    await query('UPDATE mill_events SET ingestion_id=\'logs\',id=\'!renamed\' WHERE id=\'!after-cursor\'')
    await assertProjectionParity()
    await query('SAVEPOINT projection_retry')
    await query('UPDATE mill_events SET normalized=\'{}\'::jsonb WHERE id=\'!renamed\'')
    await assertProjectionParity()
    await query('ROLLBACK TO SAVEPOINT projection_retry')
    await assertProjectionParity()
    await query('WITH removed AS (DELETE FROM mill_events WHERE id=\'!renamed\' RETURNING id) SELECT * FROM removed')
    await assertProjectionParity()
    await query('INSERT INTO organizations (id,status,name) VALUES (\'projection-delete\',\'active\',\'Fixture\')')
    await query(`INSERT INTO mill_events (id,ingestion_id,organization_id,event_timestamp,normalized)
        VALUES ('!delete-org','logs','projection-delete',NOW(),'{"severity":"critical","service":"private"}')`)
    await query('UPDATE organizations SET status=\'archived\' WHERE id=\'projection-delete\'')
    for (const kql of ['Logs', 'ApplicationLogs | where Severity != "critical"', 'Logs | where Service == "private"', 'Logs | where TimeGenerated > ago(1h)']) {
        const compiled = compileLogQuery(kql)
        const predicates = ['ingestion_id = \'logs\'', 'processing_status = \'processed\'', 'event_timestamp >= NOW()-INTERVAL \'24 hours\'',
            ...compiled.where, 'EXISTS (SELECT 1 FROM organizations o WHERE o.id=mill_events.organization_id AND o.status=\'active\')']
        const original = await query(`SELECT normalized->>'severity' AS severity, normalized->>'service' AS service, COUNT(*)::int AS count
            FROM mill_events WHERE ${predicates.join(' AND ')} GROUP BY 1,2 ORDER BY 1,2`, compiled.params)
        const compact = await query(`SELECT severity,service,COUNT(*)::int AS count FROM mill_log_dimensions mill_events
            WHERE ${dimensionLogWhere(predicates)!.join(' AND ')} GROUP BY 1,2 ORDER BY 1,2`, compiled.params)
        assert.deepEqual(compact.rows, original.rows, `Exact projected counters, including active organizations: ${kql}`)
        assert.deepEqual(foldLogCounts(compact.rows), foldLogCounts(original.rows))
    }
    await query('DELETE FROM organizations WHERE id=\'projection-delete\'')
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
    const other = await query('SELECT count(*)::int AS count FROM mill_findings WHERE organization_id = \'other\'')
    assert.equal(other.rows[0].count, 0, 'No findings in another organization')
    // Apply the committed standby SELECT block to isolated temporary relations.
    // Authentication is mocked; the actual handlers and SQL run under an unprivileged role.
    const permissions = readFileSync(new URL('../../scripts/recovery/standby-permissions.sql', import.meta.url), 'utf8')
    const logsGrant = permissions.match(/-- Administrator-only Logs pages[^\n]*\n(GRANT SELECT[\s\S]*?;)/)?.[1]
    assert.ok(logsGrant, 'The explicit standby Logs grant must exist')
    const logTables = ['service_logs', 'traffic_events', 'mill_events', 'log_processing_cursors', 'log_catchup_progress', 'log_process_queue', 'mill_log_dimensions', 'mill_log_dimensions_state', 'mill_log_counts', 'mill_log_counts_state']
    assert.deepEqual([...logsGrant.matchAll(/public\.(\w+)/g)].map(match => match[1]), logTables)
    const navigationGrant = permissions.match(/-- Organization selector[^\n]*\n(GRANT SELECT[\s\S]*?;)/)?.[1]
    assert.ok(navigationGrant, 'The explicit standby organization/Traffic read grant must exist')
    const navigationTables = ['organization_invites', 'traffic_aggregate_events']
    assert.deepEqual([...navigationGrant.matchAll(/public\.(\w+)/g)].map(match => match[1]), navigationTables)
    await query('ALTER TABLE organizations ADD COLUMN updated_at timestamptz DEFAULT NOW()')
    await query('ALTER TABLE users ADD COLUMN active boolean NOT NULL DEFAULT true')
    for (const table of ['organization_members', 'organization_invites', 'organization_watchlist_items']) {
        const definition = schema.match(new RegExp('CREATE TABLE IF NOT EXISTS ' + table + ' \\([\\s\\S]*?\\n        \\)'))?.[0]
        assert.ok(definition, `Actual schema for ${table} must be found`)
        await query(definition.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE'))
    }
    await query('INSERT INTO users(id) VALUES (\'permission-user\')')
    await query('INSERT INTO organization_members(organization_id,user_id,role) VALUES (\'fixture\',\'permission-user\',\'owner\')')
    await query(`INSERT INTO organization_invites(organization_id,email,invited_by,expires_at)
        VALUES ('fixture','pending@example.test','permission-user',NOW()+INTERVAL '1 day'),
            ('fixture','expired@example.test','permission-user',NOW()-INTERVAL '1 day')`)
    const historySchema = readFileSync(new URL('../src/utils/traffic/history.ts', import.meta.url), 'utf8')
    for (const table of ['traffic_history_state', 'traffic_history']) {
        const definition = historySchema.match(new RegExp('CREATE TABLE IF NOT EXISTS ' + table + ' \\([\\s\\S]*?\\n        \\)'))?.[0]
        assert.ok(definition, `Actual schema for ${table} must be found`)
        await query(definition.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE'))
    }
    const { ensureTrafficHistorySchema } = await import('../src/utils/traffic/history.ts')
    await ensureTrafficHistorySchema()
    assert.equal((await query('SELECT relpersistence FROM pg_class WHERE oid=\'traffic_aggregate_events\'::regclass')).rows[0].relpersistence, 't', 'Aggregate view and every fixture relation stay temporary')
    const reader = `logs_reader_${crypto.randomUUID().replaceAll('-', '')}`
    const temporarySchema = (await query('SELECT nspname FROM pg_namespace WHERE oid=pg_my_temp_schema()')).rows[0].nspname
    assert.match(temporarySchema, /^pg_temp_\d+$/)
    await query(`CREATE ROLE ${reader} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`)
    await query(`GRANT USAGE ON SCHEMA ${temporarySchema} TO ${reader}`)
    // These reads already belong to the existing standby policy.
    await query(`GRANT SELECT ON pg_temp.organizations, pg_temp.login_events, pg_temp.users, pg_temp.organization_members, pg_temp.organization_watchlist_items TO ${reader}`)
    await query(`SET LOCAL ROLE ${reader}`)
    await query('SAVEPOINT denied_log_read')
    await assert.rejects(query('SELECT id FROM service_logs LIMIT 1'), { code: '42501' })
    await query('ROLLBACK TO SAVEPOINT denied_log_read')
    for (const table of navigationTables) {
        await query('SAVEPOINT denied_navigation_read')
        await assert.rejects(query(`SELECT 1 FROM ${table} LIMIT 1`), { code: '42501' })
        await query('ROLLBACK TO SAVEPOINT denied_navigation_read')
    }
    await query('RESET ROLE')
    await query(navigationGrant.replaceAll('public.', 'pg_temp.').replace('hanasand_standby_app', reader))
    await query(logsGrant.replaceAll('public.', 'pg_temp.').replace('hanasand_standby_app', reader))
    await query('UPDATE organizations SET status=\'archived\' WHERE id=\'other\'')
    await query(`INSERT INTO mill_events (id, ingestion_id, organization_id, event_timestamp, processing_status, normalized)
        VALUES ('permission-active','logs','fixture',NOW(),'processed','{"severity":"high","service":"standby-fixture","log_type":"ProcessLogs","message":"standby permission fixture"}'),
            ('permission-inactive','logs','other',NOW(),'processed','{"severity":"critical","service":"standby-fixture","log_type":"ProcessLogs","message":"standby permission fixture"}')`)
    await query(`INSERT INTO service_logs (service,level,message,metadata) VALUES ('standby-fixture','error','standby permission fixture',
        '{"category":"http_response_error","surface":"api","status_code":500,"error_code":"fixture","error_message":"fixture","path":"/fixture","user_agent":"fixture"}')`)
    await query('INSERT INTO traffic_events (path,method,status,user_agent) VALUES (\'/standby-permission\',\'GET\',503,\'fixture\')')
    await query('INSERT INTO login_events (user_id,ip,status,reason) VALUES (\'permission-user\',\'192.0.2.1\',\'failure\',\'bad_password\')')
    let authorized = true, administrator = true, reads = 0
    mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: authorized, id: 'permission-user' }) }))
    mock.module('../src/utils/auth/hasRole.ts', () => ({ default: async () => ({ valid: administrator }) }))
    mock.module('../src/utils/logs/native.ts', () => ({ listNativeLogs: async () => [], listNativeLogServices: async () => [], isNativeLogSourceAvailable: () => false }))
    mock.module('../src/utils/docker/engine.ts', () => ({ listRuntimeLogs: async () => ({ logs: [], containers: [] }), isRuntimeLogSourceAvailable: () => false }))
    const { default: Fastify } = await import('fastify')
    const { searchLogs } = await import('../src/handlers/logs/search.ts')
    const { getLogs, getLogServices } = await import('../src/handlers/logs/get.ts')
    const { getErrorEvents } = await import('../src/handlers/logs/errors.ts')
    const { getOrganizations } = await import('../src/handlers/organizations.ts')
    const { getLegacyTrafficSummary, getLegacyTrafficRecords } = await import('../src/handlers/traffic/legacy.ts')
    const app = Fastify()
    app.get('/organizations', getOrganizations)
    app.get('/traffic/summary', getLegacyTrafficSummary)
    app.get('/traffic/records', getLegacyTrafficRecords)
    app.get('/logs/search', searchLogs)
    app.get('/logs', getLogs)
    app.get('/logs/services', getLogServices)
    app.get('/logs/errors', getErrorEvents)
    await query(`SET LOCAL ROLE ${reader}`)
    queryObserver = async () => { reads++ }
    try {
        const organizations = await app.inject('/organizations')
        assert.equal(organizations.statusCode, 200, organizations.body)
        assert.deepEqual(organizations.json().organizations.map((row: { id: string, pendingInviteCount: number }) => [row.id, row.pendingInviteCount]), [['fixture', 1]], 'Membership and pending/unexpired invitation counts remain enforced')
        for (const path of ['/traffic/summary?metric=path', '/traffic/records']) {
            const response = await app.inject(path)
            assert.equal(response.statusCode, 200, response.body)
            if (path.includes('summary')) assert.ok(response.json().some((row: { value: string }) => row.value === '/standby-permission'))
            else assert.ok(response.json().result.length && response.json().total > 0)
        }
        const search = '/logs/search?service=standby-fixture&stats=1'
        for (const suffix of ['', '&severity=high,critical', '&search=standby', `&kql=${encodeURIComponent('ProcessLogs | where Message contains "standby" | take 100')}`]) {
            const response = await app.inject(search + suffix)
            assert.equal(response.statusCode, 200, response.body)
            const body = response.json()
            assert.deepEqual(body.rows.map((row: {id: string}) => row.id), ['permission-active'], 'Inactive organizations stay excluded under the standby role')
            assert.deepEqual(body.counts, [{ severity: 'high', count: 1 }])
            assert.deepEqual(body.services, [{ service: 'standby-fixture', count: 1 }])
            assert.ok(body.processing.sources.length)
            assert.equal(typeof body.processing.pending_commands.count, 'number')
        }
        for (const url of ['/logs?service=standby-fixture', '/logs/services', '/logs/errors?includeExpected=1']) {
            const response = await app.inject(url)
            assert.equal(response.statusCode, 200, response.body)
            if (url.includes('errors')) assert.ok(['api', 'auth', 'traffic'].every(source => response.json().errors.some((row: {source: string}) => row.source === source)))
            else if (url.includes('services')) assert.ok(response.json().services.some((row: {service: string}) => row.service === 'standby-fixture'))
            else assert.ok(response.json().logs.length)
        }
        for (const url of [search, '/logs', '/logs/services', '/logs/errors']) {
            const before = reads
            authorized = false
            assert.equal((await app.inject(url)).statusCode, 401)
            authorized = true
            administrator = false
            assert.equal((await app.inject(url)).statusCode, 403)
            administrator = true
            assert.equal(reads, before, 'Denied users never reach SQL or cached log data')
        }
        for (const table of [...logTables, ...navigationTables]) {
            const privileges = (await query(`SELECT has_table_privilege(current_user,$1,'SELECT') AS readable,
                has_table_privilege(current_user,$1,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS writable`, [`pg_temp.${table}`])).rows[0]
            assert.deepEqual(privileges, { readable: true, writable: false }, table)
        }
        for (const table of ['mill_findings', 'mill_rules', 'system_events', 'traffic_history', 'traffic_history_state']) {
            assert.equal((await query('SELECT has_table_privilege(current_user,$1,\'SELECT\') AS allowed', [`pg_temp.${table}`])).rows[0].allowed, false, 'No unrelated table access')
        }
        assert.equal((await query('SELECT has_schema_privilege(current_user,$1,\'CREATE\') AS allowed', ['public'])).rows[0].allowed, false)
        const flags = (await query('SELECT rolsuper,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0]
        assert.ok(Object.values(flags).every(value => value === false))
        for (const sql of ['UPDATE mill_events SET normalized=\'{}\' WHERE FALSE', 'DELETE FROM service_logs WHERE FALSE', 'DELETE FROM organization_invites WHERE FALSE', 'UPDATE traffic_history_state SET covered_before=NOW() WHERE FALSE', 'CREATE TABLE public.forbidden_logs_ddl (id int)']) {
            await query('SAVEPOINT denied_log_write')
            await assert.rejects(query(sql), { code: '42501' })
            await query('ROLLBACK TO SAVEPOINT denied_log_write')
        }
    } finally {
        queryObserver = undefined
        await query('RESET ROLE')
        await app.close()
    }
    console.log('PostgreSQL standby permissions passed: exact SELECT grants, actual organization/Traffic/Logs/search/counters/errors readers, active organization filtering, 401/403 before reads, no added writes or DDL.')
    await query('INSERT INTO organizations(id,status,name) VALUES (\'deleted-scope\',\'deleted\',\'Deleted fixture\')')
    const replayIds = (await query('INSERT INTO service_logs(service,level,message,metadata) VALUES (\'fixture\',\'info\',\'Unknown org original\', \'{"organizationId":"missing-scope"}\'), (\'fixture\',\'info\',\'Deleted org original\', \'{"organizationId":"deleted-scope"}\') RETURNING id::text')).rows.map(row => row.id)
    for (const id of replayIds) await query('INSERT INTO mill_events(id,ingestion_id,organization_id,log_key,processing_status,normalized,event_timestamp) VALUES($1,\'logs\',\'fixture\',$2,\'skipped\',$3,NOW())', [
        (await import('node:crypto')).createHash('sha256').update('service:'+id).digest('hex'), 'service:'+id, { processing_reason: 'Organization is missing or inactive' }])
    const { recoverUnassignedLogs } = await import('../src/utils/mill/recoverUnassignedLogs.ts')
    await recoverUnassignedLogs(logs => processLogBatch(logs, 'fixture', rules))
    await recoverUnassignedLogs(logs => processLogBatch(logs, 'fixture', rules))
    const replayed = (await query('SELECT processing_status,organization_id,normalized FROM mill_events WHERE log_key=$1', ['service:'+replayIds[0]])).rows[0]
    assert.equal(replayed.processing_status,'processed')
    assert.equal(replayed.organization_id,'fixture')
    assert.equal(replayed.normalized.message,'Unknown org original')
    assert.equal((await query('SELECT processing_status FROM mill_events WHERE log_key=$1', ['service:'+replayIds[1]])).rows[0].processing_status,'processed')
    for (const cursorColumn of ['last_id', 'recent_id']) {
        const acknowledgedHistory = (await query(`INSERT INTO service_logs(service,level,message,metadata,created_at)
        SELECT 'history-fixture','info','Historical acknowledgement '||n,'{}'::jsonb,NOW()-INTERVAL '2 days'
        FROM generate_series(1,500) n RETURNING *`)).rows
        const holes = [acknowledgedHistory[199].id, acknowledgedHistory[399].id]
        await processLogBatch(acknowledgedHistory.filter(row => !holes.includes(row.id)), 'fixture', rules)
        await query('UPDATE log_processing_cursors SET last_id=$1,recent_id=$2,history_end_id=$2 WHERE name=\'service_logs\'',
            [String(BigInt(acknowledgedHistory[0].id)-1n), cursorColumn === 'last_id' ? acknowledgedHistory.at(-1).id : String(BigInt(acknowledgedHistory[0].id)-1n)])
        const previousHistoryLimit = process.env.LOG_CATCHUP_BATCH_LIMIT
        process.env.LOG_CATCHUP_BATCH_LIMIT = '1'
        try {
            for (const expected of [...holes, acknowledgedHistory.at(-1).id]) {
                await processStoredLogs()
                assert.equal(String((await query('SELECT ' + cursorColumn + ' AS position FROM log_processing_cursors WHERE name=\'service_logs\'')).rows[0].position), String(expected),
                    'Acknowledged rows may be passed, but the next pending row must obey the evaluation cap')
            }
        } finally {
            if (previousHistoryLimit === undefined) delete process.env.LOG_CATCHUP_BATCH_LIMIT
            else process.env.LOG_CATCHUP_BATCH_LIMIT = previousHistoryLimit
        }
        assert.equal(Number((await query('SELECT count(*) FROM mill_events WHERE log_key=ANY($1::text[]) AND processing_status=\'processed\'',
            [acknowledgedHistory.map(row => 'service:'+row.id)])).rows[0].count), 500)
        console.log(`PostgreSQL ${cursorColumn} scan passed: pending holes processed in order at cap1, acknowledged rows skipped, complete durable coverage.`)
    }
    const { refreshLogCatchupProgress } = await import('../src/utils/mill/catchupProgress.ts')
    await refreshLogCatchupProgress()
    await query('UPDATE log_catchup_progress SET sampled_at=NULL, attempted_at=NULL')
    await refreshLogCatchupProgress()
    const progress = (await query('SELECT payload FROM log_catchup_progress')).rows[0].payload
    let remaining = 0
    for (const source of ['service_logs','login_events','traffic_events','system_events']) {
        const c = (await query('SELECT last_id,recent_id,history_end_id FROM log_processing_cursors WHERE name=$1',[source])).rows[0]
        remaining += Number((await query('SELECT count(*) FROM '+source+' WHERE id>$1 AND id<=$2',[c.last_id,c.history_end_id ?? c.recent_id])).rows[0].count)
        remaining += Number((await query('SELECT count(*) FROM '+source+' WHERE id>$1',[c.recent_id])).rows[0].count)
    }
    assert.equal(progress.remaining,remaining,'Progress counts retained rows, not sequence gaps')
    assert.equal(progress.estimated_seconds,remaining ? null : 0,'No fabricated rate in the first sample')
    console.log(`PostgreSQL verification passed: all ${MILL_RULES.length} rules, ${securityRules.length} negatives, retry deduplication, auth correlation, and KQL.`)
} finally {
    await client.query('ROLLBACK')
    await client.end()
}
