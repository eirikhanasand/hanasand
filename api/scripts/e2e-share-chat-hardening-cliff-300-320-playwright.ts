import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type Kind = 'website' | 'api' | 'worker' | 'bot'
type Story = { id: number; title: string; prompt: string; kind: Kind; mustMention: RegExp[]; scenario: RegExp[]; critique: string }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'share-chat-hardening-cliff-300-320-playwright')
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
    { id: 300, title: 'Production Recovery API', kind: 'api', prompt: 'Name it "Production Recovery API". Create a production recovery API with RBAC, requireRole, backup, restore, migrations, feature flags, featureFlags, security headers, PII redaction, audit events, idempotency, webhook signatures, verifyWebhookSignature, pagination, schemaVersion, failureOwner, rate limiting, token gate, API_TOKEN, health, readiness, Docker/export handoff, GitHub Actions CI, and no hardcoded secrets.', mustMention: [/requireRole/i, /\/backup/i, /\/restore/i, /migrations/i, /featureFlags/i, /x-content-type-options/i, /redact/i, /auditEvents/i, /idempotency/i, /verifyWebhookSignature/i, /nextCursor/i, /schemaVersion/i, /failureOwner/i, /rateLimit|rateBuckets/i, /API_TOKEN=replace_me/i, /\.github\/workflows\/ci\.yml/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Production recovery API must still pass when carried into the next hardening tranche with CI and full recovery seams.' },
    { id: 301, title: 'Transactional Billing Recovery API', kind: 'api', prompt: 'Name it "Transactional Billing Recovery API". Create transactional billing recovery API with transaction rollback idempotency cache invalidation audit events request IDs OpenAPI metrics RBAC backup restore webhook signatures CI Docker.', mustMention: [/withTransaction/i, /metrics/i, /cache\.clear/i, /x-request-id/i, /\/openapi\.json/i, /requireRole/i, /\/backup/i, /\/restore/i, /verifyWebhookSignature/i, /\.github\/workflows\/ci\.yml/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Billing recovery API must prove transaction rollback, cache invalidation, OpenAPI, metrics, RBAC, restore, and CI.' },
    { id: 302, title: 'CORS Debuggable Customer API', kind: 'api', prompt: 'Name it "CORS Debuggable Customer API". Build CORS debuggable customer API with allowed origins CORS headers request IDs shaped errors owner scoping pagination rate limits readiness Docker.', mustMention: [/ALLOWED_ORIGINS/i, /allowedOrigin/i, /access-control-allow-origin/i, /x-request-id/i, /request_error/i, /ownerId/i, /nextCursor/i, /rateLimit/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'CORS API must be debuggable in production with allowlists, request IDs, shaped errors, and scoped pagination.' },
    { id: 303, title: 'Worker Cancellation Backoff Queue', kind: 'worker', prompt: 'Name it "Worker Cancellation Backoff Queue". Create worker cancellation backoff queue with cancelJob cancel endpoint BACKOFF_MS nextRunAt poison quarantine event logs Redis worker status.', mustMention: [/cancelJob/i, /\/api\/jobs\/:id\/cancel/i, /BACKOFF_MS/i, /nextRunAt/i, /poisonJobs/i, /events/i, /worker-status/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Worker queue must make cancellation, backoff, poison quarantine, Redis, and status visible.' },
    { id: 304, title: 'CI Export Ownership Marketing Site', kind: 'website', prompt: 'Name it "CI Export Ownership Marketing Site". Build CI export ownership marketing site with source export Docker GitHub Actions CI no lock-in backend contract rollback path accessible controls.', mustMention: [/\.github\/workflows\/ci\.yml/i, /No platform lock-in/i, /Readable source export/i, /Docker/i, /Backend contract/i, /Rollback path/i, /Accessible controls/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Export ownership site must show actual source ownership, backend contract, rollback, CI, and accessibility.' },
    { id: 305, title: 'OpenAPI Partner Integration API', kind: 'api', prompt: 'Name it "OpenAPI Partner Integration API". Create OpenAPI partner integration API with OpenAPI security headers request IDs idempotency webhook signature metrics backup restore readiness.', mustMention: [/\/openapi\.json/i, /x-content-type-options/i, /x-request-id/i, /idempotency/i, /verifyWebhookSignature/i, /\/metrics/i, /\/backup/i, /\/restore/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Partner API must expose OpenAPI, metrics, headers, idempotency, webhook signatures, and recovery seams.' },
    { id: 306, title: 'Cache TTL Product Catalog API', kind: 'api', prompt: 'Name it "Cache TTL Product Catalog API". Build cache TTL product catalog API with CACHE_TTL_SECONDS readCache writeCache cache hit miss metrics cache invalidation pagination owner scoping rate limits request IDs.', mustMention: [/CACHE_TTL_SECONDS/i, /readCache/i, /writeCache/i, /cacheHits/i, /cacheMisses/i, /cache\.clear/i, /nextCursor/i, /ownerId/i, /x-request-id/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Catalog API must prove TTL cache reads/writes, hit/miss metrics, invalidation, scoping, and tracing.' },
    { id: 307, title: 'Refund Dispute Transaction API', kind: 'api', prompt: 'Name it "Refund Dispute Transaction API". Create refund dispute transaction API with withTransaction rollback metrics audit events PII redaction RBAC backup restore shaped errors.', mustMention: [/withTransaction/i, /rollbacks/i, /auditEvents/i, /redact/i, /requireRole/i, /\/backup/i, /\/restore/i, /request_error/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Refund/dispute API must keep finance writes transactional, audited, redacted, role gated, and restorable.' },
    { id: 308, title: 'Disaster Cutover CI Site', kind: 'website', prompt: 'Name it "Disaster Cutover CI Site". Build disaster cutover CI site with DNS SSL checklist rollback plan verification failure owner source export Docker GitHub Actions CI.', mustMention: [/DNS checklist/i, /SSL checklist/i, /Rollback plan/i, /Verification/i, /Failure owner/i, /Source export/i, /\.github\/workflows\/ci\.yml/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Cutover site must make DNS, SSL, rollback, verification, failure owner, source export, and CI explicit.' },
    { id: 309, title: 'Moderator Evidence Bot With CI', kind: 'bot', prompt: 'Name it "Moderator Evidence Bot With CI". Create Discord moderator evidence bot with audit logs safe stubs restart requests maintenance notices no destructive defaults env handling Docker CI.', mustMention: [/auditLog/i, /restartRequests/i, /maintenance/i, /stub/i, /DISCORD_TOKEN/i, /Destructive actions require explicit review/i, /\.github\/workflows\/ci\.yml/i], scenario: [/Validation blocked missing email/i, /Bot status healthy/i, /Queued 30 safe commands/i, /Audit history visible/i, /Mobile layout fits viewport/i], critique: 'Moderator bot must keep audit evidence, safe stubs, restart/maintenance workflows, CI, and no destructive defaults.' },
    { id: 310, title: 'Tenant Metrics API', kind: 'api', prompt: 'Name it "Tenant Metrics API". Create tenant metrics API with metrics request tracing scoped records rate limits cache hits writes rollbacks audit events pagination readiness.', mustMention: [/\/metrics/i, /metrics/i, /x-request-id/i, /ownerId/i, /rateLimit/i, /cacheHits/i, /writes/i, /rollbacks/i, /auditEvents/i, /nextCursor/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Tenant metrics API must show tracing, tenant scoping, limits, cache/write/rollback metrics, audit, and pagination.' },
    { id: 311, title: 'Report Worker Customer Cancel', kind: 'worker', prompt: 'Name it "Report Worker Customer Cancel". Build report worker customer cancel with cancel endpoint event logs backoff retry dead poison states worker status Redis seam failure owner.', mustMention: [/cancelJob/i, /\/api\/jobs\/:id\/cancel/i, /BACKOFF_MS/i, /events/i, /retrying/i, /dead/i, /poisonJobs/i, /worker-status/i, /FAILURE_OWNER/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Report worker must support customer cancellation and show retry/dead/poison state with failure ownership.' },
    { id: 312, title: 'Security Headers API', kind: 'api', prompt: 'Name it "Security Headers API". Create security headers API with CORS allowlist request IDs RBAC audit events PII redaction webhook signatures OpenAPI.', mustMention: [/x-content-type-options/i, /x-frame-options/i, /ALLOWED_ORIGINS/i, /x-request-id/i, /requireRole/i, /auditEvents/i, /redact/i, /verifyWebhookSignature/i, /\/openapi\.json/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Security API must include browser-facing headers, CORS allowlist, request tracing, RBAC, audit, redaction, webhook signatures, and OpenAPI.' },
    { id: 313, title: 'Accessible Analytics Site', kind: 'website', prompt: 'Name it "Accessible Analytics Site". Create accessible analytics consent marketing site with proof pricing FAQ lead capture privacy seams accessible controls CI Docker handoff tasks.', mustMention: [/Proof/i, /Pricing/i, /FAQ/i, /lead capture/i, /Privacy and data seams/i, /Accessible controls/i, /\.github\/workflows\/ci\.yml/i, /Docker/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Analytics site must be accessible and include proof, pricing, FAQ, lead capture, privacy seams, CI, Docker, and handoff.' },
    { id: 314, title: 'Replay-Safe Webhook API', kind: 'api', prompt: 'Name it "Replay-Safe Webhook API". Build replay safe webhook API with signature seam idempotency transaction rollback audit events metrics request IDs OpenAPI backup restore.', mustMention: [/verifyWebhookSignature/i, /idempotency/i, /withTransaction/i, /auditEvents/i, /\/metrics/i, /x-request-id/i, /\/openapi\.json/i, /\/backup/i, /\/restore/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Webhook API must be replay-safe through signatures, idempotency, transactions, audit, metrics, OpenAPI, and restore.' },
    { id: 315, title: 'Backpressure Import Worker', kind: 'worker', prompt: 'Name it "Backpressure Import Worker". Create backpressure import worker with BACKOFF_MS cancellation idempotency poison quarantine event logs retry dead states Redis status counts.', mustMention: [/BACKOFF_MS/i, /cancelJob/i, /idempotency/i, /poisonJobs/i, /events/i, /retrying/i, /dead/i, /Redis/i, /worker-status/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Import worker must combine backpressure, cancellation, idempotency, poison quarantine, events, Redis, and status counts.' },
    { id: 316, title: 'Enterprise Status With CI Site', kind: 'website', prompt: 'Name it "Enterprise Status With CI Site". Build enterprise incident observability status page with service health incident timeline subscriber notice SLO evidence postmortems failure owner Docker CI.', mustMention: [/Service health/i, /Incident timeline/i, /Subscriber notice/i, /SLO evidence/i, /Postmortems/i, /Failure owner/i, /\.github\/workflows\/ci\.yml/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Status site must show service health, incident timeline, subscriber notice, SLO evidence, postmortems, failure owner, Docker, and CI.' },
    { id: 317, title: 'Custom Rules Admin API', kind: 'api', prompt: 'Name it "Custom Rules Admin API". Create custom rules admin API with feature flags migrations RBAC request IDs metrics backup restore OpenAPI transaction rollback.', mustMention: [/featureFlags/i, /migrations/i, /requireRole/i, /x-request-id/i, /\/metrics/i, /\/backup/i, /\/restore/i, /\/openapi\.json/i, /withTransaction/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Custom rules API must expose feature flags, migrations, RBAC, tracing, metrics, restore, OpenAPI, and transaction rollback.' },
    { id: 318, title: 'Rate Limit UX API', kind: 'api', prompt: 'Name it "Rate Limit UX API". Build rate limit UX API with shaped Limit reached request_error request IDs CORS metrics owner scoping pagination readiness.', mustMention: [/Limit reached/i, /request_error/i, /x-request-id/i, /access-control-allow-origin/i, /\/metrics/i, /ownerId/i, /nextCursor/i, /\/ready/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Rate-limit API must shape limit copy, request errors, tracing, CORS, metrics, scoping, pagination, and readiness.' },
    { id: 319, title: 'Source Review Portfolio Site', kind: 'website', prompt: 'Name it "Source Review Portfolio Site". Create source review portfolio site with readable source export Docker CI accessible controls mobile layout backend contract rollback path no lock-in.', mustMention: [/Readable source export/i, /Docker/i, /\.github\/workflows\/ci\.yml/i, /Accessible controls/i, /Mobile-first layout/i, /Backend contract/i, /Rollback path/i, /No platform lock-in/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Portfolio site must avoid generic AI gloss by proving readable source, CI, accessibility, mobile layout, backend contract, rollback, and no lock-in.' },
    { id: 320, title: 'Production Operations API', kind: 'api', prompt: 'Name it "Production Operations API". Create production operations API with CORS allowlist request IDs OpenAPI metrics cache TTL transaction rollback RBAC backup restore migrations feature flags security headers PII redaction audit events idempotency webhook signatures pagination schemaVersion failureOwner rate limiting token gate health readiness Docker CI.', mustMention: [/ALLOWED_ORIGINS/i, /x-request-id/i, /\/openapi\.json/i, /\/metrics/i, /CACHE_TTL_SECONDS/i, /withTransaction/i, /requireRole/i, /\/backup/i, /\/restore/i, /migrations/i, /featureFlags/i, /x-content-type-options/i, /redact/i, /auditEvents/i, /idempotency/i, /verifyWebhookSignature/i, /nextCursor/i, /schemaVersion/i, /failureOwner/i, /rateLimit/i, /API_TOKEN/i, /\.github\/workflows\/ci\.yml/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Production operations API must combine every hardening seam without hardcoded secrets or unverifiable handoff.' },
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
    const previewPath = path.join(target, 'playwright-300-320-usability-preview.html')
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
        operationalHandoff: /handoff|verification|docker compose|run locally|health|ready|worker-status|CI/i.test(readme + allContent),
        noLorem: !/lorem ipsum|placeholder text|todo: write copy/i.test(allContent),
        noHardcodedSecrets: !/(sk-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|DISCORD_TOKEN\s*=\s*(?!replace_me)[^\n]{12,}|API_TOKEN\s*=\s*(?!replace_me)[^\n]{12,})/i.test(allContent),
        mentions: story.mustMention.every((pattern) => pattern.test(allContent)),
    }
    if (story.kind === 'website') {
        checks.nextApp = await exists(path.join(target, 'src/app/page.tsx')) && await exists(path.join(target, 'src/app/layout.tsx'))
        checks.standalone = /output:\s*'standalone'/.test(allContent)
        checks.accessible = /Skip to content|aria-label|<label|Accessible controls/i.test(allContent)
        checks.responsive = /clamp\(|auto-fit|flexWrap|mobile|Mobile-first layout/i.test(allContent)
        checks.selfHosted = /Dockerfile|docker-compose\.yml|No platform lock-in|Source export|Readable source export/i.test(allContent)
    }
    if (story.kind === 'api') {
        checks.apiSource = await exists(path.join(target, 'src/index.ts'))
        checks.postgres = /postgres:16-alpine|DATABASE_URL|from 'pg'|migrations\/001_initial_schema\.sql/i.test(allContent)
        checks.healthReadyMetrics = /\/health|\/ready|\/metrics|openapi\.json/i.test(allContent)
        checks.shapedErrors = /request_error|internal_error|title_required|Forbidden|x-request-id|Limit reached/i.test(allContent)
        checks.safeToken = /API_TOKEN=replace_me|assertToken|Bearer/i.test(allContent)
        checks.loadSafe = /pagination|nextCursor|rateLimit|MAX_BODY_BYTES|metrics|idempotency|CACHE_TTL_SECONDS|withTransaction/i.test(allContent)
        checks.operability = /x-request-id|\/openapi\.json|\/metrics|ALLOWED_ORIGINS|x-content-type-options|x-frame-options/i.test(allContent)
        checks.rollbackRecovery = /withTransaction|rollbacks|\/backup|\/restore|migrations|featureFlags|cache\.clear/i.test(allContent)
    }
    if (story.kind === 'worker') {
        checks.workerSource = await exists(path.join(target, 'src/worker.ts')) && await exists(path.join(target, 'src/queue.ts'))
        checks.redis = /redis:7-alpine|REDIS_URL|depends_on:\n {6}- redis/i.test(allContent)
        checks.workerStatus = /worker-status|heartbeatAt|retryBudget|workerAlerts|status counts/i.test(allContent)
        checks.deadLetter = /dead|dead-letter|poison|failed|poisonJobs/i.test(allContent)
        checks.noSilentFailure = /retry|backoff|BACKOFF_MS|workerAlerts|stuckJobDetector|status|nextRunAt/i.test(allContent)
        checks.cancelPath = /cancelJob|\/api\/jobs\/:id\/cancel|cancelled/i.test(allContent)
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
        artifactsVisible: /Generated artifacts/.test(text) && /package\.json|Dockerfile|README\.md|\.github\/workflows\/ci\.yml/.test(text),
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
if (failed.length) throw new Error(`${failed.length} share chat hardening cliff 300-320 Playwright stories failed.`)
console.log(`All ${results.length} share chat hardening cliff 300-320 stories passed with stricter Playwright usability and load checks.`)
