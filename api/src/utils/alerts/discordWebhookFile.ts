import { readFile } from 'node:fs/promises'

const DISCORD_WEBHOOK_FILE_PREFIX = 'discord-webhook-file:'

export function isDiscordWebhookFileDestination(value: string | null | undefined) {
    return typeof value === 'string' && value.trim().startsWith(DISCORD_WEBHOOK_FILE_PREFIX)
}

export function discordWebhookFileModelLabel(value: string | null | undefined) {
    return isDiscordWebhookFileDestination(value) ? 'discord-webhook-file' : value || 'discord'
}

export async function deliverDiscordWebhookFile(destination: string | null, content: string) {
    const webhookUrl = await resolveDiscordWebhookUrl(destination)
    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content: content.slice(0, 1900),
            allowed_mentions: { parse: [] },
        }),
        signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`Discord delivery failed with HTTP ${response.status}${body ? `: ${redactSecretBearingText(body).slice(0, 180)}` : ''}`)
    }
}

export async function resolveDiscordWebhookUrl(destination: string | null) {
    const cleaned = typeof destination === 'string' ? destination.trim() : ''
    if (!cleaned.startsWith(DISCORD_WEBHOOK_FILE_PREFIX)) {
        throw new Error('Discord delivery needs a discord-webhook-file:<absolute path> destination.')
    }

    const filePath = cleaned.slice(DISCORD_WEBHOOK_FILE_PREFIX.length).trim()
    if (!filePath.startsWith('/')) {
        throw new Error('Discord webhook file destination must be an absolute path.')
    }

    const raw = await readFile(filePath, 'utf8')
    const webhookUrl = raw.trim()
    if (!/^https:\/\/(?:[^/\s]+\.)?discord(?:app)?\.com\/api\/webhooks\/[^/\s]+\/[^/\s]+$/i.test(webhookUrl)) {
        throw new Error('Discord webhook file did not contain a valid Discord webhook URL.')
    }

    return webhookUrl
}

export function redactSecretBearingText(value: string) {
    return value
        .replace(/(discord(?:app)?\.com\/api\/webhooks\/[^/\s"']+\/)[^/\s"']+/gi, '$1[redacted]')
        .replace(/(api\/webhooks\/[^/\s"']+\/)[^/\s"']+/gi, '$1[redacted]')
        .replace(/(token|secret|authorization)=([^&\s]+)/gi, '$1=[redacted]')
}
