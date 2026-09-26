import { describe, expect, test } from 'bun:test'
import { BUILTIN_RULES, adaptVendorEvent, collectEventFindings, compileSigmaDocument, matchesRule, normalizeConditions, normalizeEvent, validateEventFields } from '../src/handlers/events.ts'

describe('Event detection catalog', () => {
    test('keeps rule identifiers unique and explanations evidence-backed', () => {
        expect(new Set(BUILTIN_RULES.map(rule => rule.id)).size).toBe(BUILTIN_RULES.length)
        expect(BUILTIN_RULES.every(rule => rule.id.endsWith(`.v${rule.version}`) && rule.explanation && rule.evidence.length > 0)).toBe(true)
    })

    test('does not turn approved scanner visits into security detections', () => {
        expect(BUILTIN_RULES.some(rule => rule.id === 'scanner.hanasand_validation.v1')).toBe(false)
    })

    test('reports invalid timestamps by event field', () => {
        expect(validateEventFields([{ timestamp: 'not-a-date' }, {}, { timestamp: '2026-08-03T08:15:00Z' }])).toEqual([
            { field: 'events[0].timestamp', message: 'timestamp must be a valid ISO-8601 date string.' },
        ])
    })

    test('matches bounded normalized JSON conditions without executing code', () => {
        const normalized = normalizeConditions([
            { path: 'event_type', operator: 'equals', value: 'authentication' },
            { path: 'source.product', operator: 'contains', value: 'identity' },
        ])
        expect(normalized.error).toBeUndefined()
        expect(matchesRule({ event_type: 'authentication', source: { product: 'customer-identity' } }, normalized.conditions)).toBe(true)
        expect(matchesRule({ event_type: 'file', source: { product: 'customer-identity' } }, normalized.conditions)).toBe(false)
    })

    test('evaluates newly created Detection rules before Match rules after Analyze retention', () => {
        const event = normalizeEvent({ timestamp: '2026-09-26T10:00:00Z', event_type: 'application', action: 'log', severity: 'low', message: 'routine' }, { vendor: 'Hanasand', product: 'Logs' })
        const rules = ['match', 'detect'].map(stage => ({ id: `custom.${stage}.v1`, version: '1', name: stage, family: 'Custom',
            severity: 'low', explanation: 'A matching event', evidence: [], source: 'owned' as const, enabled: true,
            definition: { match: 'all' as const, stage: stage as 'match' | 'detect', action: 'keep' as const,
                conditions: [{ path: 'message', operator: 'equals' as const, value: 'routine' }] } }))
        expect(collectEventFindings('org', 'event', event, rules).findings.map(finding => finding[1])).toEqual(['custom.detect.v1', 'custom.match.v1'])
    })

    test('normalizes Azure, Defender, and EVE-compatible records into one event model', () => {
        const azure = normalizeEvent({ timeGenerated: '2026-08-03T08:00:00Z', resultType: '0', userPrincipalName: 'analyst@example.com', callerIpAddress: '203.0.113.10', location: { countryOrRegion: 'NO' } }, { vendor: 'Microsoft', product: 'Entra ID' })
        expect(azure.eventType).toBe('authentication')
        expect(azure.outcome).toBe('success')
        expect(azure.userEmail).toBe('analyst@example.com')
        expect(azure.parserVersion).toBe('event.azure-entra.v1')
        expect(azure.normalized.source_vendor).toBe('Microsoft')
        expect(azure.normalized.source_product).toBe('Entra ID')
        const defender = normalizeEvent({ Timestamp: '2026-08-03T08:01:00Z', ResultType: 'Failure', AccountName: 'analyst', IpAddress: '203.0.113.11', DeviceId: 'device-1' }, { vendor: 'Microsoft', product: 'Defender for Endpoint' })
        expect(defender.outcome).toBe('failure')
        expect(defender.deviceId).toBe('device-1')
        expect(defender.parserVersion).toBe('event.defender.v1')
        const eve = normalizeEvent({ tstamp: '2026-08-03T08:02:00Z', src_ip: '198.51.100.3', dest_ip: '192.0.2.8', alert: { signature_id: 2100367, signature: 'ET SCAN suspicious scan' } }, { vendor: 'Suricata', product: 'EVE JSON' })
        expect(eve.eventType).toBe('network')
        expect(eve.action).toBe('alert')
        expect(eve.parserVersion).toBe('event.network-eve.v1')
        expect(eve.normalized.signature).toBe('ET SCAN suspicious scan')
        expect(adaptVendorEvent({}, { vendor: 'custom', product: 'json' })).toEqual({})
    })

    test('does not invent an event timestamp when the source is undated', () => {
        expect(normalizeEvent({ event_type: 'authentication' }, { vendor: 'custom', product: 'json' }).timestamp).toBe('')
        expect(normalizeEvent({ timeGenerated: '2026-08-03T08:00:00Z' }, { vendor: 'Microsoft', product: 'Entra ID' }).timestamp).toBe('2026-08-03T08:00:00.000Z')
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
