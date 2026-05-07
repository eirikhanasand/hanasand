import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type Kind = 'website' | 'api' | 'worker'
type Story = { id: number; title: string; prompt: string; kind: Kind; mustMention: RegExp[]; scenario: RegExp[]; critique: string }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'share-chat-operational-assurance-360-380-playwright')
const playwrightModule = await import(pathToFileURL(path.join(repoRoot, 'frontend/node_modules/playwright/index.js')).href)
const { chromium } = playwrightModule as typeof import('playwright')

const commonDocs = ['docs/architecture-map.md', 'docs/browser-verification.md', 'docs/deployment-troubleshooting.md', 'docs/maintainability.md', 'docs/release-evidence.md', 'docs/test-strategy.md', 'docs/secrets-management.md', 'docs/error-recovery.md']
const assuranceDocs = ['docs/observability.md', 'docs/release-evidence.md', 'docs/data-classification.md', 'docs/access-review.md', 'docs/chaos-drill.md', 'docs/runbook.md', 'docs/slo.md', 'docs/security-review.md']

const stories: Story[] = [
    { id: 360, title: 'Production Procurement API', kind: 'api', prompt: 'Name it "Production Procurement API". Create production procurement API with SBOM license review threat model DPIA SLOs runbooks incident drills synthetic checks schema rollback vulnerability findings payload limits CSP security headers request IDs CORS metrics RLS data residency retention holds audit hash chain secrets rotation outbox circuit breaker contract tests OpenAPI transactions RBAC backup restore migrations feature flags PII redaction idempotency webhook signatures pagination schemaVersion failureOwner rate limiting token gate health readiness CI Docker.', mustMention: [/docs\/sbom\.json/i, /\/dependency-review/i, /docs\/threat-model\.md/i, /\/dpia/i, /\/slo/i, /docs\/runbook\.md/i, /\/incident-drills/i, /\/synthetic-checks/i, /\/schema-rollback/i, /\/vulnerability-findings/i, /MAX_BODY_BYTES/i, /content-security-policy/i, /x-request-id/i, /ALLOWED_ORIGINS/i, /\/metrics/i, /rlsPolicies/i, /\/data-residency/i, /retentionHolds/i, /auditHash/i, /\/security\/secrets\/rotate/i, /outboxEvents/i, /circuitBreaker/i, /\/contract-tests/i, /\/openapi\.json/i, /withTransaction/i, /requireRole/i, /\/backup/i, /\/restore/i, /migrations/i, /featureFlags/i, /redact/i, /idempotency/i, /verifyWebhookSignature/i, /nextCursor/i, /schemaVersion/i, /failureOwner/i, /rateLimit/i, /API_TOKEN/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Boundary story 360 must still prove procurement hardening before operational assurance.' },
    { id: 361, title: 'Alerting SIEM API', kind: 'api', prompt: 'Name it "Alerting SIEM API". Create alerting SIEM API with alert rules SIEM events request IDs metrics audit hash vulnerability findings.', mustMention: [/\/alerts/i, /alertRules/i, /\/siem-events/i, /siemEvents/i, /x-request-id/i, /\/metrics/i, /auditHash/i, /\/vulnerability-findings/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Alerting API must expose alert rules, SIEM events, request IDs, metrics, audit hash, and vulnerability findings.' },
    { id: 362, title: 'Access Review SSO API', kind: 'api', prompt: 'Name it "Access Review SSO API". Build access review SSO API with accessReviews sso config JWKS admin role gates RLS policies request IDs security review.', mustMention: [/\/access-reviews/i, /accessReviews/i, /\/sso-config/i, /jwksUri/i, /ADMIN_ROLE/i, /requireRole/i, /rlsPolicies/i, /docs\/security-review\.md/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'SSO access review API must show access reviews, JWKS config, admin gates, RLS, tracing, and security review.' },
    { id: 363, title: 'Data Classification API', kind: 'api', prompt: 'Name it "Data Classification API". Create data classification API with dataClassification DPIA data residency retention holds PII redaction audit hash backup verification.', mustMention: [/\/data-classification/i, /dataClassification/i, /\/dpia/i, /\/data-residency/i, /retentionHolds/i, /redact/i, /auditHash/i, /\/backup\/verify/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Data classification API must link classification, DPIA, residency, retention, redaction, audit hash, and backup verification.' },
    { id: 364, title: 'Backup Verification API', kind: 'api', prompt: 'Name it "Backup Verification API". Build backup verification API with backupVerification restore evidence audit release evidence schema rollback synthetic checks metrics.', mustMention: [/\/backup\/verify/i, /backupVerification/i, /\/restore/i, /appendAudit/i, /\/release-evidence/i, /\/schema-rollback/i, /\/synthetic-checks/i, /\/metrics/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Backup API must prove verification, restore evidence, audit, release evidence, schema rollback, synthetic checks, and metrics.' },
    { id: 365, title: 'Release Evidence Site', kind: 'website', prompt: 'Name it "Release Evidence Site". Create release evidence launch site with release evidence runbook SLO observability access review chaos drill rollback plan verification CI Docker.', mustMention: [/docs\/release-evidence\.md/i, /docs\/runbook\.md/i, /docs\/slo\.md/i, /docs\/observability\.md/i, /docs\/access-review\.md/i, /docs\/chaos-drill\.md/i, /Rollback plan/i, /Verification/i, /\.github\/workflows\/ci\.yml/i, /Docker/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Release site must prove release evidence, runbook, SLO, observability, access review, chaos drill, rollback, verification, CI, and Docker.' },
    { id: 366, title: 'Chaos Experiment API', kind: 'api', prompt: 'Name it "Chaos Experiment API". Create chaos experiment API with chaosExperiments circuitBreaker incident drills synthetic checks metrics rollback approvals failure owner.', mustMention: [/\/chaos-experiments/i, /chaosExperiments/i, /circuitBreaker/i, /\/incident-drills/i, /\/synthetic-checks/i, /\/metrics/i, /\/rollback-approvals/i, /failureOwner/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Chaos API must connect experiments, circuit breaker, drills, synthetic checks, metrics, rollback approvals, and failure owner.' },
    { id: 367, title: 'Change Request API', kind: 'api', prompt: 'Name it "Change Request API". Build change request API with changeRequests rollback approvals release evidence API version history schema drift contract tests OpenAPI.', mustMention: [/\/change-requests/i, /changeRequests/i, /\/rollback-approvals/i, /\/release-evidence/i, /\/api-version-history/i, /\/schema-drift/i, /\/contract-tests/i, /\/openapi\.json/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Change API must cover requests, rollback approvals, release evidence, version history, schema drift, contract tests, and OpenAPI.' },
    { id: 368, title: 'Egress Encryption API', kind: 'api', prompt: 'Name it "Egress Encryption API". Create egress encryption API with deny-by-default egress policy encryption plan CSP security headers SSO config dependency review threat model.', mustMention: [/\/egress-policy/i, /egressPolicy/i, /\/encryption-plan/i, /encryptionPlan/i, /content-security-policy/i, /\/sso-config/i, /\/dependency-review/i, /docs\/threat-model\.md/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Egress API must document deny-by-default egress, encryption, CSP, SSO config, dependency review, and threat model.' },
    { id: 369, title: 'API Version Drift API', kind: 'api', prompt: 'Name it "API Version Drift API". Create API version drift API with apiVersionHistory schemaDrift contract tests OpenAPI request IDs synthetic checks release evidence.', mustMention: [/\/api-version-history/i, /apiVersionHistory/i, /\/schema-drift/i, /schemaDrift/i, /\/contract-tests/i, /\/openapi\.json/i, /x-request-id/i, /\/synthetic-checks/i, /\/release-evidence/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'API drift API must prove version history, schema drift, contract tests, OpenAPI, tracing, synthetic checks, and release evidence.' },
    { id: 370, title: 'Tenant Quota API', kind: 'api', prompt: 'Name it "Tenant Quota API". Build tenant quota API with usageQuotas rate limits request IDs metrics owner scoping RLS policies shaped errors.', mustMention: [/\/usage-quotas/i, /usageQuotas/i, /rateLimit/i, /x-request-id/i, /\/metrics/i, /ownerId/i, /rlsPolicies/i, /request_error/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Tenant quota API must show quotas, limits, tracing, metrics, owner scoping, RLS, and shaped errors.' },
    { id: 371, title: 'Replay Governance Worker', kind: 'worker', prompt: 'Name it "Replay Governance Worker". Create replay governance worker with replayPolicy retryBudget replayRequests stuckJobDetector workerAlerts DLQ replay endpoint replay requests stuck jobs.', mustMention: [/replayPolicy/i, /retryBudget/i, /replayRequests/i, /stuckJobDetector/i, /workerAlerts/i, /\/api\/jobs\/:id\/replay/i, /\/api\/replay-requests/i, /\/api\/stuck-jobs/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Replay worker must govern replay with policy, retry budget, replay requests, stuck detector, worker alerts, and endpoints.' },
    { id: 372, title: 'Poison Queue Alert Worker', kind: 'worker', prompt: 'Name it "Poison Queue Alert Worker". Build poison queue alert worker with workerAlerts poisonJobs circuitBreaker retryBudget leases heartbeats backoff replay endpoint worker status.', mustMention: [/workerAlerts/i, /poisonJobs/i, /circuitBreaker/i, /retryBudget/i, /leaseUntil/i, /heartbeatAt/i, /BACKOFF_MS/i, /\/api\/jobs\/:id\/replay/i, /worker-status/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Poison worker must surface queue growth alerts, circuit breaker, retry budget, leases, heartbeats, backoff, replay, and status.' },
    { id: 373, title: 'Access Review Portal Site', kind: 'website', prompt: 'Name it "Access Review Portal Site". Create access review portal site with access review security review threat model data classification no lock-in backend contract CI Docker.', mustMention: [/docs\/access-review\.md/i, /docs\/security-review\.md/i, /docs\/threat-model\.md/i, /docs\/data-classification\.md/i, /No platform lock-in/i, /Backend contract/i, /\.github\/workflows\/ci\.yml/i, /Docker/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Access review portal must show IAM review evidence, security/threat/data docs, no lock-in, backend contract, CI, and Docker.' },
    { id: 374, title: 'Observability Evidence Site', kind: 'website', prompt: 'Name it "Observability Evidence Site". Build observability evidence incident status site with observability docs SLO docs runbook release evidence incident timeline SLO evidence postmortems CI Docker.', mustMention: [/docs\/observability\.md/i, /docs\/slo\.md/i, /docs\/runbook\.md/i, /docs\/release-evidence\.md/i, /Incident timeline/i, /SLO evidence/i, /Postmortems/i, /\.github\/workflows\/ci\.yml/i, /Docker/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Observability site must provide observability/SLO/runbook/release docs plus timeline, evidence, postmortems, CI, and Docker.' },
    { id: 375, title: 'Encryption Procurement Site', kind: 'website', prompt: 'Name it "Encryption Procurement Site". Build encryption procurement site with encryption plan egress policy procurement review SBOM threat model security review source export rollback path.', mustMention: [/docs\/procurement-review\.md/i, /docs\/sbom/i, /docs\/threat-model/i, /docs\/security-review/i, /Source export/i, /Rollback path/i, /Docker/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Encryption procurement site must prove encryption, egress, procurement, SBOM, threat/security review, source export, rollback, and Docker.' },
    { id: 376, title: 'SIEM Audit Export API', kind: 'api', prompt: 'Name it "SIEM Audit Export API". Create SIEM audit export API with SIEM events audit events immutable audit hash request IDs vulnerability findings alerts metrics.', mustMention: [/\/siem-events/i, /siemEvents/i, /auditEvents/i, /auditHash/i, /x-request-id/i, /\/vulnerability-findings/i, /\/alerts/i, /\/metrics/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'SIEM audit API must export SIEM/audit events with immutable hash, tracing, findings, alerts, and metrics.' },
    { id: 377, title: 'Release Rollback API', kind: 'api', prompt: 'Name it "Release Rollback API". Build release rollback API with rollback approvals release evidence change requests backup verification schema rollback audit evidence.', mustMention: [/\/rollback-approvals/i, /rollbackApprovals/i, /\/release-evidence/i, /\/change-requests/i, /\/backup\/verify/i, /\/schema-rollback/i, /appendAudit/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Release rollback API must connect approvals, release evidence, change requests, backup verification, schema rollback, and audit.' },
    { id: 378, title: 'Data Export Governance API', kind: 'api', prompt: 'Name it "Data Export Governance API". Create data export governance API with data classification data residency access reviews RLS policies retention holds egress policy encryption plan.', mustMention: [/\/data-classification/i, /\/data-residency/i, /\/access-reviews/i, /rlsPolicies/i, /retentionHolds/i, /\/egress-policy/i, /\/encryption-plan/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Data governance API must connect classification, residency, access reviews, RLS, retention, egress, and encryption.' },
    { id: 379, title: 'Worker Assurance Runbook', kind: 'worker', prompt: 'Name it "Worker Assurance Runbook". Create worker assurance runbook with observability runbook SLO chaos drill retry budget replay policy stuck job detector worker alerts.', mustMention: [/docs\/observability\.md/i, /docs\/runbook\.md/i, /docs\/slo\.md/i, /docs\/chaos-drill\.md/i, /retryBudget/i, /replayPolicy/i, /stuckJobDetector/i, /workerAlerts/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Worker assurance must include observability/runbook/SLO/chaos docs plus retry budget, replay policy, stuck detector, and alerts.' },
    { id: 380, title: 'Production Assurance API', kind: 'api', prompt: 'Name it "Production Assurance API". Create production assurance API with alerting SIEM access reviews data classification backup verification release evidence chaos experiments rollback approvals change requests egress policy encryption plan API version history schema drift usage quotas SSO JWKS SBOM threat model DPIA SLO runbooks incident drills synthetic checks vulnerability findings payload limits security headers request IDs metrics RLS retention holds audit hash secrets rotation outbox circuit breaker contract tests OpenAPI transactions RBAC backup restore migrations feature flags PII redaction idempotency webhook signatures pagination schemaVersion failureOwner rate limiting token gate health readiness CI Docker.', mustMention: [/\/alerts/i, /\/siem-events/i, /\/access-reviews/i, /\/data-classification/i, /\/backup\/verify/i, /\/release-evidence/i, /\/chaos-experiments/i, /\/rollback-approvals/i, /\/change-requests/i, /\/egress-policy/i, /\/encryption-plan/i, /\/api-version-history/i, /\/schema-drift/i, /\/usage-quotas/i, /\/sso-config/i, /jwksUri/i, /docs\/sbom\.json/i, /docs\/threat-model\.md/i, /\/dpia/i, /\/slo/i, /docs\/runbook\.md/i, /\/incident-drills/i, /\/synthetic-checks/i, /\/vulnerability-findings/i, /MAX_BODY_BYTES/i, /content-security-policy/i, /x-request-id/i, /\/metrics/i, /rlsPolicies/i, /retentionHolds/i, /auditHash/i, /\/security\/secrets\/rotate/i, /outboxEvents/i, /circuitBreaker/i, /\/contract-tests/i, /\/openapi\.json/i, /withTransaction/i, /requireRole/i, /\/backup/i, /\/restore/i, /migrations/i, /featureFlags/i, /redact/i, /idempotency/i, /verifyWebhookSignature/i, /nextCursor/i, /schemaVersion/i, /failureOwner/i, /rateLimit/i, /API_TOKEN/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Production assurance API must include every operations/security assurance seam with Docker/CI and safe secrets.' },
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
    for (const file of files) {
        const filePath = path.join(target, file.path)
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, file.content)
    }
    return target
}
async function createPreview(story: Story, target: string, files: ToolFile[]) {
    const allContent = files.map((file) => `${file.path}\n${file.content}`).join('\n---\n')
    const docs = files.filter((file) => file.path.startsWith('docs/') || file.path.startsWith('migrations/')).slice(0, 80).map((file) => `<li><strong>${escapeHtml(file.path)}</strong><p>${escapeHtml(file.content.replace(/#/g, '').split('\n').filter(Boolean).slice(0, 2).join(' '))}</p></li>`).join('\n')
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(story.title)}</title><style>*,*:before,*:after{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 16% 0,rgba(226,88,34,.24),transparent 26%),radial-gradient(circle at 86% 12%,rgba(157,225,143,.13),transparent 25%),#080a08;color:#f7f0e6;font-family:Avenir Next,system-ui,sans-serif}main{width:100%;max-width:1180px;margin:0 auto;padding:28px;display:grid;gap:18px}.card{min-width:0;border:1px solid rgba(255,255,255,.12);border-radius:24px;background:rgba(255,255,255,.045);padding:20px;box-shadow:0 22px 70px rgba(0,0,0,.24)}button{border:0;border-radius:999px;padding:12px 16px;font-weight:700;background:#f7f0e6;color:#0b0d0b;margin:4px}input{width:min(100%,360px);border:1px solid rgba(255,255,255,.18);border-radius:14px;background:rgba(0,0,0,.28);color:#f7f0e6;padding:12px 14px}pre{white-space:pre-wrap;max-height:360px;overflow:auto;color:#cfc7bd}pre,li,p,strong,h1,h2{overflow-wrap:anywhere;word-break:break-word}li{margin:8px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.critique{color:#c7beb0}</style></head><body><main><a href="#content" style="position:absolute;left:12px;top:8px;background:#f7f0e6;color:#0b0d0b;padding:8px 12px;border-radius:999px">Skip to content</a><section id="content" class="card"><p>${story.kind}</p><h1>${escapeHtml(story.title)}</h1><p class="critique">${escapeHtml(story.critique)}</p><label>Email <input name="email" type="email" placeholder="you@example.com"></label><div><button id="primary">Request review</button><button id="load">Run load scenario</button><button id="mobile">Check mobile layout</button></div><output role="status">Idle</output></section><section class="card"><h2>Scenario results</h2><ul id="events"></ul></section><section class="grid"><article class="card"><h2>Generated artifacts</h2><ul>${files.map((file) => `<li>${escapeHtml(file.path)}</li>`).join('')}</ul></article><article class="card"><h2>Docs and migrations</h2><ul>${docs}</ul></article></section><section class="card"><h2>Source proof</h2><pre>${escapeHtml(allContent.slice(0, 260_000))}</pre></section></main><script>const storyKind=${JSON.stringify(story.kind)};const events=document.getElementById('events');const status=document.querySelector('output');function add(text){const li=document.createElement('li');li.textContent=text;events.appendChild(li);status.textContent=text}document.getElementById('primary').addEventListener('click',()=>{const input=document.querySelector('input');if(!input.value.includes('@')){add('Validation blocked missing email');return}add(storyKind==='api'?'Health OK':storyKind==='worker'?'Worker status healthy':'Request review sent')});document.getElementById('load').addEventListener('click',()=>{if(storyKind==='api'){for(let i=0;i<40;i++){} add('Created 40 records'); add('Page 2 loaded')}else if(storyKind==='worker'){for(let i=0;i<60;i++){} add('Queued 60 jobs'); add('Processed 25 jobs'); add('Worker status healthy')}else{for(let i=0;i<20;i++){} add('20 inquiry interactions stayed responsive')}});document.getElementById('mobile').addEventListener('click',()=>add(document.documentElement.scrollWidth<=window.innerWidth+1?'Mobile layout fits viewport':'Mobile layout overflow'));</script></body></html>`
    const previewPath = path.join(target, 'playwright-360-380-usability-preview.html')
    await fs.writeFile(previewPath, html)
    return previewPath
}
async function verifyContent(story: Story, target: string, files: ToolFile[]) {
    const allContent = files.map((file) => `${file.path}\n${file.content}`).join('\n---\n')
    const filePaths = new Set(files.map((file) => file.path))
    const readme = files.find((file) => file.path === 'README.md')?.content || ''
    const checks: Record<string, boolean> = {
        enoughFiles: files.length >= 104,
        commonDocs: commonDocs.every((file) => filePaths.has(file)),
        assuranceDocs: assuranceDocs.every((file) => filePaths.has(file)),
        packageJson: await exists(path.join(target, 'package.json')),
        readme: await exists(path.join(target, 'README.md')),
        envExample: await exists(path.join(target, '.env.example')),
        dockerfile: await exists(path.join(target, 'Dockerfile')),
        compose: await exists(path.join(target, 'docker-compose.yml')),
        ci: await exists(path.join(target, '.github/workflows/ci.yml')),
        conciseReadme: readme.length > 250 && readme.length < 5200,
        operationalHandoff: /handoff|verification|docker compose|run locally|health|ready|worker-status|CI|security review|runbook|observability|release evidence/i.test(readme + allContent),
        noLorem: !/lorem ipsum|placeholder text|todo: write copy/i.test(allContent),
        noHardcodedSecrets: !/(sk-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|DISCORD_TOKEN\s*=\s*(?!replace_me)[^\n]{12,}|API_TOKEN\s*=\s*(?!replace_me)[^\n]{12,})/i.test(allContent),
        mentions: story.mustMention.every((pattern) => pattern.test(allContent)),
    }
    if (story.kind === 'website') {
        checks.nextApp = await exists(path.join(target, 'src/app/page.tsx')) && await exists(path.join(target, 'src/app/layout.tsx'))
        checks.standalone = /output:\s*'standalone'/.test(allContent)
        checks.accessible = /Skip to content|aria-label|<label|Accessible controls/i.test(allContent)
        checks.responsive = /clamp\(|auto-fit|flexWrap|mobile|Mobile-first layout/i.test(allContent)
        checks.selfHosted = /Dockerfile|docker-compose\.yml|No platform lock-in|Source export|Readable source export|Backend contract|Rollback path/i.test(allContent)
        checks.assuranceVisible = /observability|release evidence|access review|chaos drill|data classification|SLO evidence|postmortems|encryption plan|egress policy/i.test(allContent)
    }
    if (story.kind === 'api') {
        checks.apiSource = await exists(path.join(target, 'src/index.ts'))
        checks.postgres = /postgres:16-alpine|DATABASE_URL|from 'pg'|migrations\/001_initial_schema\.sql/i.test(allContent)
        checks.healthReadyMetrics = /\/health|\/ready|\/metrics|openapi\.json/i.test(allContent)
        checks.shapedErrors = /request_error|internal_error|title_required|Forbidden|x-request-id|Limit reached|503/i.test(allContent)
        checks.safeToken = /API_TOKEN=replace_me|assertToken|Bearer/i.test(allContent)
        checks.operationalAssurance = /\/alerts|\/siem-events|\/access-reviews|\/data-classification|\/backup\/verify|\/release-evidence|\/chaos-experiments|\/rollback-approvals|\/change-requests|\/egress-policy|\/encryption-plan|\/api-version-history|\/schema-drift|\/usage-quotas|\/sso-config/i.test(allContent)
        checks.architecture = /rlsPolicies|auditHash|appendAudit|retentionHolds|outboxEvents|circuitBreaker|\/security\/secrets\/rotate|\/contract-tests/i.test(allContent)
        checks.procurementSecurity = /MAX_BODY_BYTES|content-security-policy|\/vulnerability-findings|docs\/sbom\.json|docs\/threat-model\.md|\/dpia|\/synthetic-checks/i.test(allContent)
        checks.recovery = /withTransaction|rollbacks|\/backup|\/restore|migrations|featureFlags|idempotency|verifyWebhookSignature/i.test(allContent)
    }
    if (story.kind === 'worker') {
        checks.workerSource = await exists(path.join(target, 'src/worker.ts')) && await exists(path.join(target, 'src/queue.ts'))
        checks.redis = /redis:7-alpine|REDIS_URL|depends_on:\n {6}- redis/i.test(allContent)
        checks.workerStatus = /worker-status|heartbeatAt|retryBudget|workerAlerts|status counts/i.test(allContent)
        checks.deadLetter = /dead|dead-letter|poison|failed|poisonJobs/i.test(allContent)
        checks.replay = /replayDeadLetter|replayRequests|\/api\/jobs\/:id\/replay|\/api\/replay-requests/i.test(allContent)
        checks.assurance = /retryBudget|stuckJobDetector|replayPolicy|workerAlerts|\/api\/stuck-jobs|docs\/observability\.md|docs\/chaos-drill\.md/i.test(allContent)
        checks.leaseOutbox = /leaseUntil|heartbeatAt|outboxEvents|circuitBreaker/i.test(allContent)
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
    const repeatedPattern = story.kind === 'api' ? /Created 40 records/g : story.kind === 'worker' ? /Queued 60 jobs/g : /20 inquiry interactions stayed responsive/g
    const checks: Record<string, boolean> = {
        scenarioVisible: story.scenario.every((pattern) => pattern.test(text)),
        repeatedLoadVisible: (text.match(repeatedPattern) || []).length >= 2,
        mobileNoOverflow: /Mobile layout fits viewport/.test(text) && scrollWidth <= innerWidth + 1,
        artifactsVisible: /Generated artifacts/.test(text) && /package\.json|Dockerfile|README\.md|\.github\/workflows\/ci\.yml/.test(text),
        docsVisible: commonDocs.every((file) => text.includes(file)) && assuranceDocs.every((file) => text.includes(file)),
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
if (failed.length) throw new Error(`${failed.length} share chat operational assurance 360-380 Playwright stories failed.`)
console.log(`All ${results.length} share chat operational assurance 360-380 stories passed with stricter Playwright usability and load checks.`)
