import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { safeAlertSummary } from '../src/utils/dwm/display'
import type { DwmAlert } from '../src/utils/dwm/product'

const portalSource = readFileSync(new URL('../src/app/dashboard/dwm/dwm-analyst-portal.tsx', import.meta.url), 'utf8')
const inboxSource = readFileSync(new URL('../src/app/dashboard/dwm/dwm-alert-inbox.tsx', import.meta.url), 'utf8')
const workbenchSource = readFileSync(new URL('../src/app/dashboard/ti/workbench/dwmAlertAdapter.ts', import.meta.url), 'utf8')
const dashboardSource = readFileSync(new URL('../src/app/dashboard/page.tsx', import.meta.url), 'utf8')

const alert = {
    id: 'json-claim',
    eventType: 'darkweb.monitoring.match',
    severity: 'high',
    confidence: 91,
    matchedTerm: { value: 'acme.com', kind: 'domain' },
    company: 'Acme',
    actor: 'Known Actor',
    artifactType: 'victim_claim',
    sourceFamily: 'darkweb_metadata',
    sourceCount: 1,
    firstSeenAt: '2026-07-03T00:00:00.000Z',
    claimSummary: '{\\"actorName\\":\\"Ransomware.live Victim Feed\\",\\"victimName\\":\\"Acme Corp\\",\\"category\\":\\"victim_claim\\",\\"status\\":\\"listed\\"}',
    reviewState: 'new',
    recommendedAction: 'Review the claim.',
    evidence: [],
    webhookDelivery: {
        recommendedRoute: 'analyst_review',
        payloadHash: 'hash',
        dedupeKey: 'dedupe',
    },
} satisfies DwmAlert

const rendered = [
    safeAlertSummary(alert),
    safeAlertSummary({ ...alert, claimSummary: alert.claimSummary.replaceAll('\\"', '"') }),
].join('\n')

assert.match(rendered, /Ransomware\.live Victim Feed matched Acme Corp as victim claim\./)

for (const pattern of [
    /\{\\"actorName\\"/,
    /"victimName"/,
    /\{\s*"[^"]+"\s*:/,
]) {
    assert.doesNotMatch(rendered, pattern, `safe alert summary leaked raw JSON: ${pattern}`)
}

for (const [label, source] of [
    ['portal queue', portalSource],
    ['portal case brief', portalSource],
    ['portal analyst brief', portalSource],
    ['inbox', inboxSource],
    ['workbench', workbenchSource],
    ['dashboard overview', dashboardSource],
] as const) {
    assert.ok(source.includes('safeAlertSummary(alert)'), `${label} should use safeAlertSummary(alert)`)
}

assert.ok(!portalSource.includes('<CaseBrief label=\'What happened\' value={alert.claimSummary} />'), 'portal case brief renders raw claimSummary')
assert.ok(!portalSource.includes('<p className=\'mt-3 line-clamp-2 text-xs leading-5 text-[#aab7cc]\'>{alert.claimSummary}</p>'), 'portal queue renders raw claimSummary')
assert.ok(!portalSource.includes('whatHappened: alert.claimSummary'), 'portal analyst brief uses raw claimSummary')
assert.ok(!inboxSource.includes('{alert.claimSummary}'), 'inbox renders raw claimSummary')
assert.ok(!workbenchSource.includes('subtitle: alert.claimSummary'), 'workbench subtitle uses raw claimSummary')
assert.ok(!dashboardSource.includes('summary: alert.claimSummary'), 'dashboard summary uses raw claimSummary')
assert.ok(!dashboardSource.includes('subtitle: alert.claimSummary'), 'dashboard subtitle uses raw claimSummary')

console.log('dwm safe summary ok')
