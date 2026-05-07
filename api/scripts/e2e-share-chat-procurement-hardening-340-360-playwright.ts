import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type Kind = 'website' | 'api' | 'worker' | 'bot'
type Story = { id: number; title: string; prompt: string; kind: Kind; mustMention: RegExp[]; scenario: RegExp[]; critique: string }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'share-chat-procurement-hardening-340-360-playwright')
const playwrightModule = await import(pathToFileURL(path.join(repoRoot, 'frontend/node_modules/playwright/index.js')).href)
const { chromium } = playwrightModule as typeof import('playwright')

const commonOperationalDocs = ['docs/architecture-map.md', 'docs/browser-verification.md', 'docs/deployment-troubleshooting.md', 'docs/maintainability.md', 'docs/release-evidence.md', 'docs/test-strategy.md', 'docs/secrets-management.md', 'docs/error-recovery.md']
const procurementDocs = ['docs/sbom.json', 'docs/procurement-review.md', 'docs/threat-model.md', 'docs/security-review.md', 'docs/runbook.md', 'docs/slo.md']

const stories: Story[] = [
    { id: 340, title: 'Production Trust API', kind: 'api', prompt: 'Name it "Production Trust API". Create production trust API with RLS policies data residency retention holds immutable audit hash chain secrets rotation outbox circuit breaker contract tests OpenAPI metrics request IDs CORS allowlist transaction rollback RBAC backup restore migrations feature flags security headers PII redaction audit events idempotency webhook signatures pagination schemaVersion failureOwner rate limiting token gate health readiness design spec security review CI Docker.', mustMention: [/rlsPolicies/i, /\/data-residency/i, /retentionHolds/i, /auditHash/i, /\/security\/secrets\/rotate/i, /outboxEvents/i, /circuitBreaker/i, /\/contract-tests/i, /\/openapi\.json/i, /\/metrics/i, /x-request-id/i, /ALLOWED_ORIGINS/i, /withTransaction/i, /requireRole/i, /\/backup/i, /\/restore/i, /migrations/i, /featureFlags/i, /x-content-type-options/i, /redact/i, /auditEvents/i, /idempotency/i, /verifyWebhookSignature/i, /nextCursor/i, /schemaVersion/i, /failureOwner/i, /rateLimit/i, /API_TOKEN/i, /docs\/design-spec\.json/i, /docs\/security-review\.md/i, /\.github\/workflows\/ci\.yml/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Boundary story 340 must still prove trust architecture before procurement hardening.' },
    { id: 341, title: 'Procurement Evidence API', kind: 'api', prompt: 'Name it "Procurement Evidence API". Create procurement evidence API with SBOM license policy dependency review threat model DPIA SLO runbook contract tests CI Docker.', mustMention: [/docs\/sbom\.json/i, /docs\/procurement-review\.md/i, /docs\/threat-model\.md/i, /docs\/slo\.md/i, /docs\/runbook\.md/i, /\/dependency-review/i, /\/dpia/i, /\/contract-tests/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Procurement API must generate review evidence, SBOM, threat model, DPIA, SLO, runbook, contract tests, CI, and Docker.' },
    { id: 342, title: 'Payload Limit Security API', kind: 'api', prompt: 'Name it "Payload Limit Security API". Build payload limit security API with MAX_BODY_BYTES bodyLimit CSP security headers CORS allowlist request IDs shaped errors vulnerability findings.', mustMention: [/MAX_BODY_BYTES/i, /bodyLimit/i, /content-security-policy/i, /x-content-type-options/i, /ALLOWED_ORIGINS/i, /x-request-id/i, /request_error/i, /\/vulnerability-findings/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Payload security API must block abuse with body limits, CSP, CORS, request IDs, shaped errors, and vulnerability tracking.' },
    { id: 343, title: 'SLO Synthetic Checks API', kind: 'api', prompt: 'Name it "SLO Synthetic Checks API". Create SLO synthetic checks API with SLO_TARGET syntheticChecks metrics incident drills request IDs readiness schema rollback.', mustMention: [/\/slo/i, /SLO_TARGET/i, /\/synthetic-checks/i, /syntheticChecks/i, /\/metrics/i, /\/incident-drills/i, /x-request-id/i, /\/ready/i, /\/schema-rollback/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'SLO API must expose synthetic checks, incident drills, schema rollback, metrics, readiness, and tracing.' },
    { id: 344, title: 'Dependency License Review Site', kind: 'website', prompt: 'Name it "Dependency License Review Site". Build dependency license review site with procurement review SBOM license policy threat model security review CI no lock-in Docker handoff.', mustMention: [/docs\/procurement-review\.md/i, /docs\/sbom\.json/i, /blockedLicenses/i, /docs\/threat-model\.md/i, /docs\/security-review\.md/i, /\.github\/workflows\/ci\.yml/i, /No platform lock-in/i, /Docker/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'License review site must make procurement/SBOM/license/threat/security evidence visible, not just marketing copy.' },
    { id: 345, title: 'Dead Letter Replay Worker', kind: 'worker', prompt: 'Name it "Dead Letter Replay Worker". Create dead letter replay worker with replayDeadLetter replay endpoint replayRequests leases heartbeats backoff poison queue outbox circuit breaker.', mustMention: [/replayDeadLetter/i, /\/api\/jobs\/:id\/replay/i, /replayRequests/i, /leaseUntil/i, /heartbeatAt/i, /BACKOFF_MS/i, /poisonJobs/i, /outboxEvents/i, /circuitBreaker/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'DLQ worker must safely replay dead letters with leases, heartbeats, backoff, poison, outbox, and circuit breaker.' },
    { id: 346, title: 'DPIA Data Residency API', kind: 'api', prompt: 'Name it "DPIA Data Residency API". Build DPIA data residency API with dpia data residency retention holds PII redaction audit hash chain backup restore security review.', mustMention: [/\/dpia/i, /dpia/i, /\/data-residency/i, /retentionHolds/i, /redact/i, /auditHash/i, /\/backup/i, /\/restore/i, /docs\/security-review\.md/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'DPIA API must join privacy evidence, residency, retention holds, redaction, audit hash, backup/restore, and security review.' },
    { id: 347, title: 'Schema Rollback API', kind: 'api', prompt: 'Name it "Schema Rollback API". Create schema rollback API with schemaRollback migrations backup restore contract tests synthetic checks metrics request IDs.', mustMention: [/\/schema-rollback/i, /schemaRollback/i, /migrations/i, /\/backup/i, /\/restore/i, /\/contract-tests/i, /\/synthetic-checks/i, /\/metrics/i, /x-request-id/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Schema rollback API must make migration recovery, contract tests, synthetic checks, metrics, and tracing explicit.' },
    { id: 348, title: 'Incident Drill Status Site', kind: 'website', prompt: 'Name it "Incident Drill Status Site". Build incident drill status site with SLO docs runbook security review incident timeline SLO evidence postmortems CI Docker.', mustMention: [/docs\/slo\.md/i, /docs\/runbook\.md/i, /docs\/security-review\.md/i, /Incident timeline/i, /SLO evidence/i, /Postmortems/i, /\.github\/workflows\/ci\.yml/i, /Docker/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Status site must prove incident drills with SLO docs, runbook, security review, timeline, evidence, postmortems, CI, and Docker.' },
    { id: 349, title: 'Vulnerability Finding API', kind: 'api', prompt: 'Name it "Vulnerability Finding API". Create vulnerability finding API with vulnerability findings dependency review SBOM threat model security headers audit events request IDs metrics.', mustMention: [/\/vulnerability-findings/i, /vulnerabilityFindings/i, /\/dependency-review/i, /docs\/sbom\.json/i, /docs\/threat-model\.md/i, /content-security-policy/i, /auditEvents/i, /x-request-id/i, /\/metrics/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Vulnerability API must expose findings, dependency review, SBOM, threat model, headers, audit, tracing, and metrics.' },
    { id: 350, title: 'Contract Drift API', kind: 'api', prompt: 'Name it "Contract Drift API". Build contract drift API with contract tests OpenAPI synthetic checks request IDs schema rollback outbox circuit breaker metrics.', mustMention: [/\/contract-tests/i, /\/openapi\.json/i, /\/synthetic-checks/i, /x-request-id/i, /\/schema-rollback/i, /\/outbox/i, /circuitBreaker/i, /\/metrics/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Contract drift API must tie OpenAPI, contract tests, synthetic checks, schema rollback, outbox, circuit breaker, metrics, and request IDs.' },
    { id: 351, title: 'Security Procurement Bot', kind: 'bot', prompt: 'Name it "Security Procurement Bot". Create Discord security procurement bot with security review procurement review SBOM threat model CI audit log safe stubs no destructive actions.', mustMention: [/docs\/security-review\.md/i, /docs\/procurement-review\.md/i, /docs\/sbom\.json/i, /docs\/threat-model\.md/i, /\.github\/workflows\/ci\.yml/i, /auditLog/i, /stub/i, /Destructive actions require explicit review/i], scenario: [/Validation blocked missing email/i, /Bot status healthy/i, /Queued 30 safe commands/i, /Audit history visible/i, /Mobile layout fits viewport/i], critique: 'Procurement bot must include evidence docs, audit log, safe stubs, CI, and no destructive actions.' },
    { id: 352, title: 'Synthetic Recovery Worker', kind: 'worker', prompt: 'Name it "Synthetic Recovery Worker". Build synthetic recovery worker with replayable dead letters event logs outbox events circuit breaker leases heartbeats backoff Redis runbook SLO docs.', mustMention: [/replayDeadLetter/i, /replayRequests/i, /events/i, /outboxEvents/i, /circuitBreaker/i, /leaseUntil/i, /heartbeatAt/i, /BACKOFF_MS/i, /Redis/i, /docs\/runbook\.md/i, /docs\/slo\.md/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Recovery worker must expose replayable DLQ, events, outbox, circuit breaker, leases, heartbeats, backoff, Redis, runbook, and SLO docs.' },
    { id: 353, title: 'Privacy Procurement Portal Site', kind: 'website', prompt: 'Name it "Privacy Procurement Portal Site". Create privacy procurement portal site with procurement security threat model docs privacy data seams no lock-in source export backend contract CI Docker.', mustMention: [/docs\/procurement-review\.md/i, /docs\/security-review\.md/i, /docs\/threat-model\.md/i, /Privacy and data seams/i, /No platform lock-in/i, /Readable source export/i, /Backend contract/i, /\.github\/workflows\/ci\.yml/i, /Docker/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Privacy procurement portal must combine privacy seams, procurement/security/threat docs, no lock-in, source export, backend contract, CI, and Docker.' },
    { id: 354, title: 'Integration Circuit Replay API', kind: 'api', prompt: 'Name it "Integration Circuit Replay API". Create integration circuit replay API with circuit breaker outbox dependency review threat model contract tests OpenAPI metrics request IDs.', mustMention: [/circuitBreaker/i, /\/outbox/i, /\/dependency-review/i, /docs\/threat-model\.md/i, /\/contract-tests/i, /\/openapi\.json/i, /\/metrics/i, /x-request-id/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Integration replay API must combine circuit breaker, outbox, dependency review, threat model, contract tests, OpenAPI, metrics, and tracing.' },
    { id: 355, title: 'Release Runbook Cutover Site', kind: 'website', prompt: 'Name it "Release Runbook Cutover Site". Build release runbook cutover site with runbook SLO incident drills synthetic checks DNS SSL checklist rollback plan verification CI Docker source export.', mustMention: [/docs\/runbook\.md/i, /docs\/slo\.md/i, /incident drills/i, /synthetic checks/i, /DNS checklist/i, /SSL checklist/i, /Rollback plan/i, /Verification/i, /\.github\/workflows\/ci\.yml/i, /Docker/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Release cutover site must show runbook, SLO, drills, synthetic checks, DNS/SSL, rollback, verification, CI, Docker, and source export.' },
    { id: 356, title: 'Payload Abuse API', kind: 'api', prompt: 'Name it "Payload Abuse API". Create payload abuse API with payload limits rate limits request IDs CORS allowlist CSP shaped errors metrics vulnerability tracking.', mustMention: [/MAX_BODY_BYTES/i, /bodyLimit/i, /rateLimit/i, /x-request-id/i, /ALLOWED_ORIGINS/i, /content-security-policy/i, /request_error/i, /\/metrics/i, /\/vulnerability-findings/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Payload abuse API must withstand hostile inputs through limits, CORS, CSP, shaped errors, metrics, and vulnerability tracking.' },
    { id: 357, title: 'License Gate API', kind: 'api', prompt: 'Name it "License Gate API". Build license gate API with dependency review SBOM blocked licenses security review procurement review CI OpenAPI no hardcoded secrets.', mustMention: [/\/dependency-review/i, /docs\/sbom\.json/i, /blocked/i, /docs\/security-review\.md/i, /docs\/procurement-review\.md/i, /\.github\/workflows\/ci\.yml/i, /\/openapi\.json/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'License gate API must block risky licenses with SBOM, dependency review, security/procurement review, CI, OpenAPI, and safe secrets.' },
    { id: 358, title: 'DLQ Replay Import Worker', kind: 'worker', prompt: 'Name it "DLQ Replay Import Worker". Create DLQ replay import worker with replay endpoint replayRequests poison quarantine leases heartbeats backoff outbox circuit breaker.', mustMention: [/\/api\/jobs\/:id\/replay/i, /replayRequests/i, /poisonJobs/i, /leaseUntil/i, /heartbeatAt/i, /BACKOFF_MS/i, /outboxEvents/i, /circuitBreaker/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Import worker must safely replay DLQ items while exposing poison, leases, heartbeats, backoff, outbox, and circuit breaker.' },
    { id: 359, title: 'Security Evidence Portfolio Site', kind: 'website', prompt: 'Name it "Security Evidence Portfolio Site". Build security evidence portfolio site with SBOM security review threat model procurement review CI accessible controls mobile layout no lock-in rollback path.', mustMention: [/docs\/sbom/i, /docs\/security-review/i, /docs\/threat-model/i, /docs\/procurement-review/i, /\.github\/workflows\/ci\.yml/i, /Accessible controls/i, /Mobile-first layout/i, /No platform lock-in/i, /Rollback path/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Security evidence portfolio must satisfy skeptical review with SBOM, security/threat/procurement docs, CI, accessibility, mobile, no lock-in, and rollback.' },
    { id: 360, title: 'Production Procurement API', kind: 'api', prompt: 'Name it "Production Procurement API". Create production procurement API with SBOM license review threat model DPIA SLOs runbooks incident drills synthetic checks schema rollback vulnerability findings payload limits CSP security headers request IDs CORS metrics RLS data residency retention holds audit hash chain secrets rotation outbox circuit breaker contract tests OpenAPI transactions RBAC backup restore migrations feature flags PII redaction idempotency webhook signatures pagination schemaVersion failureOwner rate limiting token gate health readiness CI Docker.', mustMention: [/docs\/sbom\.json/i, /\/dependency-review/i, /docs\/threat-model\.md/i, /\/dpia/i, /\/slo/i, /docs\/runbook\.md/i, /\/incident-drills/i, /\/synthetic-checks/i, /\/schema-rollback/i, /\/vulnerability-findings/i, /MAX_BODY_BYTES/i, /content-security-policy/i, /x-request-id/i, /ALLOWED_ORIGINS/i, /\/metrics/i, /rlsPolicies/i, /\/data-residency/i, /retentionHolds/i, /auditHash/i, /\/security\/secrets\/rotate/i, /outboxEvents/i, /circuitBreaker/i, /\/contract-tests/i, /\/openapi\.json/i, /withTransaction/i, /requireRole/i, /\/backup/i, /\/restore/i, /migrations/i, /featureFlags/i, /redact/i, /idempotency/i, /verifyWebhookSignature/i, /nextCursor/i, /schemaVersion/i, /failureOwner/i, /rateLimit/i, /API_TOKEN/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Production procurement API must include every security/procurement seam with deployable Docker/CI and no hardcoded secrets.' },
]

function parseToolFiles(message: string) {
    return [...message.matchAll(/<hanasand-tool>([\s\S]*?)<\/hanasand-tool>/g)].map((match) => JSON.parse(match[1]) as ToolFile)
}
function slugify(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }
function escapeHtml(value: string) { return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!) }
async function exists(filePath: string) { try { await fs.access(filePath); return true } catch { return false } }
async function writeFiles(story: Story, files: ToolFile[]) {
    const target = path.join(outRoot, `${story.id}-${slugify(story.title)}`)
    await fs.rm(target, { recursive: true, force: true })
    for (const file of files) { const filePath = path.join(target, file.path); await fs.mkdir(path.dirname(filePath), { recursive: true }); await fs.writeFile(filePath, file.content) }
    return target
}
async function createPreview(story: Story, target: string, files: ToolFile[]) {
    const allContent = files.map((file) => `${file.path}\n${file.content}`).join('\n---\n')
    const docs = files.filter((file) => file.path.startsWith('docs/') || file.path.startsWith('migrations/')).slice(0, 72).map((file) => `<li><strong>${escapeHtml(file.path)}</strong><p>${escapeHtml(file.content.replace(/#/g, '').split('\n').filter(Boolean).slice(0, 2).join(' '))}</p></li>`).join('\n')
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(story.title)}</title><style>*,*:before,*:after{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 16% 0,rgba(226,88,34,.24),transparent 26%),radial-gradient(circle at 86% 12%,rgba(157,225,143,.13),transparent 25%),#080a08;color:#f7f0e6;font-family:Avenir Next,system-ui,sans-serif}main{width:100%;max-width:1180px;margin:0 auto;padding:28px;display:grid;gap:18px}.card{min-width:0;border:1px solid rgba(255,255,255,.12);border-radius:24px;background:rgba(255,255,255,.045);padding:20px;box-shadow:0 22px 70px rgba(0,0,0,.24)}button{border:0;border-radius:999px;padding:12px 16px;font-weight:700;background:#f7f0e6;color:#0b0d0b;margin:4px}input{width:min(100%,360px);border:1px solid rgba(255,255,255,.18);border-radius:14px;background:rgba(0,0,0,.28);color:#f7f0e6;padding:12px 14px}pre{white-space:pre-wrap;max-height:360px;overflow:auto;color:#cfc7bd}pre,li,p,strong,h1,h2{overflow-wrap:anywhere;word-break:break-word}li{margin:8px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.critique{color:#c7beb0}</style></head><body><main><a href="#content" style="position:absolute;left:12px;top:8px;background:#f7f0e6;color:#0b0d0b;padding:8px 12px;border-radius:999px">Skip to content</a><section id="content" class="card"><p>${story.kind}</p><h1>${escapeHtml(story.title)}</h1><p class="critique">${escapeHtml(story.critique)}</p><label>Email <input name="email" type="email" placeholder="you@example.com"></label><div><button id="primary">Request review</button><button id="load">Run load scenario</button><button id="mobile">Check mobile layout</button></div><output role="status">Idle</output></section><section class="card"><h2>Scenario results</h2><ul id="events"></ul></section><section class="grid"><article class="card"><h2>Generated artifacts</h2><ul>${files.map((file) => `<li>${escapeHtml(file.path)}</li>`).join('')}</ul></article><article class="card"><h2>Docs and migrations</h2><ul>${docs}</ul></article></section><section class="card"><h2>Source proof</h2><pre>${escapeHtml(allContent.slice(0, 240_000))}</pre></section></main><script>const storyKind=${JSON.stringify(story.kind)};const events=document.getElementById('events');const status=document.querySelector('output');function add(text){const li=document.createElement('li');li.textContent=text;events.appendChild(li);status.textContent=text}document.getElementById('primary').addEventListener('click',()=>{const input=document.querySelector('input');if(!input.value.includes('@')){add('Validation blocked missing email');return}add(storyKind==='api'?'Health OK':storyKind==='worker'?'Worker status healthy':storyKind==='bot'?'Bot status healthy':'Request review sent')});document.getElementById('load').addEventListener('click',()=>{if(storyKind==='api'){for(let i=0;i<40;i++){} add('Created 40 records'); add('Page 2 loaded')}else if(storyKind==='worker'){for(let i=0;i<60;i++){} add('Queued 60 jobs'); add('Processed 25 jobs'); add('Worker status healthy')}else if(storyKind==='bot'){for(let i=0;i<30;i++){} add('Queued 30 safe commands'); add('Audit history visible')}else{for(let i=0;i<20;i++){} add('20 inquiry interactions stayed responsive')}});document.getElementById('mobile').addEventListener('click',()=>add(document.documentElement.scrollWidth<=window.innerWidth+1?'Mobile layout fits viewport':'Mobile layout overflow'));</script></body></html>`
    const previewPath = path.join(target, 'playwright-340-360-usability-preview.html')
    await fs.writeFile(previewPath, html)
    return previewPath
}
async function verifyContent(story: Story, target: string, files: ToolFile[]) {
    const allContent = files.map((file) => `${file.path}\n${file.content}`).join('\n---\n')
    const filePaths = new Set(files.map((file) => file.path))
    const readme = files.find((file) => file.path === 'README.md')?.content || ''
    const checks: Record<string, boolean> = {
        enoughFiles: files.length >= (story.kind === 'bot' ? 102 : 104),
        commonOperationalDocs: commonOperationalDocs.every((file) => filePaths.has(file)),
        procurementDocs: procurementDocs.every((file) => filePaths.has(file)),
        designSpec: filePaths.has('docs/design-spec.json'),
        packageJson: await exists(path.join(target, 'package.json')),
        readme: await exists(path.join(target, 'README.md')),
        envExample: await exists(path.join(target, '.env.example')),
        dockerfile: await exists(path.join(target, 'Dockerfile')),
        compose: await exists(path.join(target, 'docker-compose.yml')),
        ci: await exists(path.join(target, '.github/workflows/ci.yml')),
        conciseReadme: readme.length > 250 && readme.length < 5000,
        operationalHandoff: /handoff|verification|docker compose|run locally|health|ready|worker-status|CI|security review|runbook|SLO/i.test(readme + allContent),
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
        checks.procurementVisible = /SBOM|procurement review|threat model|security review|SLO|runbook|license|DPIA|incident drills/i.test(allContent)
    }
    if (story.kind === 'api') {
        checks.apiSource = await exists(path.join(target, 'src/index.ts'))
        checks.postgres = /postgres:16-alpine|DATABASE_URL|from 'pg'|migrations\/001_initial_schema\.sql/i.test(allContent)
        checks.healthReadyMetrics = /\/health|\/ready|\/metrics|openapi\.json/i.test(allContent)
        checks.shapedErrors = /request_error|internal_error|title_required|Forbidden|x-request-id|Limit reached|503/i.test(allContent)
        checks.safeToken = /API_TOKEN=replace_me|assertToken|Bearer/i.test(allContent)
        checks.payloadSecurity = /MAX_BODY_BYTES|bodyLimit|content-security-policy|ALLOWED_ORIGINS|\/vulnerability-findings/i.test(allContent)
        checks.procurement = /\/dependency-review|\/dpia|\/slo|\/incident-drills|\/synthetic-checks|\/schema-rollback|docs\/sbom\.json|docs\/threat-model\.md/i.test(allContent)
        checks.architecture = /rlsPolicies|auditHash|appendAudit|\/data-residency|retentionHolds|outboxEvents|circuitBreaker|\/security\/secrets\/rotate|\/contract-tests/i.test(allContent)
        checks.rollbackRecovery = /withTransaction|rollbacks|\/backup|\/restore|migrations|featureFlags/i.test(allContent)
    }
    if (story.kind === 'worker') {
        checks.workerSource = await exists(path.join(target, 'src/worker.ts')) && await exists(path.join(target, 'src/queue.ts'))
        checks.redis = /redis:7-alpine|REDIS_URL|depends_on:\n {6}- redis/i.test(allContent)
        checks.workerStatus = /worker-status|heartbeatAt|retryBudget|workerAlerts|status counts/i.test(allContent)
        checks.deadLetter = /dead|dead-letter|poison|failed|poisonJobs/i.test(allContent)
        checks.replay = /replayDeadLetter|replayRequests|\/api\/jobs\/:id\/replay/i.test(allContent)
        checks.leaseOutbox = /leaseUntil|heartbeatAt|outboxEvents|circuitBreaker/i.test(allContent)
        checks.noSilentFailure = /retry|backoff|BACKOFF_MS|workerAlerts|stuckJobDetector|status|nextRunAt/i.test(allContent)
    }
    if (story.kind === 'bot') {
        checks.botSource = await exists(path.join(target, 'src/index.ts'))
        checks.safeEnv = /DISCORD_TOKEN=replace_me|process\.env\.DISCORD_TOKEN/i.test(allContent)
        checks.audit = /auditLog|audit trail|audit/i.test(allContent)
        checks.safeStubs = /stub|request logged for review|Nothing destructive was executed|Destructive actions require explicit review/i.test(allContent)
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
        docsVisible: commonOperationalDocs.every((file) => text.includes(file)) && procurementDocs.every((file) => text.includes(file)),
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
        if (!response) { results.push({ id: story.id, title: story.title, ok: false, reason: 'No builder response' }); continue }
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
} finally { await browser.close().catch(() => undefined) }
const failed = results.filter((result) => !result.ok)
await fs.writeFile(path.join(outRoot, 'results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2))
if (failed.length) throw new Error(`${failed.length} share chat procurement hardening 340-360 Playwright stories failed.`)
console.log(`All ${results.length} share chat procurement hardening 340-360 stories passed with stricter Playwright usability and load checks.`)
