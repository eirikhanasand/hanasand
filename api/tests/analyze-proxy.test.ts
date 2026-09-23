import { expect, test } from 'bun:test'
import { analyzeProxy, proxyConnection, proxyNotice, safeProxyRequest, proxyRuleId, proxyDefinition } from '../src/utils/mill/analyzeProxy.ts'
import { normalizeBuiltinDefinition } from '../src/handlers/mill.ts'
const id = 'bde2f19d-cecd-4d7f-8b97-738850a6c412'
const header = `${id}|hanasand-proxy-1|127.0.0.1|41000|127.0.0.1|18080|api`
const log = { service: 'hanasand-proxy-1', host: 'inspur', level: 'info', timestamp: '2026-09-24T00:00:00.000Z', sourceEventId: 'a'.repeat(64),
    message: `Connect from 127.0.0.1:41000 to 127.0.0.1:18080 (api/HTTP) correlation=${id} proxy=hanasand-proxy-1`,
    metadata: { collector: 'docker', stream: 'stdout', container_id: '123456abcdef' } }
const access = { key: 'http-api:request', timestamp: '2026-09-24T00:00:00.010Z', method: 'GET', path: '/ready', status: 200, ip: '192.0.2.1',
    inspection: { version: 1, bodyEmpty: true, headersSafe: true, pathSafe: true } }
function proof(): any {
    const connection = proxyConnection(header)
    return structuredClone({ connection, access, service_log_id: '42', level: 'info', message: 'proxy_request_completed', metadata: { proxy: connection, access } })
}
test('old, malformed, warning, cross-tenant and unexpected proxy notices remain', () => {
    expect(proxyNotice(log)).toEqual(proxyConnection(header))
    for (const change of [{ host: 'ovhcloud' }, { service: 'hanasand-proxy-3' }, { level: 'warn' }, { timestamp: 'bad' }, { sourceEventId: '' },
        { message: log.message + '\nWARNING backend down' }, { message: log.message.replace('api/HTTP', 'database/TCP') },
        { message: log.message.replace('41000', '65536') }, { message: log.message.replace('18080', '13000') },
        { message: log.message.replace('127.0.0.1', '192.0.2.1') }, { message: log.message.split(' correlation=')[0] },
        { metadata: { ...log.metadata, error: 'unexpected' } }, { metadata: { ...log.metadata, organizationId: 'customer' } },
        { metadata: { ...log.metadata, stream: 'stderr' } }, { metadata: { ...log.metadata, collector: 'syslog' } }]) expect(proxyNotice({ ...log, ...change })).toBeNull()
    expect(proxyConnection(header + '|extra')).toBeNull()
})
test('200 cannot override suspicious paths, methods, bodies, headers or incomplete inspection', () => {
    expect(safeProxyRequest(access)).toBe(true)
    for (const patch of [{ status: 500 }, { method: 'POST' }, { path: '/admin' }, { path: '/public?q=1' }, { path: '/%2e%2e/etc/passwd' },
        { ip: 'unknown' }, { inspection: undefined }, ...['bodyEmpty', 'headersSafe', 'pathSafe'].map(key => ({ inspection: { ...access.inspection, [key]: false } }))]) expect(safeProxyRequest({ ...access, ...patch })).toBe(false)
})
test('only committed matching safe evidence permits a receipt and count', async () => {
    for (const mode of ['drop', 'disabled', 'missing', 'mismatch', 'unsafe', 'late', 'tampered']) {
        const statements: string[] = [], evidence = proof()
        if (mode === 'mismatch') evidence.connection.sourcePort++
        if (mode === 'unsafe') evidence.access.inspection.headersSafe = false
        if (mode === 'late') evidence.access.timestamp = '2026-09-24T00:02:00Z'
        if (mode === 'tampered') evidence.metadata.proxy = null
        const query: any = async (sql: string, args: any[]) => {
            statements.push(sql)
            if (sql.includes('FROM mill_rules')) return { rows: mode === 'disabled' ? [] : [{ organization_id: 'platform' }] }
            if (sql.startsWith('SELECT original')) return { rows: [] }
            if (sql.includes('FROM log_proxy_requests')) return { rows: mode === 'missing' ? [] : [evidence] }
            if (sql.includes('INSERT INTO log_proxy_receipts')) {
                expect(JSON.parse(args[4])).toEqual(log)
                expect(args[3]).toBe('service:42')
                return { rowCount: 1, rows: [] }
            }
            return { rows: [], rowCount: 1 }
        }
        expect(await analyzeProxy(log, query)).toBe(mode === 'drop')
        expect(statements.some(s => s.includes('INSERT INTO log_proxy_counts'))).toBe(mode === 'drop')
    }
})
test('retry does not inflate counts or hide modified content under an existing ID', async () => {
    const queries: string[] = []
    const query: any = async (sql: string) => {
        queries.push(sql)
        return { rows: sql.includes('FROM mill_rules') ? [{ organization_id: 'platform' }] : [{ original: log }] }
    }
    expect(await analyzeProxy(log, query)).toBe(true)
    expect(await analyzeProxy({ ...log, timestamp: '2026-09-24T00:00:01Z' }, query)).toBe(false)
    expect(queries.some(q => q.startsWith('INSERT'))).toBe(false)
})
test('storage failure prevents acknowledgment; Keep is supported without editable safety selectors', async () => {
    const query: any = async (sql: string) => {
        if (sql.includes('FROM mill_rules')) return { rows: [{ organization_id: 'platform' }] }
        throw new Error('database unavailable')
    }
    await expect(analyzeProxy(log, query)).rejects.toThrow('database unavailable')
    expect(normalizeBuiltinDefinition(proxyRuleId, proxyDefinition).definition).toEqual(proxyDefinition)
    expect(normalizeBuiltinDefinition(proxyRuleId, { ...proxyDefinition, action: 'keep' }).definition?.action).toBe('keep')
    expect(normalizeBuiltinDefinition(proxyRuleId, { ...proxyDefinition, conditions: [{ path: 'host', operator: 'equals', value: 'inspur' }] }).error).toBeTruthy()
})
