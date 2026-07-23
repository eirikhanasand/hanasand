import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { formatClaimSummary } from '../src/utils/dwm/display.ts'

const source = readFileSync(new URL('../src/app/dashboard/dwm/dwm-analyst-portal.tsx', import.meta.url), 'utf8')
const pageSource = readFileSync(new URL('../src/app/dashboard/dwm/page.tsx', import.meta.url), 'utf8')
const workflowSource = readFileSync(new URL('../src/app/dashboard/dwm/dwm-workflow-actions.tsx', import.meta.url), 'utf8')
const caseDetailSource = readFileSync(new URL('../src/app/dashboard/dwm/cases/[id]/case-detail-client.tsx', import.meta.url), 'utf8')
const workbenchAdapterSource = readFileSync(new URL('../src/app/dashboard/ti/workbench/dwmAlertAdapter.ts', import.meta.url), 'utf8')
const displaySource = readFileSync(new URL('../src/utils/dwm/display.ts', import.meta.url), 'utf8')

for (const token of [
    'data-dwm-analyst-brief',
    'Analyst brief',
    'Observed fact',
    'Source claim',
    'Analyst inference',
    'What to do next',
    'Evidence boundary',
    'Action status',
    'data-dwm-zero-case-recovery',
    'Exposure operations',
    'No alert is waiting for review',
    'Customer send blocked',
    'Edit watchlist',
    'Run collection',
    'Test webhook',
    'workflowActions: ReactNode',
    '<section id=\'dwm-workflow-actions\' className=\'scroll-mt-24\'>',
    'dwm-workflow-actions',
    'data-dwm-workflow-snapshot',
    'data-dwm-available-actions',
    'const availableActions:',
    'Workflow',
    'Watchlist to source, alert, case, and delivery.',
    'Run workflow',
    'buildAnalystBrief(alert, evidenceSummary, routingContext, workflowContext)',
    'safeAlertSummary(alert)',
    'keep sensitive file contents and secrets out of the customer update',
    'test delivery before sending',
    'redacted source record',
    'redacted source',
    'Actor evidence handoff',
]) {
    assert.ok(source.includes(token), `DWM analyst portal missing brief token: ${token}`)
}

for (const blockedCopy of [
    'metadata-only record',
    'metadata only',
    'Public TI intake',
    'Public TI handoff',
    'Actor intel intake',
]) {
    assert.ok(!source.includes(blockedCopy), `DWM analyst portal should not render implementation-shaped copy: ${blockedCopy}`)
}

if (workbenchAdapterSource.includes('{alert.claimSummary}')) {
    throw new Error('TI workbench adapter renders raw alert.claimSummary')
}
assert.ok(workbenchAdapterSource.includes('safeAlertSummary(alert)'), 'TI workbench adapter should render sanitized alert summaries.')

for (const token of [
    'export function safeAlertSummary',
    'export function formatClaimSummary',
    'actorName',
    'victimName',
    'matched ${victim} as',
    'replace(/\\\\"/g, \'"\'',
]) {
    assert.ok(displaySource.includes(token), `DWM display helper missing token: ${token}`)
}

const safeSummary = formatClaimSummary('{\\"actorName\\":\\"Ransomware.live Victim Feed\\",\\"victimName\\":\\"Acme Corp\\",\\"category\\":\\"victim_claim\\"}', {
    actor: 'Known Actor', artifactType: 'victim_claim', company: 'Acme', matchedTerm: { value: 'acme.com', kind: 'domain' }, sourceFamily: 'darkweb_metadata',
})
assert.equal(safeSummary, 'Ransomware.live Victim Feed matched Acme Corp as victim claim.')
assert.doesNotMatch(safeSummary, /[{}]|actorName|victimName/)

const briefIndex = source.indexOf('<AnalystBriefPanel brief={analystBrief} />')
const actionIndex = source.indexOf('<SelectedActionBar')
const tabsIndex = source.indexOf('<InvestigationTabs')

