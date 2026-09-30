import { expect, mock, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import Ajv from 'ajv/dist/2020.js'

const query = async () => ({ rows: [] })
mock.module('../src/utils/db.ts', () => ({ default: query, queryOnce: query, withTransaction: async (work: (q: typeof query) => unknown) => work(query) }))
const { parsePushEvent, pushOutcome } = await import('../src/utils/pushMonitoring.ts')
const { normalizeAutomationInput } = await import('../src/utils/automations.ts')
const { monitoringIssueFingerprint } = await import('../src/utils/monitoringIssues.ts')
const now = Date.now()
const event = { eventId: 'event-1', sequence: 1, source: 'home-1/basement/moisture', type: 'incident', observedAt: new Date(now).toISOString(), message: 'Moisture detected. Check for a leak.', details: { podId: 'pod-1', sensorId: 'sensor-1', value: true } }

test('external event schema and receiver accept the same sample', async () => {
    const ajv = new Ajv({ strict: false })
    ajv.addFormat('date-time', { type: 'string', validate: (value: string) => Number.isFinite(Date.parse(value)) })
    const validate = ajv.compile(JSON.parse(await readFile(new URL('../public/external-monitor-event.schema.json', import.meta.url), 'utf8')))
    for (const type of ['incident', 'recovery', 'heartbeat']) {
        const sample = { ...event, type }
        expect(validate(sample)).toBe(true)
        expect(parsePushEvent(sample, now).type).toBe(type)
    }
    for (const invalid of [{ ...event, extra: true }, { ...event, sequence: 0 }, { ...event, message: '' }, { ...event, details: { secret: 'no' } }]) {
        expect(validate(invalid)).toBe(false)
        expect(() => parsePushEvent(invalid, now)).toThrow()
    }
})

test('reject malformed, oversized and future observations at the boundary', () => {
    for (const invalid of [null, [], { ...event, sequence: Number.MAX_SAFE_INTEGER + 1 }, { ...event, observedAt: 'yesterday' },
        ...['2026-02-30T12:00:00Z', '2025-02-29T12:00:00Z', '2026-09-01T24:00:00Z', '2026-09-01T12:00Z'].map(observedAt => ({ ...event, observedAt })),
        { ...event, observedAt: new Date(now + 60_001).toISOString() }, { ...event, message: 'x'.repeat(2001) }, { ...event, details: { value: Infinity } }]) {
        expect(() => parsePushEvent(invalid, now)).toThrow()
    }
    expect(parsePushEvent({ ...event, observedAt: '2024-02-29T23:30:00-02:00' }, now).observedAt).toBe('2024-03-01T01:30:00.000Z')
})

test('JSON object ordering does not change a retried event', () => {
    expect(parsePushEvent(event, now)).toEqual(parsePushEvent({ ...event, details: { value: true, sensorId: 'sensor-1', podId: 'pod-1' } }, now))
})

test('missing, stale and heartbeat-only sources cannot report healthy', () => {
    expect(pushOutcome(null, 180, now).kind).toBe('failure')
    const source = { sequence: 1, observed_at: event.observedAt, incident: null, message: null, details: {} }
    expect(pushOutcome(source, 180, now).message).toContain('No sensor reading')
    expect(pushOutcome({ ...source, incident: false }, 180, now).kind).toBeNull()
    expect(pushOutcome({ ...source, incident: false }, 180, now + 180_000).kind).toBe('failure')
    expect(pushOutcome({ ...source, incident: true, message: event.message }, 180, now + 180_000).message).toContain('Moisture detected')
})

test('external monitor configuration uses a source ID and a one-minute silence check', () => {
    const input = { name: 'Basement moisture', prompt: 'Check for water.', actionType: 'agent_prompt', monitoringType: 'push',
        targetUrl: event.source, scheduleKind: 'interval', intervalMinutes: 1 }
    const normalized = normalizeAutomationInput(input)
    expect(normalized.targetUrl).toBe(event.source)
    expect(normalized.timeoutSeconds).toBe(180)
    for (const change of [{ intervalMinutes: 15 }, { expectedDown: true }, { actionType: 'echo' }, { targetUrl: '' }]) {
        expect(() => normalizeAutomationInput({ ...input, ...change })).toThrow()
    }
})

test('changing incident details, offline status and recurrence preserve the case identity', () => {
    const monitor = { monitoring_type: 'push' as const, target_url: event.source }
    const fingerprint = monitoringIssueFingerprint(monitor, 'failure', event.message)
    expect(monitoringIssueFingerprint(monitor, 'failure', 'The source stopped reporting.')).toBe(fingerprint)
    expect(monitoringIssueFingerprint({ ...monitor, target_url: 'home-2/moisture' }, 'failure', event.message)).not.toBe(fingerprint)
})
