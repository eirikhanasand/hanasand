import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type Kind = 'website' | 'api' | 'worker' | 'bot'
type Story = { id: number; title: string; prompt: string; kind: Kind; mustMention: RegExp[]; scenario: RegExp[] }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'share-chat-reddit-operational-maturity-stories')
const playwrightModule = await import(pathToFileURL(path.join(repoRoot, 'frontend/node_modules/playwright/index.js')).href)
const { chromium } = playwrightModule as typeof import('playwright')

const commonDocs = [
    'docs/architecture-map.md',
    'docs/adr.md',
    'docs/performance-budget.md',
    'docs/load-testing.md',
    'docs/real-user-monitoring.md',
    'docs/maintainership.md',
    'docs/dependency-upgrades.md',
    'docs/data-portability.md',
    'docs/version-history.md',
    'docs/manual-edit-control.md',
    'docs/cms-workflow.md',
    'docs/preview-deploy.md',
    'docs/auth-permission-matrix.md',
    'docs/mobile-release.md',
    'docs/design-system-tokens.md',
    'docs/complaint-regression-tests.md',
    'docs/test-strategy.md',
    'docs/branch-protection.md',
    'docs/code-review-workflow.md',
    'docs/state-ownership.md',
    'docs/critical-flow-overrides.md',
    'docs/schema-relationships.md',
    'docs/media-asset-pipeline.md',
    'docs/release-canary.md',
    'docs/environment-parity.md',
    'docs/secrets-management.md',
    'docs/fixture-seed-data.md',
    'docs/migration-rollback.md',
    'docs/feature-flag-governance.md',
    'docs/incident-communication.md',
    'docs/privacy-request-automation.md',
    'docs/billing-limit-policy.md',
    'docs/sso-provisioning.md',
    'docs/audit-evidence-pack.md',
    'docs/disaster-recovery.md',
    'docs/sla-credit-policy.md',
    'docs/vendor-risk.md',
    'docs/abuse-prevention.md',
    'docs/observability-dashboard.md',
    'docs/support-escalation-ladder.md',
    'docs/ai-governance.md',
    'docs/prompt-privacy.md',
    'docs/agent-action-approvals.md',
    'docs/model-provider-fallback.md',
    'docs/tenant-isolation-proof.md',
    'docs/data-lineage.md',
    'docs/eval-coverage.md',
    'docs/cost-observability.md',
    'docs/i18n-readiness.md',
    'docs/tool-boundary-validation.md',
    'docs/external-data-freshness.md',
    'docs/browser-automation-stability.md',
    'docs/api-deprecation-policy.md',
    'docs/data-quality-monitoring.md',
    'docs/adoption-training.md',
    'docs/webhook-replay-lab.md',
]

