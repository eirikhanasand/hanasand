import { expect, mock, test } from 'bun:test'
if (process.env.DB_HOST !== 'monitor-test-db') throw Error('Requires the disposable monitor-test-db database')
let sent = 0
let fail = false
mock.module('../src/utils/alerts/discordWebhookFile.ts', () => ({
    redactSecretBearingText: (text: string) => text,
    deliverDiscordWebhookFile: async () => { if (fail) throw Error('Delivery failed'); return { id: String(++sent), mention_everyone: true } },
}))
const { queryOnce: query } = await import('../src/utils/db.ts')
const { default: schema } = await import('../src/utils/db/monitoringIssuesSchema.ts')
const { recordMonitoringOutcome, loadMonitoringIssues } = await import('../src/utils/monitoringIssues.ts')

test('preserves delivered content and counts, excludes failures, and imports legacy IDs once', async () => {
    await query('CREATE TABLE agent_automations (id text PRIMARY KEY); CREATE TABLE agent_automation_runs(id text PRIMARY KEY)')
    await query(`CREATE TABLE IF NOT EXISTS vms(name text PRIMARY KEY, owner text, created_by text, access_users text[], deleted_at timestamptz)`);
    await schema()
    await query("INSERT INTO agent_automations VALUES ('monitor',NULL)")
    const automation = { id: 'monitor', name: 'Health check', monitoring_type: 'fetch', target_url: 'https://example.com', notify_on: 'failure', notification_destinations: ['destination'] } as any
    async function check(id: string, message: string) {
        await query('INSERT INTO agent_automation_runs(id) VALUES ($1)', [id])
        await recordMonitoringOutcome(automation, id, 'failure', message)
    }
    await check('first', 'HTTP 503 in 20ms')
    await query("UPDATE monitoring_issue_notifications SET next_attempt_at=NOW()-INTERVAL '1 second'")
    await check('second', 'HTTP 503 in 30ms')
    let item = (await loadMonitoringIssues('monitor'))[0]
    expect(item.notifications).toHaveLength(2)
    expect(item.notifications.map((n: any) => n.message.embeds[0].description)).toEqual(['HTTP 503 in 30ms', 'HTTP 503 in 20ms'])
    expect(item.notifications[0].message.content).toContain('@everyone')
    expect(JSON.stringify(item.notifications)).not.toContain('destination')
    fail = true
    await query("UPDATE monitoring_issue_notifications SET next_attempt_at=NOW()-INTERVAL '1 second'")
    await check('third', 'HTTP 503 in 40ms')
    item = (await loadMonitoringIssues('monitor'))[0]
    expect(item.notifications.filter((n: any) => n.deliveredAt)).toHaveLength(2)
    expect(item.notifications.find((n: any) => n.error)?.error).toBe('Delivery failed')
    await query("INSERT INTO monitoring_issue_notifications(issue_id,destination,next_attempt_at,delivered_at,message_id) VALUES ($1,'legacy-secret',NOW(),NOW(),'999')",[item.id])
    await schema(); await schema()
    item = (await loadMonitoringIssues('monitor'))[0]
    expect(item.notifications.filter((n: any) => n.deliveredAt)).toHaveLength(3)
    expect(item.notifications.find((n: any) => n.messageId === '999').message).toBeNull()
    expect(item.notifications.filter((n: any) => n.message)).toHaveLength(2)
})
