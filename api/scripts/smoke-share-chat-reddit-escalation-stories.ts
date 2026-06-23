import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type Kind = 'website' | 'api' | 'bot' | 'worker'
type Story = { id: number; title: string; prompt: string; kind: Kind; mustMention: RegExp[] }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'share-chat-reddit-escalation-stories')

const stories: Story[] = [
    { id: 401, title: 'SEO Rage Local Contractor Site', kind: 'website', prompt: 'Create local SEO rage contractor site with search validation redirect checklist LLM visibility browser verification accessibility audit change review Docker CI.', mustMention: [/Search validation/i, /Redirect checklist/i, /docs\/seo-llm-visibility\.md/i, /docs\/browser-verification\.md/i, /docs\/accessibility-audit\.md/i, /docs\/change-review\.md/i] },
    { id: 402, title: 'Pricing Trap SaaS API', kind: 'api', prompt: 'Build pricing trap SaaS API with usage quotas rate limit reset behavior pricing risk metrics shaped limit errors export restore.', mustMention: [/\/usage-quotas/i, /rateLimit/i, /Limit reached/i, /\/metrics/i, /docs\/pricing-risk\.md/i, /docs\/exit-plan\.md/i, /\/backup/i, /\/restore/i, /request_error/i] },
    { id: 403, title: 'Workflow Portability Worker', kind: 'worker', prompt: 'Create workflow portability worker with triggers side effects retry rules replay governance change review support bundle.', mustMention: [/src\/queue\.ts/i, /src\/worker\.ts/i, /replayRequests/i, /retryBudget/i, /workerAlerts/i, /docs\/workflow-portability\.md/i, /docs\/change-review\.md/i, /docs\/support-bundle\.md/i] },
    { id: 404, title: 'Policy Upload Safety API', kind: 'api', prompt: 'Create policy upload safety API with payload limits shaped upload failures data classification retention holds support bundle malware scan seam.', mustMention: [/MAX_BODY_BYTES/i, /request_error/i, /docs\/policy-upload\.md/i, /docs\/data-classification\.md/i, /retentionHolds/i, /docs\/support-bundle\.md/i, /malware-scan/i] },
    { id: 405, title: 'ADA Lawsuit Recovery Site', kind: 'website', prompt: 'Build ADA accessibility lawsuit recovery site with keyboard skip links labels reduced motion accessibility audit browser verification QA plan.', mustMention: [/Skip to content/i, /aria-label|<label/i, /Reduced motion/i, /docs\/accessibility-audit\.md/i, /docs\/browser-verification\.md/i, /docs\/qa-plan\.md/i] },
    { id: 406, title: 'Diff Undo Preview Delivery Site', kind: 'website', prompt: 'Build diff undo preview delivery site with preview diff undo approval support bundle browser verification change review Docker.', mustMention: [/docs\/change-review\.md/i, /docs\/support-bundle\.md/i, /docs\/browser-verification\.md/i, /preview/i, /diff/i, /undo/i, /approval/i] },
    { id: 407, title: 'Fake Integration Detector API', kind: 'api', prompt: 'Create fake integration detector API with backend contract OpenAPI shaped errors support bundle migration plan webhook signature seam Docker.', mustMention: [/\/openapi\.json/i, /request_error/i, /docs\/support-bundle\.md/i, /docs\/migration-plan\.md/i, /contractVersion|Backend contract/i, /verifyWebhookSignature/i] },
    { id: 408, title: 'Client Data Export Hostage API', kind: 'api', prompt: 'Build client data export hostage API with export backup restore schema drift exit plan workflow portability migration plan support bundle.', mustMention: [/\/backup/i, /\/restore/i, /\/schema-drift/i, /docs\/exit-plan\.md/i, /docs\/workflow-portability\.md/i, /docs\/migration-plan\.md/i, /docs\/support-bundle\.md/i] },
    { id: 409, title: 'Restaurant Allergy Policy Upload Site', kind: 'website', prompt: 'Create restaurant allergy policy upload site with menu allergens reservations policy upload accessibility audit browser verification SEO visibility migration delivery.', mustMention: [/Menu and allergens/i, /Reservations/i, /docs\/policy-upload\.md/i, /docs\/accessibility-audit\.md/i, /docs\/browser-verification\.md/i, /docs\/seo-llm-visibility\.md/i, /docs\/migration-plan\.md/i] },
    { id: 410, title: 'Subscription Cancellation API', kind: 'api', prompt: 'Create subscription cancellation API with cancellation export pricing risk audit events webhook replay shaped errors support evidence rate limits.', mustMention: [/auditEvents/i, /verifyWebhookSignature/i, /request_error/i, /docs\/pricing-risk\.md/i, /docs\/support-bundle\.md/i, /docs\/exit-plan\.md/i, /rateLimit/i] },
    { id: 411, title: 'Content Moderation Appeal Bot', kind: 'bot', prompt: 'Build Discord content moderation appeal bot with safe appeal logs no auto ban change review support bundle role config audit evidence.', mustMention: [/discord\.js/i, /auditLog/i, /!roles/i, /Destructive actions require explicit review/i, /docs\/change-review\.md/i, /docs\/support-bundle\.md/i] },
    { id: 412, title: 'Multi Editor Collaboration Site', kind: 'website', prompt: 'Create multi editor collaboration site with change review maintainability workflow portability QA preview diff undo concrete copy no filler.', mustMention: [/docs\/change-review\.md/i, /docs\/maintainability\.md/i, /docs\/workflow-portability\.md/i, /docs\/qa-plan\.md/i, /preview/i, /diff/i, /undo/i, /concrete/i] },
    { id: 413, title: 'Form Spam Abuse API', kind: 'api', prompt: 'Build form spam abuse API with rate limiting payload limits shaped errors audit events support bundle policy upload limits metrics.', mustMention: [/rateLimit/i, /MAX_BODY_BYTES/i, /request_error/i, /auditEvents/i, /\/metrics/i, /docs\/support-bundle\.md/i, /docs\/policy-upload\.md/i] },
    { id: 414, title: 'LLM Search Restaurant Site', kind: 'website', prompt: 'Create LLM search restaurant site with SEO LLM visibility local content menu allergens reservations browser verification exit plan concrete local copy.', mustMention: [/docs\/seo-llm-visibility\.md/i, /Menu and allergens/i, /Reservations/i, /docs\/browser-verification\.md/i, /docs\/exit-plan\.md/i, /concrete/i] },
    { id: 415, title: 'Approval Queue Worker', kind: 'worker', prompt: 'Create approval queue worker with no destructive changes without approval replay policy poison queue safety cancel job change review support bundle.', mustMention: [/replayPolicy/i, /poisonJobs/i, /workerAlerts/i, /cancelJob/i, /docs\/change-review\.md/i, /docs\/support-bundle\.md/i, /approval|Destructive/i] },
    { id: 416, title: 'Procurement Renewal Shock Site', kind: 'website', prompt: 'Build procurement renewal shock site with pricing risk exit plan SBOM license review support bundle rollback path.', mustMention: [/docs\/pricing-risk\.md/i, /docs\/exit-plan\.md/i, /docs\/sbom\.json/i, /docs\/procurement-review\.md/i, /docs\/support-bundle\.md/i, /Rollback path/i] },
    { id: 417, title: 'Policy Evidence Portal Site', kind: 'website', prompt: 'Create legal policy evidence portal with policy upload data classification accessibility audit support bundle browser verification change review.', mustMention: [/docs\/policy-upload\.md/i, /docs\/data-classification\.md/i, /docs\/accessibility-audit\.md/i, /docs\/support-bundle\.md/i, /docs\/browser-verification\.md/i, /docs\/change-review\.md/i] },
    { id: 418, title: 'Exportable CRM Backend API', kind: 'api', prompt: 'Build exportable CRM backend API with backup restore workflow portability OpenAPI quotas shaped errors support bundle migration plan.', mustMention: [/\/backup/i, /\/restore/i, /\/openapi\.json/i, /\/usage-quotas/i, /request_error/i, /docs\/workflow-portability\.md/i, /docs\/support-bundle\.md/i, /docs\/migration-plan\.md/i] },
    { id: 419, title: 'Accessibility Procurement Bot', kind: 'bot', prompt: 'Create accessibility procurement bot with safe status answers accessibility audit change review no destructive commands no hardcoded credentials.', mustMention: [/src\/index\.ts/i, /auditLog/i, /docs\/accessibility-audit\.md/i, /docs\/change-review\.md/i, /Destructive actions require explicit review/i] },
    { id: 420, title: 'Hostile Enterprise Buyer Gauntlet 2', kind: 'worker', prompt: 'Create hostile enterprise buyer gauntlet worker with SEO LLM visibility pricing risk workflow portability policy upload safety accessibility audit change review migration support exit backup restore rate limits replay governance Docker CI.', mustMention: [/docs\/seo-llm-visibility\.md/i, /docs\/pricing-risk\.md/i, /docs\/workflow-portability\.md/i, /docs\/policy-upload\.md/i, /docs\/accessibility-audit\.md/i, /docs\/change-review\.md/i, /docs\/migration-plan\.md/i, /docs\/support-bundle\.md/i, /docs\/exit-plan\.md/i, /replayRequests/i, /worker-status/i] },
]

