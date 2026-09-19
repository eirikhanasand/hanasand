import { beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
let ready = true, authorized = true, administrator = true, pendingCount = 0
let statements: string[], parameters: any[][]
const query = async (sql: string, params: any[] = []): Promise<any> => {
    statements.push(sql); parameters.push(params)
    if (sql.includes('FROM log_process_queue LIMIT 10001')) return { rows: [{ count: pendingCount, oldest_queued_at: pendingCount ? '2026-09-19T14:49:32.311Z' : null }] }
    if (sql.startsWith('SELECT name, updated_at')) return { rows: [{ name: 'service_logs', last_error: null }] }
    if (sql === 'SELECT ready, last_error FROM mill_log_dimensions_state WHERE id = TRUE') return { rows: [{ ready }] }
    if (sql.includes('GROUP BY 1, 2')) return { rows: [{ severity: 'high', service: 'api', count: 4 }, { severity: 'low', service: 'api', count: 6 }] }
    return { rows: [] }
}
mock.module('#db', () => ({ default: query, withTransaction: async (work: any) => work(query) }))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: authorized }) }))
mock.module('../src/utils/auth/hasRole.ts', () => ({ default: async () => ({ valid: administrator }) }))
const { searchLogs } = await import('../src/handlers/logs/search.ts')
const app = Fastify()
app.get('/logs/search', searchLogs)
beforeEach(() => { ready = authorized = administrator = true; pendingCount = 0; statements = []; parameters = [] })
test('dashboard uses one exact compact grouping scan after complete backfill', async () => {
    const response = await app.inject('/logs/search?stats=1&service=api&severity=high,critical')
    expect(response.statusCode).toBe(200)
    expect(response.json().counts).toEqual([{ severity: 'high', count: 4 }, { severity: 'low', count: 6 }])
    expect(response.json().services).toEqual([{ service: 'api', count: 10 }])
    const groups = statements.filter(sql => sql.includes('GROUP BY'))
    expect(groups).toHaveLength(1)
    expect(groups[0]).toContain('FROM mill_log_dimensions mill_events')
    expect(groups[0]).toContain("o.status = 'active'")
    expect(groups[0]).toContain("severity IN ('high', 'critical')")
    expect(groups[0]).toContain('service = $2')
    expect(groups[0]).not.toContain('LIMIT')
})
test('incomplete backfill retains exact original-table counters', async () => {
    ready = false
    expect((await app.inject('/logs/search?stats=1')).statusCode).toBe(200)
    expect(statements.some(sql => sql.includes('FROM mill_log_dimensions mill_events'))).toBe(false)
    expect(statements.find(sql => sql.includes('GROUP BY'))).toContain("normalized->>'severity'")
})
test('basic JSON search and arbitrary KQL predicates keep the full-data fallback', async () => {
    for (const suffix of ['search=needle', 'kql=' + encodeURIComponent('Logs | where UserId == "alice"'), 'kql=' + encodeURIComponent('Logs | where RuleId == "process.recon.whoami.v1"')]) {
        statements = []
        expect((await app.inject('/logs/search?stats=1&' + suffix)).statusCode).toBe(200)
        expect(statements.some(sql => sql.includes('FROM mill_log_dimensions mill_events'))).toBe(false)
        expect(statements.filter(sql => sql.includes('GROUP BY'))).toHaveLength(1)
    }
})
test('KQL table/time/severity filters use equivalent projection fields and parameters', async () => {
    const kql = 'ProcessLogs | where Severity == "high" and TimeGenerated > ago(1h) | take 1'
    expect((await app.inject('/logs/search?stats=1&kql=' + encodeURIComponent(kql))).statusCode).toBe(200)
    const group = statements.findIndex(sql => sql.includes('GROUP BY'))
    expect(statements[group]).toContain('log_type = $1')
    expect(statements[group]).toContain('severity = $2')
    expect(parameters[group]).toEqual(['ProcessLogs', 'high', 3600, 24])
    expect(statements[group]).not.toContain('LIMIT 1')
})
test('reporting queries retain administrator authorization on every request', async () => {
    authorized = false
    expect((await app.inject('/logs/search?stats=1')).statusCode).toBe(401)
    authorized = true; administrator = false
    expect((await app.inject('/logs/search?stats=1')).statusCode).toBe(403)
    expect(statements).toHaveLength(0)
})

test('basic search stays literal and parameterized for rows and exact full-data counts', async () => {
    for (const search of ['whoami', '%', '_', '\\', '!', 'a', 'xy', "needle' OR 1=1 --"]) {
        statements = []; parameters = []
        const response = await app.inject('/logs/search?stats=1&search=' + encodeURIComponent(search))
        expect(response.statusCode).toBe(200)
        const selected = statements.findIndex(sql => sql.startsWith('SELECT id, normalized'))
        const grouped = statements.findIndex(sql => sql.includes('GROUP BY'))
        for (const index of [selected, grouped]) {
            expect(statements[index]).toContain("lower(normalized::text) LIKE '%' ||")
            expect(statements[index]).toContain("ESCAPE '!' AND strpos(lower(normalized::text), lower($2::text)) > 0")
            expect(parameters[index]).toEqual([24, search])
            expect(statements[index]).toContain("o.status = 'active'")
        }
        expect(statements[grouped]).not.toContain('LIMIT')
    }
    statements = []
    expect((await app.inject('/logs/search?search=')).statusCode).toBe(200)
    expect(statements.some(sql => sql.includes('LIKE'))).toBe(false)
})

test('processing status exposes bounded pending command counts and their oldest receipt', async () => {
    pendingCount = 10001
    const response = await app.inject('/logs/search')
    expect(response.statusCode).toBe(200)
    expect(response.json().processing.pending_commands).toEqual({ count: 10000, has_more: true, oldest_queued_at: '2026-09-19T14:49:32.311Z' })
    pendingCount = 0
    expect((await app.inject('/logs/search')).json().processing.pending_commands).toEqual({ count: 0, has_more: false, oldest_queued_at: null })
})
