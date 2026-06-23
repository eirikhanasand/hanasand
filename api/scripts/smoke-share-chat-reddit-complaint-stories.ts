import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type Kind = 'website' | 'api' | 'bot' | 'worker'
type Story = { id: number; title: string; prompt: string; kind: Kind; mustMention: RegExp[] }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'share-chat-reddit-complaint-stories')

const stories: Story[] = [
    { id: 381, title: 'Angry Restaurant Migration Rescue', kind: 'website', prompt: 'Create angry restaurant migration rescue website with menu allergens reservations redirects source export browser verification support bundle exit plan Docker CI.', mustMention: [/Menu and allergens/i, /Reservations/i, /docs\/migration-plan\.md/i, /docs\/browser-verification\.md/i, /docs\/support-bundle\.md/i, /docs\/exit-plan\.md/i, /Source export/i, /Redirect checklist|Rollback plan/i] },
    { id: 382, title: 'Agency Landing Page Maintainable Delivery', kind: 'website', prompt: 'Build critic agency marketing landing page with concrete copy maintainability QA procurement support bundle ownership delivery no lock-in Docker CI.', mustMention: [/docs\/maintainability\.md/i, /docs\/qa-plan\.md/i, /docs\/procurement-review\.md/i, /docs\/support-bundle\.md/i, /No platform lock-in/i, /concrete/i] },
    { id: 383, title: 'Discord Bot Rage Quit Recovery', kind: 'bot', prompt: 'Create Discord bot rage quit recovery with safe stubs audit log restart requests support bundle maintainability exit plan no hardcoded token.', mustMention: [/discord\.js/i, /auditLog/i, /restartRequests/i, /Destructive actions require explicit review/i, /docs\/support-bundle\.md/i, /docs\/maintainability\.md/i, /docs\/exit-plan\.md/i] },
    { id: 384, title: 'Backend Ownership API', kind: 'api', prompt: 'Build backend ownership API with export import OpenAPI support bundle migration plan data classification request IDs shaped errors backup restore.', mustMention: [/\/openapi\.json/i, /\/backup/i, /\/restore/i, /x-request-id/i, /request_error/i, /docs\/migration-plan\.md/i, /docs\/support-bundle\.md/i, /docs\/data-classification\.md/i] },
    { id: 385, title: 'Rate Limit Without Red Error API', kind: 'api', prompt: 'Create rate limit humane shaped errors API with retry guidance metrics usage quotas request IDs support bundle QA plan.', mustMention: [/rateLimit/i, /Limit reached/i, /\/usage-quotas/i, /\/metrics/i, /x-request-id/i, /request_error/i, /docs\/support-bundle\.md/i, /docs\/qa-plan\.md/i] },
    { id: 386, title: 'Browser Verified Ecommerce Site', kind: 'website', prompt: 'Build ecommerce store website with product bundles checkout buttons forms responsive browser verification QA plan support bundle exit plan Docker.', mustMention: [/Product bundles/i, /Checkout CTA/i, /docs\/browser-verification\.md/i, /docs\/qa-plan\.md/i, /docs\/support-bundle\.md/i, /docs\/exit-plan\.md/i, /<form|aria-label/i, /clamp\(|auto-fit|flexWrap/i] },
    { id: 387, title: 'Import Export Worker', kind: 'worker', prompt: 'Create import export worker with idempotency replay poison quarantine support bundle migration plan stuck-job detection retry budget.', mustMention: [/src\/queue\.ts/i, /src\/worker\.ts/i, /idempotency/i, /replayRequests/i, /poisonJobs/i, /stuckJobDetector/i, /retryBudget/i, /docs\/support-bundle\.md/i, /docs\/migration-plan\.md/i] },
    { id: 388, title: 'Auth Session Second Device API', kind: 'api', prompt: 'Build auth session second device API with owner scoping RBAC audit events shaped errors QA browser verification access review security review.', mustMention: [/requireRole/i, /ownerId/i, /auditEvents/i, /request_error/i, /docs\/qa-plan\.md/i, /docs\/browser-verification\.md/i, /docs\/access-review\.md/i, /docs\/security-review\.md/i] },
    { id: 389, title: 'Local SEO Redirect Recovery Site', kind: 'website', prompt: 'Create local SEO redirect recovery site with search validation redirect checklist migration plan QA plan browser verification exit plan Docker.', mustMention: [/Search validation/i, /Redirect checklist/i, /docs\/migration-plan\.md/i, /docs\/qa-plan\.md/i, /docs\/browser-verification\.md/i, /docs\/exit-plan\.md/i] },
    { id: 390, title: 'Privacy Data Request API', kind: 'api', prompt: 'Create privacy data request API with data classification retention holds audit hash backup verification support bundle shaped errors PII redact.', mustMention: [/\/data-classification/i, /retentionHolds/i, /auditHash/i, /\/backup\/verify/i, /request_error/i, /docs\/support-bundle\.md/i, /docs\/data-classification\.md/i, /redact/i] },
    { id: 391, title: 'Slow Invisible Progress Worker', kind: 'worker', prompt: 'Build slow invisible progress worker with events worker status replay requests stuck jobs support bundle maintainability retry budget.', mustMention: [/events/i, /worker-status/i, /\/api\/replay-requests/i, /\/api\/stuck-jobs/i, /docs\/support-bundle\.md/i, /docs\/maintainability\.md/i, /retryBudget/i] },
    { id: 392, title: 'SaaS Procurement Packet Site', kind: 'website', prompt: 'Build SaaS procurement packet site with SBOM threat model procurement review support bundle exit plan browser verification Docker no fake enterprise claims.', mustMention: [/docs\/sbom\.json/i, /docs\/threat-model\.md/i, /docs\/procurement-review\.md/i, /docs\/support-bundle\.md/i, /docs\/exit-plan\.md/i, /docs\/browser-verification\.md/i] },
    { id: 393, title: 'Restaurant Back Office API', kind: 'api', prompt: 'Create restaurant back office API with menu reservation validation idempotency backup restore metrics data classification migration delivery Docker.', mustMention: [/title_required/i, /idempotency/i, /\/backup/i, /\/restore/i, /\/metrics/i, /docs\/data-classification\.md/i, /docs\/migration-plan\.md/i] },
    { id: 394, title: 'Failed Payment Subscription API', kind: 'api', prompt: 'Build failed payment subscription API with rate limits audit events webhook signature seam request IDs rollback support bundle QA plan Docker.', mustMention: [/rateLimit/i, /auditEvents/i, /verifyWebhookSignature/i, /x-request-id/i, /rollback/i, /docs\/support-bundle\.md/i, /docs\/qa-plan\.md/i] },
    { id: 395, title: 'Accessibility Rage Test Site', kind: 'website', prompt: 'Create accessibility a11y rage test site with skip links labels reduced motion browser verification QA plan maintainability responsive keyboard flow.', mustMention: [/Skip to content/i, /aria-label|<label/i, /Reduced motion/i, /docs\/browser-verification\.md/i, /docs\/qa-plan\.md/i, /docs\/maintainability\.md/i, /clamp\(|auto-fit|flexWrap/i] },
    { id: 396, title: 'Incident Status Site Delivery', kind: 'website', prompt: 'Build incident status page with incident timeline SLO evidence postmortems observability support bundle release evidence rollback plan.', mustMention: [/Incident timeline/i, /SLO evidence/i, /Postmortems/i, /docs\/observability\.md/i, /docs\/support-bundle\.md/i, /docs\/release-evidence\.md/i, /Rollback plan/i] },
    { id: 397, title: 'Data Import Vendor Exit API', kind: 'api', prompt: 'Create data import vendor exit API with data import export ownership backup restore schema drift migration plan exit plan support bundle OpenAPI.', mustMention: [/\/backup/i, /\/restore/i, /\/schema-drift/i, /\/openapi\.json/i, /docs\/migration-plan\.md/i, /docs\/exit-plan\.md/i, /docs\/support-bundle\.md/i] },
    { id: 398, title: 'Moderation Bot Human Review', kind: 'bot', prompt: 'Create Discord moderation bot with human review audit log safe stubs role configuration support bundle no destructive auto actions.', mustMention: [/discord\.js/i, /auditLog/i, /!roles/i, /Restart request logged/i, /Destructive actions require explicit review/i, /docs\/support-bundle\.md/i] },
    { id: 399, title: 'Enterprise Support Escalation Portal', kind: 'website', prompt: 'Build support escalation SLA portal with escalation paths SLA states customer messaging support bundle browser verification QA plan failure owner.', mustMention: [/Escalation paths/i, /SLA states/i, /Customer messaging/i, /Failure owner/i, /docs\/support-bundle\.md/i, /docs\/browser-verification\.md/i, /docs\/qa-plan\.md/i] },
    { id: 400, title: 'Hostile Full Stack Recovery Gauntlet', kind: 'worker', prompt: 'Create hostile full stack recovery worker gauntlet with lock-in exit export maintainability browser verification support migration QA security observability worker replay Docker CI.', mustMention: [/docs\/migration-plan\.md/i, /docs\/support-bundle\.md/i, /docs\/qa-plan\.md/i, /docs\/browser-verification\.md/i, /docs\/maintainability\.md/i, /docs\/exit-plan\.md/i, /docs\/security-review\.md/i, /docs\/observability\.md/i, /Docker/i, /replayRequests/i, /worker-status/i] },
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
        enoughFiles: files.length >= (story.kind === 'website' ? 28 : story.kind === 'worker' ? 28 : 26),
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
        noHardcodedSecrets: !/(sk-[a-z0-9]|xox[baprs]-|DISCORD_TOKEN\s*=\s*[^\n]*[A-Za-z0-9]{20,})/i.test(allContent),
        noLorem: !/lorem ipsum|placeholder text|todo: write copy/i.test(allContent),
        delivery: /delivery|release notes|verification|docker compose|failure owner|rollback|restore|CI|security review|support bundle|migration plan|browser verification/i.test(await read(path.join(target, 'README.md')) + allContent),
        mentions: story.mustMention.every((pattern) => pattern.test(allContent)),
    }
    if (story.kind === 'website') { checks.page = await exists(path.join(target, 'src/app/page.tsx')); checks.layout = await exists(path.join(target, 'src/app/layout.tsx')); checks.accessible = /aria-label|<label|Skip to content/i.test(allContent); checks.responsive = /clamp\(|auto-fit|flexWrap|mobile/i.test(allContent); checks.trust = /No platform lock-in|Source export|Privacy and data paths documented|Backend contract|Rollback path/i.test(allContent) }
    if (story.kind === 'api') { checks.apiSource = await exists(path.join(target, 'src/index.ts')); checks.healthReady = /\/health|\/ready/.test(allContent); checks.shapedErrors = /request_error|Limit reached|title_required/i.test(allContent); checks.operability = /x-request-id|\/openapi\.json|\/metrics|withTransaction|auditHash/i.test(allContent); checks.recovery = /\/backup|\/restore|migrations|featureFlags|rollback/i.test(allContent) }
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
if (failed.length) throw new Error(`${failed.length} reddit complaint stories failed.`)
console.log(`All ${results.length} reddit complaint stories passed.`)
