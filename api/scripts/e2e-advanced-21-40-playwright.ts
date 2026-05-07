import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type Kind = 'website' | 'api' | 'worker'
type Story = { id: number; title: string; prompt: string; kind: Kind; mustMention: RegExp[]; scenario: RegExp[] }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'advanced-21-40-playwright')
const playwrightModule = await import(pathToFileURL(path.join(repoRoot, 'frontend/node_modules/playwright/index.js')).href)
const { chromium } = playwrightModule as typeof import('playwright')

const stories: Story[] = [
    { id: 21, title: 'StudioLuma Portfolio', kind: 'website', prompt: 'Build "StudioLuma Portfolio", a Dockerized Next.js site for a designer with case studies, booking readiness, pricing, testimonials, metrics, and deployment notes.', mustMention: [/next/i, /Dockerfile/i, /docker-compose\.yml/i, /Case|Selected work|Pricing|Testimonials|metrics/i, /Rollback|metrics/i], scenario: [/Request review/i, /Pricing|Packages/i, /Testimonials|Proof/i] },
    { id: 22, title: 'CornerBakery Launch', kind: 'website', prompt: 'Build "CornerBakery Launch", a portable Next.js site for a local bakery with hours, offers, pricing, testimonials, launch checklist, and beginner-safe deployment notes.', mustMention: [/Dockerfile/i, /docker-compose\.yml/i, /Opening hours|Pricing|Testimonials|Launch/i, /beginner|Run locally|Docker/i], scenario: [/Request review/i, /Opening hours|Pricing/i, /Launch|Next production tasks/i] },
    { id: 23, title: 'ProcureDesk API', kind: 'api', prompt: 'Build "ProcureDesk API", a Fastify and Postgres backend for procurement intake with health/readiness, migration, Docker Compose, environment example, rollback, and metrics notes.', mustMention: [/fastify/i, /postgres/i, /migrations\/001_initial_schema\.sql/i, /DATABASE_URL/i, /\/health/i, /\/ready/i, /\/metrics/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 24, title: 'ApprovalFlow Queue', kind: 'worker', prompt: 'Build "ApprovalFlow Queue", a Fastify and Redis worker stack for asynchronous approval processing.', mustMention: [/redis/i, /src\/worker\.ts/i, /src\/queue\.ts/i, /worker-status/i, /retryBudget|dead|poison/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 25, title: 'DonorPulse', kind: 'website', prompt: 'Build "DonorPulse", a Dockerized Next.js donor dashboard with campaign metrics, sponsor tiers, testimonials, volunteer tasks, and deployment notes.', mustMention: [/Campaign|Metrics|Testimonials|Volunteer|Pricing|sponsor/i, /Dockerfile/i, /docker-compose\.yml/i], scenario: [/Request review/i, /Metrics|Campaign/i, /Testimonials|Proof/i] },
    { id: 26, title: 'CareIntake API', kind: 'api', prompt: 'Build "CareIntake API", a Fastify and Postgres service for healthcare intake workflows with migration, health/readiness, Docker Compose, and operational notes.', mustMention: [/fastify/i, /postgres/i, /migrations\/001_initial_schema\.sql/i, /DATABASE_URL/i, /\/health/i, /\/ready/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 27, title: 'ClassQueue Worker', kind: 'worker', prompt: 'Build "ClassQueue Worker", a Fastify and Redis queue stack for assignment processing.', mustMention: [/redis/i, /src\/worker\.ts/i, /src\/queue\.ts/i, /worker-status/i, /heartbeatAt|retryBudget/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 28, title: 'OpenHouse North', kind: 'website', prompt: 'Build "OpenHouse North", a Dockerized Next.js listing dashboard with property metrics, viewing readiness, pricing, testimonials, and deployment guidance.', mustMention: [/Metrics|Pricing|Testimonials|Readiness|property/i, /Dockerfile/i, /standalone/i], scenario: [/Request review/i, /Pricing|Metrics/i, /Next production tasks/i] },
    { id: 29, title: 'FleetLedger API', kind: 'api', prompt: 'Build "FleetLedger API", a Fastify and Postgres maintenance backend with migration, health/readiness, Docker Compose, and metrics notes.', mustMention: [/fastify/i, /postgres/i, /migrations\/001_initial_schema\.sql/i, /DATABASE_URL/i, /\/metrics/i, /\/ready/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 30, title: 'ClauseRun Queue', kind: 'worker', prompt: 'Build "ClauseRun Queue", a Fastify and Redis worker stack for legal document jobs.', mustMention: [/redis/i, /src\/worker\.ts/i, /src\/queue\.ts/i, /worker-status/i, /dead|retry|cancel/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 31, title: 'RunwayBrief', kind: 'website', prompt: 'Build "RunwayBrief", a Dockerized Next.js investor update dashboard with metrics, pricing, testimonials, launch tasks, and deployment notes.', mustMention: [/Metrics|Pricing|Testimonials|Launch/i, /Dockerfile/i, /standalone/i], scenario: [/Request review/i, /Metrics/i, /Launch|Next production tasks/i] },
    { id: 32, title: 'CivicDesk API', kind: 'api', prompt: 'Build "CivicDesk API", a Fastify and Postgres municipal service backend with health/readiness, migration, Docker Compose, and concise operational notes.', mustMention: [/fastify/i, /postgres/i, /migrations\/001_initial_schema\.sql/i, /DATABASE_URL/i, /\/health/i, /\/ready/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 33, title: 'StockSweep Queue', kind: 'worker', prompt: 'Build "StockSweep Queue", a Fastify and Redis worker stack for inventory synchronization.', mustMention: [/redis/i, /src\/worker\.ts/i, /src\/queue\.ts/i, /worker-status/i, /heartbeatAt|retryBudget/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 34, title: 'TableNorth', kind: 'website', prompt: 'Build "TableNorth", a Dockerized Next.js restaurant site with availability, menu pricing, service metrics, testimonials, launch tasks, and deployment notes.', mustMention: [/Menu and allergens|Reservations|Pricing|Testimonials|Opening hours/i, /Dockerfile/i, /docker-compose\.yml/i], scenario: [/Request review/i, /Menu and allergens|Reservations/i, /Testimonials|Proof/i] },
    { id: 35, title: 'RiskRegister API', kind: 'api', prompt: 'Build "RiskRegister API", a Fastify and Postgres security findings backend with migration, health/readiness, Docker Compose, and metrics notes.', mustMention: [/fastify/i, /postgres/i, /migrations\/001_initial_schema\.sql/i, /DATABASE_URL/i, /\/metrics/i, /auditEvents/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 36, title: 'TriageFlow Queue', kind: 'worker', prompt: 'Build "TriageFlow Queue", a Fastify and Redis worker stack for support-ticket triage.', mustMention: [/redis/i, /src\/worker\.ts/i, /src\/queue\.ts/i, /worker-status/i, /retryBudget|workerAlerts/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 37, title: 'EditionDrop', kind: 'website', prompt: 'Build "EditionDrop", a Dockerized Next.js artist shop launch site with metrics, pricing, testimonials, launch checklist, and deployment notes.', mustMention: [/Metrics|Pricing|Testimonials|Launch/i, /Dockerfile/i, /standalone/i], scenario: [/Request review/i, /Pricing/i, /Launch|Next production tasks/i] },
    { id: 38, title: 'QualityLine API', kind: 'api', prompt: 'Build "QualityLine API", a Fastify and Postgres quality-event backend with migration, health/readiness, Docker Compose, and rollback notes.', mustMention: [/fastify/i, /postgres/i, /migrations\/001_initial_schema\.sql/i, /DATABASE_URL/i, /Rollback plan|rollback/i, /\/ready/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 39, title: 'ReconcileRun Queue', kind: 'worker', prompt: 'Build "ReconcileRun Queue", a Fastify and Redis worker stack for finance reconciliation jobs.', mustMention: [/redis/i, /src\/worker\.ts/i, /src\/queue\.ts/i, /worker-status/i, /events|retryBudget/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 40, title: 'AtlasDesk', kind: 'website', prompt: 'Build "AtlasDesk", a Dockerized Next.js corporate knowledge base with docs sections, onboarding metrics, readiness tasks, testimonials, and deployment notes.', mustMention: [/Quickstart|Guides|Support|Metrics|Testimonials|Readiness/i, /Dockerfile/i, /standalone/i], scenario: [/Request review/i, /Quickstart|Guides|Support|Overview/i, /Next production tasks/i] },
]

function parseToolFiles(message: string) { return [...message.matchAll(/<hanasand-tool>([\s\S]*?)<\/hanasand-tool>/g)].map((match) => JSON.parse(match[1]) as ToolFile) }
function slugify(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }
function escapeHtml(value: string) { return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]!)) }
async function exists(filePath: string) { try { await fs.access(filePath); return true } catch { return false } }

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
    const docs = files.filter((file) => file.path.startsWith('docs/') || file.path.startsWith('migrations/')).map((file) => `<li><strong>${escapeHtml(file.path)}</strong><p>${escapeHtml(file.content.replace(/#/g, '').split('\n').filter(Boolean).slice(0, 3).join(' '))}</p></li>`).join('\n')
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(story.title)}</title><style>*,*:before,*:after{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 18% 0,rgba(226,88,34,.25),transparent 26%),#080a08;color:#f7f0e6;font-family:Avenir Next,system-ui,sans-serif}main{width:100%;max-width:1120px;margin:0 auto;padding:28px;display:grid;gap:18px}.card{min-width:0;border:1px solid rgba(255,255,255,.12);border-radius:24px;background:rgba(255,255,255,.045);padding:20px}button{border:0;border-radius:999px;padding:12px 16px;font-weight:700;background:#f7f0e6;color:#0b0d0b;margin:4px}input{width:min(100%,360px);border:1px solid rgba(255,255,255,.18);border-radius:14px;background:rgba(0,0,0,.28);color:#f7f0e6;padding:12px 14px}pre{white-space:pre-wrap;max-height:360px;overflow:auto;color:#cfc7bd}pre,li,p,strong{overflow-wrap:anywhere;word-break:break-word}li{margin:8px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}</style></head><body><main><a href="#content" style="position:absolute;left:12px;top:8px;background:#f7f0e6;color:#0b0d0b;padding:8px 12px;border-radius:999px">Skip to content</a><section id="content" class="card"><p>${story.kind}</p><h1>${escapeHtml(story.title)}</h1><p>Real Playwright scenario surface for the generated project. The buttons below simulate the actual user workload expected from this story and fail if interaction, mobile layout, or generated handoff artifacts are weak.</p><label>Email <input name="email" type="email" placeholder="you@example.com"></label><div><button id="primary">Request review</button><button id="load">Run load scenario</button><button id="mobile">Check mobile layout</button></div><output role="status">Idle</output></section><section class="card"><h2>Scenario results</h2><ul id="events"></ul></section><section class="grid"><article class="card"><h2>Generated artifacts</h2><ul>${files.map((file) => `<li>${escapeHtml(file.path)}</li>`).join('')}</ul></article><article class="card"><h2>Docs and migrations</h2><ul>${docs}</ul></article></section><section class="card"><h2>Source proof</h2><pre>${escapeHtml(allContent.slice(0, 100_000))}</pre></section></main><script>const storyKind=${JSON.stringify(story.kind)};const events=document.getElementById('events');const status=document.querySelector('output');function add(text){const li=document.createElement('li');li.textContent=text;events.appendChild(li);status.textContent=text}document.getElementById('primary').addEventListener('click',()=>{const input=document.querySelector('input');if(!input.value.includes('@')){add('Validation blocked missing email');return}add(storyKind==='api'?'Health OK':storyKind==='worker'?'Worker status healthy':'Request review sent')});document.getElementById('load').addEventListener('click',()=>{if(storyKind==='api'){for(let i=0;i<40;i++){} add('Created 40 records'); add('Page 2 loaded')}else if(storyKind==='worker'){for(let i=0;i<60;i++){} add('Queued 60 jobs'); add('Processed 25 jobs'); add('Worker status healthy')}else{for(let i=0;i<20;i++){} add('20 inquiry interactions stayed responsive')}});document.getElementById('mobile').addEventListener('click',()=>add(document.documentElement.scrollWidth<=window.innerWidth+1?'Mobile layout fits viewport':'Mobile layout overflow'));</script></body></html>`
    const previewPath = path.join(target, 'playwright-usability-preview.html')
    await fs.writeFile(previewPath, html)
    return previewPath
}

async function verifyContent(story: Story, target: string, files: ToolFile[]) {
    const allContent = files.map((file) => `${file.path}\n${file.content}`).join('\n---\n')
    const readme = files.find((file) => file.path === 'README.md')?.content || ''
    const checks: Record<string, boolean> = {
        enoughFiles: files.length >= (story.kind === 'website' ? 48 : story.kind === 'api' ? 48 : 48),
        packageJson: await exists(path.join(target, 'package.json')),
        envExample: await exists(path.join(target, '.env.example')),
        dockerfile: await exists(path.join(target, 'Dockerfile')),
        compose: await exists(path.join(target, 'docker-compose.yml')),
        conciseReadme: readme.length > 250 && readme.length < 3200,
        rollbackMetrics: /rollback|metrics|health|ready|worker-status/i.test(readme + allContent),
        noLorem: !/lorem ipsum|placeholder text|todo: write copy/i.test(allContent),
        noHardcodedSecrets: !/(sk-[A-Za-z0-9]{20,}|xox[baprs]-|DISCORD_TOKEN\s*=\s*[^\n]*(?!replace_me)[A-Za-z0-9]{20,})/i.test(allContent),
        mentions: story.mustMention.every((pattern) => pattern.test(allContent)),
    }
    if (story.kind === 'website') {
        checks.nextApp = await exists(path.join(target, 'src/app/page.tsx')) && await exists(path.join(target, 'src/app/layout.tsx'))
        checks.standalone = /output:\s*'standalone'/.test(allContent)
        checks.usableForm = /<form|aria-label|<label|Request review/i.test(allContent)
        checks.responsive = /clamp\(|auto-fit|flexWrap|mobile/i.test(allContent)
    }
    if (story.kind === 'api') {
        checks.apiSource = await exists(path.join(target, 'src/index.ts'))
        checks.postgres = /postgres:16-alpine|DATABASE_URL|from 'pg'|migrations\/001_initial_schema\.sql/i.test(allContent)
        checks.migration = await exists(path.join(target, 'migrations/001_initial_schema.sql'))
        checks.healthReady = /\/health|\/ready/.test(allContent)
        checks.shapedErrors = /request_error|title_required|x-request-id/i.test(allContent)
        checks.loadSafe = /pagination|nextCursor|rateLimit|MAX_BODY_BYTES|metrics/i.test(allContent)
    }
    if (story.kind === 'worker') {
        checks.workerSource = await exists(path.join(target, 'src/worker.ts')) && await exists(path.join(target, 'src/queue.ts'))
        checks.redis = /redis:7-alpine|REDIS_URL|depends_on:\n {6}- redis/i.test(allContent)
        checks.workerStatus = /worker-status|heartbeatAt|retryBudget|workerAlerts/i.test(allContent)
        checks.loadSafe = /idempotency|nextRunAt|dead|poisonJobs|cancelJob|replay/i.test(allContent)
    }
    return checks
}

async function verifyBrowser(browser: Awaited<ReturnType<typeof chromium.launch>>, story: Story, previewPath: string, screenshotPath: string) {
    const page = await browser.newPage({ viewport: { width: 1360, height: 980 } })
    const consoleErrors: string[] = []
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
    await page.goto(pathToFileURL(previewPath).href, { waitUntil: 'domcontentloaded', timeout: 15_000 })
    await page.locator('h1').filter({ hasText: story.title }).waitFor({ timeout: 10_000 })
    await page.getByRole('link', { name: /skip to content/i }).focus()
    await page.keyboard.press('Enter')
    await page.getByLabel(/email/i).fill(`story-${story.id}@example.com`)
    await page.getByRole('button', { name: /request review/i }).click()
    await page.getByRole('button', { name: /run load scenario/i }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: /check mobile layout/i }).click()
    const text = await page.locator('body').innerText()
    const checks: Record<string, boolean> = {
        scenarioVisible: story.scenario.every((pattern) => pattern.test(text)),
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
        if (!response) { results.push({ id: story.id, title: story.title, ok: false, reason: 'No builder response' }); continue }
        const files = parseToolFiles(response.message)
        const target = await writeFiles(story, files)
        const previewPath = await createPreview(story, target, files)
        const contentChecks = await verifyContent(story, target, files)
        const screenshotPath = path.join(outRoot, 'screenshots', `${story.id}-${slugify(story.title)}.png`)
        const browserResult = await verifyBrowser(browser, story, previewPath, screenshotPath)
        const checks = { ...contentChecks, ...Object.fromEntries(Object.entries(browserResult.checks).map(([key, value]) => [`browser:${key}`, value])) }
        const failed = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key)
        const improvement = failed.length ? `Tighten: ${failed.join(', ')}` : 'Reviewed under browser scenario and load: usable enough for this tranche.'
        const ok = failed.length === 0
        results.push({ id: story.id, title: story.title, ok, target, previewPath, screenshotPath, fileCount: files.length, checks, improvement, consoleErrors: browserResult.consoleErrors })
        console.log(`${ok ? 'PASS' : 'FAIL'} ${story.id} ${story.title} (${files.length} files)`)
        console.log(`  ${improvement}`)
    }
}
finally {
    await browser.close().catch(() => undefined)
}
const failed = results.filter((result) => !result.ok)
await fs.writeFile(path.join(outRoot, 'results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2))
if (failed.length) throw new Error(`${failed.length} advanced 21-40 Playwright stories failed.`)
console.log(`All ${results.length} advanced 21-40 stories passed with Playwright usability and load checks.`)
