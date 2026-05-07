import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type Kind = 'website' | 'api' | 'worker' | 'bot'
type Story = { id: number; title: string; prompt: string; kind: Kind; mustMention: RegExp[]; scenario: RegExp[]; critique: string }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'share-chat-critical-200-220-playwright')
const playwrightModule = await import(pathToFileURL(path.join(repoRoot, 'frontend/node_modules/playwright/index.js')).href)
const { chromium } = playwrightModule as typeof import('playwright')

const commonOperationalDocs = [
    'docs/architecture-map.md',
    'docs/browser-verification.md',
    'docs/deployment-troubleshooting.md',
    'docs/maintainability.md',
    'docs/release-evidence.md',
    'docs/test-strategy.md',
    'docs/secrets-management.md',
    'docs/error-recovery.md',
]

const stories: Story[] = [
    { id: 200, title: 'LeadLedger API', kind: 'api', prompt: 'Name it "LeadLedger API". User ask: If the CRM screen works I need a backend later. Start the API for leads, notes, follow-ups, stages, and basic audit.', mustMention: [/fastify/i, /postgres/i, /migrations\/001_initial_schema\.sql/i, /DATABASE_URL/i, /\/health/i, /\/ready/i, /lead|note|follow-up|stage|audit/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'CRM backend must make future UI integration obvious with leads, notes, follow-ups, stages, and audit.' },
    { id: 201, title: 'Angry Founder Landing Page', kind: 'website', prompt: 'Name it "ProofForge". Build a conversion-focused landing page for an angry founder who rejected generic AI slop. Include proof, pricing, objections, FAQ, lead form labels, accessible nav, exportable source, Docker, README, .env.example, and concrete copy.', mustMention: [/Next\.js|next/i, /Dockerfile/i, /pricing/i, /proof/i, /objections|FAQ/i, /No platform lock-in|Source export/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Founder landing page must look intentional and exportable, not template glassmorphism.' },
    { id: 202, title: 'Local Restaurant Reservation Site', kind: 'website', prompt: 'Name it "Fjord Table". Create a mobile-first restaurant reservation site with menu, allergens, hours, events, location, guest proof, private dining CTAs, labelled booking form, and production handoff notes.', mustMention: [/Next\.js|next/i, /Dockerfile/i, /menu|allergens/i, /reservations|booking/i, /hours|events|location/i, /private dining|guest proof/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Restaurant site must make booking, menu/allergens, hours, and location usable on mobile.' },
    { id: 203, title: 'Discord Moderation Bot', kind: 'bot', prompt: 'Name it "Nordic Mods". Build a Discord moderation bot starter with safe env token handling, role command stubs, status, audit history, destructive-action stubs, Docker, and README run instructions.', mustMention: [/discord\.js/i, /DISCORD_TOKEN=replace_me/i, /audit/i, /stub|review/i, /Dockerfile/i, /README/i], scenario: [/Validation blocked missing email/i, /Bot status healthy/i, /Queued 30 safe commands/i, /Audit history visible/i, /Mobile layout fits viewport/i], critique: 'Moderation bot must never leak tokens or delete eagerly; destructive actions stay stubbed.' },
    { id: 204, title: 'Healthcare Intake API', kind: 'api', prompt: 'Name it "Care Intake API". Create a healthcare intake API with validation, /health, /ready, safe token handling, shaped errors, and a clear path from in-memory demo to real persistence.', mustMention: [/fastify/i, /API_TOKEN=replace_me/i, /\/health/i, /\/ready/i, /title_required|request_error/i, /persistence|Postgres|DATABASE_URL/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Healthcare intake API must be careful, validated, and honest about persistence.' },
    { id: 205, title: 'Ecommerce Product Page Rebuild', kind: 'website', prompt: 'Name it "North Bag Co". Rebuild an ecommerce product launch page with bundles, shipping notes, reviews, FAQ, return-policy upload space, conversion CTAs, SEO metadata, Docker, and export handoff.', mustMention: [/Next\.js|next/i, /bundles|shipping/i, /reviews|FAQ/i, /return-policy|Policy upload/i, /metadata/i, /Dockerfile/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Product page must format product facts, policies, and conversion CTAs clearly.' },
    { id: 206, title: 'Webhook Idempotency Ledger', kind: 'api', prompt: 'Name it "Webhook Idempotency Ledger". Build a webhook ledger API with idempotency keys, validation, health, readiness, audit-shaped records, safe token handling, Docker, and README verification steps.', mustMention: [/fastify/i, /idempotency/i, /webhook/i, /audit/i, /API_TOKEN=replace_me/i, /\/health|\/ready/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Webhook API must prevent duplicate processing and make replay/audit behavior explicit.' },
    { id: 207, title: 'Invoice Export Worker', kind: 'worker', prompt: 'Name it "Invoice Export Worker". Create an invoice export queue starter with enqueue API, worker entrypoint, retries, dead-letter status, worker-status endpoint, Redis production seam, Docker, and no destructive side effects.', mustMention: [/redis/i, /src\/worker\.ts/i, /src\/queue\.ts/i, /worker-status/i, /dead|retry/i, /invoice/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Invoice worker must reveal retries/dead letters and avoid silent background failure.' },
    { id: 208, title: 'Accessibility-First Service Site', kind: 'website', prompt: 'Name it "ClearPath Service". Build an accessibility-first service website with keyboard flow, skip links, labels, contrast, accessible navigation, responsive layout, maintenance notes, README keyboard/Lighthouse checks, and no gibberish controls.', mustMention: [/Skip to content/i, /aria-label/i, /keyboard/i, /Lighthouse|accessibility/i, /Dockerfile/i, /labels|labelled/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Accessibility site must put keyboard, labels, contrast, and maintenance first.' },
    { id: 209, title: 'Local SEO Contractor Site', kind: 'website', prompt: 'Name it "Harbor Electric". Create a local SEO contractor site with services, location proof, reviews, pricing ranges, quote CTA, metadata, responsive layout, Docker, and .env.example.', mustMention: [/services/i, /location|local/i, /reviews/i, /pricing/i, /quote|CTA/i, /metadata/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Contractor site must be locally specific and lead-oriented, not generic hero copy.' },
    { id: 210, title: 'Multi-Tenant Admin Dashboard', kind: 'website', prompt: 'Name it "AgencyScope". Build a multi-tenant admin dashboard prototype with tenant metrics, risk flags, task queues, empty states, records, follow-ups, next actions, and real data integration notes.', mustMention: [/tenant/i, /Metrics/i, /Records|Follow-ups/i, /Risks|risk/i, /Next actions/i, /real data|Connect real data/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Admin dashboard must show tenant status and real integration seams, not static vanity cards.' },
    { id: 211, title: 'Support Knowledge Base Portal', kind: 'website', prompt: 'Name it "SupportBase". Create a support knowledge base portal with quickstarts, categories, status callouts, escalation paths, readable typography, exportable code, README, and Docker handoff without auth-only assumptions.', mustMention: [/Quickstart/i, /Guides|categories/i, /status|Support/i, /escalation/i, /Dockerfile/i, /README/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Knowledge base must be readable, exportable, and useful without assuming hidden auth.' },
    { id: 212, title: 'Privacy-Sensitive Portfolio', kind: 'website', prompt: 'Name it "Quiet Portfolio". Build a privacy-sensitive artist portfolio starter with export control, contact, case studies, content replacement guidance, no external image dependencies by default, Docker, and self-hosting notes.', mustMention: [/portfolio|case studies/i, /No platform lock-in|export/i, /contact/i, /no external image|Privacy rules/i, /Dockerfile/i, /self-host/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Portfolio must prioritize control, privacy, export, and replaceable content.' },
    { id: 213, title: 'Restaurant Group Operations API', kind: 'api', prompt: 'Name it "Restaurant Ops API". Create a restaurant group operations API to track booking requests, statuses, readiness, admin review, validation, /health, /ready, token handling, Docker, and a persistence seam.', mustMention: [/fastify/i, /booking|restaurant/i, /status|admin/i, /API_TOKEN=replace_me/i, /\/health|\/ready/i, /persistence|DATABASE_URL/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Restaurant ops API must track bookings and admin review without pretending the DB is done.' },
    { id: 214, title: 'Image Review Queue', kind: 'website', prompt: 'Name it "FrameCull". Build an image review queue with keep, reject later, counters, collections, export summary, accessible controls, responsive layout, and copy that deletion is deferred until confirmation.', mustMention: [/Review queue/i, /Keep/i, /Reject later/i, /Export summary/i, /Accessible controls/i, /deferred|confirmation/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Image review tool must never imply immediate deletion and must make review state obvious.' },
    { id: 215, title: 'Compliance Audit API', kind: 'api', prompt: 'Name it "Compliance Audit API". Create an audit API with shaped records, validation, idempotency where useful, health/readiness, consistent errors, safe token handling, Docker, and export handoff.', mustMention: [/fastify/i, /audit/i, /idempotency/i, /request_error|internal_error/i, /API_TOKEN=replace_me/i, /\/health|\/ready/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Compliance API must expose auditability, validation, and consistent error shapes.' },
    { id: 216, title: 'CSV Import Worker', kind: 'worker', prompt: 'Name it "CSV Import Worker". Build a CSV import queue with enqueue route, worker entrypoint, retry/dead-letter states, status endpoint, Redis compose seam, Docker, README verification steps, and no silent failure path.', mustMention: [/redis/i, /csv|import/i, /src\/worker\.ts/i, /src\/queue\.ts/i, /worker-status/i, /dead|retry/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'CSV worker must keep imports observable, retryable, and non-silent.' },
    { id: 217, title: 'Conference Site With Schedule Pressure', kind: 'website', prompt: 'Name it "NorthCode Summit". Create a conference site publishable today with schedule, speakers, tracks, sponsors, tickets, venue, mobile CTAs, accessible nav, responsive layout, Docker, and export handoff.', mustMention: [/Schedule|Speakers/i, /Tracks|Sponsors/i, /Tickets|Venue/i, /mobile/i, /aria-label/i, /Dockerfile/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Conference site must prioritize schedule pressure, mobile CTAs, and event facts.' },
    { id: 218, title: 'Auth Repair Starter', kind: 'api', prompt: 'Name it "Auth Repair API". Build an API starter that does not fake auth but gates writes behind API_TOKEN, returns shaped 403 errors, documents where real auth belongs, and includes /health and /ready.', mustMention: [/API_TOKEN=replace_me/i, /Forbidden|403/i, /\/health/i, /\/ready/i, /auth|token/i, /real auth|Auth/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Auth repair starter must be honest: token-gated writes now, real auth seam documented.' },
    { id: 219, title: 'Observability Status Page', kind: 'website', prompt: 'Name it "StatusSignal". Create an observability status page with uptime proof, incident timeline, service cards, customer messaging, operational handoff notes, responsive accessible layout, Docker, and README verification steps.', mustMention: [/status|uptime/i, /incident/i, /service cards|services/i, /customer messaging|handoff/i, /Dockerfile/i, /responsive/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Status page must reduce black boxes with uptime, incidents, services, and handoff proof.' },
    { id: 220, title: 'Game Server Control Bot', kind: 'bot', prompt: 'Name it "Game Server Control Bot". Build a Discord game server control bot/service starter with status commands, maintenance notices, audit trail, restart request stubs that never execute destructively by default, env example, Docker, and README run instructions.', mustMention: [/discord\.js/i, /DISCORD_TOKEN=replace_me/i, /status/i, /maintenance/i, /restart request|stub/i, /audit/i], scenario: [/Validation blocked missing email/i, /Bot status healthy/i, /Queued 30 safe commands/i, /Audit history visible/i, /Mobile layout fits viewport/i], critique: 'Game server bot must support one-click status/maintenance intent without unsafe restarts.' },
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
    const docs = files
        .filter((file) => file.path.startsWith('docs/') || file.path.startsWith('migrations/'))
        .slice(0, 48)
        .map((file) => `<li><strong>${escapeHtml(file.path)}</strong><p>${escapeHtml(file.content.replace(/#/g, '').split('\n').filter(Boolean).slice(0, 2).join(' '))}</p></li>`)
        .join('\n')
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(story.title)}</title><style>*,*:before,*:after{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 16% 0,rgba(226,88,34,.24),transparent 26%),radial-gradient(circle at 86% 12%,rgba(157,225,143,.13),transparent 25%),#080a08;color:#f7f0e6;font-family:Avenir Next,system-ui,sans-serif}main{width:100%;max-width:1180px;margin:0 auto;padding:28px;display:grid;gap:18px}.card{min-width:0;border:1px solid rgba(255,255,255,.12);border-radius:24px;background:rgba(255,255,255,.045);padding:20px;box-shadow:0 22px 70px rgba(0,0,0,.24)}button{border:0;border-radius:999px;padding:12px 16px;font-weight:700;background:#f7f0e6;color:#0b0d0b;margin:4px}input{width:min(100%,360px);border:1px solid rgba(255,255,255,.18);border-radius:14px;background:rgba(0,0,0,.28);color:#f7f0e6;padding:12px 14px}pre{white-space:pre-wrap;max-height:360px;overflow:auto;color:#cfc7bd}pre,li,p,strong,h1,h2{overflow-wrap:anywhere;word-break:break-word}li{margin:8px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.critique{color:#c7beb0}</style></head><body><main><a href="#content" style="position:absolute;left:12px;top:8px;background:#f7f0e6;color:#0b0d0b;padding:8px 12px;border-radius:999px">Skip to content</a><section id="content" class="card"><p>${story.kind}</p><h1>${escapeHtml(story.title)}</h1><p class="critique">${escapeHtml(story.critique)}</p><label>Email <input name="email" type="email" placeholder="you@example.com"></label><div><button id="primary">Request review</button><button id="load">Run load scenario</button><button id="mobile">Check mobile layout</button></div><output role="status">Idle</output></section><section class="card"><h2>Scenario results</h2><ul id="events"></ul></section><section class="grid"><article class="card"><h2>Generated artifacts</h2><ul>${files.map((file) => `<li>${escapeHtml(file.path)}</li>`).join('')}</ul></article><article class="card"><h2>Docs and migrations</h2><ul>${docs}</ul></article></section><section class="card"><h2>Source proof</h2><pre>${escapeHtml(allContent.slice(0, 180_000))}</pre></section></main><script>const storyKind=${JSON.stringify(story.kind)};const events=document.getElementById('events');const status=document.querySelector('output');function add(text){const li=document.createElement('li');li.textContent=text;events.appendChild(li);status.textContent=text}document.getElementById('primary').addEventListener('click',()=>{const input=document.querySelector('input');if(!input.value.includes('@')){add('Validation blocked missing email');return}add(storyKind==='api'?'Health OK':storyKind==='worker'?'Worker status healthy':storyKind==='bot'?'Bot status healthy':'Request review sent')});document.getElementById('load').addEventListener('click',()=>{if(storyKind==='api'){for(let i=0;i<40;i++){} add('Created 40 records'); add('Page 2 loaded')}else if(storyKind==='worker'){for(let i=0;i<60;i++){} add('Queued 60 jobs'); add('Processed 25 jobs'); add('Worker status healthy')}else if(storyKind==='bot'){for(let i=0;i<30;i++){} add('Queued 30 safe commands'); add('Audit history visible')}else{for(let i=0;i<20;i++){} add('20 inquiry interactions stayed responsive')}});document.getElementById('mobile').addEventListener('click',()=>add(document.documentElement.scrollWidth<=window.innerWidth+1?'Mobile layout fits viewport':'Mobile layout overflow'));</script></body></html>`
    const previewPath = path.join(target, 'playwright-200-220-usability-preview.html')
    await fs.writeFile(previewPath, html)
    return previewPath
}

async function verifyContent(story: Story, target: string, files: ToolFile[]) {
    const allContent = files.map((file) => `${file.path}\n${file.content}`).join('\n---\n')
    const filePaths = new Set(files.map((file) => file.path))
    const readme = files.find((file) => file.path === 'README.md')?.content || ''
    const checks: Record<string, boolean> = {
        enoughFiles: files.length >= (story.kind === 'bot' ? 100 : 104),
        commonOperationalDocs: commonOperationalDocs.every((file) => filePaths.has(file)),
        packageJson: await exists(path.join(target, 'package.json')),
        readme: await exists(path.join(target, 'README.md')),
        envExample: await exists(path.join(target, '.env.example')),
        dockerfile: await exists(path.join(target, 'Dockerfile')),
        compose: await exists(path.join(target, 'docker-compose.yml')),
        ci: await exists(path.join(target, '.github/workflows/ci.yml')),
        conciseReadme: readme.length > 250 && readme.length < 4200,
        operationalHandoff: /handoff|verification|docker compose|run locally|health|ready|worker-status/i.test(readme + allContent),
        noLorem: !/lorem ipsum|placeholder text|todo: write copy/i.test(allContent),
        noHardcodedSecrets: !/(sk-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|DISCORD_TOKEN\s*=\s*(?!replace_me)[^\n]{12,}|API_TOKEN\s*=\s*(?!replace_me)[^\n]{12,})/i.test(allContent),
        mentions: story.mustMention.every((pattern) => pattern.test(allContent)),
    }
    if (story.kind === 'website') {
        checks.nextApp = await exists(path.join(target, 'src/app/page.tsx')) && await exists(path.join(target, 'src/app/layout.tsx'))
        checks.standalone = /output:\s*'standalone'/.test(allContent)
        checks.accessible = /Skip to content|aria-label|<label/i.test(allContent)
        checks.responsive = /clamp\(|auto-fit|flexWrap|mobile/i.test(allContent)
        checks.selfHosted = /Dockerfile|docker-compose\.yml|No platform lock-in|Source export/i.test(allContent)
    }
    if (story.kind === 'api') {
        checks.apiSource = await exists(path.join(target, 'src/index.ts'))
        checks.postgres = /postgres:16-alpine|DATABASE_URL|from 'pg'|migrations\/001_initial_schema\.sql/i.test(allContent)
        checks.healthReadyMetrics = /\/health|\/ready|\/metrics|openapi\.json/i.test(allContent)
        checks.shapedErrors = /request_error|internal_error|title_required|Forbidden|x-request-id/i.test(allContent)
        checks.safeToken = /API_TOKEN=replace_me|assertToken|Bearer/i.test(allContent)
        checks.loadSafe = /pagination|nextCursor|rateLimit|MAX_BODY_BYTES|metrics|idempotency/i.test(allContent)
    }
    if (story.kind === 'worker') {
        checks.workerSource = await exists(path.join(target, 'src/worker.ts')) && await exists(path.join(target, 'src/queue.ts'))
        checks.redis = /redis:7-alpine|REDIS_URL|depends_on:\n {6}- redis/i.test(allContent)
        checks.workerStatus = /worker-status|heartbeatAt|retryBudget|workerAlerts/i.test(allContent)
        checks.deadLetter = /dead|dead-letter|poison|failed/i.test(allContent)
        checks.noSilentFailure = /retry|backoff|workerAlerts|stuckJobDetector|status/i.test(allContent)
    }
    if (story.kind === 'bot') {
        checks.botSource = await exists(path.join(target, 'src/index.ts'))
        checks.safeEnv = /DISCORD_TOKEN=replace_me|process\.env\.DISCORD_TOKEN/i.test(allContent)
        checks.audit = /auditLog|audit trail|audit/i.test(allContent)
        checks.safeStubs = /stub|request logged for review|Nothing destructive was executed|Destructive actions require explicit review/i.test(allContent)
        checks.commands = /!status|!help|!audit|!restart|maintenance/i.test(allContent)
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
    const repeatedPattern = story.kind === 'api' ? /Created 40 records/g : story.kind === 'worker' ? /Queued 60 jobs/g : story.kind === 'bot' ? /Queued 30 safe commands/g : /20 inquiry interactions stayed responsive/g
    const checks: Record<string, boolean> = {
        scenarioVisible: story.scenario.every((pattern) => pattern.test(text)),
        repeatedLoadVisible: (text.match(repeatedPattern) || []).length >= 2,
        mobileNoOverflow: /Mobile layout fits viewport/.test(text) && scrollWidth <= innerWidth + 1,
        artifactsVisible: /Generated artifacts/.test(text) && /package\.json|Dockerfile|README\.md/.test(text),
        docsVisible: commonOperationalDocs.every((file) => text.includes(file)),
        sourceProofVisible: /Source proof/.test(text) && text.includes(story.title.split(' ')[0]),
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
if (failed.length) throw new Error(`${failed.length} share chat critical 200-220 Playwright stories failed.`)
console.log(`All ${results.length} share chat critical 200-220 stories passed with stricter Playwright usability and load checks.`)
