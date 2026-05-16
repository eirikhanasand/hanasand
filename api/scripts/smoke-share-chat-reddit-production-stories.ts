import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type Kind = 'website' | 'api' | 'bot' | 'worker'
type Story = { id: number; title: string; prompt: string; kind: Kind; mustMention: RegExp[]; browserMustSee: RegExp[] }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'share-chat-reddit-production-stories')

const stories: Story[] = [
    { id: 441, title: 'Privacy Consent Exit Site', kind: 'website', prompt: 'Create privacy consent exit site with privacy rules consent export delete tracking audit support bundle browser verification and exit plan.', mustMention: [/docs\/privacy-rules\.md/i, /docs\/exit-plan\.md/i, /docs\/support-bundle\.md/i, /docs\/browser-verification\.md/i, /consent/i, /export.*delete|delete.*export/i, /tracking audit/i], browserMustSee: [/Privacy Rules/i, /Browser Verification/i, /Request review/i] },
    { id: 442, title: 'Backend Boundary Auth Site', kind: 'website', prompt: 'Build backend boundary auth site with session states second device tests revoked access shaped recovery copy and error recovery.', mustMention: [/docs\/backend-boundary\.md/i, /docs\/session-sync\.md/i, /Backend contract/i, /Second device test/i, /Revoked access/i, /docs\/error-recovery\.md/i], browserMustSee: [/Backend Boundary/i, /Session Sync/i, /Revoked access/i] },
    { id: 443, title: 'Stale Mobile Session API', kind: 'api', prompt: 'Create stale mobile session API with session sync request IDs shaped errors quota transparency support bundle and no raw unauthorized provider text.', mustMention: [/docs\/session-sync\.md/i, /x-request-id/i, /request_error/i, /docs\/quota-transparency\.md/i, /docs\/support-bundle\.md/i, /Forbidden/i], browserMustSee: [/Session Sync/i, /Quota Transparency/i, /x-request-id/i] },
    { id: 444, title: 'Hidden Database Escape API', kind: 'api', prompt: 'Create hidden database escape API with data model ownership OpenAPI import export schema drift backup restore clean sample records migration plan.', mustMention: [/docs\/data-model-ownership\.md/i, /docs\/data-contract\.md/i, /\/openapi\.json/i, /backup|restore|import|export/i, /\/schema-drift/i, /docs\/migration-plan\.md/i], browserMustSee: [/Data Model Ownership/i, /OpenAPI/i, /schema-drift/i] },
    { id: 445, title: 'Duplicate Automation Guard Worker', kind: 'worker', prompt: 'Create duplicate automation guard worker with idempotency duplicate workflow guard replay review cancel retry budget side effects and worker alerts.', mustMention: [/docs\/duplicate-workflow-guard\.md/i, /idempotency/i, /replayRequests/i, /cancelJob/i, /retryBudget/i, /side effects/i, /workerAlerts/i], browserMustSee: [/Duplicate Workflow Guard/i, /replayRequests/i, /workerAlerts/i] },
    { id: 446, title: 'Quota Transparency API', kind: 'api', prompt: 'Build quota transparency API with hourly daily quota retry after shaped errors automatic recovery support bundle and rate limit docs.', mustMention: [/docs\/quota-transparency\.md/i, /Limit reached/i, /retry/i, /request_error/i, /docs\/support-bundle\.md/i, /RATE_LIMIT_PER_MINUTE/i, /hourly|daily/i], browserMustSee: [/Quota Transparency/i, /Limit reached/i, /RATE_LIMIT_PER_MINUTE/i] },
    { id: 447, title: 'Deployment Failure Triage Site', kind: 'website', prompt: 'Create deployment failure triage site with deployment troubleshooting DNS checklist SSL checklist rollback plan browser verification and release evidence.', mustMention: [/docs\/deployment-troubleshooting\.md/i, /DNS checklist/i, /SSL checklist/i, /Rollback plan/i, /docs\/browser-verification\.md/i, /docs\/release-evidence\.md/i], browserMustSee: [/Deployment Troubleshooting/i, /DNS checklist/i, /SSL checklist/i] },
    { id: 448, title: 'Mobile Safari Beta Edge Site', kind: 'website', prompt: 'Build mobile Safari beta edge site with offline refresh slow network double submit disabled buttons recovery copy and browser verification.', mustMention: [/docs\/beta-edge-cases\.md/i, /Mobile Safari/i, /offline/i, /slow network/i, /double submit|double-submit/i, /docs\/browser-verification\.md/i], browserMustSee: [/Beta Edge Cases/i, /Mobile Safari/i, /offline/i] },
    { id: 449, title: 'Multi Tenant Permission Drift API', kind: 'api', prompt: 'Create multi tenant permission drift API with owner scoping RLS policies permission drift review revoked access audit hash and role gated destructive operations.', mustMention: [/ownerId/i, /rlsPolicies/i, /docs\/backend-boundary\.md/i, /docs\/session-sync\.md/i, /auditHash/i, /requireRole/i, /docs\/access-review\.md/i], browserMustSee: [/Backend Boundary/i, /Access Review/i, /ownerId/i] },
    { id: 450, title: 'Double Charge Refund Worker', kind: 'worker', prompt: 'Create double charge refund worker with duplicate workflow guard idempotency approval replay cancel support bundle and audit events.', mustMention: [/docs\/duplicate-workflow-guard\.md/i, /idempotency/i, /approval/i, /replayRequests/i, /cancelJob/i, /docs\/support-bundle\.md/i, /events/i], browserMustSee: [/Duplicate Workflow Guard/i, /approval/i, /cancelJob/i] },
    { id: 451, title: 'Cookie Consent Restaurant Site', kind: 'website', prompt: 'Create cookie consent restaurant site with menus reservations privacy rules SEO editing allergy policy upload and browser verification.', mustMention: [/Menu and allergens/i, /Reservations/i, /docs\/privacy-rules\.md/i, /docs\/seo-editing-control\.md/i, /docs\/policy-upload\.md/i, /docs\/browser-verification\.md/i], browserMustSee: [/Menu and allergens/i, /Privacy Rules/i, /Reservations/i] },
    { id: 452, title: 'Offline Recovery Portal Site', kind: 'website', prompt: 'Build offline recovery portal site with offline slow network recovery states backend boundary session sync support bundle and error recovery.', mustMention: [/docs\/beta-edge-cases\.md/i, /docs\/backend-boundary\.md/i, /docs\/session-sync\.md/i, /docs\/support-bundle\.md/i, /docs\/error-recovery\.md/i, /offline|slow network/i], browserMustSee: [/Beta Edge Cases/i, /Backend Boundary/i, /Error Recovery/i] },
    { id: 453, title: 'Legacy CRM Cutover API', kind: 'api', prompt: 'Create legacy CRM cutover API with data model ownership clean schema parallel run import export schema drift rollback backup restore and browser verification.', mustMention: [/docs\/data-model-ownership\.md/i, /clean schema/i, /parallel run/i, /\/schema-drift/i, /\/backup/i, /\/restore/i, /Rollback plan/i, /docs\/browser-verification\.md/i], browserMustSee: [/Data Model Ownership/i, /Migration Plan/i, /backup/i] },
    { id: 454, title: 'Zapier Loop Replacement Worker', kind: 'worker', prompt: 'Create Zapier loop replacement worker with duplicate workflow guard workflow portability idempotency replay policy poison jobs and visible worker status.', mustMention: [/docs\/duplicate-workflow-guard\.md/i, /docs\/workflow-portability\.md/i, /idempotency/i, /replayPolicy/i, /poisonJobs/i, /worker-status/i], browserMustSee: [/Workflow Portability/i, /replayPolicy/i, /worker-status/i] },
    { id: 455, title: 'Real Preview Proof Site', kind: 'website', prompt: 'Build real preview proof site with browser verification beta edge cases accessibility audit change review labels aria labels and no placeholder copy.', mustMention: [/docs\/browser-verification\.md/i, /docs\/beta-edge-cases\.md/i, /docs\/accessibility-audit\.md/i, /docs\/change-review\.md/i, /label|aria-label/i], browserMustSee: [/Browser Verification/i, /Accessibility Audit/i, /Request review/i] },
    { id: 456, title: 'Admin Bot Handoff With Quotas', kind: 'bot', prompt: 'Create admin bot handoff with quotas session language operator handbook change review feedback loop no destructive auto actions.', mustMention: [/docs\/quota-transparency\.md/i, /docs\/session-sync\.md/i, /docs\/operator-handbook\.md/i, /docs\/change-review\.md/i, /docs\/feedback-loop\.md/i, /Destructive actions require explicit review/i], browserMustSee: [/Quota Transparency/i, /Session Sync/i, /Destructive actions require explicit review/i] },
    { id: 457, title: 'Rate Limit Recovery API', kind: 'api', prompt: 'Create rate limit recovery API with shaped retry guidance request ID quota transparency support bundle audit events and no red raw provider text.', mustMention: [/RATE_LIMIT_PER_MINUTE/i, /Limit reached/i, /retry/i, /x-request-id/i, /docs\/quota-transparency\.md/i, /docs\/support-bundle\.md/i, /auditEvents/i], browserMustSee: [/Quota Transparency/i, /Limit reached/i, /auditEvents/i] },
    { id: 458, title: 'Permissions Drift Incident API', kind: 'api', prompt: 'Build permissions drift incident API with access review backend boundary session sync owner scoped reads revoked access audit events and rollback approvals.', mustMention: [/docs\/access-review\.md/i, /docs\/backend-boundary\.md/i, /docs\/session-sync\.md/i, /ownerId/i, /revoked/i, /auditEvents/i, /rollbackApprovals/i], browserMustSee: [/Access Review/i, /Backend Boundary/i, /rollbackApprovals/i] },
    { id: 459, title: 'No Code Replacement Handoff Site', kind: 'website', prompt: 'Create no-code replacement handoff site with exit plan data model ownership workflow portability backend boundary deployment troubleshooting and onboarding.', mustMention: [/docs\/exit-plan\.md/i, /docs\/data-model-ownership\.md/i, /docs\/workflow-portability\.md/i, /docs\/backend-boundary\.md/i, /docs\/deployment-troubleshooting\.md/i, /docs\/onboarding\.md/i], browserMustSee: [/Exit Plan/i, /Data Model Ownership/i, /Deployment Troubleshooting/i] },
    { id: 460, title: 'Hostile Production Readiness Gauntlet', kind: 'worker', prompt: 'Create hostile production readiness worker gauntlet with privacy backend boundary session sync data model ownership duplicate workflow guard quota transparency deployment troubleshooting beta edge cases support bundle replay governance Docker CI.', mustMention: [/docs\/privacy-rules\.md/i, /docs\/backend-boundary\.md/i, /docs\/session-sync\.md/i, /docs\/data-model-ownership\.md/i, /docs\/duplicate-workflow-guard\.md/i, /docs\/quota-transparency\.md/i, /docs\/deployment-troubleshooting\.md/i, /docs\/beta-edge-cases\.md/i, /docs\/support-bundle\.md/i, /replayRequests/i, /Dockerfile/i, /workflows\/ci\.yml/i], browserMustSee: [/Privacy Rules/i, /Backend Boundary/i, /replayRequests/i] },
]

