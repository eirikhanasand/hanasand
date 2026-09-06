import { expect, mock, test } from 'bun:test'
if (process.env.DB_HOST !== 'monitor-test-db') throw Error('Requires the disposable monitor-test-db database')
const sent: Array<{ content: string, mention: boolean }> = []
let failDelivery = false
mock.module('../src/utils/alerts/discordWebhookFile.ts', () => ({
    redactSecretBearingText: (text: string) => text,
    discordWebhookFileModelLabel: () => 'discord',
    deliverDiscordWebhookFile: async (_destination: string, content: string, mention: boolean) => {
        sent.push({ content, mention })
        if (failDelivery) throw new Error('Test delivery unavailable')
    },
}))
const { queryOnce: query } = await import('../src/utils/db.ts')
const { default: schema } = await import('../src/utils/db/monitoringIssuesSchema.ts')
const { recordMonitoringOutcome, loadMonitoringIssues, backfillMonitoringIssues } = await import('../src/utils/monitoringIssues.ts')
const { executeAutomation } = await import('../src/utils/automations.ts')
import type { AutomationRow } from '../src/utils/automations.ts'

test('database aggregation, concurrent delivery, rolling cooldown, recovery and delivery failure', async () => {
    await query(`CREATE TABLE IF NOT EXISTS agent_automation_runs (id text PRIMARY KEY, automation_id text, owner_id text, status text, warning boolean DEFAULT false, result text, error text, provider text, model text, artifacts jsonb DEFAULT '[]', started_at timestamptz DEFAULT NOW(), completed_at timestamptz, duration_ms int)`)
    await query(`CREATE TABLE IF NOT EXISTS agent_automations (id text PRIMARY KEY, status text, last_status text, last_run_at timestamptz, updated_at timestamptz, last_error text, last_completed_at timestamptz, next_run_at timestamptz, schedule_kind text, consecutive_failures int DEFAULT 0, action_type text, paused_reason text, run_count int DEFAULT 0, certificate_status text, certificate_subject text, certificate_issuer text, certificate_expires_at timestamptz)`)
    await query("ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS target_url text DEFAULT 'http://127.0.0.1:9'")
    await query("ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS monitoring_type text DEFAULT 'fetch'")
    await schema()
    await query("INSERT INTO agent_automations(id,status,action_type,schedule_kind) VALUES ('issues','active','agent_prompt','interval'), ('other-issues','active','agent_prompt','interval')")
    const monitor = { id: 'issues', owner_id: 'owner', action_type: 'agent_prompt', monitoring_type: 'fetch', target_url: 'http://127.0.0.1:9', timeout_seconds: 1, retry_count: 0, notify_on: 'failure', interval_minutes: 1, schedule_kind: 'interval', notification_destinations: ['test-discord', 'test-discord'] } as AutomationRow
    async function check(id: string, message = 'HTTP 503', kind: 'failure' | 'warning' | null = 'failure', automation = monitor) {
        await query("INSERT INTO agent_automation_runs(id,automation_id,owner_id,status) VALUES ($1,$2,'owner',$3)", [id, automation.id, kind === 'failure' ? 'failed' : 'completed'])
        await recordMonitoringOutcome(automation, id, kind, message)
    }
    await Promise.all(Array.from({ length: 12 }, (_, i) => check(`issue-${i}`)))
    let issues = await loadMonitoringIssues('issues')
    expect(issues).toHaveLength(1)
    expect(issues[0].occurrences).toBe(12)
    expect(sent).toEqual([{ content: issues[0].caseNumber, mention: true }])
    await recordMonitoringOutcome(monitor, 'issue-0', 'failure', 'HTTP 503')
    expect((await loadMonitoringIssues('issues'))[0].occurrences).toBe(12)
    await check('different', 'HTTP 401')
    expect(sent).toHaveLength(2)
    await check('healthy', 'Healthy', null)
    expect((await loadMonitoringIssues('issues')).every(issue => issue.resolvedAt)).toBe(true)
    await check('recur')
    expect(sent).toHaveLength(2)
    const reopened = (await loadMonitoringIssues('issues')).find(issue => issue.summary === 'HTTP 503')!
    expect(reopened.caseNumber).toBe(issues[0].caseNumber)
    expect(reopened.resolvedAt).toBeNull()
    await query("UPDATE monitoring_issue_notifications SET next_attempt_at=NOW()+INTERVAL '1 minute' WHERE issue_id=$1", [reopened.id])
    await check('before-window')
    expect(sent).toHaveLength(2)
    await query("UPDATE monitoring_issue_notifications SET next_attempt_at=NOW()-INTERVAL '1 second' WHERE issue_id=$1", [reopened.id])
    await Promise.all([check('after-window-1'), check('after-window-2')])
    expect(sent).toHaveLength(3)
    await check('other-owner-monitor', 'HTTP 503', 'failure', { ...monitor, id: 'other-issues' })
    expect(sent).toHaveLength(4)
    await check('muted', 'HTTP 404', 'failure', { ...monitor, notify_on: 'never' })
    await check('warning', 'Slow', 'warning')
    expect(sent).toHaveLength(4)
    failDelivery = true
    await executeAutomation(monitor)
    const result = (await query("SELECT last_status,last_error FROM agent_automations WHERE id='issues'")).rows[0]
    expect(result.last_status).toBe('failed')
    expect(result.last_error).not.toContain('delivery')
    issues = await loadMonitoringIssues('issues')
    expect(issues.some(issue => issue.notifications.some((n: { error: string }) => n.error === 'Test delivery unavailable'))).toBe(true)
    await query("INSERT INTO agent_automation_runs(id,automation_id,owner_id,status,error,started_at) VALUES ('historical-1','issues','owner','failed','Historical timeout','2026-01-01'), ('historical-2','issues','owner','failed','Historical timeout','2026-01-02')")
    await backfillMonitoringIssues()
    await backfillMonitoringIssues()
    const historical = (await loadMonitoringIssues('issues')).find(issue => issue.summary === 'Historical timeout')!
    expect(historical.occurrences).toBe(2)
    expect(new Date(historical.firstSeenAt).toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(historical.resolvedAt).not.toBeNull()
    const count = sent.length
    await executeAutomation(monitor)
    expect(sent).toHaveLength(count)
})

test('JSON checks share a fetch across concurrent rules and cache source failures', async () => {
    const { sharedJsonSnapshot, evaluateJsonRule } = await import('../src/utils/jsonMonitoring.ts')
    let requests = 0
    let broken = false
    const server = Bun.serve({ port: 0, async fetch() {
        requests++
        await Bun.sleep(30)
        return broken ? new Response('offline', { status: 503 }) : Response.json({ cpu: 81, ram: 25 })
    } })
    const source = { owner_id: 'json-test', target_url: `http://127.0.0.1:${server.port}`, user_agent: null, follow_redirects: true, timeout_seconds: 2 }
    try {
        const snapshots = await Promise.all(Array.from({ length: 12 }, () => sharedJsonSnapshot(source)))
        expect(requests).toBe(1)
        expect(evaluateJsonRule(snapshots[0].payload, { path: 'cpu', aggregate: 'max', operator: 'gt', value: 80 }).exceeded).toBe(true)
        expect(evaluateJsonRule(snapshots[1].payload, { path: 'ram', aggregate: 'max', operator: 'gt', value: 80 }).exceeded).toBe(false)
        await sharedJsonSnapshot({ ...source, owner_id: 'other-json-owner' })
        expect(requests).toBe(2)
        await query("UPDATE monitoring_json_snapshots SET expires_at = NOW() - INTERVAL '1 second'")
        broken = true
        const failures = await Promise.allSettled(Array.from({ length: 12 }, () => sharedJsonSnapshot(source)))
        expect(requests).toBe(3)
        expect(failures.every(result => result.status === 'rejected' && result.reason.message.includes('503'))).toBe(true)
    } finally { server.stop(true) }
})
