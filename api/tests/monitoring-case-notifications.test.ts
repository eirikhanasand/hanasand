import { expect, mock, test } from 'bun:test'

let enabled = false
let claims = 0
let deliveries = 0
let delivered: unknown[] = []
mock.module('../src/utils/db.ts', () => ({
    default: async (sql: string) => {
        if (sql.startsWith('SELECT notifications_enabled')) return { rows: [{ notifications_enabled: enabled, kind: 'failure', summary: 'HTTP 503', occurrences: 2, first_seen_at: '2026-09-07T18:00:00Z', last_seen_at: '2026-09-07T18:01:00Z' }] }
        if (sql.startsWith('INSERT INTO monitoring_issue_notifications')) claims++
        return { rows: [{ issue_id: '1' }] }
    },
    withTransaction: async (work: (query: (sql: string) => Promise<unknown>) => Promise<unknown>) => work(async sql => ({ rows: sql.startsWith('INSERT') ? [{ id: '1' }] : [{}] })),
}))
mock.module('../src/utils/alerts/discordWebhookFile.ts', () => ({
    redactSecretBearingText: (value: string) => value,
    deliverDiscordWebhookFile: async (...args: unknown[]) => { delivered = args; deliveries++; return { id: 'receipt' } },
}))
const { recordMonitoringOutcome } = await import('../src/utils/monitoringIssues.ts')
import type { AutomationRow } from '../src/utils/automations.ts'

test('case notification preference suppresses delivery until re-enabled', async () => {
    const automation = { id: 'monitor', monitoring_type: 'fetch', target_url: 'https://example.test', notify_on: 'failure', notification_destinations: ['destination'] } as AutomationRow
    await recordMonitoringOutcome(automation, 'run-1', 'failure', 'HTTP 503')
    expect(claims).toBe(0)
    expect(deliveries).toBe(0)
    enabled = true
    await recordMonitoringOutcome(automation, 'run-2', 'failure', 'HTTP 503')
    expect(claims).toBe(1)
    expect(deliveries).toBe(1)
    expect(delivered).toMatchObject(['destination', '[HA-1](https://hanasand.com/cases/HA-1)', true, [{ url: 'https://hanasand.com/cases/HA-1', description: 'HTTP 503' }]])
})
