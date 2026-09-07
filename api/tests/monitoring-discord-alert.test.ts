import { afterAll, afterEach, expect, spyOn, test } from 'bun:test'
import { monitoringCaseDiscordAlert } from '../src/utils/alerts/monitoringCase.ts'
import { deliverDiscordWebhookFile } from '../src/utils/alerts/discordWebhookFile.ts'

const issue = { kind: 'failure', summary: 'GPU usage is high: 81% used (alert at 80%).', occurrences: 3, first_seen_at: '2026-09-07T18:11:00Z', last_seen_at: '2026-09-07T18:13:00Z' }
const requests: Array<{ url: string, body: Record<string, any> }> = []
const fetchMock = spyOn(globalThis, 'fetch')
afterAll(() => fetchMock.mockRestore())
afterEach(() => { fetchMock.mockReset(); requests.length = 0 })

function interceptDelivery() {
    fetchMock.mockImplementation(async (url, options) => {
        requests.push({ url: String(url), body: JSON.parse(String(options?.body)) })
        return new Response(JSON.stringify({ id: 'receipt', mention_everyone: true }), { status: 200 })
    })
}

test('one webhook message combines the ping, clickable case and diagnostic embed', async () => {
    interceptDelivery()
    const alert = monitoringCaseDiscordAlert('HA-9050', 'Host GPU', 'gpu-check', issue)
    const receipt = await deliverDiscordWebhookFile('https://discord.com/api/webhooks/123/test-token', alert.content, true, alert.embeds)
    expect(requests).toHaveLength(1)
    expect(requests[0].url).toEndWith('?wait=true')
    expect(requests[0].body).toMatchObject({
        content: '@everyone [HA-9050](https://hanasand.com/cases/HA-9050)',
        allowed_mentions: { parse: ['everyone'] },
        embeds: [{ title: 'HA-9050 · Host GPU', url: 'https://hanasand.com/cases/HA-9050', description: issue.summary, color: 0xED4245 }],
    })
    expect(alert.embeds[0].fields).toContainEqual({ name: 'Occurrences', value: '3', inline: true })
    expect(alert.embeds[0].fields).toContainEqual({ name: 'First seen', value: '<t:1788804660:f>', inline: true })
    expect(receipt?.id).toBe('receipt')
})

test('embeds respect case overrides, redact secrets and stay within Discord limits', () => {
    const { embeds: [embed] } = monitoringCaseDiscordAlert('HA-1', 'x'.repeat(500), 'check', { ...issue, summary: 'token=private ' + 'x'.repeat(7000), status_override: 'closed', severity_override: 'low' })
    expect(embed.title.length).toBeLessThanOrEqual(256)
    expect(embed.description.length).toBeLessThanOrEqual(4096)
    expect(embed.description).not.toContain('private')
    expect(embed.fields).toContainEqual({ name: 'Case status', value: 'closed', inline: true })
    expect(embed.fields).toContainEqual({ name: 'Severity', value: 'low', inline: true })
    expect(embed.title.length + embed.description.length + embed.fields.reduce((sum, field) => sum + field.name.length + field.value.length, 0)).toBeLessThanOrEqual(6000)
})

test('existing text-only callers and disabled mentions are unchanged', async () => {
    interceptDelivery()
    await deliverDiscordWebhookFile('https://discord.com/api/webhooks/123/test-token', 'Mail recovered', false)
    expect(requests[0].body).toEqual({ content: 'Mail recovered', allowed_mentions: { parse: [] } })
})
