import { expect, test } from '@playwright/test'
import { simpleStatusText, statusHeadline } from '@/utils/status/incidentCopy'
import { toPublicServiceStatus } from '@/utils/status/publicStatus'
import type { ServiceCheck, ServiceStatus } from '@/utils/status/getStatus'

const check = (service: string, check_name: string, status: ServiceCheck['status']): ServiceCheck => ({ service, check_name, status, latency_ms: 1, checked_at: new Date().toISOString(), uptime_30d: '99', message: '' })
test('banner names one or two affected services and combines DWM checks', () => {
    const dwm = check('Dark web monitoring', 'Latest Activity', 'degraded')
    const search = check('Threat intelligence', 'Public Search', 'degraded')
    expect(statusHeadline({ overall: 'degraded', checks: [dwm] })).toBe('Dark web monitoring is degraded')
    expect(statusHeadline({ overall: 'degraded', checks: [dwm, { ...dwm, check_name: 'Monitoring Workspace' }] })).toBe('Dark web monitoring is degraded')
    expect(statusHeadline({ overall: 'degraded', checks: [dwm, search] })).toBe('Dark web monitoring and Public Search are degraded')
    expect(statusHeadline({ overall: 'down', checks: [{ ...dwm, status: 'down' }, search] })).toBe('Dark web monitoring is unavailable and Public Search is degraded')
    expect(statusHeadline({ overall: 'down', checks: [dwm, { ...dwm, status: 'down' }] })).toBe('Dark web monitoring is unavailable')
    expect(statusHeadline({ overall: 'degraded', checks: [dwm, search, check('Website', 'Public Website', 'degraded')] })).toBe('Some systems degraded')
    expect(statusHeadline({ overall: 'up', checks: [] })).toBe('Everything operational')
    expect(statusHeadline({ overall: 'unknown', checks: [] })).toBe('Monitoring unavailable')
})

test('short incident wording preserves failures, measurements, uncertainty and actual repair notes', () => {
    expect(simpleStatusText('A successful check confirmed recovery. This is the first recorded healthy result after the incident; no repair details were recorded.')).toBe('Recovered. No repair recorded.')
    expect(simpleStatusText('Threat intelligence search is unavailable (200)')).toBe('Search returned an unusable response despite HTTP 200.')
    expect(simpleStatusText('Threat intelligence search is unavailable (503)')).toBe('Search was unavailable (HTTP 503).')
    expect(simpleStatusText('Latest customer activity returned 2522 retained records; newest successful collection check is 1 minutes old.')).toBe('2522 saved records. Last successful source check was 1 minute ago.')
    expect(simpleStatusText('5263 stale reviews (oldest 1848 minutes).')).toBe('Threat intelligence processing is delayed.')
    expect(simpleStatusText('0 stale reviews, 0 overdue discovery jobs, 0 stalled evaluations, 133 captured sources without automatic review, 0 recent delivery failures.')).toBe('No processing delays reported.')
    expect(simpleStatusText('Collection processing is current; automatic review is disabled and 120 captured sources have no optional automatic review.')).toBe('Collection is up to date. Automatic review is off for 120 sources.')
    expect(simpleStatusText('Source operations returned 76 sources; 0 failed.')).toBe('Source collection completed successfully.')
    expect(simpleStatusText('Source operations returned 76 sources; 1 failed.')).toBe('Source collection is delayed.')
    for (const text of ['Restarted the worker to restore collection.', 'Repaired the database index.', 'Response took 3731 ms.']) expect(simpleStatusText(text)).toBe(text)
})

test('public incident cleanup preserves IDs and recovery times and deduplicates repeated evidence', () => {
    const at = new Date().toISOString()
    const raw: ServiceStatus = { overall: 'up', generated_at: at, checks: [], history: [], incidents: [{
        id: 'original-id', aliases: ['old-link'], service: 'dark-web-monitoring', check_name: 'Latest activity', title: 'Latest activity interruption', impact: 'Outage', status: 'resolved',
        started_at: '2026-09-19T12:00:00Z', resolved_at: '2026-09-19T12:03:00Z', summary: 'Recent monitoring activity was delayed. The activity feed was not up to date.', cause: 'No confirmed root cause was recorded.',
        updates: [
            { at: '2026-09-19T12:00:00Z', status: 'investigating', message: 'Automated monitoring detected a problem with this component.', evidence: 'Latest customer activity is stale (61 minutes).' },
            { at: '2026-09-19T12:01:00Z', status: 'monitoring', message: 'The availability check was still failing.', evidence: 'Latest customer activity is stale (62 minutes).' },
            { at: '2026-09-19T12:03:00Z', status: 'resolved', message: 'A successful check confirmed recovery. This is the first recorded healthy result after the incident; no repair details were recorded.' },
        ],
    }] }
    const copy = JSON.stringify(raw)
    const incident = toPublicServiceStatus(raw).incidents[0]
    expect(incident).toMatchObject({ id: 'original-id', aliases: ['old-link'], started_at: raw.incidents[0].started_at, resolved_at: raw.incidents[0].resolved_at, cause: 'Cause unknown.' })
    expect(incident.updates).toHaveLength(2)
    expect(incident.updates[0].message).toBe('Recovered. No repair recorded.')
    expect(JSON.stringify(raw)).toBe(copy)
    const processing = { ...raw, incidents: [{ ...raw.incidents[0], service: 'threat-intelligence', check_name: 'Processing backlog', updates: [
        { ...raw.incidents[0].updates[0], evidence: '5263 stale reviews (oldest 1848 minutes).' },
        { ...raw.incidents[0].updates[1], evidence: '5264 stale reviews (oldest 1849 minutes).' },
        raw.incidents[0].updates[2],
    ] }] }
    const short = toPublicServiceStatus(processing).incidents[0]
    expect(short.updates).toHaveLength(2)
    expect(short.updates[1].message).toBe('Threat intelligence processing is delayed.')
})
