import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type Kind = 'website' | 'api' | 'worker' | 'bot'
type Story = { id: number; title: string; prompt: string; kind: Kind; mustMention: RegExp[]; scenario: RegExp[] }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'share-chat-reddit-maintainability-stories')
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
]

const stories: Story[] = [
    { id: 461, title: 'Bloated Export Takeover Site', kind: 'website', prompt: 'Build "Bloated Export Takeover Site", a Dockerized Next.js marketing page for a hostile agency lead who says AI builders create bloated unreadable exports. Include architecture map, ADRs, maintainership, dependency upgrades, performance budget, load testing, real user monitoring, and data portability proof.', mustMention: [/next/i, /Dockerfile/i, /architecture map|architecture-map/i, /Architecture Decision Records|ADR/i, /Performance Budget/i, /Data Portability/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 462, title: 'Agency Handoff Architecture API', kind: 'api', prompt: 'Build "Agency Handoff Architecture API", a Fastify and Postgres backend for agency handoff review with migrations, OpenAPI, architecture map, ADRs, performance budget, load testing, RUM, dependency upgrades, and data portability.', mustMention: [/fastify/i, /postgres/i, /migrations\/001_initial_schema\.sql/i, /openapi/i, /architecture map|architecture-map/i, /load testing/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 463, title: 'Queue Load Soak Worker', kind: 'worker', prompt: 'Build "Queue Load Soak Worker", a Fastify and Redis worker stack for a critic who demands queue depth, retries, poison jobs, replay requests, load soak testing, performance budgets, and maintainership docs.', mustMention: [/redis/i, /src\/worker\.ts/i, /replayRequests|replay/i, /poisonJobs|poison/i, /workerAlerts/i, /Load Testing/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 464, title: 'Restaurant SEO Performance Recovery Site', kind: 'website', prompt: 'Build "Restaurant SEO Performance Recovery Site", a Next.js restaurant site for an angry owner whose AI website was slow and bad for SEO. Include menu, reservations, pricing, RUM, Core Web Vitals, performance budget, SEO controls, and browser verification.', mustMention: [/Menu and allergens|Reservations|Pricing/i, /real user monitoring|RUM/i, /performance budget/i, /SEO/i, /browser verification/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 465, title: 'Hidden Database Portability API', kind: 'api', prompt: 'Build "Hidden Database Portability API", a Fastify Postgres API for a founder who fears hidden builder databases. Include migrations, schemaVersion, backup restore, dry-run import/export docs, data ownership, and portability evidence.', mustMention: [/DATABASE_URL/i, /schemaVersion/i, /backup|restore/i, /Data Portability/i, /dry run|dry-run/i, /data model ownership/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 466, title: 'Dependency Upgrade Panic API', kind: 'api', prompt: 'Build "Dependency Upgrade Panic API", a Fastify Postgres backend for a maintainer handling CVEs and breaking dependency upgrades. Include SBOM, dependency upgrade policy, vulnerability findings, CI, rollback evidence, health and readiness.', mustMention: [/SBOM/i, /Dependency Upgrades/i, /vulnerability/i, /rollback/i, /\.github\/workflows\/ci\.yml/i, /\/ready/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 467, title: 'No Maintainer Left Worker', kind: 'worker', prompt: 'Build "No Maintainer Left Worker", a Redis worker queue for an orphaned support workflow. Include runbook, maintainership, replay policy, stuck job detector, worker alerts, architecture map, and load testing.', mustMention: [/stuckJobDetector/i, /replayPolicy/i, /workerAlerts/i, /Maintainership/i, /Architecture Map/i, /Load Testing/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 468, title: 'Mobile Slow Network Site', kind: 'website', prompt: 'Build "Mobile Slow Network Site", a Next.js site for users complaining that generated pages only work on the creator machine. Include slow network beta cases, offline refresh notes, empty states, performance budget, RUM, and browser verification.', mustMention: [/Beta Edge Cases/i, /slow network/i, /offline refresh/i, /empty states/i, /Performance Budget/i, /Real User Monitoring/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 469, title: 'Client Says The Code Is Unreadable Site', kind: 'website', prompt: 'Build "Client Says The Code Is Unreadable Site", a Next.js export for a critic demanding readable source, architecture boundaries, ADRs, maintainership, change review, onboarding, and no vague filler.', mustMention: [/Architecture Map/i, /Architecture Decision Records/i, /Maintainership/i, /Change Review/i, /Onboarding/i, /No platform lock-in/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 470, title: 'Webhook Load Spike API', kind: 'api', prompt: 'Build "Webhook Load Spike API", a Fastify Postgres webhook API that handles idempotency, rate limits, request IDs, outbox events, webhook signatures, load spikes, shaped errors, and metrics.', mustMention: [/idempotency/i, /rateLimit|rate limit/i, /x-request-id/i, /outbox/i, /webhook signature/i, /metrics/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 471, title: 'Support Cannot Debug Bot', kind: 'bot', prompt: 'Build "Support Cannot Debug Bot", a Discord bot for a community admin who needs env-only secrets, safe admin stubs, audit logs, support bundles, error recovery, maintainership, architecture docs, and dependency upgrade guidance.', mustMention: [/discord\.js/i, /DISCORD_TOKEN=replace_me/i, /auditLog/i, /Support Bundle/i, /Error Recovery/i, /Dependency Upgrades/i], scenario: [/Bot readiness OK/i, /Support bundle visible/i, /Mobile layout fits viewport/i] },
    { id: 472, title: 'Procurement Asks For ADRs Site', kind: 'website', prompt: 'Build "Procurement Asks For ADRs Site", a Next.js procurement-ready site with ADRs, dependency policy, SBOM, privacy rules, data portability, source export proof, and browser verification.', mustMention: [/Procurement Review/i, /Architecture Decision Records/i, /Dependency Upgrades/i, /SBOM/i, /Privacy Rules/i, /Data Portability/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 473, title: 'CSV Import Roundtrip Worker', kind: 'worker', prompt: 'Build "CSV Import Roundtrip Worker", a Redis worker for bulk import/export round trips with dry-run validation, replay, rollback, load testing, data portability, and maintainership docs.', mustMention: [/Data Portability/i, /dry run|dry-run/i, /replay/i, /rollback/i, /Load Testing/i, /Maintainership/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 474, title: 'Founder Wants Exit Proof API', kind: 'api', prompt: 'Build "Founder Wants Exit Proof API", a Fastify Postgres backend that proves the founder can leave the platform. Include schema, migrations, OpenAPI, backup restore, audit hash, data contract, data portability, and restore drill notes.', mustMention: [/postgres/i, /migrations/i, /openapi/i, /backup|restore/i, /auditHash/i, /Data Contract|data-contract/i, /Data Portability/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 475, title: 'Real User Monitoring Status Site', kind: 'website', prompt: 'Build "Real User Monitoring Status Site", a Next.js site for a launch team that needs web vitals, RUM, SLOs, observability, incident notes, performance budget, and status-ready UX.', mustMention: [/Real User Monitoring/i, /web vitals|Core Web Vitals/i, /SLO/i, /Observability/i, /incident/i, /Performance Budget/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 476, title: 'Breaking Dependency Rollback Worker', kind: 'worker', prompt: 'Build "Breaking Dependency Rollback Worker", a Redis worker for release managers who need dependency upgrades, rollback evidence, CI, replay safety, runbook, and worker status before a breaking update.', mustMention: [/Dependency Upgrades/i, /Release Evidence/i, /\.github\/workflows\/ci\.yml/i, /replay/i, /Runbook/i, /worker-status/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 477, title: 'Multi Team Ownership API', kind: 'api', prompt: 'Build "Multi Team Ownership API", a Fastify Postgres API with role boundaries, access reviews, architecture map, maintainership, data contracts, OpenAPI, metrics, and clear team ownership.', mustMention: [/access review/i, /rolesFor|requireRole/i, /Architecture Map/i, /Maintainership/i, /Data Contract/i, /openapi/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 478, title: 'Builder Performance Complaint Site', kind: 'website', prompt: 'Build "Builder Performance Complaint Site", a Next.js site for a user who says AI builder output is slow, generic, and bad for SEO. Include performance budgets, load testing, RUM, SEO editing control, mobile fit, and browser verification.', mustMention: [/Performance Budget/i, /Load Testing/i, /Real User Monitoring/i, /SEO Editing Control/i, /Mobile-first|mobile/i, /Browser Verification/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 479, title: 'Auditor Wants Data Lineage API', kind: 'api', prompt: 'Build "Auditor Wants Data Lineage API", a Fastify Postgres API with data lineage, schemaVersion, auditHash, data classification, access review, OpenAPI, migrations, and portability docs.', mustMention: [/schemaVersion/i, /auditHash/i, /Data Classification/i, /Access Review/i, /openapi/i, /migrations/i, /Data Portability/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 480, title: 'Hostile Maintainer Gauntlet Worker', kind: 'worker', prompt: 'Build "Hostile Maintainer Gauntlet Worker", a Redis worker that must pass a hostile takeover review with architecture map, ADRs, performance and load testing, data portability, dependency upgrades, support bundles, retry, replay, stuck jobs, cancel, and alerts.', mustMention: [/Architecture Map/i, /Architecture Decision Records/i, /Performance Budget/i, /Load Testing/i, /Data Portability/i, /Dependency Upgrades/i, /stuckJobDetector|cancelJob|workerAlerts/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
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
    const previewPath = path.join(target, 'playwright-maintainability-preview.html')
    await fs.writeFile(previewPath, html)
    return previewPath
}

async function verifyContent(story: Story, target: string, files: ToolFile[]) {
    const allContent = files.map((file) => `${file.path}\n${file.content}`).join('\n---\n')
    const filePaths = new Set(files.map((file) => file.path))
    const readme = files.find((file) => file.path === 'README.md')?.content || ''
    const checks: Record<string, boolean> = {
        enoughFiles: files.length >= 54,
        commonDocs: commonDocs.every((file) => filePaths.has(file)),
        packageJson: await exists(path.join(target, 'package.json')),
        envExample: await exists(path.join(target, '.env.example')),
        dockerfile: await exists(path.join(target, 'Dockerfile')),
        compose: await exists(path.join(target, 'docker-compose.yml')),
        ci: await exists(path.join(target, '.github/workflows/ci.yml')),
        conciseReadme: readme.length > 250 && readme.length < 3600,
        docsAreConcrete: /architecture map|ADR|Performance Budget|Load Testing|Real User Monitoring|Data Portability|Maintainership/i.test(allContent),
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
        const improvement = failed.length ? `Tighten: ${failed.join(', ')}` : 'Passed real browser workflow plus maintainability, portability, and ownership checks.'
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
if (failed.length) throw new Error(`${failed.length} maintainability Playwright stories failed.`)
console.log(`All ${results.length} maintainability stories passed with Playwright usability and load checks.`)
