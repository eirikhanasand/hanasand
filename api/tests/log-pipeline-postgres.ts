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
const query = (sql: string, values: unknown[] = []) => client.query(sql, values)
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
    const { processLogBatch } = await import('../src/utils/mill/processLogs.ts')
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
    const started = performance.now()
    await processLogBatch(Array.from({ length: 5000 }, (_, index) => ({ id: `volume-${index}`, service: 'fixture', host: 'fixture', level: 'info', message: 'Ordinary service log', created_at: new Date().toISOString() })), 'fixture', rules)
    console.log(`Ordinary-event throughput: ${Math.round(5000000 / (performance.now() - started))} events/second`)
    const other = await query("SELECT count(*)::int AS count FROM mill_findings WHERE organization_id = 'other'")
    assert.equal(other.rows[0].count, 0, 'No findings in another organization')
    console.log(`PostgreSQL verification passed: all ${MILL_RULES.length} rules, ${securityRules.length} negatives, retry deduplication, auth correlation, and KQL.`)
} finally {
    await client.query('ROLLBACK')
    await client.end()
}