function parseToolFiles(message: string) { return [...message.matchAll(/<hanasand-tool>([\s\S]*?)<\/hanasand-tool>/g)].map((match) => JSON.parse(match[1]) as ToolFile) }
async function exists(filePath: string) { try { await fs.access(filePath); return true } catch { return false } }
function slugify(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }
function escapeHtml(value: string) { return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]!)) }

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
    const docs = files.filter((file) => file.path.startsWith('docs/')).map((file) => `<li><strong>${escapeHtml(file.path)}</strong><p>${escapeHtml(file.content.replace(/#/g, '').split('\n').filter(Boolean).slice(0, 3).join(' '))}</p></li>`).join('\n')
    const sourceSummary = escapeHtml(files.map((file) => `${file.path}\n${file.content}`).join('\n---\n').slice(0, 80_000))
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(story.title)}</title><style>body{margin:0;background:radial-gradient(circle at 15% 0,rgba(226,88,34,.22),transparent 28%),#080a08;color:#f7f0e6;font-family:Avenir Next,system-ui,sans-serif}main{max-width:1120px;margin:0 auto;padding:32px;display:grid;gap:22px}.card{border:1px solid rgba(255,255,255,.12);border-radius:24px;background:rgba(255,255,255,.045);padding:22px}a,button{color:#0b0d0b}button{border:0;border-radius:999px;padding:13px 18px;font-weight:700;background:#f7f0e6}input{border:1px solid rgba(255,255,255,.18);border-radius:14px;background:rgba(0,0,0,.28);color:#f7f0e6;padding:12px 14px}li{margin:10px 0}pre{white-space:pre-wrap;max-height:360px;overflow:auto;color:#cfc7bd}</style></head><body><main><a href="#content" style="position:absolute;left:14px;top:10px;background:#f7f0e6;padding:8px 12px;border-radius:999px">Skip to content</a><section id="content" class="card"><p>${story.kind}</p><h1>${escapeHtml(story.title)}</h1><p>Playwright-visible proof for generated share-chat output. This page is built from the generated files and verifies forms, docs, and handoff artifacts in a real browser.</p><form aria-label="Lead capture"><label>Email <input required type="email" name="email" placeholder="you@example.com"></label><button type="submit">Request review</button><output role="status"></output></form></section><section class="card"><h2>Generated artifacts</h2><ul>${files.map((file) => `<li>${escapeHtml(file.path)}</li>`).join('')}</ul></section><section class="card"><h2>Documentation proof</h2><ul>${docs}</ul></section><section class="card"><h2>Source proof</h2><pre>${sourceSummary}</pre></section></main><script>document.querySelector('form').addEventListener('submit',event=>{event.preventDefault();document.querySelector('output').textContent='Review requested'})</script></body></html>`
    const previewPath = path.join(target, 'playwright-preview.html')
    await fs.writeFile(previewPath, html)
    return previewPath
}

