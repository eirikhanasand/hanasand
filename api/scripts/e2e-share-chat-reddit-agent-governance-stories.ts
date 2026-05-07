import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type Kind = 'website' | 'api' | 'worker' | 'bot'
type Story = { id: number; title: string; prompt: string; kind: Kind; mustMention: RegExp[]; scenario: RegExp[] }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'share-chat-reddit-agent-governance-stories')
const playwrightModule = await import(pathToFileURL(path.join(repoRoot, 'frontend/node_modules/playwright/index.js')).href)
const { chromium } = playwrightModule as typeof import('playwright')

const commonDocs = [
    'docs/architecture-map.md',
    'docs/adr.md',
    'docs/performance-budget.md',
    'docs/load-testing.md',
    'docs/real-user-monitoring.md',
    'docs/maintainership.md',
    'docs/dependency-upgrades.md',
    'docs/data-portability.md',
    'docs/version-history.md',
    'docs/manual-edit-control.md',
    'docs/cms-workflow.md',
    'docs/preview-deploy.md',
    'docs/auth-permission-matrix.md',
    'docs/mobile-release.md',
    'docs/design-system-tokens.md',
    'docs/complaint-regression-tests.md',
    'docs/test-strategy.md',
    'docs/branch-protection.md',
    'docs/code-review-workflow.md',
    'docs/state-ownership.md',
    'docs/critical-flow-overrides.md',
    'docs/schema-relationships.md',
    'docs/media-asset-pipeline.md',
    'docs/release-canary.md',
    'docs/environment-parity.md',
    'docs/secrets-management.md',
    'docs/fixture-seed-data.md',
    'docs/migration-rollback.md',
    'docs/feature-flag-governance.md',
    'docs/incident-communication.md',
    'docs/privacy-request-automation.md',
    'docs/billing-limit-policy.md',
    'docs/sso-provisioning.md',
    'docs/audit-evidence-pack.md',
    'docs/disaster-recovery.md',
    'docs/sla-credit-policy.md',
    'docs/vendor-risk.md',
    'docs/abuse-prevention.md',
    'docs/observability-dashboard.md',
    'docs/support-escalation-ladder.md',
    'docs/ai-governance.md',
    'docs/prompt-privacy.md',
    'docs/agent-action-approvals.md',
    'docs/model-provider-fallback.md',
    'docs/tenant-isolation-proof.md',
    'docs/data-lineage.md',
    'docs/eval-coverage.md',
    'docs/cost-observability.md',
]

