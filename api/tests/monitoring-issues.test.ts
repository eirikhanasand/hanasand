import { expect, test } from 'bun:test'
import { monitoringIssueFingerprint } from '../src/utils/monitoringIssues.ts'

test('issue identity ignores durations and retries but preserves targets, HTTP codes and failure kinds', () => {
    const monitor = { target_url: 'https://example.test/health', monitoring_type: 'fetch' as const }
    const key = (message: string) => monitoringIssueFingerprint(monitor, 'failure', message)
    expect(key('Timed out after 1 second. Failed after 2 attempts.')).toBe(key('Timed out after 20 seconds. Failed after 1 attempt.'))
    expect(key('HTTP 503')).not.toBe(key('HTTP 401'))
    expect(key('HTTP 503')).not.toBe(monitoringIssueFingerprint({ ...monitor, target_url: 'https://other.test' }, 'failure', 'HTTP 503'))
    expect(key('Slow')).not.toBe(monitoringIssueFingerprint(monitor, 'warning', 'Slow'))
    expect(key('TLS certificate validation failed.')).not.toBe(key('Connection refused.'))
    expect(key('Activity is stale (317 minutes).')).toBe(key('Activity is stale (318 minutes).'))
})

test('service check identity survives changing ages and source details', () => {
    const monitor = { target_url: 'https://hanasand.com/api/status?service=dark-web-monitoring&check=Latest%20activity', monitoring_type: 'fetch' as const }
    const key = (message: string) => monitoringIssueFingerprint(monitor, 'warning', message)
    expect(key('Latest customer activity is stale (317 minutes).')).toBe(key('Latest customer activity is stale (318 minutes).'))
    const collection = { ...monitor, target_url: 'https://hanasand.com/api/status?service=threat-intelligence&check=Source%20collection' }
    expect(monitoringIssueFingerprint(collection, 'warning', 'Collection problems: restrictedMetadata.'))
        .toBe(monitoringIssueFingerprint(collection, 'warning', 'Collection problems: sourceB, restrictedMetadata.'))
    expect(key('unavailable')).not.toBe(monitoringIssueFingerprint(collection, 'warning', 'unavailable'))
})