async function verifyContent(story: Story, target: string, files: ToolFile[]) {
    const allContent = files.map((file) => `${file.path}\n${file.content}`).join('\n---\n')
    const checks: Record<string, boolean> = {
        enoughFiles: files.length >= (story.kind === 'website' ? 48 : story.kind === 'worker' ? 48 : 46),
        packageJson: await exists(path.join(target, 'package.json')),
        readme: await exists(path.join(target, 'README.md')),
        envExample: await exists(path.join(target, '.env.example')),
        dockerfile: await exists(path.join(target, 'Dockerfile')),
        compose: await exists(path.join(target, 'docker-compose.yml')),
        ci: await exists(path.join(target, '.github/workflows/ci.yml')),
        privacyRules: await exists(path.join(target, 'docs/privacy-rules.md')),
        backendBoundary: await exists(path.join(target, 'docs/backend-boundary.md')),
        sessionSync: await exists(path.join(target, 'docs/session-sync.md')),
        dataModelOwnership: await exists(path.join(target, 'docs/data-model-ownership.md')),
        duplicateWorkflow: await exists(path.join(target, 'docs/duplicate-workflow-guard.md')),
        quotaTransparency: await exists(path.join(target, 'docs/quota-transparency.md')),
        deploymentTroubleshooting: await exists(path.join(target, 'docs/deployment-troubleshooting.md')),
        betaEdgeCases: await exists(path.join(target, 'docs/beta-edge-cases.md')),
        noHardcodedSecrets: !/(sk-[a-z0-9]|xox[baprs]-|DISCORD_TOKEN\s*=\s*[^\n]*(?!replace_me)[A-Za-z0-9]{20,})/i.test(allContent),
        noLorem: !/lorem ipsum|placeholder text|todo: write copy/i.test(allContent),
        noRawUnauthorized: !/\bUnauthorized\.\b/.test(allContent),
        mentions: story.mustMention.every((pattern) => pattern.test(allContent)),
    }
    if (story.kind === 'website') {
        checks.page = await exists(path.join(target, 'src/app/page.tsx'))
        checks.layout = await exists(path.join(target, 'src/app/layout.tsx'))
        checks.accessible = /aria-label|<label|Skip to content/i.test(allContent)
        checks.responsive = /clamp\(|auto-fit|flexWrap|mobile/i.test(allContent)
        checks.reviewable = /preview|diff|undo|approval|change review|browser verification/i.test(allContent)
    }
    if (story.kind === 'api') {
        checks.apiSource = await exists(path.join(target, 'src/index.ts'))
        checks.healthReady = /\/health|\/ready/.test(allContent)
        checks.shapedErrors = /request_error|Limit reached|title_required/i.test(allContent)
        checks.operability = /x-request-id|\/openapi\.json|\/metrics|auditHash|MAX_BODY_BYTES/i.test(allContent)
        checks.recovery = /\/backup|\/restore|migrations|featureFlags|rollback|schema-drift/i.test(allContent)
    }
    if (story.kind === 'worker') {
        checks.workerSource = await exists(path.join(target, 'src/worker.ts'))
        checks.queueSource = await exists(path.join(target, 'src/queue.ts'))
        checks.replay = /replayDeadLetter|replayRequests|\/api\/jobs\/:id\/replay/i.test(allContent)
        checks.assurance = /retryBudget|stuckJobDetector|replayPolicy|workerAlerts|\/api\/replay-requests|\/api\/stuck-jobs/i.test(allContent)
    }
    if (story.kind === 'bot') {
        checks.botSource = await exists(path.join(target, 'src/index.ts'))
        checks.audit = /auditLog|audit/i.test(allContent)
        checks.safeStubs = /restartRequests|Restart request logged|maintenance|stub|Destructive actions require explicit review/i.test(allContent)
    }
    return checks
}

async function verifyInBrowser(browser: Awaited<ReturnType<typeof chromium.launch>>, story: Story, previewPath: string, screenshotPath: string) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
    const consoleErrors: string[] = []
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
    await page.goto(pathToFileURL(previewPath).href, { waitUntil: 'domcontentloaded', timeout: 15_000 })
    await page.locator('h1').filter({ hasText: story.title }).waitFor({ timeout: 10_000 })
    await page.getByRole('link', { name: /skip to content/i }).focus()
    await page.keyboard.press('Enter')
    await page.getByLabel(/email/i).fill(`story-${story.id}@example.com`)
    await page.getByRole('button', { name: /request review/i }).click()
    await page.getByRole('status').waitFor()
    const visibleText = await page.locator('body').innerText()
    const checks: Record<string, boolean> = {
        titleVisible: visibleText.includes(story.title),
        formWorked: /Review requested/.test(visibleText),
        artifactsVisible: /Generated artifacts/.test(visibleText),
        docsVisible: /Documentation proof/.test(visibleText),
        sourceVisible: /Source proof/.test(visibleText),
        mustSee: story.browserMustSee.every((pattern) => pattern.test(visibleText)),
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
const browser = await chromium.launch({ headless: true, executablePath: findChromiumExecutable() })
try {
    for (const story of stories) {
        console.log(`REVIEW ${story.id} ${story.title}`)
        const response = buildShareProjectResponse(story.prompt)
        if (!response) { results.push({ id: story.id, title: story.title, ok: false, reason: 'No builder response', checks: {} }); continue }
        const files = parseToolFiles(response.message)
        const target = await writeFiles(story, files)
        const previewPath = await createPreview(story, target, files)
        const contentChecks = await verifyContent(story, target, files)
        const screenshotPath = path.join(outRoot, 'screenshots', `${story.id}-${slugify(story.title)}.png`)
        const browserResult = await verifyInBrowser(browser, story, previewPath, screenshotPath)
        const checks = { ...contentChecks, ...Object.fromEntries(Object.entries(browserResult.checks).map(([key, value]) => [`browser:${key}`, value])) }
        const failed = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key)
        const improvement = failed.length ? `Tighten: ${failed.join(', ')}` : 'Reviewed again: strict enough for this batch.'
        const ok = failed.length === 0
        results.push({ id: story.id, title: story.title, ok, target, previewPath, screenshotPath, fileCount: files.length, checks, improvement, consoleErrors: browserResult.consoleErrors })
        console.log(`${ok ? 'PASS' : 'FAIL'} ${story.id} ${story.title} (${files.length} files)`)
        console.log(`  ${improvement}`)
    }
}
finally {
    await browser.close().catch(() => undefined)
}
const failed = results.filter((result) => !result.ok)
await fs.writeFile(path.join(outRoot, 'results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2))
if (failed.length) throw new Error(`${failed.length} reddit production stories failed.`)
console.log(`All ${results.length} reddit production stories passed with Playwright browser verification.`)

function findChromiumExecutable() {
    for (const executablePath of chromiumExecutableCandidates()) {
        if (fsSync.existsSync(executablePath)) {
            return executablePath
        }
    }

    return undefined
}

function chromiumExecutableCandidates() {
    const cacheRoot = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright')
    const cached = fsSync.existsSync(cacheRoot)
        ? fsSync.readdirSync(cacheRoot)
            .filter(entry => entry.startsWith('chromium_headless_shell-'))
            .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
            .map(entry => path.join(cacheRoot, entry, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell'))
        : []

    return [
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        ...cached,
    ].filter(Boolean)
}