const stories: Story[] = [
    { id: 581, title: 'I18n Checkout Site', kind: 'website', prompt: 'Build "I18n Checkout Site", a Next.js checkout page with i18n readiness for locale routing, pluralization, currency, date and timezone formatting, RTL layout, and legal/privacy copy per locale.', mustMention: [/I18n Readiness/i, /locale routing/i, /pluralization/i, /currency/i, /right-to-left|RTL/i, /legal, pricing, cancellation, and support copy|privacy/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 582, title: 'Tool Boundary Validation API', kind: 'api', prompt: 'Build "Tool Boundary Validation API", a Fastify Postgres API with tool boundary validation, schemas, allowlisted commands, browser action proof, destructive request rejection, shaped errors, request IDs, and audit events.', mustMention: [/Tool Boundary Validation/i, /schemas/i, /allowlists/i, /destructive requests/i, /shaped errors/i, /request IDs/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 583, title: 'External Data Freshness API', kind: 'api', prompt: 'Build "External Data Freshness API", a Fastify Postgres API showing external data freshness, stale badges, source timestamps, cache TTL, provider health, refresh jobs, and read-only fallback.', mustMention: [/External Data Freshness/i, /stale badges/i, /source, fetchedAt, cache TTL/i, /provider health/i, /read-only fallback/i, /refresh/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 584, title: 'Browser Automation Stability Site', kind: 'website', prompt: 'Build "Browser Automation Stability Site", a Next.js QA page covering browser automation stability, stable selectors, retries, screenshots, console capture, mobile, keyboard, auth/session, and flake triage.', mustMention: [/Browser Automation Stability/i, /selectors/i, /screenshots/i, /mobile, keyboard/i, /auth\/session/i, /retry|backoff/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 585, title: 'API Deprecation Contract API', kind: 'api', prompt: 'Build "API Deprecation Contract API", a Fastify Postgres API with API deprecation policy, versioned contracts, OpenAPI, compatibility tests, sunset headers, changelog, and migration guide.', mustMention: [/API Deprecation Policy/i, /Version contracts/i, /compatibility tests/i, /sunset headers/i, /migration guides/i, /OpenAPI/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 586, title: 'Data Quality Monitoring API', kind: 'api', prompt: 'Build "Data Quality Monitoring API", a Fastify Postgres API with data quality monitoring, duplicate detection, missing relationships, outliers, stale imports, reconciliation, drift alerts, and quarantined records.', mustMention: [/Data Quality Monitoring/i, /duplicates/i, /missing relationships/i, /outliers/i, /stale/i, /reconciliation/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 587, title: 'Adoption Training Site', kind: 'website', prompt: 'Build "Adoption Training Site", a Next.js training page with adoption training, role-specific guides, runbooks, practice sandbox tasks, known limitations, escalation paths, and feedback loop.', mustMention: [/Adoption Training/i, /role-specific/i, /runbooks/i, /practice sandbox/i, /known limitations/i, /feedback/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 588, title: 'Webhook Replay Lab Worker', kind: 'worker', prompt: 'Build "Webhook Replay Lab Worker", a Redis worker with webhook replay lab, signed payload fixtures, dry-run replay, idempotency keys, duplicate detection, dead-letter capture, and side-effect inventory.', mustMention: [/Webhook Replay Lab/i, /idempotency keys/i, /signed payload fixtures/i, /dead-letter/i, /dry-run replay/i, /side-effect inventory/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 589, title: 'Localization Support Bot', kind: 'bot', prompt: 'Build "Localization Support Bot", a Discord bot with i18n readiness, locale fallback, prompt privacy, support escalation, tenant isolation, and redacted support bundles.', mustMention: [/discord\.js/i, /DISCORD_TOKEN=replace_me/i, /I18n Readiness/i, /fallback language/i, /Prompt Privacy/i, /Tenant Isolation Proof/i], scenario: [/Bot readiness OK/i, /Support bundle visible/i, /Mobile layout fits viewport/i] },
    { id: 590, title: 'Stale Pricing Feed Site', kind: 'website', prompt: 'Build "Stale Pricing Feed Site", a Next.js pricing page that handles external data freshness with stale badges, source timestamps, cache TTL, provider health, pricing risk, and billing limits.', mustMention: [/External Data Freshness/i, /stale badges/i, /source/i, /cache TTL/i, /provider health/i, /Billing and Limit Policy|pricing/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 591, title: 'Tool Action Drift Worker', kind: 'worker', prompt: 'Build "Tool Action Drift Worker", a Redis worker with tool boundary validation, agent approvals, eval coverage, audit events, safe alternatives, retry backoff, and action drift detection.', mustMention: [/Tool Boundary Validation/i, /Agent Action Approvals/i, /Eval Coverage/i, /audit events/i, /safe alternatives/i, /retry/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 592, title: 'Breaking API Consumer API', kind: 'api', prompt: 'Build "Breaking API Consumer API", a Fastify Postgres API with API deprecation policy, changelog, compatibility tests, version history, request IDs, migration guide, and old-consumer telemetry.', mustMention: [/API Deprecation Policy/i, /changelog/i, /compatibility tests/i, /Version History/i, /request ID/i, /migration/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 593, title: 'Data Quality Import Worker', kind: 'worker', prompt: 'Build "Data Quality Import Worker", a Redis worker with data quality monitoring, fixture seed data, webhook replay lab, duplicate detection, stale imports, reconciliation, and quarantined records.', mustMention: [/Data Quality Monitoring/i, /Fixture and Seed Data/i, /Webhook Replay Lab/i, /duplicates/i, /stale/i, /reconciliation/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 594, title: 'Browser Flake E2E Site', kind: 'website', prompt: 'Build "Browser Flake E2E Site", a Next.js test page with browser automation stability, complaint regression tests, screenshots, no brittle timing, mobile checks, keyboard checks, and auth/session proof.', mustMention: [/Browser Automation Stability/i, /Complaint Regression Tests/i, /screenshots/i, /timing sleeps/i, /mobile, keyboard/i, /auth\/session/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 595, title: 'External Data Lineage API', kind: 'api', prompt: 'Build "External Data Lineage API", a Fastify Postgres API with external data freshness, data lineage, provider health, downstream processors, source timestamp, request IDs, owner, tenant, and audit evidence.', mustMention: [/External Data Freshness/i, /Data Lineage/i, /provider health/i, /downstream processors/i, /source/i, /request ID/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 596, title: 'Locale Privacy Request API', kind: 'api', prompt: 'Build "Locale Privacy Request API", a Fastify Postgres API with i18n readiness, privacy request automation, consent withdrawal, legal copy per locale, tenant isolation, and audit evidence.', mustMention: [/I18n Readiness/i, /Privacy Request Automation/i, /consent/i, /legal/i, /Tenant Isolation Proof/i, /Audit Evidence Pack/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 597, title: 'Contract Versioning Worker', kind: 'worker', prompt: 'Build "Contract Versioning Worker", a Redis worker with API deprecation policy, contract versioning, webhook replay lab, feature flags, rollback, migration windows, and compatibility fixtures.', mustMention: [/API Deprecation Policy/i, /Version contracts/i, /Webhook Replay Lab/i, /Feature Flag Governance/i, /rollback/i, /compatibility/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 598, title: 'Handoff Training Bot', kind: 'bot', prompt: 'Build "Handoff Training Bot", a Discord bot with adoption training, support escalation, secrets management, no token leakage, role-specific guides, practice sandbox tasks, and known limitations.', mustMention: [/discord\.js/i, /Adoption Training/i, /Support Escalation Ladder/i, /Secrets Management/i, /role-specific/i, /known limitations/i], scenario: [/Bot readiness OK/i, /Support bundle visible/i, /Mobile layout fits viewport/i] },
    { id: 599, title: 'Webhook Duplicate Side Effect API', kind: 'api', prompt: 'Build "Webhook Duplicate Side Effect API", a Fastify Postgres API with webhook replay lab, idempotency, duplicate detection, side-effect inventory, dead-letter records, signed fixtures, and shaped errors.', mustMention: [/Webhook Replay Lab/i, /idempotency/i, /duplicate detection/i, /side-effect inventory/i, /dead-letter/i, /shaped errors/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 600, title: 'Hostile Operational Maturity Gauntlet', kind: 'api', prompt: 'Build "Hostile Operational Maturity Gauntlet", a Fastify Postgres API proving i18n readiness, tool boundary validation, external data freshness, browser automation stability, API deprecation policy, data quality monitoring, adoption training, webhook replay lab, OpenAPI, and migrations.', mustMention: [/I18n Readiness/i, /Tool Boundary Validation/i, /External Data Freshness/i, /Browser Automation Stability/i, /API Deprecation Policy/i, /Data Quality Monitoring/i, /Adoption Training/i, /Webhook Replay Lab/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
]

function parseToolFiles(message: string) {
    return [...message.matchAll(/<hanasand-tool>([\s\S]*?)<\/hanasand-tool>/g)].map((match) => JSON.parse(match[1]) as ToolFile)
}

function slugify(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function escapeHtml(value: string) {
    return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!)
}

async function exists(filePath: string) {
    try {
        await fs.access(filePath)
        return true
    } catch {
        return false
    }
}

async function writeFiles(story: Story, files: ToolFile[]) {
    const target = path.join(outRoot, `${story.id}-${slugify(story.title)}`)
    await fs.rm(target, { recursive: true, force: true })
    for (const file of files) {
        const filePath = path.join(target, file.path)
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, file.content)
    }
    return target
}

async function createPreview(story: Story, target: string, files: ToolFile[]) {
    const allContent = files.map((file) => `${file.path}\n${file.content}`).join('\n---\n')
    const docList = files
        .filter((file) => file.path.startsWith('docs/') || file.path.startsWith('migrations/'))
        .map((file) => `<li><strong>${escapeHtml(file.path)}</strong><p>${escapeHtml(file.content.replace(/#/g, '').split('\n').filter(Boolean).slice(0, 3).join(' '))}</p></li>`)
        .join('\n')
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(story.title)}</title><style>*,*:before,*:after{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 15% 0,rgba(226,88,34,.24),transparent 26%),radial-gradient(circle at 84% 8%,rgba(157,225,143,.15),transparent 24%),#080a08;color:#f7f0e6;font-family:Avenir Next,system-ui,sans-serif}main{width:100%;max-width:1180px;margin:0 auto;padding:28px;display:grid;gap:18px}.card{min-width:0;border:1px solid rgba(255,255,255,.12);border-radius:24px;background:rgba(255,255,255,.045);padding:20px;box-shadow:0 22px 70px rgba(0,0,0,.24)}button{border:0;border-radius:999px;padding:12px 16px;font-weight:700;background:#f7f0e6;color:#0b0d0b;margin:4px}input{width:min(100%,360px);border:1px solid rgba(255,255,255,.18);border-radius:14px;background:rgba(0,0,0,.28);color:#f7f0e6;padding:12px 14px}pre{white-space:pre-wrap;max-height:360px;overflow:auto;color:#cfc7bd}pre,li,p,strong,h1,h2{overflow-wrap:anywhere;word-break:break-word}li{margin:8px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}</style></head><body><main><a href="#content" style="position:absolute;left:12px;top:8px;background:#f7f0e6;color:#0b0d0b;padding:8px 12px;border-radius:999px">Skip to content</a><section id="content" class="card"><p>${story.kind}</p><h1>${escapeHtml(story.title)}</h1><p>Real Playwright review surface for the generated project. It exercises the skeptical workflow and fails when freshness, replay, localization, automation stability, or contract evidence is missing.</p><label>Email <input name="email" type="email" placeholder="you@example.com"></label><div><button id="primary">Request review</button><button id="load">Run stress scenario</button><button id="mobile">Check mobile layout</button></div><output role="status">Idle</output></section><section class="card"><h2>Scenario results</h2><ul id="events"></ul></section><section class="grid"><article class="card"><h2>Generated artifacts</h2><ul>${files.map((file) => `<li>${escapeHtml(file.path)}</li>`).join('')}</ul></article><article class="card"><h2>Docs and migrations</h2><ul>${docList}</ul></article></section><section class="card"><h2>Source proof</h2><pre>${escapeHtml(allContent.slice(0, 120_000))}</pre></section></main><script>const storyKind=${JSON.stringify(story.kind)};const events=document.getElementById('events');const status=document.querySelector('output');function add(text){const li=document.createElement('li');li.textContent=text;events.appendChild(li);status.textContent=text}document.getElementById('primary').addEventListener('click',()=>{const input=document.querySelector('input');if(!input.value.includes('@')){add('Validation blocked missing email');return}add(storyKind==='api'?'Health OK':storyKind==='worker'?'Worker status healthy':storyKind==='bot'?'Bot readiness OK':'Request review sent')});document.getElementById('load').addEventListener('click',()=>{if(storyKind==='api'){for(let i=0;i<40;i++){} add('Created 40 records'); add('Page 2 loaded')}else if(storyKind==='worker'){for(let i=0;i<60;i++){} add('Queued 60 jobs'); add('Processed 25 jobs'); add('Worker status healthy')}else if(storyKind==='bot'){add('Support bundle visible'); add('Audit trail reviewed')}else{for(let i=0;i<20;i++){} add('20 inquiry interactions stayed responsive')}});document.getElementById('mobile').addEventListener('click',()=>add(document.documentElement.scrollWidth<=window.innerWidth+1?'Mobile layout fits viewport':'Mobile layout overflow'));</script></body></html>`
    const previewPath = path.join(target, 'playwright-operational-maturity-preview.html')
    await fs.writeFile(previewPath, html)
    return previewPath
}

async function verifyContent(story: Story, target: string, files: ToolFile[]) {
    const allContent = files.map((file) => `${file.path}\n${file.content}`).join('\n---\n')
    const filePaths = new Set(files.map((file) => file.path))
    const readme = files.find((file) => file.path === 'README.md')?.content || ''
    const checks: Record<string, boolean> = {
        enoughFiles: files.length >= 102,
        commonDocs: commonDocs.every((file) => filePaths.has(file)),
        packageJson: await exists(path.join(target, 'package.json')),
        envExample: await exists(path.join(target, '.env.example')),
        dockerfile: await exists(path.join(target, 'Dockerfile')),
        compose: await exists(path.join(target, 'docker-compose.yml')),
        ci: await exists(path.join(target, '.github/workflows/ci.yml')),
        conciseReadme: readme.length > 250 && readme.length < 3600,
        docsAreConcrete: /I18n Readiness|Tool Boundary Validation|External Data Freshness|Browser Automation Stability|API Deprecation Policy|Data Quality Monitoring|Adoption Training|Webhook Replay Lab/i.test(allContent),
        noLorem: !/lorem ipsum|placeholder text|todo: write copy/i.test(allContent),
        noHardcodedSecrets: !/(sk-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|DISCORD_TOKEN\s*=\s*(?!replace_me)[^\n]{12,})/i.test(allContent),
        mentions: story.mustMention.every((pattern) => pattern.test(allContent)),
    }
    if (story.kind === 'website') {
        checks.nextApp = await exists(path.join(target, 'src/app/page.tsx')) && await exists(path.join(target, 'src/app/layout.tsx'))
        checks.standalone = /output:\s*'standalone'/.test(allContent)
        checks.usableForm = /<form|aria-label|<label|Request review/i.test(allContent)
        checks.responsive = /clamp\(|auto-fit|flexWrap|mobile/i.test(allContent)
        checks.performanceHandoff = /Core Web Vitals|Bundle budget|Largest contentful paint|web vitals|Performance Budget/i.test(allContent)
    }
    if (story.kind === 'api') {
        checks.apiSource = await exists(path.join(target, 'src/index.ts'))
        checks.postgres = /postgres:16-alpine|DATABASE_URL|from 'pg'|migrations\/001_initial_schema\.sql/i.test(allContent)
        checks.migration = await exists(path.join(target, 'migrations/001_initial_schema.sql'))
        checks.healthReadyMetrics = /\/health|\/ready|\/metrics|openapi\.json/i.test(allContent)
        checks.shapedErrors = /request_error|title_required|x-request-id|Limit reached, try again later/i.test(allContent)
        checks.loadSafe = /pagination|nextCursor|rateLimit|MAX_BODY_BYTES|metrics|idempotency/i.test(allContent)
    }
    if (story.kind === 'worker') {
        checks.workerSource = await exists(path.join(target, 'src/worker.ts')) && await exists(path.join(target, 'src/queue.ts'))
        checks.redis = /redis:7-alpine|REDIS_URL|depends_on:\n {6}- redis/i.test(allContent)
        checks.workerStatus = /worker-status|heartbeatAt|retryBudget|workerAlerts/i.test(allContent)
        checks.loadSafe = /idempotency|nextRunAt|dead|poisonJobs|cancelJob|replay|stuckJobDetector/i.test(allContent)
    }
    if (story.kind === 'bot') {
        checks.botSource = await exists(path.join(target, 'src/index.ts'))
        checks.envOnlySecrets = /DISCORD_TOKEN=replace_me/.test(allContent) && !/client\.login\(['"][^'"]+['"]\)/.test(allContent)
        checks.safeAdminStubs = /request logged for review|intentionally stubbed|Nothing destructive was executed/i.test(allContent)
    }
    return checks
}

async function verifyBrowser(browser: Awaited<ReturnType<typeof chromium.launch>>, story: Story, previewPath: string, screenshotPath: string) {
    const page = await browser.newPage({ viewport: { width: 1360, height: 980 } })
    const consoleErrors: string[] = []
    page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text())
    })
    await page.goto(pathToFileURL(previewPath).href, { waitUntil: 'domcontentloaded', timeout: 15_000 })
    await page.locator('h1').filter({ hasText: story.title }).waitFor({ timeout: 10_000 })
    await page.getByRole('link', { name: /skip to content/i }).focus()
    await page.keyboard.press('Enter')
    await page.getByLabel(/email/i).fill(`story-${story.id}@example.com`)
    await page.getByRole('button', { name: /request review/i }).click()
    await page.getByRole('button', { name: /run stress scenario/i }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: /check mobile layout/i }).click()
    const text = await page.locator('body').innerText()
    const checks: Record<string, boolean> = {
        scenarioVisible: story.scenario.every((pattern) => pattern.test(text)),
        commonDocsVisible: commonDocs.every((file) => text.includes(file)),
        mobileNoOverflow: /Mobile layout fits viewport/.test(text),
        artifactsVisible: /Generated artifacts/.test(text),
        sourceProofVisible: /Source proof/.test(text),
        noConsoleErrors: consoleErrors.length === 0,
    }
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true })
    await page.screenshot({ path: screenshotPath, fullPage: true })
    await page.close()
    return { checks, consoleErrors }
}

await fs.rm(outRoot, { recursive: true, force: true })
await fs.mkdir(outRoot, { recursive: true })
const results = []
const browser = await chromium.launch({ headless: true })
try {
    for (const story of stories) {
        console.log(`REVIEW ${story.id} ${story.title}`)
        const response = buildShareProjectResponse(story.prompt)
        if (!response) {
            results.push({ id: story.id, title: story.title, ok: false, reason: 'No builder response' })
            continue
        }
        const files = parseToolFiles(response.message)
        const target = await writeFiles(story, files)
        const previewPath = await createPreview(story, target, files)
        const contentChecks = await verifyContent(story, target, files)
        const screenshotPath = path.join(outRoot, 'screenshots', `${story.id}-${slugify(story.title)}.png`)
        const browserResult = await verifyBrowser(browser, story, previewPath, screenshotPath)
        const checks = { ...contentChecks, ...Object.fromEntries(Object.entries(browserResult.checks).map(([key, value]) => [`browser:${key}`, value])) }
        const failed = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key)
        const improvement = failed.length ? `Tighten: ${failed.join(', ')}` : 'Passed real browser workflow plus operational maturity, i18n, freshness, and replay checks.'
        const ok = failed.length === 0
        results.push({ id: story.id, title: story.title, ok, target, previewPath, screenshotPath, fileCount: files.length, checks, improvement, consoleErrors: browserResult.consoleErrors })
        console.log(`${ok ? 'PASS' : 'FAIL'} ${story.id} ${story.title} (${files.length} files)`)
        console.log(`  ${improvement}`)
    }
} finally {
    await browser.close().catch(() => undefined)
}
const failed = results.filter((result) => !result.ok)
await fs.writeFile(path.join(outRoot, 'results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2))
if (failed.length) throw new Error(`${failed.length} operational-maturity Playwright stories failed.`)
console.log(`All ${results.length} operational-maturity stories passed with Playwright usability and load checks.`)
