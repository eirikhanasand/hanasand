import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type StoryKind = 'website' | 'api' | 'bot' | 'worker'
type Story = { id: number; title: string; prompt: string; kind: StoryKind; mustMention: RegExp[] }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'share-chat-adversarial-systems-stories')

const stories: Story[] = [
    { id: 241, title: 'Second-Device Auth Contract Site', kind: 'website', prompt: 'Build a second device auth session contract site with backend contract session states permission matrix revoked access failure owner and second-device tests Docker.', mustMention: [/Backend contract/i, /Session states/i, /Permission matrix/i, /Second device test/i, /Failure owner/i] },
    { id: 242, title: 'Paginated Customer Records API', kind: 'api', prompt: 'Create a paginated customer records API with owner scoping pagination schema version failure owner rate limiting token gate health readiness shaped errors Docker.', mustMention: [/ownerId/i, /nextCursor/i, /schemaVersion/i, /failureOwner/i, /rateLimit/i] },
    { id: 243, title: 'Duplicate Workflow Guard Worker', kind: 'worker', prompt: 'Create a duplicate workflow guard worker queue with idempotency guard event log retry dead-letter visible worker status Redis Docker.', mustMention: [/idempotency/i, /events/i, /dead/i, /retrying/i, /worker-status/i] },
    { id: 244, title: 'Restart Request Discord Bot', kind: 'bot', prompt: 'Build a Discord restart request bot that converts restart commands into audited requests maintenance notices and never restarts automatically.', mustMention: [/restartRequests/i, /Restart request logged/i, /maintenance/i, /auditLog/i] },
    { id: 245, title: 'DNS SSL Rollback Handoff Site', kind: 'website', prompt: 'Build a DNS SSL rollback deployment handoff site with environment map DNS checklist SSL checklist rollback plan verification Docker Compose.', mustMention: [/Environment map/i, /DNS checklist/i, /SSL checklist/i, /Rollback plan/i, /Verification/i] },
    { id: 246, title: 'Payment Failure Recovery Page', kind: 'website', prompt: 'Build a payment subscription checkout recovery page with plans checkout states failed payments cancellation invoice notes security review backend contract.', mustMention: [/Plans/i, /Checkout states/i, /Failed payments/i, /Cancellation/i, /Security review/i] },
    { id: 247, title: 'Account-Scoped Refund API', kind: 'api', prompt: 'Create an account scoped refund API with idempotency pagination schemaVersion failureOwner token gate rateLimit health ready shaped errors.', mustMention: [/ownerId/i, /idempotency/i, /nextCursor/i, /schemaVersion/i, /failureOwner/i] },
    { id: 248, title: 'Workflow Side-Effects Review Site', kind: 'website', prompt: 'Create a workflow side effects review site with trigger inventory duplicate guard state transitions side effects failure owner rollback path.', mustMention: [/Trigger inventory/i, /Duplicate guard/i, /State transitions/i, /Side effects/i, /Rollback path/i] },
    { id: 249, title: 'Long Report Idempotent Worker', kind: 'worker', prompt: 'Build a long report idempotent worker with idempotencyKey duplicate guard event logs retry dead-letter worker status Redis.', mustMention: [/idempotency/i, /idempotencyKey/i, /events/i, /dead/i, /worker-status/i] },
    { id: 250, title: 'Revoked Access API', kind: 'api', prompt: 'Create a revoked access API starter with token gate owner scoping shaped 403 429 errors schemaVersion failureOwner pagination health readiness.', mustMention: [/Forbidden/i, /Limit reached/i, /ownerId/i, /schemaVersion/i, /failureOwner/i] },
    { id: 251, title: 'Mobile Refresh Data Contract Site', kind: 'website', prompt: 'Build a mobile refresh data contract page explaining backend contract state ownership autosave boundary second-device behavior rollback and failure owner.', mustMention: [/Backend contract/i, /Second device test|second-device/i, /Rollback path|Rollback plan/i, /Failure owner/i, /Backend contract before fake integrations/i] },
    { id: 252, title: 'Moderation Request Bot', kind: 'bot', prompt: 'Create a Discord moderation request bot with audit restart maintenance requests role stubs safe env Docker and no automatic destructive moderation.', mustMention: [/auditLog/i, /restartRequests/i, /maintenance/i, /stub/i, /DISCORD_TOKEN/i] },
    { id: 253, title: 'Database Query Limits API', kind: 'api', prompt: 'Build a database query limits API with clamped query limits cursor pagination scoped records rate limiting schemaVersion failureOwner health readiness.', mustMention: [/Math.min/i, /nextCursor/i, /ownerId/i, /rateLimit/i, /schemaVersion/i] },
    { id: 254, title: 'Performance Budget Site', kind: 'website', prompt: 'Create a performance budget site with query limits pagination cache notes load test plan performance budget failure owner verification Docker.', mustMention: [/Performance budget/i, /Query limits/i, /Pagination/i, /Load test plan/i, /Failure owner/i] },
    { id: 255, title: 'Webhook Replay Protection API', kind: 'api', prompt: 'Create a webhook replay protection API with idempotency replay safe account scoping pagination rate limiting schemaVersion failureOwner health ready.', mustMention: [/idempotency/i, /ownerId/i, /nextCursor/i, /rateLimit/i, /failureOwner/i] },
    { id: 256, title: 'Scheduled Job Worker', kind: 'worker', prompt: 'Build a scheduled job worker with idempotency guard visible events retry dead-letter states worker status no duplicate side effects Redis.', mustMention: [/idempotency/i, /events/i, /dead/i, /retrying/i, /worker-status/i] },
    { id: 257, title: 'Data Export Delete API', kind: 'api', prompt: 'Create a data export delete API with scoped records idempotency rate limiting schemaVersion failureOwner token gate health readiness shaped errors.', mustMention: [/ownerId/i, /idempotency/i, /rateLimit/i, /schemaVersion/i, /failureOwner/i] },
    { id: 258, title: 'SaaS Admin Real Backend Boundary Site', kind: 'website', prompt: 'Create a SaaS admin real backend boundary site with backend contract permission matrix state ownership second-device test failure owner rollback path.', mustMention: [/Backend contract/i, /Permission matrix/i, /Second device test/i, /Failure owner/i, /Rollback path/i] },
    { id: 259, title: 'Audit-Trail Worker', kind: 'worker', prompt: 'Build an audit trail background worker with idempotency event trail retry dead-letter states dead retrying counts worker status failure owner notes.', mustMention: [/idempotency/i, /events/i, /dead/i, /retrying/i, /worker-status/i] },
    { id: 260, title: 'Production Readiness API', kind: 'api', prompt: 'Create a production readiness API with owner scoping pagination schemaVersion failureOwner rate limiting token gate idempotency health readiness shaped errors.', mustMention: [/ownerId/i, /nextCursor/i, /schemaVersion/i, /failureOwner/i, /rateLimit/i] },
]

