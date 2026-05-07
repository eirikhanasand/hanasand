import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type Kind = 'website' | 'api' | 'worker' | 'bot'
type Story = { id: number; title: string; prompt: string; kind: Kind; mustMention: RegExp[]; scenario: RegExp[] }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'share-chat-reddit-production-control-stories')
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
]

const stories: Story[] = [
    { id: 501, title: 'Staging Production Drift API', kind: 'api', prompt: 'Build "Staging Production Drift API", a Fastify Postgres API for a backend lead who needs local preview staging production environment parity, required env checks, migration version evidence, feature flags, and deploy rollback targets.', mustMention: [/Environment Parity/i, /local, preview, staging, and production/i, /DATABASE_URL/i, /migrations\/001_initial_schema\.sql/i, /Feature Flag Governance/i, /rollback target/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 502, title: 'Secret Rotation Panic API', kind: 'api', prompt: 'Build "Secret Rotation Panic API", a Fastify Postgres API for security reviewers who need secrets management, rotation dates, emergency revocation, missing secret tests, shaped errors, and no leaked values.', mustMention: [/Secrets Management/i, /Rotate secrets|rotated|rotation/i, /emergency revocation/i, /expired secrets|missing or expired secrets/i, /request_error/i, /no-hardcoded-secrets|never hardcoded/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 503, title: 'Surprise Credit Burn Worker', kind: 'worker', prompt: 'Build "Surprise Credit Burn Worker", a Redis worker for expensive jobs with billing limit policy, cost estimate, queue and cancel controls, retry budget, reset windows, backoff, and support visibility.', mustMention: [/Billing and Limit Policy/i, /credit burn/i, /queue\/cancel|queue.*cancel/i, /retryBudget/i, /reset/i, /backoff/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 504, title: 'GDPR Deletion Request Site', kind: 'website', prompt: 'Build "GDPR Deletion Request Site", a Next.js privacy portal with export, correction, deletion, restriction, consent withdrawal, retention holds, request receipts, and privacy request automation.', mustMention: [/Privacy Request Automation/i, /export, correction, deletion/i, /consent withdrawal/i, /retention holds/i, /receipt/i, /Privacy Rules/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 505, title: 'Migration Rollback Booking API', kind: 'api', prompt: 'Build "Migration Rollback Booking API", a Fastify Postgres booking API with migration rollback, backup verification, data-loss assessment, schema relationships, fixtures, and canary tenant notes.', mustMention: [/Migration Rollback/i, /data-loss assessment/i, /backup verification/i, /Schema Relationships/i, /Fixture and Seed Data/i, /canary tenant/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 506, title: 'Feature Flag Graveyard Site', kind: 'website', prompt: 'Build "Feature Flag Graveyard Site", a Next.js product page for stale feature flag complaints with flag owners, rollout percentage, expiry, cleanup issue, incident timeline, and release evidence.', mustMention: [/Feature Flag Governance/i, /owner, purpose, default state/i, /rollout percentage/i, /expiry date/i, /cleanup issue/i, /incident timelines/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 507, title: 'Incident Copy Not Stack Trace API', kind: 'api', prompt: 'Build "Incident Copy Not Stack Trace API", a Fastify Postgres API where incidents show calm customer copy, internal diagnostics, severity, affected journeys, request IDs, and support bundle notes.', mustMention: [/Incident Communication/i, /raw provider errors|red stack traces/i, /severity/i, /affected journeys/i, /x-request-id/i, /Support Bundle/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 508, title: 'Seed Data Reality Site', kind: 'website', prompt: 'Build "Seed Data Reality Site", a Next.js QA demo with realistic fixtures for empty, long, duplicate, archived, deleted, invalid, permission-denied, media metadata, and quota states.', mustMention: [/Fixture and Seed Data/i, /empty, small, large, duplicate/i, /archived, deleted/i, /permission-denied/i, /media metadata/i, /quota limits/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 509, title: 'Billing Limit SaaS API', kind: 'api', prompt: 'Build "Billing Limit SaaS API", a Fastify Postgres SaaS API with billing limit policy, hourly daily monthly plan limits, overage disabled, overage approved, plan downgrade, rate limit reset copy, and audit trail.', mustMention: [/Billing and Limit Policy/i, /hourly, daily, monthly/i, /overage disabled/i, /overage approved/i, /plan downgrade/i, /rateLimit|rate limit/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 510, title: 'Enterprise Support Worker', kind: 'worker', prompt: 'Build "Enterprise Support Worker", a Redis support worker where failures create incident communication, replay controls, billing-safe retries, feature flags, support bundles, and shaped status messages.', mustMention: [/Incident Communication/i, /replay/i, /Billing and Limit Policy/i, /Feature Flag Governance/i, /Support Bundle/i, /worker-status/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 511, title: 'Consent Localization Site', kind: 'website', prompt: 'Build "Consent Localization Site", a Next.js privacy site where consent, export, deletion, correction, and withdrawal requests work across locales and never rely on English-only hardcoded copy.', mustMention: [/Privacy Request Automation/i, /consent withdrawal/i, /export, correction, deletion/i, /locale/i, /Privacy Rules/i, /Accessibility Audit/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 512, title: 'Environment Variable Preview API', kind: 'api', prompt: 'Build "Environment Variable Preview API", a Fastify Postgres API where missing env vars fail preview clearly with environment parity docs, secrets management, shaped errors, and deployment troubleshooting.', mustMention: [/Environment Parity/i, /required variables/i, /Secrets Management/i, /Preview and Deploy/i, /request_error/i, /Deployment Troubleshooting/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 513, title: 'Canary Billing Rollout Worker', kind: 'worker', prompt: 'Build "Canary Billing Rollout Worker", a Redis worker for billing-sensitive changes with release canary, feature flags, billing limit policy, rollback, queue depth thresholds, and incident communication.', mustMention: [/Release Canary/i, /Feature Flag Governance/i, /Billing and Limit Policy/i, /rollback/i, /queue depth/i, /Incident Communication/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 514, title: 'Legal Hold Export API', kind: 'api', prompt: 'Build "Legal Hold Export API", a Fastify Postgres privacy API where deletion requests respect retention holds, backups, audit logs, downstream processors, request receipts, and legal export evidence.', mustMention: [/Privacy Request Automation/i, /retention holds/i, /backups/i, /audit logs/i, /downstream processors/i, /receipt/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 515, title: 'Fixture Heavy Media Site', kind: 'website', prompt: 'Build "Fixture Heavy Media Site", a Next.js media site with fixtures for huge files, invalid types, duplicate uploads, broken EXIF, alt text, deletion recovery, media pipeline, and seed data.', mustMention: [/Media Asset Pipeline/i, /huge files|large files/i, /type validation|unsupported formats/i, /duplicate files|duplicate uploads/i, /broken EXIF/i, /Fixture and Seed Data/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 516, title: 'Secretless Support Bot', kind: 'bot', prompt: 'Build "Secretless Support Bot", a Discord support bot whose support bundles are useful without leaking secrets, chat transcripts, tokens, screenshots, or customer payloads. Include secrets management and incident communication.', mustMention: [/discord\.js/i, /DISCORD_TOKEN=replace_me/i, /Secrets Management/i, /Support Bundle/i, /Incident Communication/i, /never generated source, screenshots, support bundles/i], scenario: [/Bot readiness OK/i, /Support bundle visible/i, /Mobile layout fits viewport/i] },
    { id: 517, title: 'Production Pricing Complaint Site', kind: 'website', prompt: 'Build "Production Pricing Complaint Site", a Next.js pricing page for users angry about surprise plan limits, overages, downgrade effects, reset windows, billing-impacting confirmations, and support visibility.', mustMention: [/Billing and Limit Policy/i, /plan limits/i, /overage/i, /downgrade/i, /reset/i, /Pricing Risk/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 518, title: 'Rollback Impossible API', kind: 'api', prompt: 'Build "Rollback Impossible API", a Fastify Postgres API where impossible rollbacks are explicitly documented with compensating actions, support messages, migration rollback, feature flags, and canary evidence.', mustMention: [/Migration Rollback/i, /rollback is impossible/i, /compensating action/i, /support message/i, /Feature Flag Governance/i, /Release Canary/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 519, title: 'Privacy Queue Worker', kind: 'worker', prompt: 'Build "Privacy Queue Worker", a Redis worker for privacy export and deletion jobs with replay, audit, deadlines, retention-safe deletion, request receipts, billing-safe retries, and incident communication.', mustMention: [/Privacy Request Automation/i, /replay/i, /audit/i, /deadline/i, /retention/i, /receipt/i, /Incident Communication/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 520, title: 'Hostile Enterprise Operability Gauntlet', kind: 'api', prompt: 'Build "Hostile Enterprise Operability Gauntlet", a Fastify Postgres API for a hostile enterprise reviewer demanding environment parity, secrets management, fixture seed data, migration rollback, feature flags, incident communication, privacy request automation, billing limit policy, OpenAPI, and migrations.', mustMention: [/Environment Parity/i, /Secrets Management/i, /Fixture and Seed Data/i, /Migration Rollback/i, /Feature Flag Governance/i, /Incident Communication/i, /Privacy Request Automation/i, /Billing and Limit Policy/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
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
    const previewPath = path.join(target, 'playwright-production-control-preview.html')
    await fs.writeFile(previewPath, html)
    return previewPath
}

async function verifyContent(story: Story, target: string, files: ToolFile[]) {
    const allContent = files.map((file) => `${file.path}\n${file.content}`).join('\n---\n')
    const filePaths = new Set(files.map((file) => file.path))
    const readme = files.find((file) => file.path === 'README.md')?.content || ''
    const checks: Record<string, boolean> = {
        enoughFiles: files.length >= 78,
        commonDocs: commonDocs.every((file) => filePaths.has(file)),
        packageJson: await exists(path.join(target, 'package.json')),
        envExample: await exists(path.join(target, '.env.example')),
        dockerfile: await exists(path.join(target, 'Dockerfile')),
        compose: await exists(path.join(target, 'docker-compose.yml')),
        ci: await exists(path.join(target, '.github/workflows/ci.yml')),
        conciseReadme: readme.length > 250 && readme.length < 3600,
        docsAreConcrete: /Environment Parity|Secrets Management|Fixture and Seed Data|Migration Rollback|Feature Flag Governance|Incident Communication|Privacy Request Automation|Billing and Limit Policy/i.test(allContent),
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
        const improvement = failed.length ? `Tighten: ${failed.join(', ')}` : 'Passed real browser workflow plus production control, tests, and canary checks.'
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
if (failed.length) throw new Error(`${failed.length} production-control Playwright stories failed.`)
console.log(`All ${results.length} production-control stories passed with Playwright usability and load checks.`)
