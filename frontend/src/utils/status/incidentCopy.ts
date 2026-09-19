import type { ServiceStatus } from './getStatus'

const join = (items: string[]) => items.length < 3 ? items.join(' and ') : items.slice(0, -1).join(', ') + ' and ' + items.at(-1)

// Rewrite known monitoring templates; preserve unrecognized recorded explanations.
export function simpleStatusText(text: string): string {
    if (text === 'A successful check confirmed recovery. This is the first recorded healthy result after the incident; no repair details were recorded.') return 'Recovered. No repair recorded.'
    if (['No confirmed root cause was recorded.', 'No confirmed root cause was recorded. The monitoring results below describe the symptoms, not a verified explanation.', 'No confirmed root cause was recorded. Monitoring observations alone do not establish why the incident happened.'].includes(text)) return 'Cause unknown.'
    if (['Recent monitoring activity was delayed.', 'Recent monitoring activity was delayed. The activity feed was not up to date.'].includes(text)) return 'The activity feed was delayed.'
    const exact: Record<string, string> = {
        'Automated monitoring detected a problem with this component.': 'A problem was detected.',
        'The availability check was still failing.': 'The health check was still failing.',
        'The check was reporting degraded service. Recovery had not yet been confirmed.': 'The service was still degraded.',
        'No additional check details were recorded.': 'No further details recorded.',
        'The component passed its health check.': 'The health check passed.',
        'A canonical threat-intelligence search completed successfully.': 'Search completed successfully.',
        'The public website rendered successfully.': 'The website loaded successfully.',
        'The authenticated dark-web monitoring workspace rendered successfully.': 'Dark web monitoring loaded successfully.',
        'The browser investigation workspace rendered successfully.': 'The browser workspace loaded successfully.',
        'The dark-web monitoring page rendered successfully.': 'Dark web monitoring loaded successfully.',
        'The public API contract endpoint responded successfully.': 'The API responded successfully.',
        'The operation timed out.': 'The check timed out.',
        'Unable to connect. Is the computer able to access the url?': 'Could not connect to the service.',
        'Was there a typo in the url or port?': 'Could not connect. Check the address and port.',
        'Threat-intelligence processing is behind its current review target.': 'Threat intelligence processing is delayed.',
        'Source collection is degraded; new intelligence may be delayed.': 'Source collection is delayed.',
    }
    if (exact[text]) return exact[text]
    if (text.startsWith('The socket connection was closed unexpectedly.')) return 'The connection closed unexpectedly.'
    if (/^could not write to file .*: No space left on device$/.test(text)) return 'The database ran out of disk space.'
    let match = text.match(/^(.+) did not pass its availability check\.$/)
    if (match) return match[1] === 'Processing backlog' ? 'Threat intelligence processing failed its health check.' : match[1] + ' failed its health check.'
    match = text.match(/^(.+) was operating outside its normal check limits\.$/)
    if (match) return match[1] === 'Processing backlog' ? 'Threat intelligence processing was degraded.' : match[1] + ' was degraded.'
    match = text.match(/^Threat intelligence search is unavailable \((\d+)\)\.?$/)
    if (match) return match[1] === '200' ? 'Search returned an unusable response despite HTTP 200.' : 'Search was unavailable (HTTP ' + match[1] + ').'
    match = text.match(/^Latest customer activity is unavailable or empty \((\d+)\)\.?$/)
    if (match) return 'The activity feed was unavailable or empty (HTTP ' + match[1] + ').'
    match = text.match(/^Unexpected (monitoring workspace|browser workspace|website|public API contract) response (\d+)\.?$/)
    if (match) return ({ 'monitoring workspace': 'Dark web monitoring', 'browser workspace': 'The browser workspace', website: 'The website', 'public API contract': 'The API' } as Record<string, string>)[match[1]] + ' returned HTTP ' + match[2] + '.'
    match = text.match(/^Threat-intelligence storage or service is unhealthy \((\d+)\)\.$/)
    if (match) return 'Threat intelligence reported a storage or service problem (HTTP ' + match[1] + ').'
    match = text.match(/^Latest customer activity is stale \(([\d.]+) minutes?\)\.$/)
    if (match) return 'The activity feed was ' + match[1] + (Number(match[1]) === 1 ? ' minute' : ' minutes') + ' out of date.'
    match = text.match(/^Latest customer activity returned (\d+) retained records; newest (successful collection check|collection|activity) is ([\d.]+) minutes? old\.$/)
    if (match) return match[1] + ' saved records. ' + (match[2] === 'successful collection check' ? 'Last successful source check' : match[2] === 'collection' ? 'Last collection' : 'Latest activity') + ' was ' + match[3] + (Number(match[3]) === 1 ? ' minute' : ' minutes') + ' ago.'
    match = text.match(/^Latest customer activity returned (\d+) retained records\.$/)
    if (match) return match[1] + ' saved activity records.'
    match = text.match(/^Latest activity returned (\d+) retained records\. Sources were checked successfully; no new activity\.$/)
    if (match) return 'Sources checked successfully. No new activity. ' + match[1] + ' saved records.'
    match = text.match(/^Collector healthy; no new customer claims within the freshness window \(([\d.]+) minutes\)\.$/)
    if (match) return 'The collector is healthy. No new activity in ' + match[1] + ' minutes.'
    match = text.match(/^Storage is healthy with (\d+) pending writes and (\d+) current collection loops\.$/)
    if (match) return 'Storage is healthy with ' + match[1] + ' pending writes and ' + match[2] + ' active collectors.'
    match = text.match(/^Collection processing is current; automatic review is disabled and (\d+) captured sources have no optional automatic review\.$/)
    if (match) return 'Collection is up to date. Automatic review is off for ' + match[1] + ' sources.'
    match = text.match(/^Collection problems: (.+)\.$/)
    if (match) {
        const names: Record<string, string> = { public: 'public sources', publicDefault: 'default public sources', restrictedMetadata: 'restricted source metadata' }
        return 'Problems collecting ' + join(match[1].split(', ').map(name => names[name] || name)) + '.'
    }
    if (/^\d+ stale reviews/.test(text)) {
        const delayed = /\b[1-9]\d* (?:stale reviews|overdue discovery jobs|stalled evaluations|recent delivery failures)/.test(text)
        return delayed ? 'Threat intelligence processing is delayed.' : 'No processing delays reported.'
    }
    match = text.match(/^Source\s+operations returned \d+ sources; (\d+) failed\.$/)
    if (match) return Number(match[1]) > 0 ? 'Source collection is delayed.' : 'Source collection completed successfully.'

    return text
}

