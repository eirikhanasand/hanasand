import { redactSecretBearingText, type DiscordEmbed } from './discordWebhookFile.ts'

type CaseDetails = {
    kind: string, summary: string, occurrences: number,
    first_seen_at: string | Date, last_seen_at: string | Date,
    resolved_at?: string | Date | null, severity_override?: string | null, status_override?: string | null,
}

export function monitoringCaseDiscordAlert(caseId: string, monitorName: string, automationId: string, issue: CaseDetails) {
    const url = `https://hanasand.com/cases/${encodeURIComponent(caseId)}`
    const severity = issue.severity_override || (issue.kind === 'failure' ? 'high' : 'medium')
    const time = (value: string | Date) => {
        const seconds = Math.floor(new Date(value).getTime() / 1000)
        return Number.isFinite(seconds) ? `<t:${seconds}:f>` : 'Unknown'
    }
    const embed: DiscordEmbed = {
        title: redactSecretBearingText(`${caseId} · ${monitorName}`).slice(0, 256),
        url,
        description: redactSecretBearingText(issue.summary).slice(0, 3000),
        color: severity === 'critical' || severity === 'high' ? 0xED4245 : severity === 'medium' ? 0xFEE75C : 0x5865F2,
        fields: [
            { name: 'Severity', value: severity, inline: true },
            { name: 'Case status', value: issue.status_override || (issue.resolved_at ? 'resolved' : 'open'), inline: true },
            { name: 'Occurrences', value: String(issue.occurrences), inline: true },
            { name: 'First seen', value: time(issue.first_seen_at), inline: true },
            { name: 'Last seen', value: time(issue.last_seen_at), inline: true },
            { name: 'Health check', value: `[View health check](https://hanasand.com/automation/health?monitor=${encodeURIComponent(automationId)})` },
        ],
    }
    return { content: `[${caseId}](${url})`, embeds: [embed] }
}
