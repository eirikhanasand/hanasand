import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const workbenchSource = readFileSync(new URL('../src/app/dashboard/ti/workbench/workbenchClient.tsx', import.meta.url), 'utf8')
const modelSource = readFileSync(new URL('../src/app/dashboard/operatorConsoleModel.ts', import.meta.url), 'utf8')
const pageSource = readFileSync(new URL('../src/app/dashboard/page.tsx', import.meta.url), 'utf8')
const sourceOpsSource = readFileSync(new URL('../src/app/dashboard/ti/control/scraperControlClient.tsx', import.meta.url), 'utf8')
const checkerSource = readFileSync(new URL('./check-product-progress-contract.ts', import.meta.url), 'utf8')
const webhookProofCheckerSource = readFileSync(new URL('./check-product-progress-webhook-proof.ts', import.meta.url), 'utf8')
const alertGenerationProofCheckerSource = readFileSync(new URL('./check-product-progress-alert-generation.ts', import.meta.url), 'utf8')
const progressSource = readFileSync(new URL('../src/utils/productProgress/readiness.ts', import.meta.url), 'utf8')
const renderDomSource = readFileSync(new URL('./check-dashboard-render-dom.mjs', import.meta.url), 'utf8')

const readinessRows = {
    dashboard_evidence: {
        href: '/dashboard',
        backendProbe: 'GET /api/product-progress .dashboardEvidence + /api/dwm/alerts/generation-readiness evidence window',
        commits: ['89d9547e', 'dfb2d272'],
    },
    source_inventory_probe: {
        href: '/dashboard/ti/sources',
        backendProbe: 'GET /api/ti/scraper/control + source readiness 930f93af',
        commits: ['930f93af', '178ec078', '342c1fe3'],
    },
    dwm_product_snapshot: {
        href: '/dashboard/dwm',
        backendProbe: 'GET /api/dwm/product?demo=false',
        commits: ['9d4c7118', '03d8d1ec'],
    },
    entitlement_readiness: {
        href: '/dashboard/dwm',
        backendProbe: 'GET /api/dwm/entitlements/readiness',
        commits: ['4da6a209', '1c88a82a'],
    },
    webhook_delivery: {
        href: '/dashboard/automations?setup=dwm',
        backendProbe: 'GET /api/dwm/webhooks/deliveries',
        commits: ['14210040', '03d8d1ec'],
    },
    org_alert_export: {
        href: '/dashboard/dwm',
        backendProbe: 'GET /api/organizations/:id/alert-readiness readinessProof',
        commits: ['414c72a4', 'd0f53e04'],
    },
    webhook_health: {
        href: '/dashboard/automations?setup=dwm',
        backendProbe: 'GET /api/organizations/:id/webhooks destinationAdminProof.productProgress',
        commits: ['b3600c7e', 'adbe584b'],
    },
    helpdesk_audit: {
        href: '/dashboard/system/impersonation',
        backendProbe: 'GET /api/backend/admin/support/access-recovery + GET /api/backend/admin/audit-events',
        commits: ['016a8ef7', '9e25b6ad', '5b7d9357'],
    },
    deploy_probe: {
        href: '/status',
        backendProbe: 'GET /api/product-progress .deployProbe',
        commits: ['89d9547e'],
    },
    public_ti_provenance: {
        href: '/ti',
        backendProbe: 'GET /api/public-ti/provenance/readiness',
        commits: ['def920a7', '929f3416'],
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

for (const webhookProofToken of [
    'webhookProductProgressProof',
    'destinationAdminProof',
    'dwm.webhook.destination_admin_product_progress.v1',
    'GET /api/organizations/:id/webhooks must return destinationAdminProof.productProgress',
]) {
    assert.ok(webhookProofCheckerSource.includes(webhookProofToken), `Webhook product-progress checker missing token: ${webhookProofToken}`)
}

for (const alertGenerationProofToken of [
    'generationEvidenceWindowReady',
    'generation evidence window',
    'latestEvidenceAt',
    '/api/dwm/alerts/generation-readiness',
    'DWM alert-generation proof did not include a generation evidence window with capture timestamps.',
]) {
    assert.ok(alertGenerationProofCheckerSource.includes(alertGenerationProofToken), `Alert-generation product-progress checker missing token: ${alertGenerationProofToken}`)
}

for (const attr of [
    'data-readiness-row-id',
    'data-readiness-state',
    'data-readiness-blocker-count',
    'data-readiness-deep-link-target',
    'data-readiness-proof-timestamp',
    'data-readiness-unavailable-reason',
    'data-readiness-stale-after-seconds',
    'data-readiness-expected-dashboard-row-id',
    'data-readiness-integration-probe-hint',
    'data-readiness-backend-proof-contract-version',
    'data-readiness-owner-lane',
    'data-readiness-operator-action',
    'data-readiness-priority',
    'data-readiness-detail',
    'data-readiness-detail-state',
    'data-readiness-detail-owner',
    'data-readiness-detail-action',
    'data-readiness-detail-proof',
    'data-readiness-detail-blocker',
    'data-readiness-detail-href',
    'data-readiness-scorecard-link',
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
    'min-w-36',
    'min-w-44',
]) {
    assert.ok(workbenchSource.includes(requiredClass), `Missing render guard class ${requiredClass}`)
}

for (const source of [workbenchSource, modelSource, pageSource, sourceOpsSource]) {
    const lowered = source.toLowerCase()
    for (const bannedCopy of ['control room', 'prompt-shaped', 'acceptance criteria', 'coordinator', 'delegation', 'you are tasked']) {
        assert.equal(lowered.includes(bannedCopy), false, `Dashboard source includes banned copy: ${bannedCopy}`)
    }
    for (const bannedClass of ['border-white/', 'bg-white/10', 'bg-white/15']) {
        assert.equal(source.includes(bannedClass), false, `Dashboard source includes high-contrast dark class: ${bannedClass}`)
    }
}

for (const bannedUiCopy of ['APT29', 'LockBit', 'dashboard slop', 'how this feeds', '/ti/<query>', 'dashboard handoff', 'backed handoff']) {
    assert.equal(sourceOpsSource.includes(bannedUiCopy) || pageSource.includes(bannedUiCopy) || modelSource.includes(bannedUiCopy), false, `Dashboard visible source includes prompt/example copy: ${bannedUiCopy}`)
}

for (const sourceOpsGuard of ['min-w-32', 'min-w-44', 'sm:whitespace-nowrap', 'dark:border-[#2a3d5c]', 'dark:bg-[#111827]', 'dark:bg-[#0f172a]', 'grid gap-2 sm:grid-cols-2', 'Organization-scoped source actions require explicit membership']) {
    assert.ok(sourceOpsSource.includes(sourceOpsGuard), `Source operations action guard missing: ${sourceOpsGuard}`)
}

for (const field of ['ownerLane', 'unavailableReason', 'staleAfterSeconds', 'proofTimestamp', 'expectedDashboardRowId', 'integrationProbeHint', 'backendProofContractVersion']) {
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
    'local-dashboard-render-proof',
    'x-hanasand-render-proof-auth',
    'rendered login screen; dashboard auth fixture was not accepted',
    '--base-url=',
    'readiness detail missing',
    'data-readiness-scorecard-link="/readiness"',
]) {
    assert.ok(renderDomSource.includes(requiredToken), `Rendered proof command missing ${requiredToken}`)
}

for (const [id, spec] of Object.entries(readinessRows)) {
    assert.ok(renderDomSource.includes(id), `Rendered proof command missing row ${id}`)
    assert.ok(renderDomSource.includes(spec.href), `Rendered proof command missing href ${spec.href}`)
}

for (const bannedCopy of ['control room', 'prompt-shaped', 'acceptance criteria', 'coordinator', 'delegation', 'you are tasked', 'worker 3', 'ti control room', 'how this feeds', '/ti/<query>', 'dashboard slop', 'signal', 'dashboard handoff', 'backed handoff']) {
    assert.ok(renderDomSource.includes(bannedCopy), `Rendered proof command missing banned copy check: ${bannedCopy}`)
}
for (const consoleWarningGuard of ['consolewarnings', 'same key', 'encountered two children']) {
    assert.ok(renderDomSource.toLowerCase().includes(consoleWarningGuard), `Rendered proof command missing console warning guard: ${consoleWarningGuard}`)
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
        'missing proof timestamp, stale threshold, probe hint, dashboard row id, or backend proof contract version',
        'missing readiness priority or scorecard link',
        'missing readiness detail owner, action, proof, blocker, or deep link',
        'ready row with nonzero blocker count',
        'non-ready row without unavailable reason',
        'visible prompt/coordinator wording',
        'white translucent dark-mode borders',
        'missing screenshot or acceptance JSON artifact',
        'overlapping readiness rows or source operation actions',
        'nested readiness links counted as overlaps',
        'action/status text clipped or stacked vertically',
    ],
}

console.log(JSON.stringify(worker3Matrix, null, 2))
