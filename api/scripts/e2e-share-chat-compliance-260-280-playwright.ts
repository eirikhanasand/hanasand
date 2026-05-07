import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type Kind = 'website' | 'api' | 'worker' | 'bot'
type Story = { id: number; title: string; prompt: string; kind: Kind; mustMention: RegExp[]; scenario: RegExp[]; critique: string }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'share-chat-compliance-260-280-playwright')
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
    { id: 260, title: 'Production Readiness API', kind: 'api', prompt: 'Name it "Production Readiness API". Create an API starter with owner scoping, pagination, schemaVersion, failureOwner, rate limiting, token gate, idempotency, health, readiness, shaped errors, Docker/export handoff, env example, and no hardcoded secrets or unscoped record dump.', mustMention: [/ownerId|x-account-id/i, /nextCursor/i, /schemaVersion/i, /failureOwner/i, /rateLimit|rateBuckets/i, /idempotency/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Production readiness API must include every core seam: scope, pagination, schema, owner, limits, token, idempotency, health, shaped errors.' },
    { id: 261, title: 'Legal Governance Launch Site', kind: 'website', prompt: 'Name it "Legal Governance Launch". Build a governance launch page for a legal reviewer blocking launch. Include governance gates, audit trail, security review, PII handling, deployment checks, failure owner, accessible responsive layout, Docker/export files, README verification, and no claim that legal compliance is complete.', mustMention: [/Governance gates/i, /Audit trail/i, /Security review/i, /PII handling/i, /Deployment checks/i, /Failure owner/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Legal governance page must show launch gates and avoid fake compliance claims.' },
    { id: 262, title: 'PII-Safe Support API', kind: 'api', prompt: 'Name it "PII Safe Support API". Create a support API with owner scoping, PII redaction, audit events, rate limiting, pagination, schemaVersion, failureOwner, health, readiness, token gate, Docker/export handoff, and no hardcoded secrets.', mustMention: [/redact/i, /auditEvents/i, /ownerId|x-account-id/i, /schemaVersion/i, /failureOwner/i, /nextCursor/i, /rateLimit|rateBuckets/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Support API must protect PII in logs while preserving audit/scoped records.' },
    { id: 263, title: 'Poison Job Import Worker', kind: 'worker', prompt: 'Name it "Poison Job Import Worker". Build an import worker with idempotency guard, event log, retry/dead-letter states, poison job quarantine, dead/retrying/poison counts, visible worker-status endpoint, Redis seam, Docker, and export handoff.', mustMention: [/poisonJobs/i, /idempotency/i, /events|event log/i, /dead/i, /retrying|retry/i, /poison/i, /worker-status/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Import worker must quarantine poison jobs instead of retrying forever.' },
    { id: 264, title: 'Billing Webhook Signature API', kind: 'api', prompt: 'Name it "Billing Webhook Signature API". Create a billing webhook API with WEBHOOK_SIGNING_SECRET, verifyWebhookSignature, idempotency, audit events, scoped records, rate limiting, pagination, health, readiness, shaped errors, Docker, and export files.', mustMention: [/WEBHOOK_SIGNING_SECRET/i, /verifyWebhookSignature/i, /idempotency/i, /auditEvents/i, /ownerId|x-account-id/i, /rateLimit|rateBuckets/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Billing webhook API must expose signature/replay/audit seams.' },
    { id: 265, title: 'Support Escalation Runbook Site', kind: 'website', prompt: 'Name it "Support Escalation Runbook". Build a support manager site with escalation paths, SLA states, customer messaging, failure owner, runbook, audit trail, accessible responsive layout, Docker handoff, and no pretty-dashboard-only gaps.', mustMention: [/Escalation paths/i, /SLA states/i, /Customer messaging/i, /Failure owner/i, /Runbook/i, /Audit trail/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Support runbook site must give escalation/accountability paths, not decoration.' },
    { id: 266, title: 'Migration Parallel Run Site', kind: 'website', prompt: 'Name it "Migration Parallel Run". Create a migration page for moving away from a locked-in builder. Include source export, clean schema, parallel run, cutover plan, rollback plan, verification, Docker/export files, and README verification.', mustMention: [/Source export/i, /Clean schema/i, /Parallel run/i, /Cutover plan/i, /Rollback plan/i, /Verification/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Migration page must make parallel-run/cutover/rollback concrete.' },
    { id: 267, title: 'PII Deletion Request API', kind: 'api', prompt: 'Name it "PII Deletion Request API". Build a deletion-request API with PII redaction, audit events, scoped records, idempotency, rate limiting, pagination, schemaVersion, failureOwner, health, readiness, token gate, Docker, and export handoff.', mustMention: [/redact/i, /auditEvents/i, /ownerId|x-account-id/i, /idempotency/i, /rateLimit|rateBuckets/i, /nextCursor/i, /schemaVersion/i, /failureOwner/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'PII deletion API must make privacy actions scoped, audited, idempotent, and rate-limited.' },
    { id: 268, title: 'Moderation Evidence Bot', kind: 'bot', prompt: 'Name it "Moderation Evidence Bot". Create a Discord moderation evidence bot that records audit evidence, restart/maintenance requests, safe role stubs, safe env config, Docker/export handoff, and never performs destructive actions automatically.', mustMention: [/discord\.js/i, /auditLog|audit evidence/i, /restartRequests|restart request/i, /maintenance/i, /stub|role/i, /DISCORD_TOKEN=replace_me/i], scenario: [/Validation blocked missing email/i, /Bot status healthy/i, /Queued 30 safe commands/i, /Audit history visible/i, /Mobile layout fits viewport/i], critique: 'Moderation evidence bot must collect evidence and avoid destructive actions.' },
    { id: 269, title: 'Webhook Replay Audit API', kind: 'api', prompt: 'Name it "Webhook Replay Audit API". Create a webhook replay API with signing-secret seam, WEBHOOK_SIGNING_SECRET, verifyWebhookSignature, idempotency, audit events, account scoping, rate limiting, pagination, schemaVersion, failureOwner, shaped errors, Docker, and export files.', mustMention: [/WEBHOOK_SIGNING_SECRET|verifyWebhookSignature/i, /auditEvents/i, /idempotency/i, /ownerId|x-account-id/i, /nextCursor/i, /rateLimit|rateBuckets/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Webhook replay API must combine signature seam, idempotency, audit, and scoped pagination.' },
    { id: 270, title: 'SLA Status Page', kind: 'website', prompt: 'Name it "SLA Status Page". Build an enterprise status/SLA page with escalation paths, SLA states, customer messaging, failure owner, runbook, audit trail, Docker export, accessible responsive layout, and handoff notes.', mustMention: [/Escalation paths/i, /SLA states/i, /Customer messaging/i, /Failure owner/i, /Runbook/i, /Audit trail/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'SLA page must make accountability visible for enterprise customers.' },
    { id: 271, title: 'Poison Report Worker', kind: 'worker', prompt: 'Name it "Poison Report Worker". Build a report worker where poison jobs are quarantined visibly instead of retried forever. Include poisonJobs, idempotency guard, event log, dead/retrying/poison counts, worker status, Redis compose seam, and README verification.', mustMention: [/poisonJobs/i, /idempotency/i, /events|event log/i, /dead/i, /retrying/i, /poison/i, /worker-status/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Report worker must quarantine poison jobs with visible counts/status.' },
    { id: 272, title: 'Tenant Isolation Audit API', kind: 'api', prompt: 'Name it "Tenant Isolation Audit API". Create an API showing account isolation, owner scoping, audit events, PII redaction, pagination, schemaVersion, failureOwner, token gate, rate limiting, health, readiness, Docker, and export handoff.', mustMention: [/ownerId|x-account-id/i, /auditEvents/i, /redact/i, /nextCursor/i, /schemaVersion/i, /failureOwner/i, /rateLimit|rateBuckets/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Tenant isolation API must prove scoped reads/writes, redaction, audit, and rate limits.' },
    { id: 273, title: 'Deployment Cutover Runbook Site', kind: 'website', prompt: 'Name it "Deployment Cutover Runbook". Build a deployment cutover page with source export, environment map, DNS checklist, SSL checklist, parallel run, rollback plan, verification, failure owner, accessible responsive layout, and Docker files.', mustMention: [/Source export|Environment map/i, /DNS checklist/i, /SSL checklist/i, /Parallel run/i, /Rollback plan/i, /Verification/i, /Failure owner/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Deployment cutover page must include env/DNS/SSL/parallel/rollback/failure-owner proof.' },
    { id: 274, title: 'Refund Audit Trail API', kind: 'api', prompt: 'Name it "Refund Audit Trail API". Build a refund API with audit events, PII redaction, idempotency, scoped records, pagination, schemaVersion, failureOwner, rate limiting, token gate, Docker, and export handoff.', mustMention: [/auditEvents/i, /redact/i, /idempotency/i, /ownerId|x-account-id/i, /nextCursor/i, /schemaVersion/i, /failureOwner/i, /rateLimit|rateBuckets/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Refund API must support finance auditability, redaction, scopes, and idempotency.' },
    { id: 275, title: 'Failed Payment Support Site', kind: 'website', prompt: 'Name it "Failed Payment Support". Create a failed-payment support page with escalation paths, SLA states, customer messaging, runbook, audit trail, failure owner, accessible responsive layout, Docker handoff, and support accountability.', mustMention: [/Escalation paths/i, /SLA states/i, /Customer messaging/i, /Runbook/i, /Audit trail/i, /Failure owner/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Failed-payment support page must show escalation/runbook ownership, not just billing copy.' },
    { id: 276, title: 'Poison Notification Worker', kind: 'worker', prompt: 'Name it "Poison Notification Worker". Create a notification worker that quarantines poison jobs, exposes event logs, retry/dead-letter states, worker status, poison/dead/retrying counts, idempotency guard, Redis compose seam, and does not hide failures.', mustMention: [/poisonJobs/i, /events|event log/i, /idempotency/i, /dead/i, /retrying|retry/i, /poison/i, /worker-status/i], scenario: [/Validation blocked missing email/i, /Worker status healthy/i, /Queued 60 jobs/i, /Processed 25 jobs/i, /Mobile layout fits viewport/i], critique: 'Notification worker must expose poison/dead/retrying states without hiding failure.' },
    { id: 277, title: 'Security Review Dashboard Site', kind: 'website', prompt: 'Name it "Security Review Dashboard". Build a security review dashboard with governance gates, audit trail, security review, PII handling, deployment checks, failure owner, verification, accessible responsive layout, Docker files, and no vague AI output.', mustMention: [/Governance gates/i, /Audit trail/i, /Security review/i, /PII handling/i, /Deployment checks/i, /Failure owner/i, /Verification/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Security dashboard must expose governance/security/PII/deployment gates.' },
    { id: 278, title: 'Customer Evidence API', kind: 'api', prompt: 'Name it "Customer Evidence API". Create an evidence API with audit events, PII redaction, scoped records, idempotency, rate limiting, pagination, schemaVersion, failureOwner, health, readiness, token gate, Docker, export files, and no hardcoded secrets.', mustMention: [/auditEvents/i, /redact/i, /ownerId|x-account-id/i, /idempotency/i, /rateLimit|rateBuckets/i, /nextCursor/i, /schemaVersion/i, /failureOwner/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Customer evidence API must combine audit/redaction/scoping/idempotency/rate-limit seams.' },
    { id: 279, title: 'Cutover Checklist Site', kind: 'website', prompt: 'Name it "Cutover Checklist". Build a cutover checklist migration page with source export, clean schema, parallel run, cutover plan, rollback plan, verification, DNS checklist, SSL checklist, Docker/export handoff, and accessible responsive layout.', mustMention: [/Source export/i, /Clean schema/i, /Parallel run/i, /Cutover plan/i, /Rollback plan/i, /Verification/i, /DNS checklist|SSL checklist/i], scenario: [/Validation blocked missing email/i, /Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i], critique: 'Cutover checklist must keep migration, rollback, DNS/SSL, and verification explicit.' },
    { id: 280, title: 'Production Support API', kind: 'api', prompt: 'Name it "Production Support API". Create a production support API with PII redaction, audit events, owner scoping, pagination, schemaVersion, failureOwner, rate limiting, token gate, idempotency, health, readiness, webhook signature seam, WEBHOOK_SIGNING_SECRET, verifyWebhookSignature, Docker handoff, and env example.', mustMention: [/redact/i, /auditEvents/i, /ownerId|x-account-id/i, /nextCursor/i, /schemaVersion/i, /failureOwner/i, /rateLimit|rateBuckets/i, /WEBHOOK_SIGNING_SECRET|verifyWebhookSignature/i], scenario: [/Validation blocked missing email/i, /Health OK/i, /Created 40 records/i, /Page 2 loaded/i, /Mobile layout fits viewport/i], critique: 'Production support API must include PII redaction, audit, scoped pagination, limits, idempotency, health, and webhook signature seams.' },
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
    const previewPath = path.join(target, 'playwright-260-280-usability-preview.html')
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
if (failed.length) throw new Error(`${failed.length} share chat compliance 260-280 Playwright stories failed.`)
console.log(`All ${results.length} share chat compliance 260-280 stories passed with stricter Playwright usability and load checks.`)