assert.ok(briefIndex >= 0, 'DWM analyst brief should render in the selected case workspace.')
assert.ok(actionIndex > briefIndex, 'DWM analyst brief should appear before action controls.')
assert.ok(tabsIndex > briefIndex, 'DWM analyst brief should appear before dense investigation tables.')
assert.ok(source.includes('const DWM_TIMELINE_PREVIEW_ROWS = 4'), 'DWM delivery and case activity timeline should stay compact by default.')
assert.ok(source.includes('timeline.slice(0, DWM_TIMELINE_PREVIEW_ROWS)'), 'DWM timeline should use the named preview cap.')
assert.ok(!source.includes('timeline.slice(0, 8)'), 'DWM timeline should not render a long event wall by default.')
assert.ok(source.includes('const DWM_RECOVERY_PREVIEW_ROWS = 3'), 'DWM recovery panels should keep source and capture rows compact by default.')
assert.ok(source.includes('latestCaptures.slice(0, DWM_RECOVERY_PREVIEW_ROWS)'), 'DWM capture recovery rows should use the named preview cap.')
assert.ok(source.includes('sourceRows.slice(0, DWM_RECOVERY_PREVIEW_ROWS)'), 'DWM source recovery rows should use the named preview cap.')
assert.ok(!source.includes('latestCaptures.slice(0, 8)'), 'DWM recovery should not render a long capture wall by default.')
assert.ok(!source.includes('sourceRows.slice(0, 8)'), 'DWM source posture should not render a long source wall by default.')
assert.ok(source.includes('const DWM_DELIVERY_PREVIEW_ROWS = 3'), 'DWM delivery history should stay compact by default.')
assert.ok(source.includes('visible.slice(0, DWM_DELIVERY_PREVIEW_ROWS)'), 'DWM delivery history should use the named preview cap.')
assert.ok(!source.includes('visible.slice(0, 6)'), 'DWM delivery history should not render a long delivery wall by default.')
assert.ok(caseDetailSource.includes('const DWM_CASE_EVIDENCE_PREVIEW_ROWS = 6'), 'DWM case evidence tables should stay compact by default.')
assert.ok(caseDetailSource.includes('const DWM_CASE_TIMELINE_PREVIEW_ROWS = 8'), 'DWM case timeline should stay compact by default.')
assert.ok(caseDetailSource.includes('evidence.slice(0, DWM_CASE_EVIDENCE_PREVIEW_ROWS)'), 'DWM case evidence rows should use the named preview cap.')
assert.ok(caseDetailSource.includes('timeline.slice(0, DWM_CASE_TIMELINE_PREVIEW_ROWS)'), 'DWM case timeline rows should use the named preview cap.')
assert.ok(!caseDetailSource.includes('evidence.map((row, index)'), 'DWM case detail should not render all evidence rows by default.')
assert.ok(!caseDetailSource.includes('timeline.map((row, index)'), 'DWM case detail should not render all timeline rows by default.')
assert.ok(caseDetailSource.includes('|| \'watch term pending\''), 'DWM case detail should use customer workflow language when watch terms are not attached.')
assert.ok(!caseDetailSource.includes('|| \'none\''), 'DWM case detail should not render dead none states for watch terms.')
assert.ok(workflowSource.includes('webhookConfigured ? \'staged\' : \'route needed\''), 'DWM workflow should render missing webhook routes as an operator action.')
assert.ok(!workflowSource.includes('webhookConfigured ? \'staged\' : \'none\''), 'DWM workflow should not render dead none labels for webhook routing.')
assert.ok(source.includes('row.newest ? relativeTimeLabel(row.newest) : \'waiting for capture\''), 'DWM source coverage should explain missing freshness as capture state.')
assert.ok(!source.includes('row.newest ? relativeTimeLabel(row.newest) : \'none\''), 'DWM source coverage should not render dead none labels for freshness.')
assert.ok(source.includes('workflowContext.hasWebhookRoute ? \'test available\' : \'destination needed\''), 'DWM selected alert webhook state should guide destination setup.')
assert.ok(!source.includes('workflowContext.hasWebhookRoute ? \'test available\' : \'not configured\''), 'DWM selected alert webhook state should not render setup as not configured.')
assert.ok(source.includes('return \'no retry scheduled\''), 'DWM retry state should use delivery workflow language.')
assert.ok(!source.includes('return \'none\''), 'DWM retry state should not render dead none labels.')
assert.ok(pageSource.includes('alerts={[]}'), 'DWM case queue should start empty before the authenticated alert proxy responds.')
assert.ok(source.includes('fetch(`/api/dwm/alerts?${params.toString()}`'), 'DWM case queue should hydrate from the authenticated alert proxy.')
assert.ok(!pageSource.includes('mergeDwmAlerts'), 'DWM case queue should not merge derived product matches into persisted alerts.')
assert.ok(source.includes('const sharedCaptureCount = operations?.counts.captureCount ?? latestCaptures.length'), 'DWM shared source inventory should retain its real capture total.')
assert.ok(source.includes('const tenantRunCaptureCount = operations?.latestRun?.captureCount ?? 0'), 'DWM workflow counters should use only the persisted tenant run.')
assert.ok(source.includes('captureCount: tenantRunCaptureCount'), 'DWM workflow telemetry should not attribute shared captures to a tenant run.')
assert.ok(!source.includes('captureRunLabel(operations?.latestRun?.captureCount, captureCount'), 'DWM run labels should not fall back to shared inventory.')
assert.ok(source.includes('alertWatchlistMatchCount(alerts)'), 'DWM workflow counters should derive visible matches from alerts when operations are unavailable.')
assert.ok(source.includes('function alertCasePath(alert: PortalAlert)'), 'DWM selected case links should use alert case paths.')
assert.ok(source.includes('String(second.attemptedAt || \'\').localeCompare(String(first.attemptedAt || \'\'))'), 'DWM delivery ordering should tolerate persisted attempts without timestamps.')
assert.ok(!source.includes('.attemptedAt.localeCompare('), 'DWM delivery views should not call localeCompare on nullable persisted timestamps.')
assert.ok(source.includes('Historical match'), 'DWM alert queue should identify retained historical evidence.')
assert.ok(source.includes('if (alert.matchTiming?.kind === \'historical_backfill\') return false'), 'DWM Fresh filter must exclude all-historical retained evidence.')
assert.ok(source.includes('selectedEvidence.provenance?.publishedAt'), 'DWM evidence details should expose the original publisher timestamp.')
assert.ok(source.includes('selectedEvidence.provenance?.collectedAt'), 'DWM evidence details should expose collection time separately.')
assert.ok(!source.includes('provenance?.publishedAt || selectedEvidence.observedAt'), 'DWM evidence details must not present collection time as publisher time.')

