import { beforeEach, expect, mock, test } from 'bun:test'
import { eventProtectionDefinition } from '../src/utils/mill/eventProtection.ts'

let rules: any[] = [], calls: string[] = [], writes: string[] = [], eligible = '', failLookup = false
const query: any = async (sql: string) => {
    if (sql.includes('FROM mill_rules r')) {
        if (failLookup) throw new Error('Rule lookup unavailable')
        return { rows: rules }
    }
    if (sql.includes('INSERT INTO service_logs') || sql.includes('INSERT INTO traffic_events')) { writes.push(sql); return { rows: [] } }
    throw new Error(`Unexpected query: ${sql}`)
}
mock.module('#db', () => ({ default: query, withTransaction: async (work: any) => work(query) }))
mock.module('../src/utils/mill/analyzeCollectorLog.ts', () => ({ analyzeCollectorExecution: async () => { calls.push('collector'); return eligible === 'collector' } }))
mock.module('../src/utils/mill/analyzeLog.ts', () => ({
    analyzeMongoPing: async () => { calls.push('mongo'); return eligible === 'mongo' },
    analyzeAccess: async () => { calls.push('http'); return eligible === 'http' },
}))
mock.module('../src/utils/traffic/proxyRequest.ts', () => ({ recordProxyRequest: async () => false }))
const { default: recordLog, recordLogBatch } = await import('../src/utils/logs/recordLog.ts')
const { default: recordTraffic } = await import('../src/utils/traffic/recordTraffic.ts')
const access = { key: 'http-api:test', ip: '192.0.2.1', timestamp: new Date().toISOString(), path: '/public/file', method: 'GET', status: 200,
    inspection: { version: 1, bodyEmpty: true, headersSafe: true, pathSafe: true } }
const entry = { service: 'cdn', host: 'inspur', level: 'info' as const, message: 'http_access', metadata: { structured: { msg: 'http_access', access } } }
const keep = (service: string) => ({ source: 'owned', enabled: true, definition: { stage: 'analyze', action: 'keep', conditions: [{ path: 'service', operator: 'equals', value: service }] } })
beforeEach(() => { rules = []; calls = []; writes = []; eligible = ''; failLookup = false })

test.each(['collector', 'mongo', 'http'])('Store prevents %s analyzer drops in single and batch ingestion', async kind => {
    eligible = kind
    await recordLog(entry)
    expect(calls).toContain(kind)
    expect(writes).toHaveLength(0)
    rules = [keep(entry.service)]
    calls = []
    await recordLog(entry)
    await recordLogBatch([entry], query)
    expect(calls).toEqual([])
    expect(writes).toHaveLength(2)
    rules[0].enabled = false
    await recordLog(entry)
    expect(calls).toContain(kind)
    expect(writes).toHaveLength(2)
})
const request = () => ({ id: 'test', ip: '192.0.2.1', url: '/public/file', method: 'GET', hostname: 'hanasand.com', headers: { host: 'hanasand.com' }, log: { warn() {}, info() {} } }) as any
const response = { statusCode: 200, elapsedTime: 1 } as any

test('Store preserves direct HTTP traffic before the access analyzer', async () => {
    eligible = 'http'
    await recordTraffic(request(), response)
    expect(calls).toContain('http')
    expect(writes).toHaveLength(0)
    calls = []
    rules = [keep('http-traffic')]
    await recordTraffic(request(), response)
    expect(calls).toEqual([])
    expect(writes).toHaveLength(1)
})
test('failed exception lookup retains direct traffic and leaves collector ingestion retryable', async () => {
    eligible = 'http'; failLookup = true
    await recordTraffic(request(), response)
    expect(writes).toHaveLength(1)
    await expect(recordLog(entry)).rejects.toThrow('Rule lookup unavailable')
    expect(calls).toEqual([])
})


test('broad custom HTTP 200 drop cannot discard failed boundary inspections', async () => {
    rules = [{ ...keep('http-traffic'), definition: { ...keep('http-traffic').definition, action: 'drop' } },
        { source: 'hanasand', enabled: true, definition: structuredClone(eventProtectionDefinition) }]
    await recordTraffic(request(), response)
    expect(writes).toHaveLength(0)
    for (const change of [{ headers: { host: 'hanasand.com', authorization: 'Bearer test' } }, { body: 'suspicious payload' }, { url: '/api/admin/users' }]) {
        await recordTraffic({ ...request(), ...change }, response)
    }
    expect(writes).toHaveLength(3)
})
