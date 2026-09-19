// Opt-in PostgreSQL check. Fixtures and the production index live in temporary
// tables and are rolled back; no live event data or indexes are changed.
// LOG_PIPELINE_TEST_DATABASE=1 DB_* bun tests/log-kql-postgres.ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { compileLogQuery } from '../src/utils/logs/kql.ts'

assert.equal(process.env.LOG_PIPELINE_TEST_DATABASE, '1', 'Use an isolated PostgreSQL test database.')
const client = new pg.Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB, user: process.env.DB_USER, password: process.env.DB_PASSWORD })
await client.connect()
await client.query('BEGIN')
try {
    await client.query('SET LOCAL statement_timeout = \'8s\'')
    await client.query('CREATE TEMP TABLE organizations (id text PRIMARY KEY, status text NOT NULL)')
    await client.query('INSERT INTO organizations VALUES (\'active\',\'active\'), (\'archived\',\'archived\')')
    await client.query(`CREATE TEMP TABLE mill_events (id text PRIMARY KEY, ingestion_id text NOT NULL DEFAULT 'logs',
        processing_status text NOT NULL DEFAULT 'processed', organization_id text NOT NULL DEFAULT 'active',
        event_timestamp timestamptz NOT NULL DEFAULT NOW(), normalized jsonb NOT NULL)`)
    const longSuffix = Array.from({ length: 1200 }, (_, index) => String.fromCodePoint(0x1f300 + index)).join('')
    const values = [null, '', 'whoami', '/usr/bin/whoami', '/usr/bin/WHOAMI', '/usr/bin/not-whoami', 'whoami.exe',
        'tool%', 'tool_', 'tool\\', 'tool!', 'tool!%_', 'tool\\%_', 'tool\' OR 1=1 --', 'İ', 'i', 'i\u0307', 'ÅßΣ', 'åßσ',
        'Straße', 'STRASSE', '😀WHOAMI', '🛰️', 'last\nline', 'line\tend', longSuffix, 'prefix' + longSuffix, 'different' + longSuffix.slice(4)]
    for (const [index, executable] of values.entries()) {
        await client.query('INSERT INTO mill_events (id, normalized) VALUES ($1, $2)',
            [`semantic-${index}`, { log_type: 'ProcessLogs', process: { executable } }])
    }
    await client.query('INSERT INTO mill_events (id, normalized) VALUES (\'missing-process\', \'{}\')')
    const suffixes = ['', 'whoami', 'WHOAMI', '%', '_', '\\', '!', '!%_', '\\%_', '\' OR 1=1 --', 'İ', 'i', 'i\u0307',
        'Σ', 'σ', 'ß', 'STRASSE', '😀WHOAMI', '🛰️', '\nline', '\tend', 'not-present', longSuffix, longSuffix.slice(4)]
    const schema = readFileSync(new URL('../src/utils/db/ensureSchema.ts', import.meta.url), 'utf8')
    const indexSql = schema.match(/CREATE INDEX IF NOT EXISTS idx_mill_logs_executable_suffix[\s\S]*?`/)?.[0].slice(0, -1)
    assert.ok(indexSql, 'Use the actual production suffix-index definition.')
    await client.query(indexSql) // Oversized metadata must remain indexable.
    for (const suffix of suffixes) {
        for (const negated of [false, true]) {
            const compiled = compileLogQuery(`Logs | where ${negated ? 'not ' : ''}Executable endswith ${JSON.stringify(suffix)}`)
            const actual = compiled.where.join(' AND ')
            const legacy = `${negated ? 'NOT ' : ''}(right(lower(COALESCE(normalized#>>'{process,executable}', '')), length($1::text)) = lower($1::text))`
            const result = await client.query(`SELECT COUNT(*)::int AS differences FROM mill_events
                WHERE (${actual}) IS DISTINCT FROM (${legacy})`, compiled.params)
            assert.equal(result.rows[0].differences, 0, `Literal/case/null parity: ${JSON.stringify(suffix)}, negated=${negated}`)
        }
    }
    await client.query('TRUNCATE mill_events')
    // Many ordinary process events plus fewer than take100 sparse matches ensures
    // the test cannot pass merely by stopping after the first matching page.
    await client.query(`INSERT INTO mill_events (id, normalized)
        SELECT 'background-' || n, jsonb_build_object('log_type', 'ProcessLogs', 'severity', 'low',
            'message', repeat(md5(n::text), 16), 'process', jsonb_build_object('executable', '/usr/bin/background-' || n))
        FROM generate_series(1, 100000) n`)
    await client.query(`INSERT INTO mill_events (id, normalized)
        SELECT 'match-' || n, jsonb_build_object('log_type', 'ProcessLogs', 'severity', 'high',
            'process', jsonb_build_object('executable', '/usr/bin/WHOAMI', 'command_line', 'whoami'))
        FROM generate_series(1, 5) n`)
    const excluded = [
        { id: 'excluded-archived', organization_id: 'archived' },
        { id: 'excluded-pending', processing_status: 'pending' },
        { id: 'excluded-native', ingestion_id: 'native' },
        { id: 'excluded-old', event_timestamp: '2000-01-01T00:00:00Z' },
        { id: 'excluded-table', log_type: 'ApplicationLogs' },
    ]
    for (const row of excluded) {
        await client.query(`INSERT INTO mill_events (id, organization_id, processing_status, ingestion_id, event_timestamp, normalized)
            VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()), $6)`,
        [row.id, row.organization_id || 'active', row.processing_status || 'processed', row.ingestion_id || 'logs',
            row.event_timestamp || null, { log_type: row.log_type || 'ProcessLogs', process: { executable: '/usr/bin/whoami' } }])
    }
    // Keep the competing indexes present: the planner must choose the suffix
    // index naturally, without disabling sequential or timestamp scans.
    await client.query('CREATE INDEX idx_mill_events_logs_time ON mill_events(event_timestamp DESC, id DESC) WHERE ingestion_id=\'logs\' AND processing_status=\'processed\'')
    await client.query('CREATE INDEX idx_mill_logs_type_time ON mill_events((normalized->>\'log_type\'), event_timestamp DESC) WHERE ingestion_id=\'logs\'')
    const statisticsSql = schema.match(/CREATE STATISTICS IF NOT EXISTS stat_mill_logs_executable_suffix[\s\S]*?`/)?.[0].slice(0, -1)
    assert.ok(statisticsSql, 'Use production expression statistics; partial-index statistics alone do not guide selectivity.')
    await client.query(statisticsSql)
    await client.query('ANALYZE mill_events')
    await client.query('ANALYZE organizations')
    const compiled = compileLogQuery('ProcessLogs | where Executable endswith "whoami" | project TimeGenerated, Host, Severity, CommandLine, RuleId | take 100')
    const predicates = ['ingestion_id=\'logs\'', 'processing_status=\'processed\'', 'event_timestamp >= NOW()-INTERVAL \'24 hours\'',
        ...compiled.where, 'EXISTS (SELECT 1 FROM organizations o WHERE o.id=mill_events.organization_id AND o.status=\'active\')']
    const sql = `SELECT id, normalized, event_timestamp, organization_id FROM mill_events WHERE ${predicates.join(' AND ')}
        ORDER BY ${compiled.order} LIMIT ${compiled.limit}`
    const result = await client.query(sql, compiled.params)
    assert.deepEqual(result.rows.map(row => row.id), ['match-5', 'match-4', 'match-3', 'match-2', 'match-1'])
    const explained = await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, compiled.params)
    const plan = explained.rows[0]['QUERY PLAN'][0]
    const planText = JSON.stringify(plan)
    assert.ok(planText.includes('idx_mill_logs_executable_suffix'), `The actual parameterized sparse query must use the suffix index: ${planText}`)
    assert.ok(planText.includes('Index Cond') && planText.includes('~>=~') && planText.includes('~<~'), 'The reversed prefix must be an index range, not a filter-only scan.')
    assert.ok(plan['Execution Time'] < 8000, 'Sparse suffix query must stay within the live eight-second timeout.')
    console.log(JSON.stringify({ executable_suffix_parity_cases: suffixes.length * 2, fixture_process_rows: 100000,
        matched_rows: result.rows.length, limit: compiled.limit, uses_suffix_index: true, execution_ms: plan['Execution Time'] }))
} finally {
    await client.query('ROLLBACK')
    await client.end()
}
