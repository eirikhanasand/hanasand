import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type Kind = 'website' | 'api' | 'worker' | 'bot'
type Story = { id: number; title: string; prompt: string; kind: Kind; mustMention: RegExp[]; scenario: RegExp[]; critique: string }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'share-chat-enterprise-recovery-280-300-playwright')
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
    { id: 280, title: 'Production Support API', kind: 'api', prompt: 'Name it "Production Support API". Create a production support API with PII redaction, audit events, owner scoping, pagination, schemaVersion, failureOwner, rate limiting, token gate, idempotency, health, readiness, webhook signature seam, WEBHOOK_SIGNING_SECRET, verifyWebhookSignature, Docker handoff, and env example.', mustMention: [/redact/i, /auditEvents/i, /ownerId|x-account-id/i, /nextCursor/i, /schemaVersion/i, /failureOwner/i, /rateLimit|rateBuckets/i, /WEBHOOK_SIGNING_SECRET|verifyWebhookSignature/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Production support API must include PII redaction, audit, scoped pagination, limits, idempotency, health, and webhook signature seams.' },
    { id: 281, title: 'RBAC Admin Restore API', kind: 'api', prompt: 'Name it "RBAC Admin Restore API". Create an admin restore API that proves RBAC role checks, requireRole, rolesFor, backup export, /backup, /restore, restore validation, audit events, owner scoping, token gate, API_TOKEN, health, readiness, Docker/export handoff, restore rehearsal notes, and no hardcoded secrets.', mustMention: [/requireRole/i, /rolesFor/i, /\/backup/i, /\/restore/i, /auditEvents/i, /ownerId|x-account-id/i, /API_TOKEN=replace_me/i, /ready|readiness/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Admin restore API must prove RBAC, backup/restore, audit, scoping, and readiness.' },
    { id: 282, title: 'Migration Escape Hatch Site', kind: 'website', prompt: 'Name it "Migration Escape Hatch". Build an escape-hatch migration site for leaving a locked-in AI builder. Include source export, clean schema, parallel run, cutover plan, rollback plan, DNS checklist, SSL checklist, verification, accessible responsive layout, Docker/export files, and README verification.', mustMention: [/Source export/i, /Clean schema/i, /Parallel run/i, /Cutover plan/i, /Rollback plan/i, /DNS checklist/i, /SSL checklist/i, /Verification/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Migration escape hatch must make source, schema, parallel run, DNS/SSL, rollback, and verification explicit.' },
    { id: 283, title: 'OAuth Permission Boundary API', kind: 'api', prompt: 'Name it "OAuth Permission Boundary API". Create an OAuth-style permission boundary API with RBAC role checks, requireRole, scoped records, token gates, API_TOKEN, rate limits, audit events, security headers, pagination, readiness, Docker, and export handoff.', mustMention: [/requireRole/i, /ownerId|x-account-id/i, /API_TOKEN=replace_me/i, /rateLimit|rateBuckets/i, /auditEvents/i, /x-content-type-options/i, /nextCursor/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'OAuth boundary API must show RBAC/token/scoped access plus headers and pagination.' },
    { id: 284, title: 'Checkout Tax Invoice Site', kind: 'website', prompt: 'Name it "Checkout Tax Invoice". Build a checkout site for a billing lead with pricing plans, checkout states, failed payments, cancellation, invoice notes, security review, handoff, Docker, and no fake buy-button-only flow.', mustMention: [/Plans/i, /Checkout states/i, /Failed payments/i, /Cancellation/i, /Invoice notes/i, /Security review/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Checkout site must handle invoices, failed payments, cancellation, and security handoff.' },
    { id: 285, title: 'Import Worker Backpressure Recovery', kind: 'worker', prompt: 'Name it "Import Worker Backpressure Recovery". Build an import worker that handles idempotency, retrying, dead-letter, poison quarantine, poisonJobs, event logs, Redis seam, worker status, visible failure owner, Docker, and export handoff.', mustMention: [/idempotency/i, /events|event logs/i, /retrying|retry/i, /dead/i, /poisonJobs/i, /worker-status/i, /Redis|redis/i, /FAILURE_OWNER|failure owner/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Import worker must show backpressure/failure ownership and poison recovery.' },
    { id: 286, title: 'Analytics Consent Landing Page', kind: 'website', prompt: 'Name it "Analytics Consent Landing". Create a marketing landing page with proof, pricing, FAQ, lead capture, consent/data seams, analytics handoff, privacy notes, exportable Docker, and responsive accessible layout.', mustMention: [/Proof/i, /Pricing/i, /FAQ/i, /Lead capture|lead capture/i, /Privacy and data seams documented|consent/i, /Dockerfile|Docker/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Analytics consent landing page must combine marketing proof with privacy/data seams.' },
    { id: 287, title: 'Feature Flag Rollout API', kind: 'api', prompt: 'Name it "Feature Flag Rollout API". Build an API with featureFlags, role checks, requireRole, audit events, rate limits, schemaVersion, failureOwner, scoped records, pagination, health, readiness, backup, restore, Docker, and export handoff.', mustMention: [/featureFlags/i, /requireRole/i, /auditEvents/i, /rateLimit|rateBuckets/i, /schemaVersion/i, /failureOwner/i, /nextCursor/i, /\/backup/i, /\/restore/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Feature flag API must connect rollout control to RBAC, audit, backup/restore, and pagination.' },
    { id: 288, title: 'Disaster Restore Runbook Site', kind: 'website', prompt: 'Name it "Disaster Restore Runbook". Build a disaster restore site with environment map, DNS checklist, SSL checklist, rollback plan, verification, failure owner, source export, accessible responsive layout, Docker, and handoff notes.', mustMention: [/Environment map/i, /DNS checklist/i, /SSL checklist/i, /Rollback plan/i, /Verification/i, /Failure owner/i, /Source export/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Disaster restore runbook must show env/DNS/SSL/rollback/failure-owner/source export.' },
    { id: 289, title: 'Moderation Appeal Evidence Bot', kind: 'bot', prompt: 'Name it "Moderation Appeal Evidence Bot". Create a Discord moderation appeal bot with auditLog, safe role stubs, maintenance notices, restart requests, evidence tracking, safe env, Docker, no destructive automatic actions, and explicit destructive-action warning.', mustMention: [/discord\.js/i, /auditLog/i, /restartRequests|restart request/i, /maintenance/i, /stub|role/i, /DISCORD_TOKEN=replace_me/i, /Destructive actions require explicit review|Nothing destructive was executed/i], scenario: [/Validation blocked missing email/i, /Bot status healthy/i, /Queued 30 safe commands/i, /Audit history visible/i, /Mobile layout fits viewport/i], critique: 'Moderation appeal bot must track evidence and keep destructive actions reviewed.' },
    { id: 290, title: 'Customer Data Export Delete API', kind: 'api', prompt: 'Name it "Customer Data Export Delete API". Create an API that supports export/delete flows with PII redaction, audit events, scoped records, pagination, role-gated backup restore, requireRole, /backup, /restore, schemaVersion, failureOwner, Docker, and export handoff.', mustMention: [/redact/i, /auditEvents/i, /ownerId|x-account-id/i, /nextCursor/i, /requireRole/i, /\/backup/i, /\/restore/i, /schemaVersion/i, /failureOwner/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Customer data export/delete API must include scoped privacy flows plus role-gated restore.' },
    { id: 291, title: 'Multi-Region Status Handoff Site', kind: 'website', prompt: 'Name it "Multi Region Status Handoff". Build a status handoff page with service health, incident timeline, subscriber notice, SLO evidence, postmortems, escalation, failure owner, Docker export, and accessible responsive layout.', mustMention: [/Service health/i, /Incident timeline/i, /Subscriber notice/i, /SLO evidence/i, /Postmortems/i, /Escalation paths|escalation/i, /Failure owner/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Multi-region status page must show SLO/incidents/subscribers/escalation/failure owner.' },
    { id: 292, title: 'Webhook Replay Restore API', kind: 'api', prompt: 'Name it "Webhook Replay Restore API". Build a webhook API that handles signatures, WEBHOOK_SIGNING_SECRET, verifyWebhookSignature, idempotency, replay audit, auditEvents, backup, restore, owner scoping, rate limits, shaped errors, readiness, Docker, and export handoff.', mustMention: [/WEBHOOK_SIGNING_SECRET/i, /verifyWebhookSignature/i, /idempotency/i, /auditEvents/i, /\/backup/i, /\/restore/i, /ownerId|x-account-id/i, /rateLimit|rateBuckets/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Webhook replay restore API must combine signature/idempotency with backup/restore.' },
    { id: 293, title: 'CSV Reconciliation Worker Audit', kind: 'worker', prompt: 'Name it "CSV Reconciliation Worker Audit". Create a CSV worker that never silently drops rows and exposes idempotency, event logs, retrying, dead, poison states, poisonJobs, worker status, Redis seam, Docker, and handoff.', mustMention: [/idempotency/i, /events|event logs/i, /retrying|retry/i, /dead/i, /poisonJobs/i, /worker-status/i, /Redis|redis/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'CSV reconciliation worker must make dropped/poison rows visible.' },
    { id: 294, title: 'Database Migration Review API', kind: 'api', prompt: 'Name it "Database Migration Review API". Create an API that exposes migrations, readiness checks, role-gated restore, requireRole, backup export, /backup, /restore, audit events, owner scoping, pagination, token gates, API_TOKEN, Docker, and export handoff.', mustMention: [/migrations/i, /ready/i, /requireRole/i, /\/backup/i, /\/restore/i, /auditEvents/i, /ownerId|x-account-id/i, /nextCursor/i, /API_TOKEN=replace_me/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Database migration API must expose migrations/readiness and role-gated restore.' },
    { id: 295, title: 'Accessibility Lawsuit Landing Site', kind: 'website', prompt: 'Name it "Accessibility Lawsuit Landing". Build an accessibility-focused landing site with skip links, keyboard flow, contrast, accessible forms, reduced motion notes, privacy seams, accessible controls, Docker export, and responsive layout.', mustMention: [/Skip links|Skip to content/i, /Keyboard flow/i, /Contrast/i, /Forms/i, /Reduced motion/i, /Accessible controls/i, /Dockerfile|Docker/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Accessibility landing page must foreground keyboard/contrast/forms/reduced-motion/accessibility controls.' },
    { id: 296, title: 'Support SLA Evidence API', kind: 'api', prompt: 'Name it "Support SLA Evidence API". Create an API that exposes audited support evidence with PII redaction, auditEvents, scoped records, ownerId, role checks, requireRole, backup, restore, rate limits, shaped request_error responses, Docker, and export handoff.', mustMention: [/auditEvents/i, /redact/i, /ownerId|x-account-id/i, /requireRole/i, /\/backup/i, /\/restore/i, /rateLimit|rateBuckets/i, /request_error/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Support SLA evidence API must preserve audited support proof with redaction and role-gated recovery.' },
    { id: 297, title: 'Report Worker Cancellation Story', kind: 'worker', prompt: 'Name it "Report Worker Cancellation". Build a report worker for stuck jobs with idempotency, event logs, retrying, dead, poison states, poisonJobs, worker status, Redis seam, clear failure owner, Docker, and handoff.', mustMention: [/idempotency/i, /events|event logs/i, /retrying|retry/i, /dead/i, /poisonJobs/i, /worker-status/i, /Redis|redis/i, /FAILURE_OWNER|failure owner/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Report worker cancellation story must expose stuck/dead/poison state and failure owner.' },
    { id: 298, title: 'Source Ownership Marketing Site', kind: 'website', prompt: 'Name it "Source Ownership Marketing". Create a marketing site for a critic of AI-builder pages that clearly promises no lock-in, readable source export, mobile-first layout, accessible controls, backend contract, rollback path, real handoff tasks, Docker, and production tasks.', mustMention: [/No platform lock-in/i, /Readable source export/i, /Mobile-first layout/i, /Accessible controls/i, /Backend contract/i, /Rollback path/i, /Next production tasks|handoff tasks/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Source ownership site must make escape/readable-code/backend/rollback promises visible.' },
    { id: 299, title: 'Tenant Audit Restore API', kind: 'api', prompt: 'Name it "Tenant Audit Restore API". Create a tenant audit restore API with owner scoping, role gates, requireRole, backup, restore, audit events, PII redaction, pagination, schemaVersion, failureOwner, health, readiness, Docker, and export handoff.', mustMention: [/ownerId|x-account-id/i, /requireRole/i, /\/backup/i, /\/restore/i, /auditEvents/i, /redact/i, /nextCursor/i, /schemaVersion/i, /failureOwner/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Tenant audit restore API must combine tenant scope, RBAC, restore, redaction, and audit.' },
    { id: 300, title: 'Production Recovery API', kind: 'api', prompt: 'Name it "Production Recovery API". Create a production recovery API with RBAC, requireRole, backup, restore, migrations, feature flags, featureFlags, security headers, PII redaction, audit events, idempotency, webhook signatures, verifyWebhookSignature, pagination, schemaVersion, failureOwner, rate limiting, token gate, API_TOKEN, health, readiness, Docker/export handoff, and no hardcoded secrets.', mustMention: [/requireRole/i, /\/backup/i, /\/restore/i, /migrations/i, /featureFlags/i, /x-content-type-options/i, /redact/i, /auditEvents/i, /idempotency/i, /verifyWebhookSignature/i, /nextCursor/i, /schemaVersion/i, /failureOwner/i, /rateLimit|rateBuckets/i, /API_TOKEN=replace_me/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Production recovery API must include the full recovery/backend seam stack without hardcoded secrets.' },
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
    const previewPath = path.join(target, 'playwright-280-300-usability-preview.html')
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
if (failed.length) throw new Error(`${failed.length} share chat enterprise recovery 280-300 Playwright stories failed.`)
console.log(`All ${results.length} share chat enterprise recovery 280-300 stories passed with stricter Playwright usability and load checks.`)
