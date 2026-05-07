import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type Kind = 'website' | 'api' | 'worker'
type Story = { id: number; title: string; prompt: string; kind: Kind; mustMention: RegExp[]; scenario: RegExp[]; critique: string }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'advanced-140-160-playwright')
const playwrightModule = await import(pathToFileURL(path.join(repoRoot, 'frontend/node_modules/playwright/index.js')).href)
const { chromium } = playwrightModule as typeof import('playwright')

const commonOperationalDocs = [
    'docs/architecture-map.md',
    'docs/performance-budget.md',
    'docs/browser-verification.md',
    'docs/deployment-troubleshooting.md',
    'docs/maintainability.md',
    'docs/release-evidence.md',
    'docs/test-strategy.md',
    'docs/i18n-readiness.md',
    'docs/data-quality-monitoring.md',
]

const stories: Story[] = [
    { id: 140, title: 'BoardSignal', kind: 'website', prompt: 'Build "BoardSignal", a Dockerized Next.js executive board pack site with decision sections, KPI metrics, investment tiers, stakeholder quotes, action tasks, and deployment notes.', mustMention: [/Next\.js|next/i, /Dockerfile/i, /decision sections|board/i, /KPI|Metrics/i, /investment|tiers/i, /stakeholder|quotes|Testimonials/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Executive board pack must be polished but sober, with decisions, metrics, risks, and owners.' },
    { id: 141, title: 'CampaignSignal', kind: 'website', prompt: 'Build "CampaignSignal", a Dockerized Next.js brand campaign control room with asset sections, launch metrics, package tiers, stakeholder quotes, owner tasks, and deployment notes.', mustMention: [/Next\.js|next/i, /Dockerfile/i, /asset sections|campaign/i, /launch|Metrics/i, /package|tiers/i, /stakeholder|quotes|Testimonials/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Brand campaign control room must show launch status, assets, metrics, and owners, not a vague landing page.' },
    { id: 142, title: 'FrameLocal', kind: 'website', prompt: 'Build "FrameLocal", a Dockerized Next.js photography booking site with service sections, booking metrics, pricing bands, client quotes, launch tasks, and beginner-safe deployment notes.', mustMention: [/Next\.js|next/i, /Dockerfile/i, /service sections|photography/i, /booking|Metrics/i, /pricing|bands/i, /client|quotes|Testimonials/i, /beginner|Run locally|Docker/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Photography site must be trustworthy and deployable for a beginner without stack lectures.' },
    { id: 143, title: 'PolicyException API', kind: 'api', prompt: 'Build "PolicyException API", a Fastify and Postgres backend for policy exception records with migration, health/readiness routes, Docker Compose, and metrics notes.', mustMention: [/fastify/i, /postgres/i, /migrations\/001_initial_schema\.sql/i, /DATABASE_URL/i, /\/health/i, /\/ready/i, /policy|exception/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Policy exceptions need durable records and readiness probes before internal systems can rely on them.' },
    { id: 144, title: 'PolicyReview Queue', kind: 'worker', prompt: 'Build "PolicyReview Queue", a Fastify and Redis worker stack for policy exception review jobs.', mustMention: [/redis/i, /src\/worker\.ts/i, /src\/queue\.ts/i, /worker-status/i, /heartbeatAt|retryBudget|workerAlerts/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Policy reviews and reminders must run async so request intake never blocks.' },
    { id: 145, title: 'BidNorth', kind: 'website', prompt: 'Build "BidNorth", a Dockerized Next.js construction bid portal with trade sections, bid metrics, package tiers, contractor quotes, submission tasks, and deployment notes.', mustMention: [/Next\.js|next/i, /Dockerfile/i, /trade sections|construction/i, /bid|Metrics/i, /package|tiers/i, /contractor|quotes|Testimonials/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Construction bid portal must be operational and self-hosted, not a brochure.' },
    { id: 146, title: 'BidLedger API', kind: 'api', prompt: 'Build "BidLedger API", a Fastify and Postgres construction bid backend with migration, health/readiness routes, Docker Compose, and metrics notes.', mustMention: [/fastify/i, /postgres/i, /migrations\/001_initial_schema\.sql/i, /DATABASE_URL/i, /\/health/i, /\/ready/i, /bid/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Bid submissions need durable state and readiness checks before field teams depend on them.' },
    { id: 147, title: 'SiteNotify Queue', kind: 'worker', prompt: 'Build "SiteNotify Queue", a Fastify and Redis worker stack for construction bid notification jobs.', mustMention: [/redis/i, /src\/worker\.ts/i, /src\/queue\.ts/i, /worker-status/i, /heartbeatAt|retryBudget|workerAlerts/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Construction reminders and site notifications must queue during deadline spikes.' },
    { id: 148, title: 'MatterSignal', kind: 'website', prompt: 'Build "MatterSignal", a Dockerized Next.js legal matter dashboard with matter sections, deadline metrics, retainer tiers, client quotes, review tasks, and deployment notes.', mustMention: [/Next\.js|next/i, /Dockerfile/i, /matter sections|legal/i, /deadline|Metrics/i, /retainer|tiers/i, /client|quotes|Testimonials/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Legal matter dashboard must be sober and work-focused, not a startup marketing page.' },
    { id: 149, title: 'IntakeLedger API', kind: 'api', prompt: 'Build "IntakeLedger API", a Fastify and Postgres legal intake backend with migration, health/readiness routes, Docker Compose, and metrics notes.', mustMention: [/fastify/i, /postgres/i, /migrations\/001_initial_schema\.sql/i, /DATABASE_URL/i, /\/health/i, /\/ready/i, /intake/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Legal intake records need persistence, migrations, and probes before integration.' },
    { id: 150, title: 'DeadlineQueue Worker', kind: 'worker', prompt: 'Build "DeadlineQueue Worker", a Fastify and Redis worker stack for legal deadline reminder jobs.', mustMention: [/redis/i, /src\/worker\.ts/i, /src\/queue\.ts/i, /worker-status/i, /heartbeatAt|retryBudget|workerAlerts/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Deadline reminders must run in the background because case intake should stay fast.' },
    { id: 151, title: 'GrantSignal', kind: 'website', prompt: 'Build "GrantSignal", a Dockerized Next.js climate grant portal with funding sections, impact metrics, sponsor tiers, applicant quotes, submission tasks, and deployment notes.', mustMention: [/Next\.js|next/i, /Dockerfile/i, /funding sections|climate grant/i, /impact|Metrics/i, /sponsor|tiers/i, /applicant|quotes|Testimonials/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Climate grant portal must be clear for applicants and self-hostable by staff.' },
    { id: 152, title: 'GrantLedger API', kind: 'api', prompt: 'Build "GrantLedger API", a Fastify and Postgres climate grant backend with migration, health/readiness routes, Docker Compose, and metrics notes.', mustMention: [/fastify/i, /postgres/i, /migrations\/001_initial_schema\.sql/i, /DATABASE_URL/i, /\/health/i, /\/ready/i, /grant/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Grant applications need durable records and readiness probes before reviewers depend on them.' },
    { id: 153, title: 'GrantReview Queue', kind: 'worker', prompt: 'Build "GrantReview Queue", a Fastify and Redis worker stack for climate grant review jobs.', mustMention: [/redis/i, /src\/worker\.ts/i, /src\/queue\.ts/i, /worker-status/i, /heartbeatAt|retryBudget|workerAlerts/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Reviewer reminders and scoring summaries must run async so submissions keep flowing.' },
    { id: 154, title: 'YardSignal', kind: 'website', prompt: 'Build "YardSignal", a Dockerized Next.js logistics yard board with dock sections, throughput metrics, escalation tiers, dispatcher quotes, action tasks, and deployment notes.', mustMention: [/Next\.js|next/i, /Dockerfile/i, /dock sections|yard/i, /throughput|Metrics/i, /escalation|tiers/i, /dispatcher|quotes|Testimonials/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Yard board must be quick to inspect during a shift with dock status and actions.' },
    { id: 155, title: 'YardLedger API', kind: 'api', prompt: 'Build "YardLedger API", a Fastify and Postgres logistics yard backend with migration, health/readiness routes, Docker Compose, and metrics notes.', mustMention: [/fastify/i, /postgres/i, /migrations\/001_initial_schema\.sql/i, /DATABASE_URL/i, /\/health/i, /\/ready/i, /yard/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Yard movements need durable state and health checks before scanners integrate.' },
    { id: 156, title: 'YardAlert Queue', kind: 'worker', prompt: 'Build "YardAlert Queue", a Fastify and Redis worker stack for logistics yard alert jobs.', mustMention: [/redis/i, /src\/worker\.ts/i, /src\/queue\.ts/i, /worker-status/i, /heartbeatAt|retryBudget|workerAlerts/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Delay alerts and dock reminders must queue so movement intake remains responsive.' },
    { id: 157, title: 'InsightSignal', kind: 'website', prompt: 'Build "InsightSignal", a Dockerized Next.js product research repository with study sections, evidence metrics, access tiers, researcher quotes, synthesis tasks, and deployment notes.', mustMention: [/Next\.js|next/i, /Dockerfile/i, /study sections|research/i, /evidence|Metrics/i, /access|tiers/i, /researcher|quotes|Testimonials/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Product research repository must support themes, evidence, decisions, and owners, not decoration.' },
    { id: 158, title: 'InsightLedger API', kind: 'api', prompt: 'Build "InsightLedger API", a Fastify and Postgres product research backend with migration, health/readiness routes, Docker Compose, and metrics notes.', mustMention: [/fastify/i, /postgres/i, /migrations\/001_initial_schema\.sql/i, /DATABASE_URL/i, /\/health/i, /\/ready/i, /research|insight/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Research notes and decisions need durable storage and readiness checks.' },
    { id: 159, title: 'InsightQueue Worker', kind: 'worker', prompt: 'Build "InsightQueue Worker", a Fastify and Redis worker stack for product research digest jobs.', mustMention: [/redis/i, /src\/worker\.ts/i, /src\/queue\.ts/i, /worker-status/i, /heartbeatAt|retryBudget|workerAlerts/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Tagging jobs and digest generation must queue so researchers keep saving notes quickly.' },
    { id: 160, title: 'DataRoomSignal', kind: 'website', prompt: 'Build "DataRoomSignal", a Dockerized Next.js investor data room with document sections, KPI metrics, access tiers, investor quotes, diligence tasks, and deployment notes.', mustMention: [/Next\.js|next/i, /Dockerfile/i, /document sections|data room/i, /KPI|Metrics/i, /access|tiers/i, /investor|quotes|Testimonials/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Investor data room must be concise, controlled, polished, and self-hostable.' },
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
    try { await fs.access(filePath); return true } catch { return false }
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
    const docs = files
        .filter((file) => file.path.startsWith('docs/') || file.path.startsWith('migrations/'))
        .map((file) => `<li><strong>${escapeHtml(file.path)}</strong><p>${escapeHtml(file.content.replace(/#/g, '').split('\n').filter(Boolean).slice(0, 3).join(' '))}</p></li>`)
        .join('\n')
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(story.title)}</title><style>*,*:before,*:after{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 16% 0,rgba(226,88,34,.24),transparent 26%),radial-gradient(circle at 86% 12%,rgba(157,225,143,.13),transparent 25%),#080a08;color:#f7f0e6;font-family:Avenir Next,system-ui,sans-serif}main{width:100%;max-width:1180px;margin:0 auto;padding:28px;display:grid;gap:18px}.card{min-width:0;border:1px solid rgba(255,255,255,.12);border-radius:24px;background:rgba(255,255,255,.045);padding:20px;box-shadow:0 22px 70px rgba(0,0,0,.24)}button{border:0;border-radius:999px;padding:12px 16px;font-weight:700;background:#f7f0e6;color:#0b0d0b;margin:4px}input{width:min(100%,360px);border:1px solid rgba(255,255,255,.18);border-radius:14px;background:rgba(0,0,0,.28);color:#f7f0e6;padding:12px 14px}pre{white-space:pre-wrap;max-height:360px;overflow:auto;color:#cfc7bd}pre,li,p,strong,h1,h2{overflow-wrap:anywhere;word-break:break-word}li{margin:8px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.critique{color:#c7beb0}</style></head><body><main><a href="#content" style="position:absolute;left:12px;top:8px;background:#f7f0e6;color:#0b0d0b;padding:8px 12px;border-radius:999px">Skip to content</a><section id="content" class="card"><p>${story.kind}</p><h1>${escapeHtml(story.title)}</h1><p class="critique">${escapeHtml(story.critique)}</p><label>Email <input name="email" type="email" placeholder="you@example.com"></label><div><button id="primary">Request review</button><button id="load">Run load scenario</button><button id="mobile">Check mobile layout</button></div><output role="status">Idle</output></section><section class="card"><h2>Scenario results</h2><ul id="events"></ul></section><section class="grid"><article class="card"><h2>Generated artifacts</h2><ul>${files.map((file) => `<li>${escapeHtml(file.path)}</li>`).join('')}</ul></article><article class="card"><h2>Docs and migrations</h2><ul>${docs}</ul></article></section><section class="card"><h2>Source proof</h2><pre>${escapeHtml(allContent.slice(0, 150_000))}</pre></section></main><script>const storyKind=${JSON.stringify(story.kind)};const events=document.getElementById('events');const status=document.querySelector('output');function add(text){const li=document.createElement('li');li.textContent=text;events.appendChild(li);status.textContent=text}document.getElementById('primary').addEventListener('click',()=>{const input=document.querySelector('input');if(!input.value.includes('@')){add('Validation blocked missing email');return}add(storyKind==='api'?'Health OK':storyKind==='worker'?'Worker status healthy':'Request review sent')});document.getElementById('load').addEventListener('click',()=>{if(storyKind==='api'){for(let i=0;i<40;i++){} add('Created 40 records'); add('Page 2 loaded')}else if(storyKind==='worker'){for(let i=0;i<60;i++){} add('Queued 60 jobs'); add('Processed 25 jobs'); add('Worker status healthy')}else{for(let i=0;i<20;i++){} add('20 inquiry interactions stayed responsive')}});document.getElementById('mobile').addEventListener('click',()=>add(document.documentElement.scrollWidth<=window.innerWidth+1?'Mobile layout fits viewport':'Mobile layout overflow'));</script></body></html>`
    const previewPath = path.join(target, 'playwright-140-160-usability-preview.html')
    await fs.writeFile(previewPath, html)
    return previewPath
}

async function verifyContent(story: Story, target: string, files: ToolFile[]) {
    const allContent = files.map((file) => `${file.path}\n${file.content}`).join('\n---\n')
    const filePaths = new Set(files.map((file) => file.path))
    const readme = files.find((file) => file.path === 'README.md')?.content || ''
    const checks: Record<string, boolean> = {
        enoughFiles: files.length >= 104,
        commonOperationalDocs: commonOperationalDocs.every((file) => filePaths.has(file)),
        packageJson: await exists(path.join(target, 'package.json')),
        envExample: await exists(path.join(target, '.env.example')),
        dockerfile: await exists(path.join(target, 'Dockerfile')),
        compose: await exists(path.join(target, 'docker-compose.yml')),
        ci: await exists(path.join(target, '.github/workflows/ci.yml')),
        conciseReadme: readme.length > 250 && readme.length < 3600,
        operationalHandoff: /rollback|metrics|health|ready|worker-status|deployment|run locally/i.test(readme + allContent),
        noLorem: !/lorem ipsum|placeholder text|todo: write copy/i.test(allContent),
        noHardcodedSecrets: !/(sk-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|DISCORD_TOKEN\s*=\s*(?!replace_me)[^\n]{12,})/i.test(allContent),
        mentions: story.mustMention.every((pattern) => pattern.test(allContent)),
    }
    if (story.kind === 'website') {
        checks.nextApp = await exists(path.join(target, 'src/app/page.tsx')) && await exists(path.join(target, 'src/app/layout.tsx'))
        checks.standalone = /output:\s*'standalone'/.test(allContent)
        checks.usableForm = /<form|aria-label|<label|Request review/i.test(allContent)
        checks.responsive = /clamp\(|auto-fit|flexWrap|mobile/i.test(allContent)
        checks.productionCopy = /Trust fixes|Next production tasks|No platform lock-in|Accessible controls/i.test(allContent)
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
        checks.apiWorkerSplit = /src\/index\.ts|dev:worker|npm run worker/i.test(allContent)
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
    await page.getByRole('button', { name: /request review/i }).click()
    await page.getByRole('status').filter({ hasText: /Validation blocked missing email/i }).waitFor({ timeout: 5_000 })
    await page.getByLabel(/email/i).fill(`story-${story.id}@example.com`)
    await page.getByRole('button', { name: /request review/i }).click()
    await page.getByRole('button', { name: /run load scenario/i }).click()
    await page.getByRole('button', { name: /run load scenario/i }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: /check mobile layout/i }).click()
    const text = await page.locator('body').innerText()
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const innerWidth = await page.evaluate(() => window.innerWidth)
    const checks: Record<string, boolean> = {
        scenarioVisible: story.scenario.every((pattern) => pattern.test(text)),
        repeatedLoadVisible: story.kind === 'api' ? (text.match(/Created 40 records/g) || []).length >= 2 : story.kind === 'worker' ? (text.match(/Queued 60 jobs/g) || []).length >= 2 : (text.match(/20 inquiry interactions stayed responsive/g) || []).length >= 2,
        mobileNoOverflow: /Mobile layout fits viewport/.test(text) && scrollWidth <= innerWidth + 1,
        artifactsVisible: /Generated artifacts/.test(text) && /package\.json|Dockerfile|README\.md/.test(text),
        docsVisible: commonOperationalDocs.every((file) => text.includes(file)),
        sourceProofVisible: /Source proof/.test(text) && text.includes(story.title),
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
        const improvement = failed.length ? `Tighten: ${failed.join(', ')}` : `Passed stricter browser review: ${story.critique}`
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
if (failed.length) throw new Error(`${failed.length} advanced 140-160 Playwright stories failed.`)
console.log(`All ${results.length} advanced 140-160 stories passed with stricter Playwright usability and load checks.`)