for (const token of [
    'data-dwm-workflow-runbook',
    'data-dwm-workflow-result',
    'Monitoring workflow',
    'Watchlist to case',
    'Workflow updated',
    'Action blocked',
    'Run watchlist, collection, case, and delivery steps from one queue.',
    'Org watchlists',
    'Commands',
    'RouteStateCard label=\'Terms\'',
    'Save and rebuild alerts',
    'Run collection',
    'Open case',
    'Test destination',
    'Send queued',
    'Alert review',
    'workflowTerms(terms)',
    'Add at least one customer-owned watchlist term.',
    'No persisted watchlist terms. Add terms owned by this tenant before collecting or rebuilding alerts.',
    'validEvidenceUrl',
    'an HTTPS source URL are required',
    'Add an HTTPS Discord or webhook endpoint before testing customer delivery.',
    'No destination yet. Add or test an HTTPS Discord/webhook endpoint before sending.',
    'Test saves a delivery attempt without sending externally.',
    'webhookUrl: webhookConfigured ? webhookUrl.trim() : undefined',
    'Enter an HTTPS webhook URL or open an organization with a saved delivery destination before sending queued alerts.',
    'data-dwm-inline-webhook',
    'disabledReason',
]) {
    assert.ok(workflowSource.includes(token), `DWM workflow actions missing practical runbook token: ${token}`)
}

for (const blockedCopy of [
    'Every command calls the DWM API',
    'Paste an HTTPS Discord or webhook endpoint before testing customer delivery.',
    'Dry-run uses this endpoint and records the delivery result without external send by default.',
    'has just published a new victim',
    'sourceFamily: \'darkweb_metadata\',\n            title:',
]) {
    assert.ok(!workflowSource.includes(blockedCopy), `DWM workflow actions should not render implementation-shaped copy: ${blockedCopy}`)
}

assert.ok(workflowSource.includes('sourceFamily: \'public_advisory\''), 'DWM public evidence intake must retain its actual source family.')
assert.ok(!workflowSource.includes('publishedAt: input.publishedAt'), 'DWM public evidence intake must not accept submitted publisher provenance.')
assert.ok(!workflowSource.includes('type=\'datetime-local\''), 'DWM public evidence intake must not render a publication-time input.')

console.log('dwm analyst brief ok')
