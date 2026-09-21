import { describe, expect, test } from 'bun:test'
import { eligibleAccess, inspectAccess, accessFromLog, type AccessEvent } from '../src/utils/mill/analyzeAccess.ts'

const event: AccessEvent = { key: 'http-api:test', ip: '192.0.2.1', path: '/public/file', method: 'GET', status: 200,
    timestamp: new Date().toISOString(), inspection: inspectAccess({ url: '/public/file', headers: { host: 'hanasand.com' } }) }
describe('Analyze access safety', () => {
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
