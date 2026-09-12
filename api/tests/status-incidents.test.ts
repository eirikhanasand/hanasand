import { expect, test } from 'bun:test'
import { buildIncidents, selectStatusIncident } from '../src/handlers/status/get.ts'

const base = { service: 'dark-web-monitoring', check_name: 'Latest activity', status: 'down' as const, message: 'Latest customer activity is stale (147 minutes).' }
test('reports recorded recovery, not the current check time, with newest evidence first', () => {
    const [incident] = buildIncidents([
        { ...base, checked_at: '2026-07-24T22:14:01.048Z', previous_status: 'up', next_status: 'down' },
        { ...base, status: 'degraded', message: 'Latest customer activity is stale (61 minutes).', checked_at: '2026-07-25T00:12:00Z', previous_status: 'down', previous_checked_at: '2026-07-25T00:11:00Z', next_status: 'up', next_checked_at: '2026-07-25T00:13:00Z', next_message: 'Fresh customer activity received.' },
    ])
    expect(incident.resolved_at).toBe('2026-07-25T00:13:00.000Z')
    expect(incident.updates.map(update => update.status)).toEqual(['resolved', 'monitoring', 'investigating'])
    expect(incident.updates[0].evidence).toBe('Fresh customer activity received.')
    expect(incident.aliases).toContain('dark-web-monitoring-latest-activity-2026-07-25t00-12-00-000z')
    expect(incident.cause).not.toBe(incident.summary)
    expect(incident.cause).toContain('No confirmed root cause')
    expect(incident.id).toBe('dark-web-monitoring-latest-activity-2026-07-24t22-14-01-048z')
})
test('an unknown or later failed sample does not prove recovery', () => {
    for (const next_status of ['unknown', 'down', 'degraded', undefined]) {
        const [incident] = buildIncidents([{ ...base, checked_at: '2026-07-24T22:14:00Z', next_status, next_checked_at: '2026-09-12T20:51:00Z' }])
        expect(incident.resolved_at).toBeNull()
        expect(incident.status).toBe('investigating')
    }
})
test('a healthy result separates incidents even within fifteen minutes', () => {
    const incidents = buildIncidents([
        { ...base, checked_at: '2026-07-24T22:14:00Z', next_status: 'up', next_checked_at: '2026-07-24T22:15:00Z' },
        { ...base, checked_at: '2026-07-24T22:16:00Z', previous_status: 'up', previous_checked_at: '2026-07-24T22:15:00Z' },
    ])
    expect(incidents).toHaveLength(2)
    expect(incidents[0].status).toBe('investigating')
    expect(incidents[1].status).toBe('resolved')
})

test('incident detail excludes unrelated history and preserves alias links and evidence', () => {
    const selected = { id: 'incident', aliases: ['old-link'], updates: [{ at: '2026-09-11', evidence: 'Original evidence' }] }
    const source = { checks: [{ message: 'not needed' }], history: [{ incident_ids: ['unrelated'] }], incidents: [selected, ...Array.from({ length: 10000 }, (_, index) => ({ id: `other-${index}`, updates: [{ evidence: 'x'.repeat(1000) }] }))], history_available: true }
    const detail = selectStatusIncident(source, 'old-link')
    expect(detail.incidents).toEqual([selected])
    expect(detail.history).toEqual([])
    expect(detail.checks).toEqual([])
    expect(JSON.stringify(detail).length).toBeLessThan(1000)
    expect(selectStatusIncident(source, 'missing').incidents).toEqual([])
    expect(source.incidents).toHaveLength(10001)
})
