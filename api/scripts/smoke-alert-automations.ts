import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { normalizeAutomationInput } from '../src/utils/automations.ts'
import { deliverDiscordWebhookFile, discordWebhookFileModelLabel, redactSecretBearingText, resolveDiscordWebhookUrl } from '../src/utils/alerts/discordWebhookFile.ts'

const tempDir = await mkdtemp(join(tmpdir(), 'hanasand-alerts-'))

try {
    const webhookFile = join(tempDir, 'discord-webhook.txt')
    await writeFile(webhookFile, 'https://discord.com/api/webhooks/example-id/example-token\n')

    const destination = `discord-webhook-file:${webhookFile}`
    const resolved = await resolveDiscordWebhookUrl(destination)
    assert.equal(resolved.startsWith('https://discord.com/api/webhooks/'), true)
    assert.equal(discordWebhookFileModelLabel(destination), 'discord-webhook-file')

    const mailAlert = normalizeAutomationInput({
        name: 'Mail path health alert',
        prompt: 'Check mail path health and notify on failures.',
        scheduleKind: 'interval',
        intervalMinutes: 5,
        status: 'active',
        actionType: 'mail_health_check',
        modelName: destination,
        notifyOn: 'failure',
        timezone: 'Europe/Oslo',
    })
    assert.equal(mailAlert.actionType, 'mail_health_check')
    assert.equal(mailAlert.modelName, destination)

    const systemAlert = normalizeAutomationInput({
        name: 'Discord system alert',
        prompt: 'Mail path alert integration smoke.',
        scheduleKind: 'once',
        runAt: new Date(Date.now() + 60_000).toISOString(),
        status: 'active',
        actionType: 'system_alert',
        modelName: destination,
        notifyOn: 'always',
        timezone: 'Europe/Oslo',
    })
    assert.equal(systemAlert.actionType, 'system_alert')

    await assert.rejects(
        resolveDiscordWebhookUrl('discord-webhook-file:relative/path.txt'),
        /absolute path/,
    )

    const redacted = redactSecretBearingText('Discord rejected https://discord.com/api/webhooks/example-id/example-token token=secret')
    assert.equal(redacted.includes('example-token'), false)
    assert.equal(redacted.includes('secret'), false)

    const ensureSchema = await readFile(new URL('../src/utils/db/ensureSchema.ts', import.meta.url), 'utf8')
    assert.match(ensureSchema, /mail_health_check/)
    assert.match(ensureSchema, /system_alert/)

    const checked = ['mail_health_check', 'system_alert', 'discord_webhook_file_redaction']
    const liveWebhookFile = process.env.ALERT_DISCORD_WEBHOOK_FILE
    if (process.env.SEND_LIVE_DISCORD === '1' && liveWebhookFile) {
        await deliverDiscordWebhookFile(
            `discord-webhook-file:${liveWebhookFile}`,
            'Hanasand alert portal smoke: Mail path alert integration can deliver to Discord via webhook-file secret.',
        )
        checked.push('live_discord_delivery')
    }

    console.log(JSON.stringify({ ok: true, checked }, null, 2))
} finally {
    await rm(tempDir, { recursive: true, force: true })
}