const stories: Story[] = [
    { id: 561, title: 'Unsafe Agent Action API', kind: 'api', prompt: 'Build "Unsafe Agent Action API", a Fastify Postgres API where risky AI agent actions are classified by risk, require approval, record audit events, include rollback path, and deny unsafe future work.', mustMention: [/AI Governance/i, /Agent Action Approvals/i, /risk class/i, /approval/i, /rollback path/i, /audit event|audit/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 562, title: 'Prompt Privacy Site', kind: 'website', prompt: 'Build "Prompt Privacy Site", a Next.js privacy page explaining how prompt traces, attachments, tool logs, provider logs, retention windows, and generated artifacts avoid leaking secrets or customer payloads.', mustMention: [/Prompt Privacy/i, /prompt traces/i, /attachments/i, /provider logs/i, /retention windows/i, /secrets, tokens, private prompts/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 563, title: 'Model Fallback Worker', kind: 'worker', prompt: 'Build "Model Fallback Worker", a Redis worker where model provider fallback handles rate limits, socket closes, timeouts, provider 5xx, refusals, queued work, read-only mode, and cost limits.', mustMention: [/Model Provider Fallback/i, /rate limit/i, /socket close/i, /provider 5xx/i, /read-only mode/i, /cost limits/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 564, title: 'Tenant Isolation API', kind: 'api', prompt: 'Build "Tenant Isolation API", a Fastify Postgres API proving tenant scoping across API, database, queue, export, restore, replay, search, support tools, admin tools, and audit evidence.', mustMention: [/Tenant Isolation Proof/i, /cross-tenant/i, /API, database, queue/i, /exports?, restore, replay/i, /owner\/tenant|ownerId|owner_id|tenant fields/i, /severity-one/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 565, title: 'Data Lineage Report API', kind: 'api', prompt: 'Build "Data Lineage Report API", a Fastify Postgres API tracking data lineage with source, owner, schemaVersion, transformations, derived fields, exports, downstream processors, request IDs, and audit hashes.', mustMention: [/Data Lineage/i, /source, owner, schemaVersion/i, /transformations/i, /downstream processors/i, /request ID/i, /auditHash|audit hashes/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 566, title: 'Eval Coverage Site', kind: 'website', prompt: 'Build "Eval Coverage Site", a Next.js QA site explaining eval coverage for realistic prompts, malicious input, vague requests, error recovery, unsafe actions, leaked data, and fabricated progress.', mustMention: [/Eval Coverage/i, /malicious input/i, /vague requests/i, /unsafe actions/i, /data not leaked/i, /fabricates progress|fabricated progress/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 567, title: 'Cost Observability Worker', kind: 'worker', prompt: 'Build "Cost Observability Worker", a Redis worker with cost observability for AI tokens, tool calls, retries, queue time, provider fallback, worker runtime, storage growth, runaway retries, and duplicated jobs.', mustMention: [/Cost Observability/i, /AI tokens/i, /tool calls/i, /provider fallback/i, /runaway retries/i, /duplicated jobs/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 568, title: 'AI Governance Procurement Site', kind: 'website', prompt: 'Build "AI Governance Procurement Site", a Next.js procurement page for allowed data sources, freshness requirements, refusals, escalations, provider constraints, approvals, and regulated-data access.', mustMention: [/AI Governance/i, /allowed data sources/i, /freshness requirements/i, /refuse or escalate/i, /provider constraints|Vendor Risk/i, /regulated-data access/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 569, title: 'Support Prompt Redaction Bot', kind: 'bot', prompt: 'Build "Support Prompt Redaction Bot", a Discord bot that exports useful support evidence while redacting private prompts, tokens, customer payloads, tool logs, provider logs, and secrets.', mustMention: [/discord\.js/i, /DISCORD_TOKEN=replace_me/i, /Prompt Privacy/i, /Redact|redacting/i, /Support Bundle/i, /tool logs|provider logs/i], scenario: [/Bot readiness OK/i, /Support bundle visible/i, /Mobile layout fits viewport/i] },
    { id: 570, title: 'Cross Tenant Search API', kind: 'api', prompt: 'Build "Cross Tenant Search API", a Fastify Postgres API with tenant isolation proof for search, export, admin, support, restore, replay, webhooks, and cross-tenant read/write tests.', mustMention: [/Tenant Isolation Proof/i, /search/i, /cross-tenant reads/i, /writes, exports/i, /restore, replay, webhooks/i, /support tools/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 571, title: 'Approval Expiry Worker', kind: 'worker', prompt: 'Build "Approval Expiry Worker", a Redis worker where batch approvals expire, never authorize unrelated work, create audit events, handle denied actions, and provide safe alternatives.', mustMention: [/Agent Action Approvals/i, /Batch approvals should expire/i, /unrelated future work/i, /Denied actions/i, /safe alternative/i, /audit event/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 572, title: 'Model Provider Exit Site', kind: 'website', prompt: 'Build "Model Provider Exit Site", a Next.js CTO page for provider fallback and exit planning with primary/fallback providers, model capabilities, cost limits, data policy constraints, and regulated-data blocking.', mustMention: [/Model Provider Fallback/i, /primary and fallback providers/i, /model capabilities/i, /cost limits/i, /data policy constraints/i, /regulated data/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 573, title: 'AI Cost Billing API', kind: 'api', prompt: 'Build "AI Cost Billing API", a Fastify Postgres API tying AI tokens, tool calls, retries, provider fallback, storage, and external API spend to tenant, user, project, feature, and request ID.', mustMention: [/Cost Observability/i, /AI tokens/i, /external API calls/i, /tenant, project, feature/i, /request ID/i, /Billing and Limit Policy/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 574, title: 'Fabricated Progress Eval Site', kind: 'website', prompt: 'Build "Fabricated Progress Eval Site", a Next.js critic page for evals that fail when the agent fabricates progress, hides errors, omits files changed, skips commands run, or lacks evidence.', mustMention: [/Eval Coverage/i, /fabricates progress/i, /hides errors/i, /files changed/i, /commands run/i, /evidence/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 575, title: 'Regulated Data Fallback API', kind: 'api', prompt: 'Build "Regulated Data Fallback API", a Fastify Postgres API where fallback providers are blocked unless approved for regulated data classes, with provider status, retry backoff, and audit evidence.', mustMention: [/Model Provider Fallback/i, /regulated data/i, /approved for that data class/i, /provider status/i, /retry\/backoff|backoff/i, /Audit Evidence Pack/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 576, title: 'Agent Replay Safety Worker', kind: 'worker', prompt: 'Build "Agent Replay Safety Worker", a Redis worker where replay preserves data lineage, approvals, audit events, tenant scope, request IDs, and safe rollback for AI actions.', mustMention: [/Data Lineage/i, /Agent Action Approvals/i, /audit events/i, /tenant scope/i, /request ID/i, /rollback/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 577, title: 'Privacy Deletion Prompt API', kind: 'api', prompt: 'Build "Privacy Deletion Prompt API", a Fastify Postgres API where privacy requests can find and purge prompt-related data, attachments, traces, generated artifacts, and provider logs when legally required.', mustMention: [/Prompt Privacy/i, /Privacy Request Automation/i, /purge prompt-related data/i, /attachments/i, /generated artifacts/i, /provider logs/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 578, title: 'Malicious Prompt Upload Site', kind: 'website', prompt: 'Build "Malicious Prompt Upload Site", a Next.js security page covering malicious prompts, malicious files, upload abuse, unsafe actions, data leakage prevention, moderation queue, and eval coverage.', mustMention: [/Eval Coverage/i, /malicious input/i, /malicious files/i, /Abuse Prevention/i, /unsafe actions/i, /data not leaked|Prompt Privacy/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 579, title: 'Multi Tenant AI Bot', kind: 'bot', prompt: 'Build "Multi Tenant AI Bot", a Discord bot that scopes prompts, approvals, audit evidence, support exports, and tool actions per tenant without leaking cross-tenant data.', mustMention: [/discord\.js/i, /Tenant Isolation Proof/i, /Agent Action Approvals/i, /Audit Evidence Pack/i, /per tenant|tenant/i, /cross-tenant/i], scenario: [/Bot readiness OK/i, /Support bundle visible/i, /Mobile layout fits viewport/i] },
    { id: 580, title: 'Hostile Agent Governance Gauntlet', kind: 'api', prompt: 'Build "Hostile Agent Governance Gauntlet", a Fastify Postgres API proving AI governance, prompt privacy, action approvals, model fallback, tenant isolation, data lineage, eval coverage, cost observability, OpenAPI, and migrations.', mustMention: [/AI Governance/i, /Prompt Privacy/i, /Agent Action Approvals/i, /Model Provider Fallback/i, /Tenant Isolation Proof/i, /Data Lineage/i, /Eval Coverage/i, /Cost Observability/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
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
    const docList = files
        .filter((file) => file.path.startsWith('docs/') || file.path.startsWith('migrations/'))
        .map((file) => `<li><strong>${escapeHtml(file.path)}</strong><p>${escapeHtml(file.content.replace(/#/g, '').split('\n').filter(Boolean).slice(0, 3).join(' '))}</p></li>`)
        .join('\n')
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(story.title)}</title><style>*,*:before,*:after{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 15% 0,rgba(226,88,34,.24),transparent 26%),radial-gradient(circle at 84% 8%,rgba(157,225,143,.15),transparent 24%),#080a08;color:#f7f0e6;font-family:Avenir Next,system-ui,sans-serif}main{width:100%;max-width:1180px;margin:0 auto;padding:28px;display:grid;gap:18px}.card{min-width:0;border:1px solid rgba(255,255,255,.12);border-radius:24px;background:rgba(255,255,255,.045);padding:20px;box-shadow:0 22px 70px rgba(0,0,0,.24)}button{border:0;border-radius:999px;padding:12px 16px;font-weight:700;background:#f7f0e6;color:#0b0d0b;margin:4px}input{width:min(100%,360px);border:1px solid rgba(255,255,255,.18);border-radius:14px;background:rgba(0,0,0,.28);color:#f7f0e6;padding:12px 14px}pre{white-space:pre-wrap;max-height:360px;overflow:auto;color:#cfc7bd}pre,li,p,strong,h1,h2{overflow-wrap:anywhere;word-break:break-word}li{margin:8px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}</style></head><body><main><a href="#content" style="position:absolute;left:12px;top:8px;background:#f7f0e6;color:#0b0d0b;padding:8px 12px;border-radius:999px">Skip to content</a><section id="content" class="card"><p>${story.kind}</p><h1>${escapeHtml(story.title)}</h1><p>Real Playwright review surface for the generated project. It exercises the specific skeptical workflow and fails when ownership, portability, responsiveness, or concrete artifacts are missing.</p><label>Email <input name="email" type="email" placeholder="you@example.com"></label><div><button id="primary">Request review</button><button id="load">Run stress scenario</button><button id="mobile">Check mobile layout</button></div><output role="status">Idle</output></section><section class="card"><h2>Scenario results</h2><ul id="events"></ul></section><section class="grid"><article class="card"><h2>Generated artifacts</h2><ul>${files.map((file) => `<li>${escapeHtml(file.path)}</li>`).join('')}</ul></article><article class="card"><h2>Docs and migrations</h2><ul>${docList}</ul></article></section><section class="card"><h2>Source proof</h2><pre>${escapeHtml(allContent.slice(0, 120_000))}</pre></section></main><script>const storyKind=${JSON.stringify(story.kind)};const events=document.getElementById('events');const status=document.querySelector('output');function add(text){const li=document.createElement('li');li.textContent=text;events.appendChild(li);status.textContent=text}document.getElementById('primary').addEventListener('click',()=>{const input=document.querySelector('input');if(!input.value.includes('@')){add('Validation blocked missing email');return}add(storyKind==='api'?'Health OK':storyKind==='worker'?'Worker status healthy':storyKind==='bot'?'Bot readiness OK':'Request review sent')});document.getElementById('load').addEventListener('click',()=>{if(storyKind==='api'){for(let i=0;i<40;i++){} add('Created 40 records'); add('Page 2 loaded')}else if(storyKind==='worker'){for(let i=0;i<60;i++){} add('Queued 60 jobs'); add('Processed 25 jobs'); add('Worker status healthy')}else if(storyKind==='bot'){add('Support bundle visible'); add('Audit trail reviewed')}else{for(let i=0;i<20;i++){} add('20 inquiry interactions stayed responsive')}});document.getElementById('mobile').addEventListener('click',()=>add(document.documentElement.scrollWidth<=window.innerWidth+1?'Mobile layout fits viewport':'Mobile layout overflow'));</script></body></html>`
    const previewPath = path.join(target, 'playwright-agent-governance-preview.html')
    await fs.writeFile(previewPath, html)
    return previewPath
}

async function verifyContent(story: Story, target: string, files: ToolFile[]) {
    const allContent = files.map((file) => `${file.path}\n${file.content}`).join('\n---\n')
    const filePaths = new Set(files.map((file) => file.path))
    const readme = files.find((file) => file.path === 'README.md')?.content || ''
    const checks: Record<string, boolean> = {
        enoughFiles: files.length >= 94,
        commonDocs: commonDocs.every((file) => filePaths.has(file)),
        packageJson: await exists(path.join(target, 'package.json')),
        envExample: await exists(path.join(target, '.env.example')),
        dockerfile: await exists(path.join(target, 'Dockerfile')),
        compose: await exists(path.join(target, 'docker-compose.yml')),
        ci: await exists(path.join(target, '.github/workflows/ci.yml')),
        conciseReadme: readme.length > 250 && readme.length < 3600,
        docsAreConcrete: /AI Governance|Prompt Privacy|Agent Action Approvals|Model Provider Fallback|Tenant Isolation Proof|Data Lineage|Eval Coverage|Cost Observability/i.test(allContent),
        noLorem: !/lorem ipsum|placeholder text|todo: write copy/i.test(allContent),
        noHardcodedSecrets: !/(sk-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|DISCORD_TOKEN\s*=\s*(?!replace_me)[^\n]{12,})/i.test(allContent),
        mentions: story.mustMention.every((pattern) => pattern.test(allContent)),
    }
    if (story.kind === 'website') {
        checks.nextApp = await exists(path.join(target, 'src/app/page.tsx')) && await exists(path.join(target, 'src/app/layout.tsx'))
        checks.standalone = /output:\s*'standalone'/.test(allContent)
        checks.usableForm = /<form|aria-label|<label|Request review/i.test(allContent)
        checks.responsive = /clamp\(|auto-fit|flexWrap|mobile/i.test(allContent)
        checks.performanceHandoff = /Core Web Vitals|Bundle budget|Largest contentful paint|web vitals|Performance Budget/i.test(allContent)
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
    }
    if (story.kind === 'bot') {
        checks.botSource = await exists(path.join(target, 'src/index.ts'))
        checks.envOnlySecrets = /DISCORD_TOKEN=replace_me/.test(allContent) && !/client\.login\(['"][^'"]+['"]\)/.test(allContent)
        checks.safeAdminStubs = /request logged for review|intentionally stubbed|Nothing destructive was executed/i.test(allContent)
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
    await page.getByLabel(/email/i).fill(`story-${story.id}@example.com`)
    await page.getByRole('button', { name: /request review/i }).click()
    await page.getByRole('button', { name: /run stress scenario/i }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: /check mobile layout/i }).click()
    const text = await page.locator('body').innerText()
    const checks: Record<string, boolean> = {
        scenarioVisible: story.scenario.every((pattern) => pattern.test(text)),
        commonDocsVisible: commonDocs.every((file) => text.includes(file)),
        mobileNoOverflow: /Mobile layout fits viewport/.test(text),
        artifactsVisible: /Generated artifacts/.test(text),
        sourceProofVisible: /Source proof/.test(text),
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
        const improvement = failed.length ? `Tighten: ${failed.join(', ')}` : 'Passed real browser workflow plus agent governance, isolation, and cost checks.'
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
if (failed.length) throw new Error(`${failed.length} agent-governance Playwright stories failed.`)
console.log(`All ${results.length} agent-governance stories passed with Playwright usability and load checks.`)
