import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/app/dashboard/dwm/dwm-analyst-portal.tsx', import.meta.url), 'utf8')
const workflowSource = readFileSync(new URL('../src/app/dashboard/dwm/dwm-workflow-actions.tsx', import.meta.url), 'utf8')
const inboxSource = readFileSync(new URL('../src/app/dashboard/dwm/dwm-alert-inbox.tsx', import.meta.url), 'utf8')
const workbenchAdapterSource = readFileSync(new URL('../src/app/dashboard/ti/workbench/dwmAlertAdapter.ts', import.meta.url), 'utf8')
const displaySource = readFileSync(new URL('../src/utils/dwm/display.ts', import.meta.url), 'utf8')

for (const token of [
    'data-dwm-analyst-brief',
    'Analyst brief',
    'What happened',
    'Why it matters',
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

for (const [label, targetSource] of [
    ['DWM inbox', inboxSource],
    ['TI workbench adapter', workbenchAdapterSource],
]) {
    if (targetSource.includes('{alert.claimSummary}')) {
        throw new Error(`${label} renders raw alert.claimSummary`)
    }
    assert.ok(targetSource.includes('safeAlertSummary(alert)'), `${label} should render sanitized alert summaries.`)
}

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

const briefIndex = source.indexOf('<AnalystBriefPanel brief={analystBrief} />')
const actionIndex = source.indexOf('<SelectedActionBar')
const tabsIndex = source.indexOf('<InvestigationTabs')

assert.ok(briefIndex >= 0, 'DWM analyst brief should render in the selected case workspace.')
assert.ok(actionIndex > briefIndex, 'DWM analyst brief should appear before action controls.')
assert.ok(tabsIndex > briefIndex, 'DWM analyst brief should appear before dense investigation tables.')
assert.ok(source.includes('const DWM_TIMELINE_PREVIEW_ROWS = 5'), 'DWM delivery and case activity timeline should stay compact by default.')
assert.ok(source.includes('timeline.slice(0, DWM_TIMELINE_PREVIEW_ROWS)'), 'DWM timeline should use the named preview cap.')
assert.ok(!source.includes('timeline.slice(0, 8)'), 'DWM timeline should not render a long event wall by default.')

for (const token of [
    'data-dwm-workflow-runbook',
    'data-dwm-workflow-result',
    'Monitoring workflow',
    'Watchlist to case',
    'Workflow updated',
    'Action blocked',
    'Every command calls the DWM API and refreshes the queue.',
    'Org watchlists',
    'Commands',
    'RouteStateCard label=\'Terms\'',
    'Save and rebuild alerts',
    'Run full workflow',
    'STARTER_WATCH_TERMS',
    'workflowTerms(terms)',
    'Prepare starter list',
    'No saved terms yet. Prepare a starter list or paste customer-owned company, domain, supplier, brand, or product terms.',
    'Paste an HTTPS Discord or webhook endpoint before testing customer delivery.',
    'data-dwm-inline-webhook',
    'disabledReason',
]) {
    assert.ok(workflowSource.includes(token), `DWM workflow actions missing practical runbook token: ${token}`)
}

console.log('dwm analyst brief ok')
