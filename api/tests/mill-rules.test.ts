import { describe, expect, test } from 'bun:test'
import { MILL_RULES, adaptVendorEvent, compileSigmaDocument, matchesMillRule, normalizeMillConditions, normalizeMillEvent, validateMillEventFields } from '../src/handlers/mill.ts'

describe('Mill detection catalog', () => {
    test('keeps rule identifiers unique and explanations evidence-backed', () => {
        expect(new Set(MILL_RULES.map(rule => rule.id)).size).toBe(MILL_RULES.length)
        expect(MILL_RULES.every(rule => rule.id.endsWith(`.v${rule.version}`) && rule.explanation && rule.evidence.length > 0)).toBe(true)
    })

    test('reports invalid timestamps by event field', () => {
        expect(validateMillEventFields([{ timestamp: 'not-a-date' }, {}, { timestamp: '2026-08-03T08:15:00Z' }])).toEqual([
            { field: 'events[0].timestamp', message: 'timestamp must be a valid ISO-8601 date string.' },
        ])
    })

    test('matches bounded normalized JSON conditions without executing code', () => {
        const normalized = normalizeMillConditions([
            { path: 'event_type', operator: 'equals', value: 'authentication' },
            { path: 'source.product', operator: 'contains', value: 'identity' },
        ])
        expect(normalized.error).toBeUndefined()
        expect(matchesMillRule({ event_type: 'authentication', source: { product: 'customer-identity' } }, normalized.conditions)).toBe(true)
        expect(matchesMillRule({ event_type: 'file', source: { product: 'customer-identity' } }, normalized.conditions)).toBe(false)
    })

    test('normalizes Azure, Defender, and EVE-compatible records into one event model', () => {
        const azure = normalizeMillEvent({ timeGenerated: '2026-08-03T08:00:00Z', resultType: '0', userPrincipalName: 'analyst@example.com', callerIpAddress: '203.0.113.10', location: { countryOrRegion: 'NO' } }, { vendor: 'Microsoft', product: 'Entra ID' })
        expect(azure.eventType).toBe('authentication')
        expect(azure.outcome).toBe('success')
        expect(azure.userEmail).toBe('analyst@example.com')
        expect(azure.parserVersion).toBe('mill.azure-entra.v1')
        const defender = normalizeMillEvent({ Timestamp: '2026-08-03T08:01:00Z', ResultType: 'Failure', AccountName: 'analyst', IpAddress: '203.0.113.11', DeviceId: 'device-1' }, { vendor: 'Microsoft', product: 'Defender for Endpoint' })
        expect(defender.outcome).toBe('failure')
        expect(defender.deviceId).toBe('device-1')
        expect(defender.parserVersion).toBe('mill.defender.v1')
        const eve = normalizeMillEvent({ tstamp: '2026-08-03T08:02:00Z', src_ip: '198.51.100.3', dest_ip: '192.0.2.8', alert: { signature_id: 2100367, signature: 'ET SCAN suspicious scan' } }, { vendor: 'Suricata', product: 'EVE JSON' })
        expect(eve.eventType).toBe('network')
        expect(eve.action).toBe('alert')
        expect(eve.parserVersion).toBe('mill.network-eve.v1')
        expect(eve.normalized.signature).toBe('ET SCAN suspicious scan')
        expect(adaptVendorEvent({}, { vendor: 'custom', product: 'json' })).toEqual({})
    })

    test('compiles common Sigma selections into bounded rules', () => {
        const compiled = compileSigmaDocument({ title: 'Failed identity event', detection: { selection: { event_type: 'authentication', 'user.email|endswith': '@example.com' }, condition: 'selection' }, level: 'high' })
        expect('rules' in compiled).toBe(true)
        if ('rules' in compiled) {
            expect(compiled.rules[0].severity).toBe('high')
            expect(compiled.rules[0].conditions).toEqual(expect.arrayContaining([{ path: 'user.email', operator: 'regex', value: '@example\\.com$' }]))
        }
    })
})
