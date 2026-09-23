import { expect, test } from 'bun:test'
import { ingestionCopy } from '../src/utils/mill/analyzeIngestion.ts'

export function fixture() {
    const reqId = '67d04ac9-630e-4d75-a2b5-33ba95b81842'
    const timestamp = '2026-09-24T00:00:00.000Z'
    const structured = { level: 30, time: Date.parse(timestamp), pid: 123, hostname: 'api-test', reqId,
        msg: 'http_access', req: { method: 'POST', url: '/api/logs/ingest', body: { events: [{ message: 'retained submitted content' }] } },
        access: { key: `http-api:${reqId}`, ip: '127.0.0.1', timestamp, path: '/api/logs/ingest', method: 'POST', status: 201 } }
    return { service: 'hanasand-api-1', host: 'inspur', level: 'info' as const, timestamp, sourceEventId: 'a'.repeat(64),
        message: JSON.stringify(structured), metadata: { collector: 'docker', container_id: 'b'.repeat(64), stream: 'stdout', structured } }
}

test('only identical complete records share a correlation key; bodies and provenance are recoverable', () => {
    const first = fixture(), copy = structuredClone(first)
    copy.sourceEventId = 'c'.repeat(64)
    copy.timestamp = '2026-09-24T00:00:01.000Z'
    copy.service = 'hanasand-api-2'
    expect(ingestionCopy(copy)?.key).toBe(ingestionCopy(first)?.key)
    const compact = ingestionCopy(copy)!
    expect({ ...JSON.parse(JSON.stringify(compact.envelope)), message: first.message,
        metadata: { ...compact.envelope.metadata, structured: first.metadata.structured } }).toEqual(copy)
    copy.metadata.structured.req.body.events[0].message = 'different submitted content'
    copy.message = JSON.stringify(copy.metadata.structured)
    expect(ingestionCopy(copy)?.key).not.toBe(ingestionCopy(first)?.key)
})

test('status or path alone never authorizes a drop; unknown evidence, warnings and failures stay', () => {
    for (const change of [{ level: 'warn' }, { level: 'error' }, { service: 'untrusted' }, { host: 'unknown' }, { sourceEventId: '' }, { extra: 'keep' }]) {
        expect(ingestionCopy({ ...fixture(), ...change } as any)).toBeNull()
    }
    for (const mutate of [
        (x: any) => { x.metadata.extra = 'keep' },
        (x: any) => { x.metadata.structured.extra = 'keep' },
        (x: any) => { x.metadata.structured.access.status = 200 },
        (x: any) => { x.metadata.structured.access.status = 401 },
        (x: any) => { x.metadata.structured.req.url += '?extra=1' },
        (x: any) => { x.metadata.structured.reqId = 'missing' },
        (x: any) => { delete x.metadata.structured.access },
    ]) {
        const log = fixture(); mutate(log); log.message = JSON.stringify(log.metadata.structured)
        expect(ingestionCopy(log)).toBeNull()
    }
    const duplicateKey = fixture()
    duplicateKey.message = duplicateKey.message.replace('"level":30', '"level":50,"level":30')
    expect(ingestionCopy(duplicateKey)).toBeNull()
})
