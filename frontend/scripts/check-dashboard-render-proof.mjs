import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const workbenchSource = readFileSync(new URL('../src/app/dashboard/ti/workbench/workbenchClient.tsx', import.meta.url), 'utf8')
const modelSource = readFileSync(new URL('../src/app/dashboard/operatorConsoleModel.ts', import.meta.url), 'utf8')
const pageSource = readFileSync(new URL('../src/app/dashboard/page.tsx', import.meta.url), 'utf8')
const checkerSource = readFileSync(new URL('./check-product-progress-contract.ts', import.meta.url), 'utf8')
const progressSource = readFileSync(new URL('../src/utils/productProgress/readiness.ts', import.meta.url), 'utf8')
const renderDomSource = readFileSync(new URL('./check-dashboard-render-dom.mjs', import.meta.url), 'utf8')

const readinessRows = {
    dashboard_evidence: {
        href: '/dashboard',
        backendProbe: 'GET /api/product-progress .dashboardEvidence',
        commits: ['89d9547e'],
    },
    source_inventory_probe: {
        href: '/dashboard/ti/sources',
        backendProbe: 'GET /api/ti/scraper/control + source readiness 930f93af',
        commits: ['930f93af', '178ec078'],
    },
    entitlement_readiness: {
        href: '/dashboard/dwm',
        backendProbe: 'GET /api/dwm/entitlements/readiness',
        commits: ['4da6a209'],
    },
    webhook_delivery: {
        href: '/dashboard/automations?setup=dwm',
        backendProbe: 'GET /api/dwm/webhooks/deliveries',
        commits: [],
    },
    org_alert_export: {
        href: '/dashboard/dwm',
        backendProbe: 'GET /api/organizations/:id/watchlist-alert-terms',
        commits: ['414c72a4'],
    },
    webhook_health: {
        href: '/dashboard/automations?setup=dwm',
        backendProbe: 'GET /api/dwm/webhooks',
        commits: [],
    },
    helpdesk_audit: {
        href: '/dashboard/system/impersonation',
        backendProbe: 'GET /api/admin/support/readiness with audit filters 016a8ef7',
        commits: ['016a8ef7', '9e25b6ad'],
    },
    deploy_probe: {
        href: '/status',
        backendProbe: 'GET /api/product-progress .deployProbe',
        commits: ['89d9547e'],
    },
    public_ti_provenance: {
        href: '/ti',
        backendProbe: 'GET /api/public-ti/provenance/readiness',
        commits: ['def920a7'],
    },
}

for (const id of Object.keys(readinessRows)) {
    assert.ok(modelSource.includes(`'${id}'`), `Missing model row id ${id}`)
    assert.ok(checkerSource.includes(`'${id}'`), `Missing checker row id ${id}`)
}

for (const [id, spec] of Object.entries(readinessRows)) {
    assert.ok(checkerSource.includes(spec.href) || modelSource.includes(spec.href), `Missing backed href ${spec.href} for ${id}`)
    for (const commit of spec.commits) {
        assert.ok(checkerSource.includes(commit) || spec.backendProbe.includes(commit), `Missing backend commit assertion ${commit} for ${id}`)
    }
}

for (const attr of [
    'data-readiness-row-id',
    'data-readiness-state',
    'data-readiness-blocker-count',
    'data-readiness-deep-link-target',
    'data-readiness-proof-timestamp',
    'data-readiness-unavailable-reason',
    'data-readiness-owner-lane',
    'data-readiness-operator-action',
]) {
    assert.ok(workbenchSource.includes(attr), `Missing DOM proof attribute ${attr}`)
}

for (const requiredClass of [
    'dark:border-[#2d3a52]',
    'dark:hover:border-[#3b4b68]',
    'wrap-break-word text-xs font-semibold',
    'wrap-break-word text-[11px]',
    'wrap-break-word text-[10px]',
    'shrink-0',
    'min-w-0',
    'flex flex-wrap items-start justify-between gap-3',
]) {
    assert.ok(workbenchSource.includes(requiredClass), `Missing render guard class ${requiredClass}`)
}

for (const source of [workbenchSource, modelSource, pageSource]) {
    const lowered = source.toLowerCase()
    for (const bannedCopy of ['control room', 'prompt-shaped', 'acceptance criteria', 'coordinator', 'delegation', 'you are tasked']) {
        assert.equal(lowered.includes(bannedCopy), false, `Dashboard source includes banned copy: ${bannedCopy}`)
    }
    for (const bannedClass of ['border-white/', 'bg-white/10', 'bg-white/15']) {
        assert.equal(source.includes(bannedClass), false, `Dashboard source includes high-contrast dark class: ${bannedClass}`)
    }
}

for (const field of ['ownerLane', 'unavailableReason', 'staleAfterSeconds', 'proofTimestamp', 'expectedDashboardRowId', 'integrationProbeHint']) {
    assert.ok(progressSource.includes(field), `Product-progress dependency proof field missing: ${field}`)
}

for (const requiredToken of [
    'hanasand.dashboard.render-proof.v1',
    '/dashboard/ti/control',
    'screenshotPath',
    'selectorCounts',
    'overlapCount',
    'bannedCopyList',
    'narrowActionCount',
    'highContrastTokenHits',
    '--base-url=',
]) {
    assert.ok(renderDomSource.includes(requiredToken), `Rendered proof command missing ${requiredToken}`)
}

for (const [id, spec] of Object.entries(readinessRows)) {
    assert.ok(renderDomSource.includes(id), `Rendered proof command missing row ${id}`)
    assert.ok(renderDomSource.includes(spec.href), `Rendered proof command missing href ${spec.href}`)
}

for (const bannedCopy of ['control room', 'prompt-shaped', 'acceptance criteria', 'coordinator', 'delegation', 'you are tasked', 'worker 3']) {
    assert.ok(renderDomSource.includes(bannedCopy), `Rendered proof command missing banned copy check: ${bannedCopy}`)
}

const worker3Matrix = {
    viewports: [
        { name: 'desktop', width: 1440, height: 1000 },
        { name: 'mobile', width: 390, height: 844 },
    ],
    screenshots: [
        '/tmp/hanasand-dashboard-desktop.png',
        '/tmp/hanasand-dashboard-mobile.png',
        '/tmp/hanasand-dashboard_ti_control-desktop.png',
        '/tmp/hanasand-dashboard_ti_control-mobile.png',
    ],
    command: 'node scripts/check-dashboard-render-dom.mjs --base-url=http://127.0.0.1:3010 --out-dir=/tmp',
    artifact: '/tmp/hanasand-dashboard-render-proof.json',
    schema: 'hanasand.dashboard.render-proof.v1',
    rows: readinessRows,
    failureConditions: [
        'missing readiness row selector',
        'empty owner lane or operator action',
        'missing deep-link target',
        'ready row with nonzero blocker count',
        'unavailable row without unavailable reason',
        'visible prompt/coordinator wording',
        'white translucent dark-mode borders',
        'missing screenshot or acceptance JSON artifact',
        'overlapping readiness rows or source operation actions',
        'action/status text clipped or stacked vertically',
    ],
}

console.log(JSON.stringify(worker3Matrix, null, 2))