function parseToolFiles(message: string) {
    return [...message.matchAll(/<hanasand-tool>([\s\S]*?)<\/hanasand-tool>/g)].map((match) => JSON.parse(match[1]) as ToolFile)
}

async function exists(filePath: string) {
    try { await fs.access(filePath); return true } catch { return false }
}
async function read(filePath: string) { return await fs.readFile(filePath, 'utf8').catch(() => '') }
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

async function verify(story: Story, target: string, files: ToolFile[]) {
    const allContent = files.map((file) => `${file.path}\n${file.content}`).join('\n---\n')
    const checks: Record<string, boolean> = {
        enoughFiles: files.length >= (story.kind === 'website' ? 8 : 7),
        packageJson: await exists(path.join(target, 'package.json')),
        readme: await exists(path.join(target, 'README.md')),
        envExample: await exists(path.join(target, '.env.example')),
        dockerfile: await exists(path.join(target, 'Dockerfile')),
        compose: await exists(path.join(target, 'docker-compose.yml')),
        noHardcodedSecrets: !/(sk-[a-z0-9]|xox[baprs]-|DISCORD_TOKEN\s*=\s*[^\n]*[A-Za-z0-9]{20,})/i.test(allContent),
        noLorem: !/lorem ipsum|placeholder text|todo: write copy/i.test(allContent),
        handoff: /handoff|verification|docker compose|failure owner|rollback/i.test(await read(path.join(target, 'README.md'))),
        mentions: story.mustMention.every((pattern) => pattern.test(allContent)),
    }
    if (story.kind === 'website') {
        checks.page = await exists(path.join(target, 'src/app/page.tsx'))
        checks.layout = await exists(path.join(target, 'src/app/layout.tsx'))
        checks.accessible = /aria-label|<label|Skip to content/i.test(allContent)
        checks.responsive = /clamp\(|auto-fit|flexWrap|mobile/i.test(allContent)
        checks.boundary = /Backend contract before fake integrations|Failure owner|Rollback/i.test(allContent)
        checks.exportable = /output:\s*'standalone'|docker compose/i.test(allContent)
    }
    if (story.kind === 'api') {
        checks.apiSource = await exists(path.join(target, 'src/index.ts'))
        checks.healthReady = /\/health|\/ready/.test(allContent)
        checks.validation = /title_required|Forbidden|setErrorHandler/i.test(allContent)
        checks.rateLimit = /rateBuckets|rateLimit|429|Limit reached/i.test(allContent)
        checks.scoped = /ownerId|x-account-id/i.test(allContent)
        checks.pagination = /nextCursor|limit = Math\.min|cursor/i.test(allContent)
        checks.schemaOwner = /schemaVersion|failureOwner/i.test(allContent)
    }
    if (story.kind === 'bot') {
        checks.botSource = await exists(path.join(target, 'src/index.ts'))
        checks.audit = /auditLog|audit/i.test(allContent)
        checks.safeStubs = /restartRequests|Restart request logged|maintenance|stub/i.test(allContent)
    }
    if (story.kind === 'worker') {
        checks.workerSource = await exists(path.join(target, 'src/worker.ts'))
        checks.queueSource = await exists(path.join(target, 'src/queue.ts'))
        checks.idempotent = /idempotency|idempotencyKey/i.test(allContent)
        checks.workerStatus = /worker-status|dead|failed|retrying|retry/i.test(allContent)
        checks.eventLog = /events|event log|queue snapshot/i.test(allContent)
    }
    return checks
}

function slugify(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }

await fs.rm(outRoot, { recursive: true, force: true })
await fs.mkdir(outRoot, { recursive: true })
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
if (failed.length) throw new Error(`${failed.length} adversarial systems stories failed.`)
console.log(`All ${results.length} adversarial systems stories passed.`)
