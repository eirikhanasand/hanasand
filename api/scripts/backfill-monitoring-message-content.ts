import run, { closeDatabase } from '../src/utils/db.ts'
import { resolveDiscordWebhookUrl, redactSecretBearingText } from '../src/utils/alerts/discordWebhookFile.ts'

// Retrieve only IDs already recorded as delivered. Never resend a notification to recover its text.
const rows = await run(`SELECT m.id, m.message_id, n.destination FROM monitoring_issue_messages m
    JOIN monitoring_issue_notifications n ON n.issue_id = m.issue_id AND n.message_id = m.message_id
    WHERE m.message IS NULL ORDER BY m.delivered_at DESC`)
let restored = 0
let unavailable = 0
const text = (value: unknown) => typeof value === 'string' ? redactSecretBearingText(value) : ''
try {
    for (const row of rows.rows) {
        try {
            if (!/^\d+$/.test(row.message_id)) throw new Error('Invalid recorded message ID')
            const url = await resolveDiscordWebhookUrl(row.destination)
            const response = await fetch(`${url}/messages/${row.message_id}`, { redirect: 'error', signal: AbortSignal.timeout(10000) })
            if (!response.ok) throw new Error(`Discord returned HTTP ${response.status}`)
            const message = await response.json() as { id: string, content?: string, embeds?: Array<{ title?: string, description?: string, fields?: Array<{ name: string, value: string }> }> }
            if (message.id !== row.message_id) throw new Error('Message ID did not match')
            const snapshot = { content: text(message.content), embeds: (message.embeds || []).map(embed => ({ title: text(embed.title), description: text(embed.description), fields: (embed.fields || []).map(field => ({ name: text(field.name), value: text(field.value) })) })) }
            await run('UPDATE monitoring_issue_messages SET message = $2::jsonb WHERE id = $1 AND message IS NULL', [row.id, JSON.stringify(snapshot)])
            restored++
        } catch {
            unavailable++
        }
        await Bun.sleep(500)
    }
    console.log(JSON.stringify({ recorded: rows.rows.length, restored, unavailable }))
} finally { await closeDatabase() }
