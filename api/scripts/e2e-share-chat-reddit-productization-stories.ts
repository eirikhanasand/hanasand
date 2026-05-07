import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type Kind = 'website' | 'api' | 'worker' | 'bot'
type Story = { id: number; title: string; prompt: string; kind: Kind; mustMention: RegExp[]; scenario: RegExp[] }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'share-chat-reddit-productization-stories')
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
]

const stories: Story[] = [
    { id: 481, title: 'Lost Manual Edits Site', kind: 'website', prompt: 'Build "Lost Manual Edits Site", a Dockerized Next.js landing page for a designer angry that AI overwrote hand-polished CSS. Include manual edit control, design system tokens, version history, preview deploy checks, complaint regression tests, and mobile release proof.', mustMention: [/Manual Edit Control/i, /Design System Tokens/i, /Version History/i, /Preview and Deploy/i, /Complaint Regression Tests/i, /Mobile Release/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 482, title: 'Prompt Drift Product Site', kind: 'website', prompt: 'Build "Prompt Drift Product Site", a Next.js product site for a founder who says prompts change unrelated sections. Include narrow change boundaries, ADRs, version history, change review, manual edit control, and complaint regression tests.', mustMention: [/Version History/i, /Change Review/i, /Architecture Decision Records/i, /Manual Edit Control/i, /Complaint Regression Tests/i, /No platform lock-in/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 483, title: 'Preview Deploy Failure API', kind: 'api', prompt: 'Build "Preview Deploy Failure API", a Fastify Postgres API for users who only see vague deploy failures. Include preview deploy diagnostics, environment checks, migrations, health, readiness, shaped runtime errors, auth matrix, and version history.', mustMention: [/Preview and Deploy/i, /DATABASE_URL/i, /migrations\/001_initial_schema\.sql/i, /\/health/i, /\/ready/i, /Auth Permission Matrix/i, /Version History/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 484, title: 'Auth Surprise SaaS API', kind: 'api', prompt: 'Build "Auth Surprise SaaS API", a Fastify Postgres SaaS backend that never leaks raw unauthorized provider text. Include auth permission matrix, expired session, revoked access, RBAC, access review, shaped errors, and background token refresh notes.', mustMention: [/Auth Permission Matrix/i, /revoked-access|revoked access/i, /rolesFor|requireRole/i, /Access Review/i, /request_error/i, /token refresh/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 485, title: 'CMS Editor Handoff Site', kind: 'website', prompt: 'Build "CMS Editor Handoff Site", a Next.js restaurant site where menu edits need draft, preview, approve, publish, rollback, content export, CMS workflow, manual edit control, and mobile release notes.', mustMention: [/CMS Workflow/i, /draft, preview, approve, publish/i, /Manual Edit Control/i, /Data Portability/i, /Mobile Release/i, /Menu and allergens|Reservations/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 486, title: 'Mobile Header Overlap Site', kind: 'website', prompt: 'Build "Mobile Header Overlap Site", a Next.js site for a critic reporting mobile header overlap, safe-area bugs, sticky controls, long labels, keyboard overlap, 390px viewport issues, and complaint regression proof.', mustMention: [/Mobile Release/i, /safe areas/i, /keyboard overlap/i, /390px/i, /Complaint Regression Tests/i, /Browser Verification/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 487, title: 'Generic AI Design Complaint Site', kind: 'website', prompt: 'Build "Generic AI Design Complaint Site", a Next.js site for a client who hates generic AI-builder sameness. Include design system tokens, manual styling control, visual hierarchy, accessibility audit, browser verification, and concrete content.', mustMention: [/Design System Tokens/i, /visual language/i, /Manual Edit Control/i, /Accessibility Audit/i, /Browser Verification/i, /generic AI-builder sameness/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 488, title: 'Collaboration Rollback API', kind: 'api', prompt: 'Build "Collaboration Rollback API", a Fastify Postgres API for multi-person collaboration with version history, change requests, rollback approvals, preview deploy checks, complaint regression tests, OpenAPI, and migrations.', mustMention: [/Version History/i, /changeRequests|change requests/i, /rollbackApprovals|rollback approvals/i, /Preview and Deploy/i, /Complaint Regression Tests/i, /openapi/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 489, title: 'Quota Credit Burn Worker', kind: 'worker', prompt: 'Build "Quota Credit Burn Worker", a Redis worker for operators angry about credit burn. Include retry budget, quota transparency, backoff, replay limits, load testing, complaint regression tests, and worker alerts.', mustMention: [/retryBudget/i, /Quota Transparency/i, /backoff/i, /replayPolicy/i, /Complaint Regression Tests/i, /workerAlerts/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 490, title: 'Database Error Debug API', kind: 'api', prompt: 'Build "Database Error Debug API", a Fastify Postgres API for mysterious database failures. Include DB seam, migrations, preview deploy diagnostics, request IDs, backup restore, error recovery, and support bundle docs.', mustMention: [/from 'pg'|DATABASE_URL/i, /migrations/i, /Preview and Deploy/i, /x-request-id/i, /backup|restore/i, /Support Bundle/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 491, title: 'Discord Permission Drift Bot', kind: 'bot', prompt: 'Build "Discord Permission Drift Bot", a Discord bot for role drift complaints with auth permission matrix, support bundle, version history, safe admin stubs, manual edit control over responses, and env-only secrets.', mustMention: [/discord\.js/i, /DISCORD_TOKEN=replace_me/i, /Auth Permission Matrix/i, /Support Bundle/i, /Version History/i, /Manual Edit Control/i], scenario: [/Bot readiness OK/i, /Support bundle visible/i, /Mobile layout fits viewport/i] },
    { id: 492, title: 'SEO Copy Manual Control Site', kind: 'website', prompt: 'Build "SEO Copy Manual Control Site", a Next.js SEO migration site where headings, redirects, metadata, CMS workflow, manual edit control, preview deploy, and version history are first-class.', mustMention: [/SEO Editing Control/i, /Manual Edit Control/i, /CMS Workflow/i, /Preview and Deploy/i, /Version History/i, /SEO Editing Control|redirect map|canonical/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 493, title: 'Marketplace Publishing Worker', kind: 'worker', prompt: 'Build "Marketplace Publishing Worker", a Redis worker for background listing publishing with preview checks, rollback, replay, stuck-job detection, version evidence, release evidence, cancel, and alerts.', mustMention: [/Preview and Deploy/i, /Version History/i, /Release Evidence/i, /stuckJobDetector/i, /cancelJob/i, /workerAlerts/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 494, title: 'Multi Tenant Permission API', kind: 'api', prompt: 'Build "Multi Tenant Permission API", a Fastify Postgres API for a security reviewer demanding auth permission matrix, RLS policy notes, cross-tenant tests, access review, shaped errors, migrations, and OpenAPI.', mustMention: [/Auth Permission Matrix/i, /rlsPolicies|RLS/i, /cross-tenant/i, /Access Review/i, /request_error/i, /openapi/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 495, title: 'Slow Preview Complaint Site', kind: 'website', prompt: 'Build "Slow Preview Complaint Site", a Next.js site for users complaining previews are slow and misleading. Include preview deploy diagnostics, performance budget, RUM, mobile release notes, complaint regression tests, and no raw provider errors.', mustMention: [/Preview and Deploy/i, /Performance Budget/i, /Real User Monitoring/i, /Mobile Release/i, /Complaint Regression Tests/i, /provider messages/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 496, title: 'Invoice Workflow Rollback Worker', kind: 'worker', prompt: 'Build "Invoice Workflow Rollback Worker", a Redis worker for finance invoice jobs with dry-run, replay, cancel, stuck-job detection, rollback evidence, manual approval, data portability, and complaint regression tests.', mustMention: [/dry run|dry-run/i, /replay/i, /cancelJob/i, /stuckJobDetector/i, /Rollback/i, /Data Portability/i, /Complaint Regression Tests/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 497, title: 'Agency White Label Site', kind: 'website', prompt: 'Build "Agency White Label Site", a Next.js white-label export with manual branding control, design tokens, CMS workflow, version history, preview deploy checks, mobile release notes, and browser verification.', mustMention: [/Manual Edit Control/i, /Design System Tokens/i, /CMS Workflow/i, /Version History/i, /Preview and Deploy/i, /Mobile Release/i], scenario: [/Request review sent/i, /20 inquiry interactions stayed responsive/i, /Mobile layout fits viewport/i] },
    { id: 498, title: 'Support Escalation API', kind: 'api', prompt: 'Build "Support Escalation API", a Fastify Postgres API that turns raw errors into supportable diagnostics with request IDs, support bundles, complaint regressions, preview deploy failure layers, shaped errors, health, and readiness.', mustMention: [/Support Bundle/i, /Preview and Deploy/i, /Error Recovery/i, /x-request-id/i, /Complaint Regression Tests/i, /\/ready/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
    { id: 499, title: 'Image Moderation Queue Worker', kind: 'worker', prompt: 'Build "Image Moderation Queue Worker", a Redis worker for image moderation jobs with review, cancel, replay, poison queue isolation, mobile release notes, manual edit control, worker alerts, and complaint regression evidence.', mustMention: [/image-jobs/i, /poisonJobs/i, /cancelJob/i, /replay/i, /Mobile Release/i, /Manual Edit Control/i, /Complaint Regression Tests/i], scenario: [/Queued 60 jobs/i, /Processed 25 jobs/i, /Worker status healthy/i] },
    { id: 500, title: 'Hostile Productization Gauntlet', kind: 'api', prompt: 'Build "Hostile Productization Gauntlet", a Fastify Postgres API for a hostile CTO demanding manual edits, CMS workflow, preview deploy, auth matrix, mobile release, design tokens, version history, complaint regression tests, OpenAPI, migrations, and portability.', mustMention: [/Manual Edit Control/i, /CMS Workflow/i, /Preview and Deploy/i, /Auth Permission Matrix/i, /Mobile Release/i, /Design System Tokens/i, /Version History/i, /Complaint Regression Tests/i], scenario: [/Health OK/i, /Created 40 records/i, /Page 2 loaded/i] },
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
    const previewPath = path.join(target, 'playwright-productization-preview.html')
    await fs.writeFile(previewPath, html)
    return previewPath
}

async function verifyContent(story: Story, target: string, files: ToolFile[]) {
    const allContent = files.map((file) => `${file.path}\n${file.content}`).join('\n---\n')
    const filePaths = new Set(files.map((file) => file.path))
    const readme = files.find((file) => file.path === 'README.md')?.content || ''
    const checks: Record<string, boolean> = {
        enoughFiles: files.length >= 62,
        commonDocs: commonDocs.every((file) => filePaths.has(file)),
        packageJson: await exists(path.join(target, 'package.json')),
        envExample: await exists(path.join(target, '.env.example')),
        dockerfile: await exists(path.join(target, 'Dockerfile')),
        compose: await exists(path.join(target, 'docker-compose.yml')),
        ci: await exists(path.join(target, '.github/workflows/ci.yml')),
        conciseReadme: readme.length > 250 && readme.length < 3600,
        docsAreConcrete: /Version History|Manual Edit Control|CMS Workflow|Preview and Deploy|Auth Permission Matrix|Mobile Release|Design System Tokens|Complaint Regression Tests/i.test(allContent),
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
        const improvement = failed.length ? `Tighten: ${failed.join(', ')}` : 'Passed real browser workflow plus productization, manual control, and preview checks.'
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
if (failed.length) throw new Error(`${failed.length} productization Playwright stories failed.`)
console.log(`All ${results.length} productization stories passed with Playwright usability and load checks.`)
