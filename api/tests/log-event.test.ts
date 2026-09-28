import { expect, test } from 'bun:test'
import { normalizeLogEvent } from '../src/utils/events/logEvent.ts'

test('local Bun Pwned validation probes remain visible as low severity traffic', () => {
    const event = normalizeLogEvent({
        id: 'probe',
        service: 'http-traffic',
        level: 'error',
        message: 'POST /api/pwned → 400',
        created_at: '2026-09-28T00:00:00.000Z',
        metadata: {
            log_type: 'HttpLogs',
            method: 'POST',
            path: '/api/pwned',
            status_code: 400,
            user_agent: 'Bun/1.3.13',
            source: { ip: '127.0.0.1' },
        },
    })

    expect(event.level).toBe('info')
    expect(event.severity).toBe('low')
    expect(event.outcome).toBe('failure')
    expect(event.metadata).toMatchObject({ expected_internal_probe: true, original_level: 'error' })
})

test('external Pwned validation failures remain high severity', () => {
    const event = normalizeLogEvent({
        id: 'request',
        service: 'http-traffic',
        level: 'error',
        message: 'POST /api/pwned → 400',
        created_at: '2026-09-28T00:00:00.000Z',
        metadata: {
            log_type: 'HttpLogs',
            method: 'POST',
            path: '/api/pwned',
            status_code: 400,
            user_agent: 'Bun/1.3.13',
            source: { ip: '203.0.113.10' },
        },
    })

    expect(event.level).toBe('error')
    expect(event.severity).toBe('high')
    expect(event.metadata.expected_internal_probe).toBeUndefined()
})
