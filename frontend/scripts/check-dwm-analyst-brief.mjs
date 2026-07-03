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
    'Next operational steps',
    'Turn source activity into customer alerts.',
    'Edit watchlist',
    'Run collection',
    'Test delivery',
    'dwm-workflow-actions',
    'data-dwm-workflow-snapshot',
    'Workflow route',
    'Watchlist to source, alert, case, and delivery.',
    'Run path',
    'buildAnalystBrief(alert, evidenceSummary, routingContext, workflowContext)',
    'safeAlertSummary(alert)',
    'keep raw leaked files and secrets out of the customer update',
    'test delivery before sending',
]) {
    assert.ok(source.includes(token), `DWM analyst portal missing brief token: ${token}`)
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

for (const token of [
    'data-dwm-workflow-runbook',
    'data-dwm-workflow-result',
    'Collection command center',
    'Watchlist to case route',
    'Tune the org watchlist, collect approved sources, rebuild alerts, open cases, and test customer delivery from one path.',
    'Operator command',
    'Save and rebuild alerts',
    'Run to case / Open case',
    'Add at least one company, domain, supplier, or product term first.',
    'Enter an HTTPS webhook URL before testing delivery.',
    'RouteStepRow',
    'disabledReason',
]) {
    assert.ok(workflowSource.includes(token), `DWM workflow actions missing practical runbook token: ${token}`)
}

console.log('dwm analyst brief ok')
