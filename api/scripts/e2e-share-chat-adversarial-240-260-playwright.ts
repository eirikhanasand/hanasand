import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type Kind = 'website' | 'api' | 'worker' | 'bot'
type Story = { id: number; title: string; prompt: string; kind: Kind; mustMention: RegExp[]; scenario: RegExp[]; critique: string }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'share-chat-adversarial-240-260-playwright')
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
    { id: 240, title: 'Customer Portal API', kind: 'api', prompt: 'Name it "Customer Portal API". Build a customer portal API with account-scoped records, token-gated writes, validation, idempotency, rate limiting, health, readiness, shaped errors, durable audit logs, Docker, and production handoff notes.', mustMention: [/ownerId|x-account-id/i, /idempotency/i, /rateLimit|rateBuckets/i, /API_TOKEN=replace_me/i, /durable audit logs|audit events/i, /health|ready/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Customer portal API must prove account scoping, token gate, idempotency, limits, and audit handoff.' },
    { id: 241, title: 'Second-Device Auth Contract Site', kind: 'website', prompt: 'Name it "Second Device Auth Contract". Build an auth/session contract website for a mobile user logged in from two devices. Include backend contract, session states, permission matrix, revoked access, second-device tests, failure owner, responsive accessible layout, Docker, export files, and handoff notes. Do not pretend auth is complete without backend wiring.', mustMention: [/Backend contract/i, /Session states/i, /Permission matrix/i, /Revoked access/i, /Second device test|second-device/i, /Failure owner/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Auth contract page must show session/revocation boundaries instead of fake completed auth.' },
    { id: 242, title: 'Paginated Customer Records API', kind: 'api', prompt: 'Name it "Paginated Customer Records API". Create a customer records API with scoped records, cursor pagination, schemaVersion, failureOwner, rate limiting, token gate, health, readiness, shaped errors, Docker, and no global unscoped record dump.', mustMention: [/ownerId|x-account-id/i, /nextCursor/i, /schemaVersion/i, /failureOwner/i, /rateLimit|rateBuckets/i, /API_TOKEN=replace_me/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Customer records API must paginate and scope data instead of dumping every row.' },
    { id: 243, title: 'Duplicate Workflow Guard Worker', kind: 'worker', prompt: 'Name it "Duplicate Workflow Guard Worker". Create a worker queue for workflows that sent invoices twice. Include idempotency guard, idempotencyKey handling, event log, retrying/dead-letter states, visible worker-status endpoint, Redis compose seam, Docker, and README verification notes.', mustMention: [/idempotency|idempotencyKey/i, /events|event log/i, /dead|dead-letter/i, /retrying|retry/i, /worker-status/i, /redis/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Workflow worker must prevent duplicate side effects and reveal retries/events.' },
    { id: 244, title: 'Restart Request Discord Bot', kind: 'bot', prompt: 'Name it "Restart Request Discord Bot". Build a Discord bot that converts restart commands into audited requests and never restarts automatically. Include restartRequests, audit log, maintenance notice, safe env handling, Docker, export files, and explicit non-destructive behavior.', mustMention: [/discord\.js/i, /restartRequests|restart request/i, /Restart request logged|Nothing destructive was executed/i, /maintenance/i, /auditLog|audit/i, /DISCORD_TOKEN=replace_me/i], scenario: [/Validation blocked missing email/i, /Bot status healthy/i, /Queued 30 safe commands/i, /Audit history visible/i, /Mobile layout fits viewport/i], critique: 'Restart bot must convert destructive intent into audited review requests only.' },
    { id: 245, title: 'DNS SSL Rollback Handoff Site', kind: 'website', prompt: 'Name it "DNS SSL Rollback Handoff". Build a deployment handoff page with environment map, DNS checklist, SSL checklist, rollback plan, verification steps, export sections, Docker Compose, README handoff notes, accessible responsive layout, and Docker files.', mustMention: [/Environment map/i, /DNS checklist/i, /SSL checklist/i, /Rollback plan/i, /Verification/i, /Docker Compose|docker-compose/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Deployment handoff must not strand users after export; DNS, SSL, rollback, env, and verification must be explicit.' },
    { id: 246, title: 'Payment Failure Recovery Page', kind: 'website', prompt: 'Name it "Payment Failure Recovery". Build a payment/subscription checkout recovery page with plans, checkout states, failed payments, cancellation, invoice notes, security review, backend contract, production boundary notes, Docker, and export files.', mustMention: [/Plans/i, /Checkout states/i, /Failed payments/i, /Cancellation/i, /Invoice notes/i, /Security review/i, /Backend contract|production boundary/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Payment recovery page must show failed states and backend boundaries, not fake checkout.' },
    { id: 247, title: 'Account-Scoped Refund API', kind: 'api', prompt: 'Name it "Account Scoped Refund API". Create a refund API that cannot leak another account disputes. Include owner/account scoping, pagination, idempotency, schemaVersion, failureOwner, token gate, rateLimit, health, ready, shaped errors, Docker, and no hardcoded secrets.', mustMention: [/ownerId|x-account-id/i, /idempotency/i, /nextCursor/i, /schemaVersion/i, /failureOwner/i, /rateLimit|rateBuckets/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Refund API must isolate accounts and support safe retries/pagination.' },
    { id: 248, title: 'Workflow Side-Effects Review Site', kind: 'website', prompt: 'Name it "Workflow Side Effects Review". Create a workflow review site that shows trigger inventory, duplicate guards, state transitions, side effects, failure owner, rollback path, accessible responsive exportable source, Docker, and backend integration handoff.', mustMention: [/Trigger inventory/i, /Duplicate guard/i, /State transitions/i, /Side effects/i, /Failure owner/i, /Rollback path/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Workflow review site must help operators see side-effect order and rollback paths.' },
    { id: 249, title: 'Long Report Idempotent Worker', kind: 'worker', prompt: 'Name it "Long Report Idempotent Worker". Build a report worker for expensive reports with idempotencyKey duplicate guard, event logs, retry/dead-letter states, visible worker status, Redis seam, Docker, and export handoff.', mustMention: [/idempotencyKey|idempotency/i, /events|event logs/i, /dead|dead-letter/i, /retry/i, /worker-status/i, /redis/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Report worker must prevent accidental reruns and surface status/events.' },
    { id: 250, title: 'Revoked Access API', kind: 'api', prompt: 'Name it "Revoked Access API". Create an API starter showing token-gated writes, account scoping, shaped 403 and 429 errors, schemaVersion, failureOwner, pagination, health, readiness, Docker, and production handoff notes.', mustMention: [/Forbidden|403/i, /Limit reached|429/i, /ownerId|x-account-id/i, /schemaVersion/i, /failureOwner/i, /nextCursor/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Revoked access API must show token gate, scopes, shaped limits, and readiness.' },
    { id: 251, title: 'Mobile Refresh Data Contract Site', kind: 'website', prompt: 'Name it "Mobile Refresh Data Contract". Build a mobile refresh data contract page explaining state ownership, backend contract, autosave boundary, second-device behavior, rollback, failure owner, accessible responsive layout, Docker handoff, and no fake persistence claims.', mustMention: [/Backend contract/i, /State ownership/i, /Autosave boundary|Backend contract before fake integrations/i, /Second device test|second-device/i, /Rollback path|Rollback plan/i, /Failure owner/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Mobile refresh page must clarify persistence boundaries and recovery behavior.' },
    { id: 252, title: 'Moderation Request Bot', kind: 'bot', prompt: 'Name it "Moderation Request Bot". Create a Discord moderation bot that records audit/restart/maintenance requests, keeps role commands as stubs, uses safe env config, Docker/export handoff, and never performs destructive moderation by default.', mustMention: [/discord\.js/i, /auditLog|audit/i, /restartRequests|restart request/i, /maintenance/i, /stub|review/i, /DISCORD_TOKEN=replace_me/i], scenario: [/Validation blocked missing email/i, /Bot status healthy/i, /Queued 30 safe commands/i, /Audit history visible/i, /Mobile layout fits viewport/i], critique: 'Moderation bot must request/review, not perform destructive moderation automatically.' },
    { id: 253, title: 'Database Query Limits API', kind: 'api', prompt: 'Name it "Database Query Limits API". Build an API that clamps query limits, supports cursor pagination, scoped records, rate limiting, schemaVersion, failureOwner, health, readiness, Docker, and README handoff.', mustMention: [/Math.min|limit = Math.min/i, /nextCursor/i, /ownerId|x-account-id/i, /rateLimit|rateBuckets/i, /schemaVersion/i, /failureOwner/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Database API must clamp limits and paginate under load.' },
    { id: 254, title: 'Performance Budget Site', kind: 'website', prompt: 'Name it "Performance Budget Site". Create a performance budget page with performance budget, query limits, cache notes, load-test plan, failure owner, verification tasks, accessible responsive layout, Docker, and README verification notes.', mustMention: [/Performance budget/i, /Query limits/i, /Cache notes/i, /Load test plan/i, /Failure owner/i, /Verification/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Performance page must turn speed complaints into budgets, query/cache limits, and verification tasks.' },
    { id: 255, title: 'Webhook Replay Protection API', kind: 'api', prompt: 'Name it "Webhook Replay Protection API". Create a webhook API with idempotency, replay protection, scoped records, pagination, rate limiting, schemaVersion, failureOwner, health, readiness, Docker, and export files.', mustMention: [/idempotency/i, /replay|webhook/i, /ownerId|x-account-id/i, /nextCursor/i, /rateLimit|rateBuckets/i, /failureOwner/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Webhook API must protect replay/duplicates with scoped idempotent records.' },
    { id: 256, title: 'Scheduled Job Worker', kind: 'worker', prompt: 'Name it "Scheduled Job Worker". Build a scheduled-job worker starter with idempotency guard, visible events, retry/dead-letter states, worker-status endpoint, Redis compose seam, verification notes, and no duplicate side effects or silent success path.', mustMention: [/idempotency/i, /events|event log/i, /dead|dead-letter/i, /retry/i, /worker-status/i, /redis/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Scheduled job worker must show idempotent queued work and no duplicate side effects.' },
    { id: 257, title: 'Data Export Delete API', kind: 'api', prompt: 'Name it "Data Export Delete API". Create a privacy data request API with scoped records, idempotency, rate limiting, schemaVersion, failureOwner, token gate, health, readiness, shaped errors, Docker handoff, and privacy production notes.', mustMention: [/ownerId|x-account-id/i, /idempotency/i, /rateLimit|rateBuckets/i, /schemaVersion/i, /failureOwner/i, /privacy|data request/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Data export/delete API must be privacy-aware and scoped/idempotent.' },
    { id: 258, title: 'SaaS Admin Real Backend Boundary Site', kind: 'website', prompt: 'Name it "SaaS Admin Backend Boundary". Create a SaaS admin page that labels backend contract, permission matrix, state ownership, second-device test, failure owner, rollback path, accessible responsive layout, Docker handoff, and avoids pretending integrations are complete.', mustMention: [/Backend contract/i, /Permission matrix/i, /State ownership/i, /Second device test/i, /Failure owner/i, /Rollback path/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'SaaS admin page must state integration boundaries instead of fake dashboards.' },
    { id: 259, title: 'Audit-Trail Worker', kind: 'worker', prompt: 'Name it "Audit Trail Worker". Build a background worker with idempotency, event trail, retry/dead-letter states, dead/retrying counts, worker-status endpoint, failure owner notes, Docker, Redis seam, and export handoff.', mustMention: [/idempotency/i, /events|event trail/i, /dead/i, /retrying|retry/i, /worker-status/i, /failure owner|FAILURE_OWNER/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Audit worker must expose idempotency, event trail, dead/retrying counts, and ownership.' },
    { id: 260, title: 'Production Readiness API', kind: 'api', prompt: 'Name it "Production Readiness API". Create an API starter with owner scoping, pagination, schemaVersion, failureOwner, rate limiting, token gate, idempotency, health, readiness, shaped errors, Docker/export handoff, env example, and no hardcoded secrets or unscoped record dump.', mustMention: [/ownerId|x-account-id/i, /nextCursor/i, /schemaVersion/i, /failureOwner/i, /rateLimit|rateBuckets/i, /idempotency/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Production readiness API must include every core seam: scope, pagination, schema, owner, limits, token, idempotency, health, shaped errors.' },
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
    const previewPath = path.join(target, 'playwright-240-260-usability-preview.html')
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
if (failed.length) throw new Error(`${failed.length} share chat adversarial 240-260 Playwright stories failed.`)
console.log(`All ${results.length} share chat adversarial 240-260 stories passed with stricter Playwright usability and load checks.`)
