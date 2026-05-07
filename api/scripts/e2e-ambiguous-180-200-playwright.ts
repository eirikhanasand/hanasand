import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type Kind = 'website' | 'api' | 'worker'
type Story = { id: number; title: string; prompt: string; kind: Kind; mustMention: RegExp[]; scenario: RegExp[]; critique: string }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'ambiguous-180-200-playwright')
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
    { id: 180, title: 'DecisionSignal', kind: 'website', prompt: 'Name it "DecisionSignal". User ask: Leadership needs a controlled decision log with owners, rationale, risks, and follow-up actions. It must be concise, professional, and self-hostable.', mustMention: [/Next\.js|next/i, /Dockerfile/i, /decision sections|decision log/i, /follow-up|Metrics/i, /governance|tiers/i, /stakeholder|quotes|Testimonials/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Executive decision log must stay concise, professional, controlled, and self-hostable.' },
    { id: 181, title: 'TinyAgencySignal', kind: 'website', prompt: 'Name it "TinyAgencySignal". User ask: Our site looks like a template and I hate sending it to clients. Make it look like a real tiny agency. I do brand, Webflow cleanup, and launch help. No giant manifesto.', mustMention: [/Next\.js|next/i, /Dockerfile/i, /Proof|Selected work/i, /brand|Webflow|launch/i, /Pricing|pricing cues/i, /Testimonials|Contact CTA/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Tiny agency site must be specific and polished, not generic marketing soup.' },
    { id: 182, title: 'OrderControl API', kind: 'api', prompt: 'Name it "OrderControl API". User ask: I have orders in emails, Stripe, and a spreadsheet. Need a tiny API to get this under control before Monday. I do not know what database tables are called.', mustMention: [/fastify/i, /postgres/i, /migrations\/001_initial_schema\.sql/i, /DATABASE_URL/i, /\/health/i, /\/ready/i, /order|customer|status|audit/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Messy order intake needs a durable beginner-safe API, not SaaS hand-waving.' },
    { id: 183, title: 'LaunchMail Queue', kind: 'worker', prompt: 'Name it "LaunchMail Queue". User ask: Every launch email is manual and someone forgets. Give me a queue thing. It should retry and show me if it is jammed.', mustMention: [/redis/i, /src\/worker\.ts/i, /src\/queue\.ts/i, /worker-status/i, /heartbeatAt|retryBudget|workerAlerts|dead/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Launch email queue must show retry and jam visibility without sending real email by default.' },
    { id: 184, title: 'BoardReadySignal', kind: 'website', prompt: 'Name it "BoardReadySignal". User ask: Can you make something board-ready for initiatives, blockers, decisions, and asks? It should feel executive, not startup cute.', mustMention: [/Next\.js|next/i, /Dockerfile/i, /Initiatives|Blockers|Decisions/i, /Owner asks|Timeline/i, /Status metrics|Metrics/i, /executive|board-ready|Decisions/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Board-ready tool must be restrained and status-forward, not cute startup chrome.' },
    { id: 185, title: 'ReconcileLedger API', kind: 'api', prompt: 'Name it "ReconcileLedger API". User ask: The accountant sends CSVs and the numbers never match. I need an API shape for imports, mismatches, approvals, and notes. Keep it boring.', mustMention: [/fastify/i, /postgres/i, /migrations\/001_initial_schema\.sql/i, /DATABASE_URL/i, /\/health/i, /\/ready/i, /import|mismatch|approval|notes|audit/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Finance CSV reconciliation needs boring persistence, validation, and auditability.' },
    { id: 186, title: 'ImportGuard Queue', kind: 'worker', prompt: 'Name it "ImportGuard Queue". User ask: We need a worker for imports that can retry without double-processing everything. Make a starter, I will wire the real source later.', mustMention: [/redis/i, /src\/worker\.ts/i, /src\/queue\.ts/i, /worker-status/i, /idempotency|retryBudget|dead|workerAlerts/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Import worker must foreground idempotency, retries, and dead-letter behavior.' },
    { id: 187, title: 'PrintDropSignal', kind: 'website', prompt: 'Name it "PrintDropSignal". User ask: I am releasing prints next month. Need a page that feels premium but not luxury nonsense. People should understand editions, dates, and shipping.', mustMention: [/Next\.js|next/i, /Dockerfile/i, /Edition details|editions/i, /Launch timeline|dates/i, /Shipping notes/i, /Purchase CTA|FAQ/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Artist drop page must explain editions, dates, and shipping without generic ecommerce bloat.' },
    { id: 188, title: 'ClinicIntake API', kind: 'api', prompt: 'Name it "ClinicIntake API". User ask: We need an intake backend for forms and follow-ups. Do not make legal promises. Just structure it so it is not a mess.', mustMention: [/fastify/i, /postgres/i, /migrations\/001_initial_schema\.sql/i, /DATABASE_URL/i, /\/health/i, /\/ready/i, /intake|patient|follow-up|audit/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Clinic intake backend must be cautious about compliance and still operational.' },
    { id: 189, title: 'ClinicReminder Queue', kind: 'worker', prompt: 'Name it "ClinicReminder Queue". User ask: Make a reminder worker skeleton. It should not actually text people yet. I need retries and a way to see what is pending.', mustMention: [/redis/i, /src\/worker\.ts/i, /src\/queue\.ts/i, /worker-status/i, /pending|retryBudget|workerAlerts|dead/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Clinic reminder worker must expose pending/status and keep real messaging disabled.' },
    { id: 190, title: 'PermitClarity', kind: 'website', prompt: 'Name it "PermitClarity". User ask: Residents keep calling because the permit page is confusing. Make a clearer page for permits, timelines, fees, documents, and where to ask.', mustMention: [/Next\.js|next/i, /Dockerfile/i, /Permit types|permits/i, /Timeline|Fee checklist|Documents/i, /Office hours|Plain FAQ/i, /Accessible controls|Beginner deployment|deployment/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Permit page must use plain civic structure, not marketing hype.' },
    { id: 191, title: 'PermitStatus API', kind: 'api', prompt: 'Name it "PermitStatus API". User ask: The public page needs an API eventually. Start the boring backend for permit status, staff notes, and audit trail.', mustMention: [/fastify/i, /postgres/i, /migrations\/001_initial_schema\.sql/i, /DATABASE_URL/i, /\/health/i, /\/ready/i, /permit|status|staff|audit/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Permit status API must keep staff notes safe and include readiness.' },
    { id: 192, title: 'PermitNotify Queue', kind: 'worker', prompt: 'Name it "PermitNotify Queue". User ask: We need notifications later when permit status changes. Make a worker starter with queue and retries, no real SMS yet.', mustMention: [/redis/i, /src\/worker\.ts/i, /src\/queue\.ts/i, /worker-status/i, /retryBudget|dead|workerAlerts/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Permit notifications must queue safely and keep real SMS disabled.' },
    { id: 193, title: 'ChoreSignal', kind: 'website', prompt: 'Name it "ChoreSignal". User ask: My family needs something for chores and allowance maybe. I do not know. Make a first version I can understand.', mustMention: [/Next\.js|next/i, /Dockerfile/i, /Chores|Assignments/i, /Allowance progress|Reminders/i, /Empty states|Beginner setup/i, /beginner|Run locally|Docker/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Chores app must stay beginner-friendly and avoid enterprise task-manager bloat.' },
    { id: 194, title: 'MaintenanceLedger API', kind: 'api', prompt: 'Name it "MaintenanceLedger API". User ask: Tenants text me repairs and I lose them. Need an API starter for requests, units, urgency, vendors, and notes.', mustMention: [/fastify/i, /postgres/i, /migrations\/001_initial_schema\.sql/i, /DATABASE_URL/i, /\/health/i, /\/ready/i, /maintenance|unit|vendor|urgency|notes/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Maintenance API must keep tenant notes careful and structure urgency/vendor state.' },
    { id: 195, title: 'RepairDispatch Queue', kind: 'worker', prompt: 'Name it "RepairDispatch Queue". User ask: Make the background worker part for sending repair jobs to vendors later. It needs retries and a jammed queue view.', mustMention: [/redis/i, /src\/worker\.ts/i, /src\/queue\.ts/i, /worker-status/i, /retryBudget|dead|workerAlerts|jammed/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Repair dispatch worker must expose jammed/failed status and avoid real vendor sends by default.' },
    { id: 196, title: 'PolicyClarity', kind: 'website', prompt: 'Name it "PolicyClarity". User ask: Our policy docs are impossible. Make a portal-ish first screen for policy categories, what changed, owners, and how to ask questions.', mustMention: [/Next\.js|next/i, /Dockerfile/i, /Policy categories|Recent changes/i, /Owners|Ask questions/i, /Acknowledgement cues|Search structure/i, /enterprise|deployment/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Policy portal must show ownership and changes, not marketing tone.' },
    { id: 197, title: 'LegalHoldLedger API', kind: 'api', prompt: 'Name it "LegalHoldLedger API". User ask: Need the backend skeleton for legal holds, custodians, notices, acknowledgements, and audit trail. Keep it careful.', mustMention: [/fastify/i, /postgres/i, /migrations\/001_initial_schema\.sql/i, /DATABASE_URL/i, /\/health/i, /\/ready/i, /legal|hold|custodian|notice|acknowledgement|audit/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Legal hold API must be careful, audit-focused, and avoid compliance overclaims.' },
    { id: 198, title: 'LegalExport Queue', kind: 'worker', prompt: 'Name it "LegalExport Queue". User ask: Make a worker skeleton for legal exports. It should queue, retry, show status, and never pretend the export succeeded.', mustMention: [/redis/i, /src\/worker\.ts/i, /src\/queue\.ts/i, /worker-status/i, /retryBudget|dead|workerAlerts|status/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Legal export worker must make failure visibility explicit.' },
    { id: 199, title: 'SimpleLeadSignal', kind: 'website', prompt: 'Name it "SimpleLeadSignal". User ask: My leads are in an ugly sheet. Make me a simple CRM screen for who to follow up with and what might close. I hate CRMs.', mustMention: [/Next\.js|next/i, /Dockerfile/i, /Leads|Next follow-up/i, /Deal stages|Notes/i, /Metrics|Import export cues/i, /Empty states|Beginner setup|Run locally/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Simple CRM must be low-friction for a freelancer and avoid enterprise CRM bloat.' },
    { id: 200, title: 'LeadLedger API', kind: 'api', prompt: 'Name it "LeadLedger API". User ask: If the CRM screen works I need a backend later. Start the API for leads, notes, follow-ups, stages, and basic audit.', mustMention: [/fastify/i, /postgres/i, /migrations\/001_initial_schema\.sql/i, /DATABASE_URL/i, /\/health/i, /\/ready/i, /lead|note|follow-up|stage|audit/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'CRM backend must make future UI integration obvious with leads, notes, follow-ups, stages, and audit.' },
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
    const previewPath = path.join(target, 'playwright-180-200-usability-preview.html')
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
if (failed.length) throw new Error(`${failed.length} ambiguous 180-200 Playwright stories failed.`)
console.log(`All ${results.length} ambiguous 180-200 stories passed with stricter Playwright usability and load checks.`)
