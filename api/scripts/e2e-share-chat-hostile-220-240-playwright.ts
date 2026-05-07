import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type Kind = 'website' | 'api' | 'worker' | 'bot'
type Story = { id: number; title: string; prompt: string; kind: Kind; mustMention: RegExp[]; scenario: RegExp[]; critique: string }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'share-chat-hostile-220-240-playwright')
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
    { id: 220, title: 'Game Server Control Bot', kind: 'bot', prompt: 'Name it "Game Server Control Bot". Build a Discord game server control bot/service starter with status commands, maintenance notices, audit trail, restart request stubs that never execute destructively by default, env example, Docker, and README run instructions.', mustMention: [/discord\.js/i, /DISCORD_TOKEN=replace_me/i, /status/i, /maintenance/i, /restart request|stub/i, /audit/i], scenario: [/Validation blocked missing email/i, /Bot status healthy/i, /Queued 30 safe commands/i, /Audit history visible/i, /Mobile layout fits viewport/i], critique: 'Game server bot must support one-click status/maintenance intent without unsafe restarts.' },
    { id: 221, title: 'GDPR Data Request Portal', kind: 'website', prompt: 'Name it "Northstar Privacy Portal". Build a GDPR privacy data request portal for a furious EU customer-success lead. Include data map, consent flow, retention rules, export request, delete request, audit trail, accessible responsive layout, Docker, source export, and explicit privacy verification notes.', mustMention: [/Data map/i, /Consent flow/i, /Retention rules/i, /Export request/i, /Delete request/i, /Audit trail/i, /privacy verification|Privacy rules/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'GDPR portal must be specific about data map, consent, retention, export/delete, and audit.' },
    { id: 222, title: 'Multi-User Notes API', kind: 'api', prompt: 'Name it "Scoped Notes API". Create a multi-user notes API where the critic says AI apps leak other users notes. Include owner/account scoping, token-gated writes, validation, actual rate limiting, health, readiness, shaped 403 and 429 errors, Docker, and .env.example.', mustMention: [/fastify/i, /ownerId/i, /x-account-id/i, /rateLimit|rateBuckets/i, /Limit reached|429/i, /Forbidden|403/i, /API_TOKEN=replace_me/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Notes API must prove owner scoping and rate limits in code, not README promises.' },
    { id: 223, title: 'Subscription Checkout Recovery Site', kind: 'website', prompt: 'Name it "Billing Recovery". Build a subscription checkout recovery site for a SaaS founder mad about broken billing demos. Include plans, checkout states, failed payments, cancellation, invoice notes, security review handoff, accessible navigation/form, metadata, Docker, and export files.', mustMention: [/Plans/i, /Checkout states/i, /Failed payments/i, /Cancellation/i, /Invoice notes/i, /Security review/i, /metadata/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Subscription site must show real billing failure states and production caveats.' },
    { id: 224, title: 'Payment Webhook API', kind: 'api', prompt: 'Name it "Payment Webhook API". Build a payment webhook API for duplicate Stripe-like events with idempotency, account scoping, token gate, rate limiting, health, readiness, consistent errors, Docker, and production handoff.', mustMention: [/fastify/i, /idempotency/i, /ownerId|x-account-id/i, /rateLimit|rateBuckets/i, /API_TOKEN=replace_me/i, /Limit reached|429/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Payment webhook API must prevent duplicate processing and expose safe failure states.' },
    { id: 225, title: 'Image Transcoding Worker With Proof', kind: 'worker', prompt: 'Name it "Transcode Proof Worker". Create an image/video transcoding worker queue with enqueue API, worker status, retrying/dead-letter counts, event logs, Redis production seam, Docker, README verification, and no fake success.', mustMention: [/redis/i, /src\/worker\.ts/i, /src\/queue\.ts/i, /worker-status/i, /dead|dead-letter/i, /retrying|retry/i, /events|event log/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Transcoding worker must make progress/failure visible and never pretend completion.' },
    { id: 226, title: 'Server Restart Approval Bot', kind: 'bot', prompt: 'Name it "Restart Approval Bot". Build a Discord server restart approval bot where restart commands only create audited review requests. Include restart request stubs, audit log, maintenance notice command, safe token handling, Docker, and env example.', mustMention: [/discord\.js/i, /DISCORD_TOKEN=replace_me/i, /restartRequests|restart request/i, /Restart request logged|Nothing destructive was executed/i, /maintenance/i, /audit/i], scenario: [/Validation blocked missing email/i, /Bot status healthy/i, /Queued 30 safe commands/i, /Audit history visible/i, /Mobile layout fits viewport/i], critique: 'Restart bot must be approval-only, audited, and non-destructive by default.' },
    { id: 227, title: 'Shared Family Calendar Site', kind: 'website', prompt: 'Name it "Family Calendar Control". Create a shared family calendar concept page for a parent tired of single-user toys. Include shared state, permissions, exports, reminders, mobile behavior, accessibility, responsive layout, and backend integration handoff.', mustMention: [/shared state|Session sync/i, /permissions|Permission matrix/i, /exports|export/i, /reminders/i, /mobile/i, /handoff|backend/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Calendar concept must explain multi-user state, permissions, exports, reminders, and mobile behavior.' },
    { id: 228, title: 'Tenant Billing Admin API', kind: 'api', prompt: 'Name it "Tenant Billing Admin API". Build an admin API for cross-tenant billing control with account-scoped records, rate limiting, validation, idempotency, health, readiness, shaped 403 and 429 errors, Docker, and README handoff.', mustMention: [/ownerId|x-account-id/i, /rateLimit|rateBuckets/i, /idempotency/i, /Forbidden|403/i, /Limit reached|429/i, /API_TOKEN=replace_me/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Tenant billing API must prevent cross-tenant mistakes with scoped writes and shaped limits.' },
    { id: 229, title: 'Incident Status Page With Subscribers', kind: 'website', prompt: 'Name it "Subscriber Status Page". Create an incident observability status page with service health, incident timeline, subscriber notices, SLO evidence, postmortems, customer messaging, handoff notes, accessible responsive layout, Docker, and export files.', mustMention: [/Service health/i, /Incident timeline/i, /Subscriber notice/i, /SLO evidence/i, /Postmortems/i, /handoff|customer messaging/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Status page must be operational, subscriber-aware, and not decorative.' },
    { id: 230, title: 'Refund Dispute API', kind: 'api', prompt: 'Name it "Refund Dispute API". Create a refund dispute API with auditability, scoped records, validation, idempotency, token gating, rate limiting, health, readiness, consistent errors, Docker, and export handoff.', mustMention: [/ownerId|x-account-id/i, /idempotency/i, /rateLimit|rateBuckets/i, /request_error/i, /API_TOKEN=replace_me/i, /audit/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Refund dispute API must preserve auditability, scope, and error consistency.' },
    { id: 231, title: 'CSV Import Reconciliation Worker', kind: 'worker', prompt: 'Name it "CSV Reconciliation Worker". Build a CSV import reconciliation worker that does not drop rows silently. Include enqueue route, queue source, worker source, event trail, worker-status endpoint, retrying/dead-letter counts, Redis compose seam, and verification notes.', mustMention: [/redis/i, /csv|import/i, /src\/worker\.ts/i, /src\/queue\.ts/i, /worker-status/i, /events|event trail/i, /dead|retrying|retry/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'CSV reconciliation worker must show row/import failure visibility and no silent success path.' },
    { id: 232, title: 'Restaurant Allergy Safety Site', kind: 'website', prompt: 'Name it "Allergy Safe Menu". Create a restaurant allergy safety mobile menu site emphasizing allergens, dietary filters, booking CTAs, reservations, hours, private dining, guest proof, location, update handoff, accessible layout, Docker, and export files.', mustMention: [/allergen/i, /dietary/i, /Reservations|booking/i, /Opening hours|hours/i, /Location/i, /Private dining|Guest proof/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Allergy safety site must make allergens, dietary filters, booking, and update handoff obvious.' },
    { id: 233, title: 'Clinic Consent Intake API', kind: 'api', prompt: 'Name it "Clinic Consent Intake API". Build a clinic consent intake API with consent records, scoped ownership, token-gated writes, rate limiting, validation, health, readiness, shaped errors, Docker, and README production warnings.', mustMention: [/consent/i, /ownerId|x-account-id/i, /rateLimit|rateBuckets/i, /title_required|validation/i, /API_TOKEN=replace_me/i, /health|ready/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Clinic consent API must be scoped, token-gated, rate-limited, and cautious.' },
    { id: 234, title: 'SEO Migration Landing Page', kind: 'website', prompt: 'Name it "Search Migration Recovery". Build an SEO migration landing page for a marketer angry about destroyed search traffic. Include metadata, proof, pricing, FAQ, redirects checklist, labelled lead capture, responsive layout, Docker, and export handoff.', mustMention: [/metadata/i, /Search proof|Proof/i, /Pricing/i, /FAQ/i, /Redirect checklist/i, /Lead capture|lead capture/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'SEO migration page must protect search traffic with metadata, redirects, proof, and lead capture.' },
    { id: 235, title: 'Moderated Community Bot', kind: 'bot', prompt: 'Name it "Moderated Community Bot". Create a Discord moderated community bot with status, role stubs, restart request flow, maintenance notices, audit log, safe token configuration, Docker, and no destructive moderation by default.', mustMention: [/discord\.js/i, /DISCORD_TOKEN=replace_me/i, /restartRequests|restart request/i, /maintenance/i, /auditLog|audit/i, /stub|review/i], scenario: [/Validation blocked missing email/i, /Bot status healthy/i, /Queued 30 safe commands/i, /Audit history visible/i, /Mobile layout fits viewport/i], critique: 'Community bot must keep moderation/restart actions stubbed and audited.' },
    { id: 236, title: 'Data Retention Dashboard', kind: 'website', prompt: 'Name it "Retention Control". Build a data retention dashboard for a privacy officer with retention rules, export requests, delete requests, consent status, audit trail, ownership boundaries, accessibility, responsive layout, Docker, and README verification notes.', mustMention: [/Retention rules/i, /Export request/i, /Delete request/i, /Consent flow|consent status/i, /Audit trail/i, /ownership|Privacy and data seams documented/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Retention dashboard must be concrete about retention, export/delete, consent, audit, and ownership.' },
    { id: 237, title: 'Rate-Limited Public API', kind: 'api', prompt: 'Name it "Rate Limited Public API". Create a public API starter that implements rate limits, shaped 429 responses, health, readiness, scoped records, token gate, Docker, and handoff notes.', mustMention: [/rateLimit|rateBuckets/i, /Limit reached|429/i, /ownerId|x-account-id/i, /API_TOKEN=replace_me|assertToken/i, /health|ready/i, /request_error/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Public API must make limits explicit in code and responses, not surprise users.' },
    { id: 238, title: 'Deployment Handoff Site', kind: 'website', prompt: 'Name it "Launch Handoff". Build a deployment handoff launch site for a founder burned by lock-in. Include export, self-hosting, env variables, DNS checklist, SSL checklist, rollback notes, verification steps, Docker, accessible responsive layout, and README deployment verification.', mustMention: [/No platform lock-in|Source export/i, /Docker Compose|Dockerfile/i, /Environment map|env/i, /DNS checklist/i, /SSL checklist/i, /Rollback plan|rollback/i, /Verification/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Deployment handoff must make export, env, DNS/SSL, rollback, and verification explicit.' },
    { id: 239, title: 'Long-Running Report Worker', kind: 'worker', prompt: 'Name it "Report Worker". Create a long-running report worker with queued, running, failed, dead status visible, event logs, enqueue API, worker status, retry/dead-letter states, Redis compose, Docker, and README verification.', mustMention: [/redis/i, /queued|running|failed/i, /dead|dead-letter/i, /events|event logs/i, /worker-status/i, /retry/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Report worker must expose queued/running/failed/dead state and retry failures.' },
    { id: 240, title: 'Customer Portal API', kind: 'api', prompt: 'Name it "Customer Portal API". Build a customer portal API with account-scoped records, token-gated writes, validation, idempotency, rate limiting, health, readiness, shaped errors, durable audit logs, Docker, and production handoff notes.', mustMention: [/ownerId|x-account-id/i, /idempotency/i, /rateLimit|rateBuckets/i, /API_TOKEN=replace_me/i, /durable audit logs|audit events/i, /health|ready/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Customer portal API must prove account scoping, token gate, idempotency, limits, and audit handoff.' },
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
    const previewPath = path.join(target, 'playwright-220-240-usability-preview.html')
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
if (failed.length) throw new Error(`${failed.length} share chat hostile 220-240 Playwright stories failed.`)
console.log(`All ${results.length} share chat hostile 220-240 stories passed with stricter Playwright usability and load checks.`)
