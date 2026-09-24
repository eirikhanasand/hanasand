import { expect, test } from 'bun:test'
import { applicationErrorRule, applicationErrorDefinition, classifyApplicationError } from '../src/utils/mill/applicationError.ts'
import { normalizeLogEvent } from '../src/utils/mill/logEvent.ts'

const log = { id: '1', service: 'hanasand-api', level: 'fatal', message: 'Cannot writeHead headers after they are sent to the client', created_at: '2026-09-24T11:05:08.894Z', metadata: { reason: {} } }
test('duplicate-response failures become medium application errors with original evidence', () => {
    const event = normalizeLogEvent(log)
    expect(event.level).toBe('error')
    expect(event.severity).toBe('medium')
    expect(event.metadata).toMatchObject({ category: 'application_error', error_code: 'ERR_HTTP_HEADERS_SENT', reason: {}, classification: { original_level: 'fatal' } })
    expect(log.level).toBe('fatal')
})
test('classification honors saved severity, selectors and disabled state', () => {
    expect(normalizeLogEvent(log, [{ ...applicationErrorRule, severity: 'high' }]).severity).toBe('high')
    expect(normalizeLogEvent(log, [{ ...applicationErrorRule, enabled: false }]).severity).toBe('critical')
    expect(classifyApplicationError(log, [{ ...applicationErrorRule, definition: { ...applicationErrorDefinition, conditions: [{ path: 'host', operator: 'equals', value: 'other' }] } }])).toBeNull()
    for (const changed of [{ service: 'other-api' }, { message: 'Out of memory' }]) expect(normalizeLogEvent({ ...log, ...changed }).severity).toBe('critical')
})
test('normalization is stable across replay and preserves the original level', () => {
    const first = classifyApplicationError(log)!
    const event = normalizeLogEvent({ ...log, level: first.level, metadata: first.metadata })
    expect(event.metadata.classification).toMatchObject({ original_level: 'fatal' })
    expect(event.severity).toBe('medium')
})
