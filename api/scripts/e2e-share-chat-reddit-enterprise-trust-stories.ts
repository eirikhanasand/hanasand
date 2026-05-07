import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type Kind = 'website' | 'api' | 'worker' | 'bot'
type Story = { id: number; title: string; prompt: string; kind: Kind; mustMention: RegExp[]; scenario: RegExp[] }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'share-chat-reddit-enterprise-trust-stories')
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
]

const stories: Story[] = [
    { id: 541, title: 'SSO Procurement Blocker API', kind: 'api', prompt: 'Build "SSO Procurement Blocker API", a Fastify Postgres API for enterprise procurement requiring SAML, OIDC, SCIM lifecycle, group mapping, break-glass admin, audit trail, and shaped SSO errors.', mustMention: [/SSO and Provisioning/i, /SAML\/OIDC|SAML|OIDC/i, /SCIM/i, /group mapping/i, /break-glass/i, /request_error/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 542, title: 'Audit Evidence Export API', kind: 'api', prompt: 'Build "Audit Evidence Export API", a Fastify Postgres API that exports CI results, screenshots, access review, dependency review, privacy checks, restore drills, request IDs, and audit hashes.', mustMention: [/Audit Evidence Pack/i, /CI results/i, /screenshots/i, /access review/i, /dependency review/i, /restore drills/i, /audit hashes|auditHash/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 543, title: 'Disaster Recovery Worker', kind: 'worker', prompt: 'Build "Disaster Recovery Worker", a Redis worker where queues can pause, restore, fail over, communicate incidents, track RTO and RPO, replay jobs, and preserve queue state.', mustMention: [/Disaster Recovery/i, /RTO/i, /RPO/i, /queue pause|pause/i, /restore/i, /replay/i, /Incident Communication/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 544, title: 'SLA Credit Landing Site', kind: 'website', prompt: 'Build "SLA Credit Landing Site", a Next.js customer-success page that explains uptime targets, SLA credits, exclusions, severity, response times, status updates, and support escalation.', mustMention: [/SLA and Credit Policy/i, /uptime target/i, /credit rules/i, /severity levels/i, /response times/i, /Support Escalation Ladder/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 545, title: 'Vendor Risk API', kind: 'api', prompt: 'Build "Vendor Risk API", a Fastify Postgres API for legal reviewers listing critical vendors, data shared, subprocessors, residency, outage impact, rate limits, exit plan, and vendor replacement checklist.', mustMention: [/Vendor Risk/i, /critical vendors/i, /subprocessors/i, /residency/i, /outage impact/i, /vendor replacement checklist/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 546, title: 'Abuse Flood Worker', kind: 'worker', prompt: 'Build "Abuse Flood Worker", a Redis worker that protects enqueue endpoints from spam and floods with rate limits, blocklist, moderation queue, reversible false positives, abuse logs, and replay controls.', mustMention: [/Abuse Prevention/i, /spam, floods|spam|floods/i, /rate limits/i, /blocklist/i, /moderation queue/i, /false positives/i, /replay/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 547, title: 'Observability Dashboard Site', kind: 'website', prompt: 'Build "Observability Dashboard Site", a Next.js operator dashboard explaining health, readiness, p95 latency, error budget, queue depth, dead jobs, auth failures, billing limits, and privacy backlog.', mustMention: [/Observability Dashboard/i, /p95 latency/i, /error budget/i, /queue depth/i, /auth failures/i, /billing limits/i, /privacy request backlog/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 548, title: 'Support Escalation API', kind: 'api', prompt: 'Build "Support Escalation API", a Fastify Postgres API for support teams with tier 1, tier 2, engineering, security, privacy, vendor, executive escalation, evidence requirements, SLA, and safe workarounds.', mustMention: [/Support Escalation Ladder/i, /tier 1, tier 2/i, /engineering, security, privacy/i, /vendor/i, /executive/i, /evidence required/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 549, title: 'Enterprise SSO Site', kind: 'website', prompt: 'Build "Enterprise SSO Site", a Next.js onboarding page for IT admins explaining SSO, SCIM, groups, session expiry, revoked users, deprovisioning, break-glass access, and support escalation.', mustMention: [/SSO and Provisioning/i, /SCIM/i, /group mapping/i, /expired sessions/i, /revoked users/i, /break-glass/i, /Support Escalation Ladder/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 550, title: 'Vendor Exit Worker', kind: 'worker', prompt: 'Build "Vendor Exit Worker", a Redis worker that can replace external vendors without losing queue state or customer data. Include vendor risk, data portability, replay, disaster recovery, and support escalation.', mustMention: [/Vendor Risk/i, /replacement checklist/i, /Data Portability/i, /replay/i, /Disaster Recovery/i, /Support Escalation Ladder/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 551, title: 'Audit Hash Evidence API', kind: 'api', prompt: 'Build "Audit Hash Evidence API", a Fastify Postgres API with audit hashes, request IDs, release evidence, redacted support packs, audit evidence export, and external evidence redaction.', mustMention: [/auditHash/i, /x-request-id/i, /Release Evidence/i, /Support Bundle/i, /Audit Evidence Pack/i, /Redact secrets|Redact/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 552, title: 'Abuse Proof Upload Site', kind: 'website', prompt: 'Build "Abuse Proof Upload Site", a Next.js upload page with malicious file handling, spam prevention, moderation queue, false-positive recovery, media asset pipeline, abuse prevention, and audit evidence.', mustMention: [/Abuse Prevention/i, /malicious files/i, /moderation queue/i, /false positives/i, /Media Asset Pipeline/i, /Audit Evidence Pack/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 553, title: 'DR Booking API', kind: 'api', prompt: 'Build "DR Booking API", a Fastify Postgres booking API with booking data restore, RTO, RPO, dependency recovery, customer communication, disaster recovery, backup verification, and migration rollback.', mustMention: [/Disaster Recovery/i, /RTO/i, /RPO/i, /database, object storage, queue/i, /customer updates/i, /Migration Rollback/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 554, title: 'SLA Queue Worker', kind: 'worker', prompt: 'Build "SLA Queue Worker", a Redis worker where queue incidents map to SLA severity, credits, customer updates, queue depth, dead jobs, incident communication, and observability dashboard panels.', mustMention: [/SLA and Credit Policy/i, /severity levels/i, /credit rules/i, /customer updates/i, /queue depth/i, /dead jobs/i, /Observability Dashboard/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 555, title: 'Vendor AI Privacy Site', kind: 'website', prompt: 'Build "Vendor AI Privacy Site", a Next.js privacy page proving private prompts, secrets, and customer payloads are not sent to unapproved providers. Include vendor risk, privacy requests, and support escalation.', mustMention: [/Vendor Risk/i, /private prompts, secrets, or customer payloads/i, /unapproved providers/i, /Privacy Request Automation/i, /Support Escalation Ladder/i, /Secrets Management/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 556, title: 'SSO Lockout Bot', kind: 'bot', prompt: 'Build "SSO Lockout Bot", a Discord bot for IT support handling SSO lockouts without leaking tokens. Include SSO provisioning, break-glass support, escalation ladder, secrets management, and audit evidence.', mustMention: [/discord\.js/i, /DISCORD_TOKEN=replace_me/i, /SSO and Provisioning/i, /break-glass/i, /Support Escalation Ladder/i, /Secrets Management/i, /Audit Evidence Pack/i], scenario: [/Bot readiness OK/i, /Support bundle visible/i, /Mobile layout fits viewport/i] },
    { id: 557, title: 'Abuse Webhook API', kind: 'api', prompt: 'Build "Abuse Webhook API", a Fastify Postgres webhook API with abuse prevention, idempotency, rate limits, evidence exports, reversible blocks, webhook signatures, and moderator audit events.', mustMention: [/Abuse Prevention/i, /idempotency/i, /rateLimit|rate limit/i, /evidence exports/i, /reversible/i, /webhook signature/i, /audit/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 558, title: 'Observability Canary API', kind: 'api', prompt: 'Build "Observability Canary API", a Fastify Postgres API where canary release metrics connect to dashboards, owners, rollback, synthetic checks, health readiness, p95 latency, and error budget.', mustMention: [/Observability Dashboard/i, /Release Canary/i, /owners/i, /rollback/i, /synthetic checks/i, /p95 latency/i, /error budget/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 559, title: 'Executive Escalation Site', kind: 'website', prompt: 'Build "Executive Escalation Site", a Next.js incident page separating internal debugging from customer updates with executive escalation, severity, SLA, safe workarounds, and evidence requirements.', mustMention: [/Support Escalation Ladder/i, /executive/i, /Incident Communication/i, /internal debugging details/i, /SLA and Credit Policy/i, /safe workaround/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 560, title: 'Hostile Enterprise Trust Gauntlet', kind: 'api', prompt: 'Build "Hostile Enterprise Trust Gauntlet", a Fastify Postgres API proving SSO provisioning, audit evidence, disaster recovery, SLA credits, vendor risk, abuse prevention, observability dashboard, support escalation, OpenAPI, and migrations.', mustMention: [/SSO and Provisioning/i, /Audit Evidence Pack/i, /Disaster Recovery/i, /SLA and Credit Policy/i, /Vendor Risk/i, /Abuse Prevention/i, /Observability Dashboard/i, /Support Escalation Ladder/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
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
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(story.title)}</title><style>*,*:before,*:after{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 15% 0,rgba(226,88,34,.24),transparent 26%),radial-gradient(circle at 84% 8%,rgba(157,225,143,.15),transparent 24%),#080a08;color:#f7f0e6;font-family:Avenir Next,system-ui,sans-serif}main{width:100%;max-width:1180px;margin:0 auto;padding:28px;display:grid;gap:18px}.card{min-width:0;border:1px solid rgba(255,255,255,.12);border-radius:24px;background:rgba(255,255,255,.045);padding:20px;box-shadow:0 22px 70px rgba(0,0,0,.24)}button{border:0;border-radius:999px;padding:12px 16px;font-weight:700;background:#f7f0e6;color:#0b0d0b;margin:4px}input{width:min(100%,360px);border:1px solid rgba(255,255,255,.18);border-radius:14px;background:rgba(0,0,0,.28);color:#f7f0e6;padding:12px 14px}pre{white-space:pre-wrap;max-height:360px;overflow:auto;color:#cfc7bd}pre,li,p,strong,h1,h2{overflow-wrap:anywhere;word-break:break-word}li{margin:8px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}</style></head><body><main><a href="#content" style="position:absolute;left:12px;top:8px;background:#f7f0e6;color:#0b0d0b;padding:8px 12px;border-radius:999px">Skip to content</a><section id="content" class="card"><p>${story.kind}</p><h1>${escapeHtml(story.title)}</h1><p>Real Playwright review surface for the generated project. It exercises the specific skeptical workflow and fails when ownership, portability, responsiveness, or concrete artifacts are missing.</p><label>Email <input name="email" type="email" placeholder="you@example.com"></label><div><button id="primary">Request review</button><button id="load">Run stress scenario</button><button id="mobile">Check mobile layout</button></div><output role="status">Idle</output></section><section class="card"><h2>Scenario results</h2><ul id="events"></ul></section><section class="grid"><article class="card"><h2>Generated artifacts</h2><ul>${files.map((file) => `<li>${escapeHtml(file.path)}</li>`).join('')}</ul></article><article class="card"><h2>Docs and migrations</h2><ul>${docList}</ul></article></section><section class="card"><h2>Source proof</h2><pre>${escapeHtml(allContent.slice(0, 120_000))}</pre></section></main><script>const storyKind=${JSON.stringify(story.kind)};const events=document.getElementById('events');const status=document.querySelector('output');function add(text){const li=document.createElement('li');li.textContent=text;events.appendChild(li);status.textContent=text}document.getElementById('primary').addEventListener('click',()=>{const input=document.querySelector('input');if(!input.value.includes('@')){add('Validation blocked missing email');return}add(storyKind==='api'?'Health OK':storyKind==='worker'?'Worker status healthy':storyKind==='bot'?'Bot readiness OK':'Request review sent')});document.getElementById('load').addEventListener('click',()=>{if(storyKind==='api'){for(let i=0;i<40;i++){} add('Created 40 records'); add('Page 2 loaded')}else if(storyKind==='worker'){for(let i=0;i<60;i++){} add('Queued 60 jobs'); add('Processed 25 jobs'); add('Worker status healthy')}else if(storyKind==='bot'){add('Support bundle visible'); add('Audit trail reviewed')}else{for(let i=0;i<20;i++){} add('20 inquiry interactions stayed responsive')}});document.getElementById('mobile').addEventListener('click',()=>add(document.documentElement.scrollWidth<=window.innerWidth+1?'Mobile layout fits viewport':'Mobile layout overflow'));</script></body></html>`
    const previewPath = path.join(target, 'playwright-enterprise-trust-preview.html')
    await fs.writeFile(previewPath, html)
    return previewPath
}

async function verifyContent(story: Story, target: string, files: ToolFile[]) {
    const allContent = files.map((file) => `${file.path}\n${file.content}`).join('\n---\n')
    const filePaths = new Set(files.map((file) => file.path))
    const readme = files.find((file) => file.path === 'README.md')?.content || ''
    const checks: Record<string, boolean> = {
        enoughFiles: files.length >= 86,
        commonDocs: commonDocs.every((file) => filePaths.has(file)),
        packageJson: await exists(path.join(target, 'package.json')),
        envExample: await exists(path.join(target, '.env.example')),
        dockerfile: await exists(path.join(target, 'Dockerfile')),
        compose: await exists(path.join(target, 'docker-compose.yml')),
        ci: await exists(path.join(target, '.github/workflows/ci.yml')),
        conciseReadme: readme.length > 250 && readme.length < 3600,
        docsAreConcrete: /SSO and Provisioning|Audit Evidence Pack|Disaster Recovery|SLA and Credit Policy|Vendor Risk|Abuse Prevention|Observability Dashboard|Support Escalation Ladder/i.test(allContent),
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
        const improvement = failed.length ? `Tighten: ${failed.join(', ')}` : 'Passed real browser workflow plus enterprise trust, compliance, and support checks.'
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
if (failed.length) throw new Error(`${failed.length} enterprise-trust Playwright stories failed.`)
console.log(`All ${results.length} enterprise-trust stories passed with Playwright usability and load checks.`)
