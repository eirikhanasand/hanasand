import { expect, test } from 'bun:test'
import { eventProtectionDefinition, matchesEventProtection, normalizeEventProtection } from '../src/utils/events/eventProtection.ts'

const policy = eventProtectionDefinition.protection
const event = (sourceIp = '192.99.32.185') => ({
    host: 'inspur',
    http: { path: '/api/logs/ingest', method: 'POST', status_code: 201 },
    source: { ip: sourceIp },
    level: 'info',
    action: 'log',
    message: 'proxy_request_completed',
    service: 'hanasand-api',
    log_type: 'HttpLogs',
    severity: 'low',
    metadata: {
        category: 'proxy_request',
        access: { inspection: { version: 1, pathSafe: true, bodyEmpty: false, headersSafe: false } },
    },
})

test('the two known self-ingestion sources bypass only unsafe transport flags', () => {
    expect(normalizeEventProtection(policy).error).toBeUndefined()
    expect(matchesEventProtection(event(), policy)).toBe(false)
    expect(matchesEventProtection(event('128.39.142.218'), policy)).toBe(false)
    for (const changed of [
        { host: 'other-host' },
        { service: 'other-service' },
        { message: 'other-message' },
        { metadata: { category: 'other-category', access: { inspection: { version: 1, pathSafe: true, bodyEmpty: false, headersSafe: false } } } },
        { source: { ip: '192.0.2.1' } },
        { http: { ...event().http, status_code: 500 } },
        { severity: 'high' },
        { detections: [{ rule_id: 'alert' }] },
        { body: { evidence: true } },
        { error: 'failed' },
    ]) expect(matchesEventProtection({ ...event(), ...changed }, policy)).toBe(true)
})

test('protection exception groups require valid non-empty conditions', () => {
    expect(normalizeEventProtection({ ...policy, checks: [{ ...policy.checks[0], unlessAny: [[]] }] }).error).toBeDefined()
    expect(normalizeEventProtection({ ...policy, checks: [{ ...policy.checks[0], unlessAny: [[{ path: 'source.ip', operator: 'regex', value: '.*' }]] }] }).error).toBeDefined()
})
