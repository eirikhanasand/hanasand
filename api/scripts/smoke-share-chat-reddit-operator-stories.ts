import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type Kind = 'website' | 'api' | 'bot' | 'worker'
type Story = { id: number; title: string; prompt: string; kind: Kind; mustMention: RegExp[] }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'share-chat-reddit-operator-stories')

const stories: Story[] = [
    { id: 421, title: 'Nontechnical Operator Takeover Site', kind: 'website', prompt: 'Create nontechnical operator takeover site with operator handbook onboarding preview diff undo support bundle plain error recovery paths.', mustMention: [/docs\/operator-handbook\.md/i, /docs\/onboarding\.md/i, /docs\/change-review\.md/i, /docs\/support-bundle\.md/i, /preview/i, /diff/i, /undo/i, /docs\/error-recovery\.md/i] },
    { id: 422, title: 'SEO Metadata Control Site', kind: 'website', prompt: 'Build SEO metadata control site with editing control LLM visibility redirect map search validation canonical sitemap change review.', mustMention: [/docs\/seo-editing-control\.md/i, /docs\/seo-llm-visibility\.md/i, /Search validation/i, /Redirect checklist/i, /docs\/change-review\.md/i, /canonical|sitemap/i] },
    { id: 423, title: 'Data Contract CRM API', kind: 'api', prompt: 'Create data contract CRM API with OpenAPI shaped errors backup restore import export pagination schema drift migration plan.', mustMention: [/docs\/data-contract\.md/i, /\/openapi\.json/i, /request_error/i, /\/backup/i, /\/restore/i, /nextCursor/i, /\/schema-drift/i, /docs\/migration-plan\.md/i] },
    { id: 424, title: 'Human Error Recovery API', kind: 'api', prompt: 'Build human error recovery API with request IDs shaped errors support bundle retry guidance idempotency owner escalation.', mustMention: [/docs\/error-recovery\.md/i, /x-request-id/i, /request_error/i, /docs\/support-bundle\.md/i, /Limit reached|retry/i, /idempotency/i, /failureOwner/i] },
    { id: 425, title: 'Feedback Becomes Test Worker', kind: 'worker', prompt: 'Create feedback becomes test worker with structured user complaints worker jobs events retry budget release evidence QA plan.', mustMention: [/docs\/feedback-loop\.md/i, /src\/queue\.ts/i, /src\/worker\.ts/i, /events/i, /retryBudget/i, /docs\/release-evidence\.md/i, /docs\/qa-plan\.md/i] },
    { id: 426, title: 'Builder Demo Reality Check Site', kind: 'website', prompt: 'Build builder demo reality check site explaining real versus demo onboarding maintainability browser verification change review backend contract concrete copy.', mustMention: [/docs\/onboarding\.md/i, /docs\/maintainability\.md/i, /docs\/browser-verification\.md/i, /docs\/change-review\.md/i, /concrete/i, /Backend contract/i] },
    { id: 427, title: 'Upload Abuse Recovery API', kind: 'api', prompt: 'Create upload abuse recovery API with payload limits policy upload error recovery data contract audit events metrics shaped errors.', mustMention: [/MAX_BODY_BYTES/i, /docs\/policy-upload\.md/i, /docs\/error-recovery\.md/i, /docs\/data-contract\.md/i, /auditEvents/i, /\/metrics/i, /request_error/i] },
    { id: 428, title: 'Restaurant Staff Handbook Site', kind: 'website', prompt: 'Create restaurant staff handbook site with menus reservations operator handbook SEO editing control allergy policy upload onboarding.', mustMention: [/Menu and allergens/i, /Reservations/i, /docs\/operator-handbook\.md/i, /docs\/seo-editing-control\.md/i, /docs\/policy-upload\.md/i, /docs\/onboarding\.md/i] },
    { id: 429, title: 'Billing Dispute Evidence API', kind: 'api', prompt: 'Build billing dispute evidence API with data contract pricing risk audit events webhook signature support bundle error recovery backup restore.', mustMention: [/docs\/data-contract\.md/i, /docs\/pricing-risk\.md/i, /auditEvents/i, /verifyWebhookSignature/i, /docs\/support-bundle\.md/i, /docs\/error-recovery\.md/i, /\/backup/i, /\/restore/i] },
    { id: 430, title: 'Moderation Feedback Bot', kind: 'bot', prompt: 'Create Discord moderation feedback bot with feedback loop change review operator handbook safe audit log no destructive auto actions.', mustMention: [/discord\.js/i, /auditLog/i, /docs\/feedback-loop\.md/i, /docs\/change-review\.md/i, /docs\/operator-handbook\.md/i, /Destructive actions require explicit review/i] },
    { id: 431, title: 'Onboarding For Developer Exit API', kind: 'api', prompt: 'Create developer exit onboarding API with data contract exit plan OpenAPI Docker CI support bundle.', mustMention: [/docs\/onboarding\.md/i, /docs\/data-contract\.md/i, /docs\/exit-plan\.md/i, /\/openapi\.json/i, /Dockerfile/i, /\.github\/workflows\/ci\.yml/i, /docs\/support-bundle\.md/i] },
    { id: 432, title: 'Error Recovery Status Site', kind: 'website', prompt: 'Build error recovery status page with incident timeline postmortems error recovery support bundle operator handbook browser verification.', mustMention: [/Incident timeline/i, /Postmortems/i, /docs\/error-recovery\.md/i, /docs\/support-bundle\.md/i, /docs\/operator-handbook\.md/i, /docs\/browser-verification\.md/i] },
    { id: 433, title: 'Workflow Audit Trail API', kind: 'api', prompt: 'Build workflow audit trail API with workflow portability data contract audit hash request IDs change review rollback approvals.', mustMention: [/docs\/workflow-portability\.md/i, /docs\/data-contract\.md/i, /auditHash/i, /x-request-id/i, /docs\/change-review\.md/i, /rollback|\/rollback-approvals/i] },
    { id: 434, title: 'Accessibility Operator Portal Site', kind: 'website', prompt: 'Create accessibility operator portal with WCAG tasks accessibility audit operator handbook onboarding QA browser verification skip link.', mustMention: [/docs\/accessibility-audit\.md/i, /docs\/operator-handbook\.md/i, /docs\/onboarding\.md/i, /docs\/qa-plan\.md/i, /docs\/browser-verification\.md/i, /Skip to content/i] },
    { id: 435, title: 'Refund Workflow Worker', kind: 'worker', prompt: 'Create refund workflow worker with approval replay cancel feedback loop error recovery support bundle.', mustMention: [/replayPolicy/i, /cancelJob/i, /replayRequests/i, /docs\/feedback-loop\.md/i, /docs\/error-recovery\.md/i, /docs\/support-bundle\.md/i, /approval/i] },
    { id: 436, title: 'Local Business LLM Visibility Site', kind: 'website', prompt: 'Build local business LLM visibility site with SEO LLM visibility SEO editing control concrete local copy browser verification operator handbook.', mustMention: [/docs\/seo-llm-visibility\.md/i, /docs\/seo-editing-control\.md/i, /concrete/i, /docs\/browser-verification\.md/i, /docs\/operator-handbook\.md/i] },
    { id: 437, title: 'Contract Drift Partner API', kind: 'api', prompt: 'Create contract drift partner API with data contract schema drift contract tests OpenAPI error recovery request IDs support bundle.', mustMention: [/docs\/data-contract\.md/i, /\/schema-drift/i, /\/contract-tests/i, /\/openapi\.json/i, /docs\/error-recovery\.md/i, /x-request-id/i, /docs\/support-bundle\.md/i] },
    { id: 438, title: 'Support Agent Training Site', kind: 'website', prompt: 'Build support agent training site with onboarding operator handbook feedback loop support bundle error recovery change review.', mustMention: [/docs\/onboarding\.md/i, /docs\/operator-handbook\.md/i, /docs\/feedback-loop\.md/i, /docs\/support-bundle\.md/i, /docs\/error-recovery\.md/i, /docs\/change-review\.md/i] },
    { id: 439, title: 'Safe Internal Admin Bot', kind: 'bot', prompt: 'Create safe internal admin bot with audit evidence operator handbook change review feedback loop no hidden destructive operations.', mustMention: [/src\/index\.ts/i, /auditLog/i, /docs\/operator-handbook\.md/i, /docs\/change-review\.md/i, /docs\/feedback-loop\.md/i, /Destructive actions require explicit review/i] },
    { id: 440, title: 'Hostile Operator Delivery Gauntlet', kind: 'worker', prompt: 'Create hostile operator delivery worker gauntlet with operator handbook onboarding data contract error recovery feedback loop SEO editing policy upload accessibility audit workflow portability support change review backup restore replay governance Docker CI.', mustMention: [/docs\/operator-handbook\.md/i, /docs\/onboarding\.md/i, /docs\/data-contract\.md/i, /docs\/error-recovery\.md/i, /docs\/feedback-loop\.md/i, /docs\/seo-editing-control\.md/i, /docs\/policy-upload\.md/i, /docs\/accessibility-audit\.md/i, /docs\/workflow-portability\.md/i, /docs\/support-bundle\.md/i, /docs\/change-review\.md/i, /replayRequests/i, /worker-status/i] },
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
        enoughFiles: files.length >= (story.kind === 'website' ? 40 : story.kind === 'worker' ? 40 : 38),
        packageJson: await exists(path.join(target, 'package.json')),
        readme: await exists(path.join(target, 'README.md')),
        envExample: await exists(path.join(target, '.env.example')),
        dockerfile: await exists(path.join(target, 'Dockerfile')),
        compose: await exists(path.join(target, 'docker-compose.yml')),
        ci: await exists(path.join(target, '.github/workflows/ci.yml')),
        operatorHandbook: await exists(path.join(target, 'docs/operator-handbook.md')),
        onboarding: await exists(path.join(target, 'docs/onboarding.md')),
        dataContract: await exists(path.join(target, 'docs/data-contract.md')),
        errorRecovery: await exists(path.join(target, 'docs/error-recovery.md')),
        feedbackLoop: await exists(path.join(target, 'docs/feedback-loop.md')),
        seoEditing: await exists(path.join(target, 'docs/seo-editing-control.md')),
        policyUpload: await exists(path.join(target, 'docs/policy-upload.md')),
        accessibilityAudit: await exists(path.join(target, 'docs/accessibility-audit.md')),
        workflowPortability: await exists(path.join(target, 'docs/workflow-portability.md')),
        supportBundle: await exists(path.join(target, 'docs/support-bundle.md')),
        changeReview: await exists(path.join(target, 'docs/change-review.md')),
        noHardcodedSecrets: !/(sk-[a-z0-9]|xox[baprs]-|DISCORD_TOKEN\s*=\s*[^\n]*[A-Za-z0-9]{20,})/i.test(allContent),
        noLorem: !/lorem ipsum|placeholder text|todo: write copy/i.test(allContent),
        delivery: /operator handbook|onboarding|data contract|error recovery|feedback loop|support bundle|change review|Docker Compose|rollback/i.test(await read(path.join(target, 'README.md')) + allContent),
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
if (failed.length) throw new Error(`${failed.length} reddit operator stories failed.`)
console.log(`All ${results.length} reddit operator stories passed.`)