function parseToolFiles(message: string) { return [...message.matchAll(/<hanasand-tool>([\s\S]*?)<\/hanasand-tool>/g)].map((match) => JSON.parse(match[1]) as ToolFile) }
async function exists(filePath: string) { try { await fs.access(filePath); return true } catch { return false } }
async function read(filePath: string) { return await fs.readFile(filePath, 'utf8').catch(() => '') }
async function writeFiles(story: Story, files: ToolFile[]) {
    const target = path.join(outRoot, `${story.id}-${slugify(story.title)}`)
    await fs.rm(target, { recursive: true, force: true })
    for (const file of files) { const filePath = path.join(target, file.path); await fs.mkdir(path.dirname(filePath), { recursive: true }); await fs.writeFile(filePath, file.content) }
    return target
}
async function verify(story: Story, target: string, files: ToolFile[]) {
    const allContent = files.map((file) => `${file.path}\n${file.content}`).join('\n---\n')
    const checks: Record<string, boolean> = {
        enoughFiles: files.length >= (story.kind === 'website' ? 34 : story.kind === 'worker' ? 34 : 32),
        packageJson: await exists(path.join(target, 'package.json')),
        readme: await exists(path.join(target, 'README.md')),
        envExample: await exists(path.join(target, '.env.example')),
        dockerfile: await exists(path.join(target, 'Dockerfile')),
        compose: await exists(path.join(target, 'docker-compose.yml')),
        ci: await exists(path.join(target, '.github/workflows/ci.yml')),
        migrationPlan: await exists(path.join(target, 'docs/migration-plan.md')),
        supportBundle: await exists(path.join(target, 'docs/support-bundle.md')),
        qaPlan: await exists(path.join(target, 'docs/qa-plan.md')),
        browserVerification: await exists(path.join(target, 'docs/browser-verification.md')),
        maintainability: await exists(path.join(target, 'docs/maintainability.md')),
        exitPlan: await exists(path.join(target, 'docs/exit-plan.md')),
        seoVisibility: await exists(path.join(target, 'docs/seo-llm-visibility.md')),
        pricingRisk: await exists(path.join(target, 'docs/pricing-risk.md')),
        workflowPortability: await exists(path.join(target, 'docs/workflow-portability.md')),
        policyUpload: await exists(path.join(target, 'docs/policy-upload.md')),
        accessibilityAudit: await exists(path.join(target, 'docs/accessibility-audit.md')),
        changeReview: await exists(path.join(target, 'docs/change-review.md')),
        noHardcodedSecrets: !/(sk-[a-z0-9]|xox[baprs]-|DISCORD_TOKEN\s*=\s*[^\n]*[A-Za-z0-9]{20,})/i.test(allContent),
        noLorem: !/lorem ipsum|placeholder text|todo: write copy/i.test(allContent),
        delivery: /delivery|release notes|verification|docker compose|failure owner|rollback|restore|CI|support bundle|migration plan|browser verification|change review|workflow portability/i.test(await read(path.join(target, 'README.md')) + allContent),
        mentions: story.mustMention.every((pattern) => pattern.test(allContent)),
    }
    if (story.kind === 'website') { checks.page = await exists(path.join(target, 'src/app/page.tsx')); checks.layout = await exists(path.join(target, 'src/app/layout.tsx')); checks.accessible = /aria-label|<label|Skip to content/i.test(allContent); checks.responsive = /clamp\(|auto-fit|flexWrap|mobile/i.test(allContent); checks.reviewable = /preview|diff|undo|approval|change review/i.test(allContent) }
    if (story.kind === 'api') { checks.apiSource = await exists(path.join(target, 'src/index.ts')); checks.healthReady = /\/health|\/ready/.test(allContent); checks.shapedErrors = /request_error|Limit reached|title_required/i.test(allContent); checks.operability = /x-request-id|\/openapi\.json|\/metrics|auditHash|MAX_BODY_BYTES/i.test(allContent); checks.recovery = /\/backup|\/restore|migrations|featureFlags|rollback/i.test(allContent) }
    if (story.kind === 'worker') { checks.workerSource = await exists(path.join(target, 'src/worker.ts')); checks.queueSource = await exists(path.join(target, 'src/queue.ts')); checks.replay = /replayDeadLetter|replayRequests|\/api\/jobs\/:id\/replay/i.test(allContent); checks.assurance = /retryBudget|stuckJobDetector|replayPolicy|workerAlerts|\/api\/replay-requests|\/api\/stuck-jobs/i.test(allContent) }
    if (story.kind === 'bot') { checks.botSource = await exists(path.join(target, 'src/index.ts')); checks.audit = /auditLog|audit/i.test(allContent); checks.safeStubs = /restartRequests|Restart request logged|maintenance|stub|Destructive actions require explicit review/i.test(allContent) }
    return checks
}
function slugify(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }
await fs.rm(outRoot, { recursive: true, force: true }); await fs.mkdir(outRoot, { recursive: true })
const results = []
for (const story of stories) {
    const response = buildShareProjectResponse(story.prompt)
    if (!response) { results.push({ id: story.id, title: story.title, ok: false, reason: 'No builder response', checks: {} }); continue }
    const files = parseToolFiles(response.message)
    const target = await writeFiles(story, files)
    const checks = await verify(story, target, files)
    const ok = Object.values(checks).every(Boolean)
    results.push({ id: story.id, title: story.title, ok, target, fileCount: files.length, checks })
    console.log(`${ok ? 'PASS' : 'FAIL'} ${story.id} ${story.title} (${files.length} files)`)
    if (!ok) console.log(Object.entries(checks).filter(([, value]) => !value).map(([key]) => `  - ${key}`).join('\n'))
}
const failed = results.filter((result) => !result.ok)
await fs.writeFile(path.join(outRoot, 'results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2))
if (failed.length) throw new Error(`${failed.length} reddit escalation stories failed.`)
console.log(`All ${results.length} reddit escalation stories passed.`)
