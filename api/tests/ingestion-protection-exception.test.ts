import { expect, test } from 'bun:test'
import { eventProtectionDefinition, matchesEventProtection, normalizeEventProtection } from '../src/utils/mill/eventProtection.ts'
const conditions = [{ path: 'http.path', operator: 'equals' as const, value: '/api/logs/ingest' }, { path: 'source.ip', operator: 'equals' as const, value: '128.39.142.218' }, { path: 'http.status_code', operator: 'equals' as const, value: '201' }, { path: 'http.method', operator: 'equals' as const, value: 'POST' }, { path: 'severity', operator: 'equals' as const, value: 'low' }]
const policy = { ...eventProtectionDefinition.protection, checks: eventProtectionDefinition.protection.checks.map(check => check.keys.includes('inspection') || check.keys.includes('bodyEmpty') ? { ...check, unlessAll: conditions } : check) }
const event = { http: { path: '/api/logs/ingest', status_code: 201, method: 'POST' }, source: { ip: '128.39.142.218' }, severity: 'low', metadata: { inspection: { version: 1, bodyEmpty: false, headersSafe: false, pathSafe: true } } }
test('saved exception permits only the expected self-ingestion transport flags', () => {
    expect(normalizeEventProtection(policy).error).toBeUndefined()
    expect(matchesEventProtection(event, policy)).toBe(false)
    for (const changed of [{ source: {ip:'192.0.2.1'} }, { http: {...event.http,status_code:500} }, { severity:'high' }, { detections:[{rule_id:'alert'}] }, { body:{evidence:true} }, { error:'failed' }]) expect(matchesEventProtection({...event,...changed},policy)).toBe(true)
    expect(normalizeEventProtection({ ...policy, checks:[{...policy.checks[0],unlessAll:[]}] }).error).toBeDefined()
})
