import type { ServiceIncident } from './getStatus'

type Update = ServiceIncident['updates'][number]
const automated = new Set([
    'Automated monitoring detected a problem with this component.',
    'The availability check was still failing.',
    'The check was reporting degraded service. Recovery had not yet been confirmed.',
])

export default function meaningfulIncidentUpdates(updates: Update[]): Update[] {
    const result: Update[] = []
    const findings = new Set<string>()
    for (const update of [...updates].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
        if (!automated.has(update.message)) {
            result.push(update)
            continue
        }
        const evidence = update.evidence?.trim() || ''
        // A rising age is the same stale-feed observation, not a new finding.
        // Do not normalize arbitrary numbers: HTTP codes and other measurements matter.
        const finding = evidence.replace(/(activity is stale) \(\d+(?:\.\d+)? minutes?\)/i, '$1').replace(/\s+/g, ' ')
        if (update.status !== 'investigating' && (!finding || findings.has(finding))) continue
        findings.add(finding)
        const message = /activity is stale/i.test(evidence) ? 'The activity feed is out of date.'
            : /^The operation timed out\.$/i.test(evidence) ? 'The monitoring check timed out.'
                : evidence || 'Monitoring detected a problem.'
        result.push({ ...update, message, evidence: evidence === message ? undefined : update.evidence })
    }
    return result.reverse()
}
