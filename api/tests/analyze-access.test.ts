import { describe, expect, test } from 'bun:test'
import { eligibleAccess, inspectAccess, accessFromLog, type AccessEvent } from '../src/utils/mill/analyzeAccess.ts'

const event: AccessEvent = { key: 'http-api:test', ip: '192.0.2.1', path: '/public/file', method: 'GET', status: 200,
    timestamp: new Date().toISOString(), inspection: inspectAccess({ url: '/public/file', headers: { host: 'hanasand.com' } }) }
describe('Analyze access safety', () => {
    const replicaLog = () => {
        const reqId = 'dd304419-ab13-451e-a2ac-3f27a94506af'
        const structured = { level: 30, time: Date.parse(event.timestamp), pid: 1, hostname: 'hanasand', reqId,
            access: { ...structuredClone(event), key: `http-api:${reqId}` }, req: { method: 'GET', url: event.path, remoteAddress: '127.0.0.1' }, msg: 'http_access' }
        return { service: 'hanasand-api-1', host: 'inspur', level: 'info', sourceEventId: 'a'.repeat(64), message: JSON.stringify(structured),
            metadata: { collector: 'docker', container_id: '123456abcdef', stream: 'stdout', structured } }
    }
    test('accepts only the four exact replica names with a complete standard envelope', () => {
        for (let i = 1; i <= 4; i++) expect(accessFromLog({ ...replicaLog(), service: `hanasand-api-${i}` })?.status).toBe(200)
        for (const change of [{ service: 'hanasand-api-5' }, { service: 'hanasand-api-1-evil' }, { host: 'unknown' }, { sourceEventId: '' }, { message: 'http_access' }, { level: 'error' }]) {
            expect(accessFromLog({ ...replicaLog(), ...change })).toBeNull()
        }
    })
    test('retains unexpected content at every envelope level even with forged safe flags', () => {
        for (const target of ['metadata', 'structured', 'access', 'inspection', 'req']) {
            const log = replicaLog()
            const row = log.metadata.structured
            const objects: Record<string, object> = { metadata: log.metadata, structured: row, access: row.access, inspection: row.access.inspection!, req: row.req }
            Object.assign(objects[target], { unexpected: 'suspicious payload' })
            log.message = JSON.stringify(row)
            expect(accessFromLog(log)).toBeNull()
        }
        const log = replicaLog()
        log.message = JSON.stringify({ ...log.metadata.structured, error: 'hidden in original message' })
        expect(accessFromLog(log)).toBeNull()
        const duplicate = replicaLog()
        duplicate.message = duplicate.message.replace('"msg":"http_access"', '"msg":"unexpected content","msg":"http_access"')
        expect(accessFromLog(duplicate)).toBeNull()
    })
    test('retains inconsistent, encoded, query-bearing, protected and failed requests', () => {
        for (const path of ['/api/auth/session', '/api/admin/users', '/.env', '/../etc/passwd', '/file?x=hello', '/%252e%252e/etc/passwd']) {
            const log = replicaLog()
            log.metadata.structured.req.url = path
            log.metadata.structured.access.path = path
            log.message = JSON.stringify(log.metadata.structured)
            expect(accessFromLog(log)).toBeNull()
        }
        for (const change of [{ status: 500 }, { method: 'POST' }, { ip: 'unknown' }, { key: 'http-api:other' }, { timestamp: 'invalid' }, { path: '/different' },
            { inspection: { version: 1, bodyEmpty: false, headersSafe: true, pathSafe: true } },
            { inspection: { version: 1, bodyEmpty: true, headersSafe: false, pathSafe: true } }]) {
            const log = replicaLog()
            Object.assign(log.metadata.structured.access, change)
            log.message = JSON.stringify(log.metadata.structured)
            expect(accessFromLog(log)).toBeNull()
        }
    })
    test('only inspected GET/200 requests are eligible', () => {
        expect(eligibleAccess(event)).toBe(true)
        for (const change of [{ method: 'POST' }, { status: 201 }, { status: 401 }, { inspection: undefined }, { ip: '' }, { protected: true }, { timestamp: 'unknown' }]) expect(eligibleAccess({ ...event, ...change })).toBe(false)
    })
    test('unknown and incomplete inspection always retain, including historical events', () => {
        expect(eligibleAccess({ ...event, inspection: undefined })).toBe(false)
        expect(eligibleAccess({ ...event, inspection: { bodyEmpty: false } })).toBe(false)
    })
    test('retains bodies, authorization and unknown or suspicious headers', () => {
        for (const headers of [{ 'content-length': '2' }, { 'transfer-encoding': 'chunked' }, { authorization: 'redacted' }, { cookie: 'redacted' }, { 'x-unrecognized': 'x' }, { 'user-agent': '${jndi:ldap://x}' }]) {
            expect(eligibleAccess({ ...event, inspection: inspectAccess({ url: event.path, headers }) })).toBe(false)
        }
        expect(eligibleAccess({ ...event, inspection: inspectAccess({ url: event.path, headers: {}, body: {} }) })).toBe(false)
    })
    test('retains protected routes and suspicious URLs, including encoded variants', () => {
        for (const path of ['/api/auth/session', '/api/admin/users', '/api/organizations/1', '/billing', '/public?x=<script>', '/%252e%252e/etc/passwd', '/.env', '/invalid%zz']) expect(eligibleAccess({ ...event, path })).toBe(false)
    })
    test('only collector service access envelopes can drop; customer JSON cannot', () => {
        const log = { service: 'cdn', level: 'info', metadata: { structured: { msg: 'http_access', access: event } } }
        expect(accessFromLog(log)?.key).toBe(event.key)
        expect(accessFromLog({ ...log, service: 'customer-app' })).toBeNull()
        expect(accessFromLog({ ...log, metadata: { ...log.metadata, organizationId: 'customer' } })).toBeNull()
        expect(accessFromLog({ ...log, level: 'warn' })).toBeNull()
    })
})