export function statusHeadline(status: Pick<ServiceStatus, 'overall' | 'checks'>): string {
    const affected = new Map<string, 'down' | 'degraded'>()
    for (const check of status.checks) {
        if (check.status !== 'down' && check.status !== 'degraded') continue
        const name = /dark[- ]web monitoring/i.test(check.service) ? 'Dark web monitoring'
            : /API health/i.test(check.check_name) ? 'API'
                : /public website/i.test(check.check_name) ? 'Website'
                    : /processing backlog/i.test(check.check_name) ? 'Threat intelligence processing' : check.check_name
        affected.set(name, affected.get(name) === 'down' ? 'down' : check.status)
    }
    if (affected.size > 0 && affected.size <= 2) {
        const entries = [...affected]
        const state = (value: string) => value === 'down' ? 'unavailable' : 'degraded'
        return entries.every(([, value]) => value === entries[0][1])
            ? join(entries.map(([name]) => name)) + (entries.length === 1 ? ' is ' : ' are ') + state(entries[0][1])
            : join(entries.map(([name, value]) => name + ' is ' + state(value)))
    }
    return status.overall === 'up' ? 'Everything operational' : status.overall === 'unknown' ? 'Monitoring unavailable'
        : status.overall === 'down' ? 'Service interruption' : 'Some systems degraded'
}
