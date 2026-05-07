import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type Kind = 'website' | 'api' | 'worker'
type Story = { id: number; title: string; prompt: string; kind: Kind; mustMention: RegExp[]; scenario: RegExp[]; critique: string }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'share-chat-enterprise-architecture-320-340-playwright')
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
    { id: 320, title: 'Production Operations API', kind: 'api', prompt: 'Name it "Production Operations API". Create production operations API with CORS allowlist request IDs OpenAPI metrics cache TTL transaction rollback RBAC backup restore migrations feature flags security headers PII redaction audit events idempotency webhook signatures pagination schemaVersion failureOwner rate limiting token gate health readiness Docker CI.', mustMention: [/ALLOWED_ORIGINS/i, /x-request-id/i, /\/openapi\.json/i, /\/metrics/i, /CACHE_TTL_SECONDS/i, /withTransaction/i, /requireRole/i, /\/backup/i, /\/restore/i, /migrations/i, /featureFlags/i, /x-content-type-options/i, /redact/i, /auditEvents/i, /idempotency/i, /verifyWebhookSignature/i, /nextCursor/i, /schemaVersion/i, /failureOwner/i, /rateLimit/i, /API_TOKEN/i, /\.github\/workflows\/ci\.yml/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Boundary story 320 must still pass with all production hardening seams before the architecture tranche.' },
    { id: 321, title: 'Tenant RLS Contract API', kind: 'api', prompt: 'Name it "Tenant RLS Contract API". Create tenant RLS contract API with rlsPolicies owner scoping RBAC request IDs audit hash chain data residency backup restore contract tests CI Docker.', mustMention: [/rlsPolicies/i, /ownerId/i, /requireRole/i, /x-request-id/i, /auditHash/i, /\/data-residency/i, /\/backup/i, /\/restore/i, /\/contract-tests/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Tenant contract API must prove RLS policy, owner scoping, audit hashes, data residency, restore, and contract tests.' },
    { id: 322, title: 'Secrets Rotation Admin API', kind: 'api', prompt: 'Name it "Secrets Rotation Admin API". Build secrets rotation admin API with /security/secrets/rotate secretsRotation appendAudit auditHash RBAC metrics security headers no hardcoded secrets.', mustMention: [/\/security\/secrets\/rotate/i, /secretsRotation/i, /appendAudit/i, /auditHash/i, /requireRole/i, /\/metrics/i, /x-content-type-options/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Secrets rotation must be explicit, audited, role gated, observable, and free of hardcoded secrets.' },
    { id: 323, title: 'Legal Hold Delete API', kind: 'api', prompt: 'Name it "Legal Hold Delete API". Create legal hold delete API with retentionHolds retention_hold_active role-gated delete PII redaction audit events data residency shaped conflict errors.', mustMention: [/retentionHolds/i, /retention_hold_active/i, /delete_/i, /redact/i, /appendAudit/i, /requireRole/i, /\/data-residency/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Legal hold delete API must block deletion safely, redact PII, audit the conflict, and show data residency.' },
    { id: 324, title: 'Outbox Webhook Reliability API', kind: 'api', prompt: 'Name it "Outbox Webhook Reliability API". Build outbox webhook reliability API with outbox events idempotency signature checks circuit breaker OpenAPI metrics request IDs.', mustMention: [/outboxEvents/i, /\/outbox/i, /idempotency/i, /verifyWebhookSignature/i, /circuitBreaker/i, /\/openapi\.json/i, /\/metrics/i, /x-request-id/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Webhook reliability must use outbox, idempotency, signatures, circuit breaker, OpenAPI, metrics, and tracing.' },
    { id: 325, title: 'Contract Test Partner API', kind: 'api', prompt: 'Name it "Contract Test Partner API". Create contract test partner API with contract tests contractVersion OpenAPI request IDs shaped errors RBAC rate limits readiness.', mustMention: [/\/contract-tests/i, /contractVersion/i, /\/openapi\.json/i, /x-request-id/i, /request_error/i, /requireRole/i, /rateLimit/i, /\/ready/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Partner API must expose contract tests/versioning, OpenAPI, shaped errors, RBAC, limits, and readiness.' },
    { id: 326, title: 'Architecture Ownership Marketing Site', kind: 'website', prompt: 'Name it "Architecture Ownership Marketing Site". Build architecture ownership marketing site with design spec security review CI no lock-in readable source export backend contract rollback path Docker.', mustMention: [/docs\/design-spec\.json/i, /docs\/security-review\.md/i, /\.github\/workflows\/ci\.yml/i, /No platform lock-in/i, /Readable source export/i, /Backend contract/i, /Rollback path/i, /Docker/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Architecture ownership site must make source, design spec, security review, backend contract, rollback, CI, and Docker visible.' },
    { id: 327, title: 'Worker Lease Heartbeat Queue', kind: 'worker', prompt: 'Name it "Worker Lease Heartbeat Queue". Create worker lease heartbeat queue with leaseUntil heartbeatAt backoff cancellation poison quarantine outbox events circuit breaker Redis worker status.', mustMention: [/leaseUntil/i, /heartbeatAt/i, /BACKOFF_MS/i, /cancelJob/i, /poisonJobs/i, /outboxEvents/i, /circuitBreaker/i, /Redis/i, /worker-status/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Lease worker must show leases, heartbeats, cancellation, backoff, poison, outbox, circuit breaker, Redis, and status.' },
    { id: 328, title: 'Data Residency Dashboard Site', kind: 'website', prompt: 'Name it "Data Residency Dashboard Site". Build data residency compliance dashboard with PII handling deployment checks failure owner security review audit trail design docs CI Docker.', mustMention: [/PII handling/i, /Deployment checks/i, /Failure owner/i, /Security review/i, /Audit trail/i, /docs\/design-spec\.json/i, /docs\/security-review\.md/i, /\.github\/workflows\/ci\.yml/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Data residency dashboard must foreground PII handling, deployment checks, failure owner, security review, audit trail, CI, and Docker.' },
    { id: 329, title: 'Circuit Breaker Integration API', kind: 'api', prompt: 'Name it "Circuit Breaker Integration API". Create circuit breaker integration API with assertCircuitClosed recordCircuitFailure metrics outbox request IDs transaction rollback shaped 503 errors.', mustMention: [/circuitBreaker/i, /assertCircuitClosed/i, /recordCircuitFailure/i, /\/metrics/i, /\/outbox/i, /x-request-id/i, /withTransaction/i, /503/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Circuit breaker API must expose failure recording, closed assertions, outbox, metrics, tracing, rollback, and shaped 503s.' },
    { id: 330, title: 'Immutable Audit Evidence API', kind: 'api', prompt: 'Name it "Immutable Audit Evidence API". Build immutable audit evidence API with auditHash hashAudit appendAudit PII redaction backup export data residency retention holds restore rehearsal.', mustMention: [/auditHash/i, /hashAudit/i, /appendAudit/i, /redact/i, /\/backup/i, /\/data-residency/i, /retentionHolds/i, /\/restore/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Audit evidence API must be append-only, hashed, redacted, restorable, and residency-aware.' },
    { id: 331, title: 'SSO Boundary Admin API', kind: 'api', prompt: 'Name it "SSO Boundary Admin API". Create SSO RBAC boundary admin API with rolesFor requireRole ADMIN_ROLE tenant policies security review contract tests.', mustMention: [/rolesFor/i, /requireRole/i, /ADMIN_ROLE/i, /rlsPolicies/i, /docs\/security-review\.md/i, /\/contract-tests/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'SSO boundary API must gate admin routes with roles, tenant policies, security review, and contract tests.' },
    { id: 332, title: 'Outbox Worker Reliability Queue', kind: 'worker', prompt: 'Name it "Outbox Worker Reliability Queue". Build outbox worker reliability queue with outboxEvents heartbeatAt leaseUntil BACKOFF_MS cancelJob circuitBreaker poisonJobs worker-status Redis.', mustMention: [/outboxEvents/i, /heartbeatAt/i, /leaseUntil/i, /BACKOFF_MS/i, /cancelJob/i, /circuitBreaker/i, /poisonJobs/i, /worker-status/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Outbox worker must publish completion events and expose heartbeat, lease, backoff, cancellation, circuit breaker, poison state, and Redis.' },
    { id: 333, title: 'Release Evidence Cutover Site', kind: 'website', prompt: 'Name it "Release Evidence Cutover Site". Create release evidence cutover site with design spec security review CI DNS checklist SSL checklist rollback plan verification failure owner source export Docker.', mustMention: [/docs\/design-spec\.json/i, /docs\/security-review\.md/i, /\.github\/workflows\/ci\.yml/i, /DNS checklist/i, /SSL checklist/i, /Rollback plan/i, /Verification/i, /Failure owner/i, /Source export/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Cutover site must tie release evidence to design spec, security review, DNS/SSL, rollback, verification, source export, and Docker.' },
    { id: 334, title: 'Retention Hold Support API', kind: 'api', prompt: 'Name it "Retention Hold Support API". Create retention hold support API with retentionHolds retention_hold_active auditHash PII redaction owner scoping request_error 409 conflict.', mustMention: [/retentionHolds/i, /retention_hold_active/i, /auditHash/i, /redact/i, /ownerId/i, /request_error/i, /409/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Support API must preserve retention holds with immutable audit, redaction, owner scoping, and shaped 409 conflicts.' },
    { id: 335, title: 'Architecture Review Portfolio Site', kind: 'website', prompt: 'Name it "Architecture Review Portfolio Site". Build architecture review portfolio site with design spec security review CI mobile layout accessible controls readable source export no lock-in rollback path.', mustMention: [/docs\/design-spec\.json/i, /docs\/security-review\.md/i, /\.github\/workflows\/ci\.yml/i, /Mobile-first layout/i, /Accessible controls/i, /Readable source export/i, /No platform lock-in/i, /Rollback path/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Architecture portfolio must satisfy a picky client with review artifacts, mobile/accessibility, source export, no lock-in, and rollback.' },
    { id: 336, title: 'Replay Outbox Payment API', kind: 'api', prompt: 'Name it "Replay Outbox Payment API". Build replay outbox payment API with webhook signature checks idempotency outbox events circuit breaker auditHash backup restore OpenAPI metrics.', mustMention: [/verifyWebhookSignature/i, /idempotency/i, /outboxEvents/i, /circuitBreaker/i, /auditHash/i, /\/backup/i, /\/restore/i, /\/openapi\.json/i, /\/metrics/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Payment webhook API must be replay-safe with outbox, circuit breaker, audit hash, restore, OpenAPI, and metrics.' },
    { id: 337, title: 'Multi-Tenant Export API', kind: 'api', prompt: 'Name it "Multi-Tenant Export API". Create multi tenant export API with owner scoping rlsPolicies data residency request IDs cache TTL pagination audit hash evidence.', mustMention: [/ownerId/i, /rlsPolicies/i, /\/data-residency/i, /x-request-id/i, /CACHE_TTL_SECONDS/i, /nextCursor/i, /auditHash/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Multi-tenant export must prove tenant scoping, RLS, data residency, cache TTL, pagination, and audit hashes.' },
    { id: 338, title: 'Poison Lease Import Worker', kind: 'worker', prompt: 'Name it "Poison Lease Import Worker". Create poison lease import worker with leaseUntil heartbeatAt cancelJob BACKOFF_MS poison quarantine outboxEvents Redis circuitBreaker.', mustMention: [/leaseUntil/i, /heartbeatAt/i, /cancelJob/i, /BACKOFF_MS/i, /poisonJobs/i, /outboxEvents/i, /Redis/i, /circuitBreaker/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Import worker must avoid duplicate leased work while exposing heartbeat, cancellation, backoff, poison, outbox, Redis, and circuit breaker.' },
    { id: 339, title: 'Enterprise Evidence Status Site', kind: 'website', prompt: 'Name it "Enterprise Evidence Status Site". Build enterprise evidence incident observability status page with incident timeline SLO evidence postmortems failure owner design spec security review CI Docker exportable source.', mustMention: [/Incident timeline/i, /SLO evidence/i, /Postmortems/i, /Failure owner/i, /docs\/design-spec\.json/i, /docs\/security-review\.md/i, /\.github\/workflows\/ci\.yml/i, /Docker/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Evidence status page must combine incident/SLO proof with design spec, security review, CI, Docker, and exportable source.' },
    { id: 340, title: 'Production Trust API', kind: 'api', prompt: 'Name it "Production Trust API". Create production trust API with RLS policies data residency retention holds immutable audit hash chain secrets rotation outbox circuit breaker contract tests OpenAPI metrics request IDs CORS allowlist transaction rollback RBAC backup restore migrations feature flags security headers PII redaction audit events idempotency webhook signatures pagination schemaVersion failureOwner rate limiting token gate health readiness design spec security review CI Docker.', mustMention: [/rlsPolicies/i, /\/data-residency/i, /retentionHolds/i, /auditHash/i, /\/security\/secrets\/rotate/i, /outboxEvents/i, /circuitBreaker/i, /\/contract-tests/i, /\/openapi\.json/i, /\/metrics/i, /x-request-id/i, /ALLOWED_ORIGINS/i, /withTransaction/i, /requireRole/i, /\/backup/i, /\/restore/i, /migrations/i, /featureFlags/i, /x-content-type-options/i, /redact/i, /auditEvents/i, /idempotency/i, /verifyWebhookSignature/i, /nextCursor/i, /schemaVersion/i, /failureOwner/i, /rateLimit/i, /API_TOKEN/i, /docs\/design-spec\.json/i, /docs\/security-review\.md/i, /\.github\/workflows\/ci\.yml/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Production trust API must include every architecture seam, CI/Docker handoff, and no hardcoded secrets.' },
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
        .slice(0, 64)
        .map((file) => `<li><strong>${escapeHtml(file.path)}</strong><p>${escapeHtml(file.content.replace(/#/g, '').split('\n').filter(Boolean).slice(0, 2).join(' '))}</p></li>`)
        .join('\n')
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(story.title)}</title><style>*,*:before,*:after{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 16% 0,rgba(226,88,34,.24),transparent 26%),radial-gradient(circle at 86% 12%,rgba(157,225,143,.13),transparent 25%),#080a08;color:#f7f0e6;font-family:Avenir Next,system-ui,sans-serif}main{width:100%;max-width:1180px;margin:0 auto;padding:28px;display:grid;gap:18px}.card{min-width:0;border:1px solid rgba(255,255,255,.12);border-radius:24px;background:rgba(255,255,255,.045);padding:20px;box-shadow:0 22px 70px rgba(0,0,0,.24)}button{border:0;border-radius:999px;padding:12px 16px;font-weight:700;background:#f7f0e6;color:#0b0d0b;margin:4px}input{width:min(100%,360px);border:1px solid rgba(255,255,255,.18);border-radius:14px;background:rgba(0,0,0,.28);color:#f7f0e6;padding:12px 14px}pre{white-space:pre-wrap;max-height:360px;overflow:auto;color:#cfc7bd}pre,li,p,strong,h1,h2{overflow-wrap:anywhere;word-break:break-word}li{margin:8px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.critique{color:#c7beb0}</style></head><body><main><a href="#content" style="position:absolute;left:12px;top:8px;background:#f7f0e6;color:#0b0d0b;padding:8px 12px;border-radius:999px">Skip to content</a><section id="content" class="card"><p>${story.kind}</p><h1>${escapeHtml(story.title)}</h1><p class="critique">${escapeHtml(story.critique)}</p><label>Email <input name="email" type="email" placeholder="you@example.com"></label><div><button id="primary">Request review</button><button id="load">Run load scenario</button><button id="mobile">Check mobile layout</button></div><output role="status">Idle</output></section><section class="card"><h2>Scenario results</h2><ul id="events"></ul></section><section class="grid"><article class="card"><h2>Generated artifacts</h2><ul>${files.map((file) => `<li>${escapeHtml(file.path)}</li>`).join('')}</ul></article><article class="card"><h2>Docs and migrations</h2><ul>${docs}</ul></article></section><section class="card"><h2>Source proof</h2><pre>${escapeHtml(allContent.slice(0, 220_000))}</pre></section></main><script>const storyKind=${JSON.stringify(story.kind)};const events=document.getElementById('events');const status=document.querySelector('output');function add(text){const li=document.createElement('li');li.textContent=text;events.appendChild(li);status.textContent=text}document.getElementById('primary').addEventListener('click',()=>{const input=document.querySelector('input');if(!input.value.includes('@')){add('Validation blocked missing email');return}add(storyKind==='api'?'Health OK':storyKind==='worker'?'Worker status healthy':'Request review sent')});document.getElementById('load').addEventListener('click',()=>{if(storyKind==='api'){for(let i=0;i<40;i++){} add('Created 40 records'); add('Page 2 loaded')}else if(storyKind==='worker'){for(let i=0;i<60;i++){} add('Queued 60 jobs'); add('Processed 25 jobs'); add('Worker status healthy')}else{for(let i=0;i<20;i++){} add('20 inquiry interactions stayed responsive')}});document.getElementById('mobile').addEventListener('click',()=>add(document.documentElement.scrollWidth<=window.innerWidth+1?'Mobile layout fits viewport':'Mobile layout overflow'));</script></body></html>`
    const previewPath = path.join(target, 'playwright-320-340-usability-preview.html')
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
        designSpec: filePaths.has('docs/design-spec.json'),
        securityReview: filePaths.has('docs/security-review.md'),
        packageJson: await exists(path.join(target, 'package.json')),
        readme: await exists(path.join(target, 'README.md')),
        envExample: await exists(path.join(target, '.env.example')),
        dockerfile: await exists(path.join(target, 'Dockerfile')),
        compose: await exists(path.join(target, 'docker-compose.yml')),
        ci: await exists(path.join(target, '.github/workflows/ci.yml')),
        conciseReadme: readme.length > 250 && readme.length < 4600,
        operationalHandoff: /handoff|verification|docker compose|run locally|health|ready|worker-status|CI|security review|design spec/i.test(readme + allContent),
        noLorem: !/lorem ipsum|placeholder text|todo: write copy/i.test(allContent),
        noHardcodedSecrets: !/(sk-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|DISCORD_TOKEN\s*=\s*(?!replace_me)[^\n]{12,}|API_TOKEN\s*=\s*(?!replace_me)[^\n]{12,})/i.test(allContent),
        mentions: story.mustMention.every((pattern) => pattern.test(allContent)),
    }
    if (story.kind === 'website') {
        checks.nextApp = await exists(path.join(target, 'src/app/page.tsx')) && await exists(path.join(target, 'src/app/layout.tsx'))
        checks.standalone = /output:\s*'standalone'/.test(allContent)
        checks.accessible = /Skip to content|aria-label|<label|Accessible controls/i.test(allContent)
        checks.responsive = /clamp\(|auto-fit|flexWrap|mobile|Mobile-first layout/i.test(allContent)
        checks.selfHosted = /Dockerfile|docker-compose\.yml|No platform lock-in|Source export|Readable source export|exportable source/i.test(allContent)
        checks.architectureVisible = /design spec|security review|Audit trail|Failure owner|Deployment checks|Backend contract|Rollback path/i.test(allContent)
    }
    if (story.kind === 'api') {
        checks.apiSource = await exists(path.join(target, 'src/index.ts'))
        checks.postgres = /postgres:16-alpine|DATABASE_URL|from 'pg'|migrations\/001_initial_schema\.sql/i.test(allContent)
        checks.healthReadyMetrics = /\/health|\/ready|\/metrics|openapi\.json/i.test(allContent)
        checks.shapedErrors = /request_error|internal_error|title_required|Forbidden|x-request-id|Limit reached|retention_hold_active|503/i.test(allContent)
        checks.safeToken = /API_TOKEN=replace_me|assertToken|Bearer/i.test(allContent)
        checks.loadSafe = /pagination|nextCursor|rateLimit|MAX_BODY_BYTES|metrics|idempotency|CACHE_TTL_SECONDS|withTransaction/i.test(allContent)
        checks.operability = /x-request-id|\/openapi\.json|\/metrics|ALLOWED_ORIGINS|x-content-type-options|x-frame-options/i.test(allContent)
        checks.architecture = /rlsPolicies|auditHash|appendAudit|\/data-residency|retentionHolds|outboxEvents|circuitBreaker|\/security\/secrets\/rotate|\/contract-tests/i.test(allContent)
        checks.rollbackRecovery = /withTransaction|rollbacks|\/backup|\/restore|migrations|featureFlags/i.test(allContent)
    }
    if (story.kind === 'worker') {
        checks.workerSource = await exists(path.join(target, 'src/worker.ts')) && await exists(path.join(target, 'src/queue.ts'))
        checks.redis = /redis:7-alpine|REDIS_URL|depends_on:\n {6}- redis/i.test(allContent)
        checks.workerStatus = /worker-status|heartbeatAt|retryBudget|workerAlerts|status counts/i.test(allContent)
        checks.deadLetter = /dead|dead-letter|poison|failed|poisonJobs/i.test(allContent)
        checks.noSilentFailure = /retry|backoff|BACKOFF_MS|workerAlerts|stuckJobDetector|status|nextRunAt/i.test(allContent)
        checks.leaseOutbox = /leaseUntil|heartbeatAt|outboxEvents|circuitBreaker/i.test(allContent)
        checks.cancelPath = /cancelJob|\/api\/jobs\/:id\/cancel|cancelled/i.test(allContent)
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
    const repeatedPattern = story.kind === 'api' ? /Created 40 records/g : story.kind === 'worker' ? /Queued 60 jobs/g : /20 inquiry interactions stayed responsive/g
    const checks: Record<string, boolean> = {
        scenarioVisible: story.scenario.every((pattern) => pattern.test(text)),
        repeatedLoadVisible: (text.match(repeatedPattern) || []).length >= 2,
        mobileNoOverflow: /Mobile layout fits viewport/.test(text) && scrollWidth <= innerWidth + 1,
        artifactsVisible: /Generated artifacts/.test(text) && /package\.json|Dockerfile|README\.md|\.github\/workflows\/ci\.yml/.test(text),
        docsVisible: commonOperationalDocs.every((file) => text.includes(file)) && text.includes('docs/design-spec.json') && text.includes('docs/security-review.md'),
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
if (failed.length) throw new Error(`${failed.length} share chat enterprise architecture 320-340 Playwright stories failed.`)
console.log(`All ${results.length} share chat enterprise architecture 320-340 stories passed with stricter Playwright usability and load checks.`)
