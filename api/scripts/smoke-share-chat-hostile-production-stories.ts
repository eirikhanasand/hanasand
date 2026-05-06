import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type StoryKind = 'website' | 'api' | 'bot' | 'worker'
type Story = { id: number; title: string; prompt: string; kind: StoryKind; mustMention: RegExp[] }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'share-chat-hostile-production-stories')

const stories: Story[] = [
    { id: 221, title: 'GDPR Data Request Portal', kind: 'website', prompt: 'Build a GDPR privacy data request portal for Northstar Support. The user is furious about fake compliance pages and demands data map consent retention export delete audit trail accessible responsive Docker source.', mustMention: [/Data map/i, /Consent flow/i, /Retention rules/i, /Export request/i, /Delete request/i, /Audit trail/i] },
    { id: 222, title: 'Multi-User Notes API', kind: 'api', prompt: 'Create a multi-user notes API where the critic says AI apps leak other users notes. Include owner scoping token-gated writes validation rate limiting health readiness shaped errors Docker.', mustMention: [/ownerId/i, /x-account-id/i, /rateLimit/i, /Limit reached/i, /Forbidden/i] },
    { id: 223, title: 'Subscription Checkout Recovery Site', kind: 'website', prompt: 'Build a subscription checkout recovery site for SaaS billing with plans checkout states failed payments cancellation invoice notes security review and Docker export.', mustMention: [/Plans/i, /Checkout states/i, /Failed payments/i, /Cancellation/i, /Security review/i] },
    { id: 224, title: 'Payment Webhook API', kind: 'api', prompt: 'Build a payment webhook API for duplicate Stripe-like events with idempotency account scoping token gate rate limiting health readiness and consistent errors.', mustMention: [/idempotency/i, /ownerId/i, /rateLimit/i, /API_TOKEN/i, /429/] },
    { id: 225, title: 'Image Transcoding Worker With Proof', kind: 'worker', prompt: 'Create an image video transcoding worker queue with enqueue API worker status retry dead-letter counts event logs Redis production seam and no fake success.', mustMention: [/events/i, /dead/i, /retrying/i, /worker-status/i, /redis/i] },
    { id: 226, title: 'Server Restart Approval Bot', kind: 'bot', prompt: 'Build a Discord server restart approval bot where restart commands only create audited review requests plus maintenance notices safe token env Docker.', mustMention: [/restartRequests/i, /Restart request logged/i, /maintenance/i, /DISCORD_TOKEN/i] },
    { id: 227, title: 'Shared Family Calendar Site', kind: 'website', prompt: 'Create a shared family calendar concept site. Critic says AI builders make single-user toys. Include shared state permissions exports reminders mobile behavior handoff.', mustMention: [/Privacy and data seams documented|ownership|permissions|shared/i, /handoff/i, /mobile/i, /Docker/i] },
    { id: 228, title: 'Tenant Billing Admin API', kind: 'api', prompt: 'Build a tenant billing admin API with account scoped records rate limiting validation idempotency health readiness shaped 403 and 429 errors Docker.', mustMention: [/ownerId/i, /x-account-id/i, /rateLimit/i, /403|Forbidden/i, /429|Limit reached/i] },
    { id: 229, title: 'Incident Status Page With Subscribers', kind: 'website', prompt: 'Create an incident observability status page with service health incident timeline subscriber notice SLO evidence postmortems handoff notes accessible Docker.', mustMention: [/Service health/i, /Incident timeline/i, /Subscriber notice/i, /SLO evidence/i, /Postmortems/i] },
    { id: 230, title: 'Refund Dispute API', kind: 'api', prompt: 'Create a refund dispute API with auditability scoped records validation idempotency token gating rate limiting health readiness and consistent errors.', mustMention: [/ownerId/i, /idempotency/i, /rateLimit/i, /request_error/i, /API_TOKEN/i] },
    { id: 231, title: 'CSV Import Reconciliation Worker', kind: 'worker', prompt: 'Build a CSV import reconciliation worker that does not drop rows silently. Include enqueue route worker status retry dead-letter counts event logs Redis compose verification.', mustMention: [/events/i, /dead/i, /retrying/i, /worker-status/i, /Redis/i] },
    { id: 232, title: 'Restaurant Allergy Safety Site', kind: 'website', prompt: 'Create a restaurant allergy safety mobile menu site with allergens dietary booking reservations hours private dining guest proof location update handoff Docker.', mustMention: [/allergen/i, /Reservations/i, /Opening hours/i, /Location/i, /Docker/i] },
    { id: 233, title: 'Clinic Consent Intake API', kind: 'api', prompt: 'Build a clinic consent intake API with consent records scoped ownership token-gated writes rate limiting validation health readiness shaped errors.', mustMention: [/ownerId/i, /rateLimit/i, /title_required/i, /health/i, /ready/i] },
    { id: 234, title: 'SEO Migration Landing Page', kind: 'website', prompt: 'Build an SEO migration landing page for a marketer angry about destroyed search traffic. Include metadata proof pricing FAQ redirects checklist lead capture accessible Docker.', mustMention: [/metadata/i, /Proof/i, /Pricing/i, /FAQ/i, /lead capture/i] },
    { id: 235, title: 'Moderated Community Bot', kind: 'bot', prompt: 'Create a Discord moderated community bot with status role stubs restart request flow maintenance notices audit log safe token configuration Docker.', mustMention: [/restartRequests/i, /maintenance/i, /auditLog/i, /stub/i, /DISCORD_TOKEN/] },
    { id: 236, title: 'Data Retention Dashboard', kind: 'website', prompt: 'Build a data retention dashboard for privacy officer with retention rules export delete requests consent status audit trail ownership boundaries accessible responsive Docker.', mustMention: [/Retention rules/i, /Export request/i, /Delete request/i, /Audit trail/i, /Privacy and data seams documented/i] },
    { id: 237, title: 'Rate-Limited Public API', kind: 'api', prompt: 'Create a rate limited public API that implements rate limits with shaped 429 responses health readiness scoped records token gate Docker handoff.', mustMention: [/rateLimit/i, /Limit reached/i, /429/i, /ownerId/i, /ready/i] },
    { id: 238, title: 'Deployment Handoff Site', kind: 'website', prompt: 'Build a deployment handoff launch site for a founder burned by lock-in. Include export self-hosting env variables DNS SSL checklist rollback notes verification Docker.', mustMention: [/No platform lock-in/i, /Docker Compose/i, /Verification/i, /handoff/i, /env/i] },
    { id: 239, title: 'Long-Running Report Worker', kind: 'worker', prompt: 'Create a long-running report worker with queued running failed dead status visible event logs enqueue API worker status retry dead-letter and Redis compose.', mustMention: [/events/i, /dead/i, /retrying/i, /worker-status/i, /Redis/i] },
    { id: 240, title: 'Customer Portal API', kind: 'api', prompt: 'Build a customer portal API with account scoped records token gated writes validation idempotency rate limiting health readiness shaped errors production handoff.', mustMention: [/ownerId/i, /idempotency/i, /rateLimit/i, /API_TOKEN/i, /durable audit logs/i] },
]

function parseToolFiles(message: string) {
    return [...message.matchAll(/<hanasand-tool>([\s\S]*?)<\/hanasand-tool>/g)].map((match) => JSON.parse(match[1]) as ToolFile)
}

async function exists(filePath: string) {
    try {
        await fs.access(filePath)
        return true
    } catch {
        return false
    }
}

async function read(filePath: string) {
    return await fs.readFile(filePath, 'utf8').catch(() => '')
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
        handoff: /handoff|verification|docker compose|durable audit logs/i.test(await read(path.join(target, 'README.md'))),
        mentions: story.mustMention.every((pattern) => pattern.test(allContent)),
    }
    if (story.kind === 'website') {
        checks.page = await exists(path.join(target, 'src/app/page.tsx'))
        checks.layout = await exists(path.join(target, 'src/app/layout.tsx'))
        checks.accessible = /aria-label|<label|Skip to content/i.test(allContent)
        checks.responsive = /clamp\(|auto-fit|flexWrap|mobile/i.test(allContent)
        checks.exportable = /output:\s*'standalone'|docker compose/i.test(allContent)
        checks.productionTasks = /Verify forms, limits, and ownership rules|privacy|handoff/i.test(allContent)
    }
    if (story.kind === 'api') {
        checks.apiSource = await exists(path.join(target, 'src/index.ts'))
        checks.healthReady = /\/health|\/ready/.test(allContent)
        checks.validation = /title_required|Forbidden|setErrorHandler/i.test(allContent)
        checks.rateLimit = /rateBuckets|rateLimit|429|Limit reached/i.test(allContent)
        checks.scoped = /ownerId|x-account-id/i.test(allContent)
    }
    if (story.kind === 'bot') {
        checks.botSource = await exists(path.join(target, 'src/index.ts'))
        checks.audit = /auditLog|audit/i.test(allContent)
        checks.safeStubs = /restartRequests|Restart request logged|Destructive actions require explicit review|stub/i.test(allContent)
    }
    if (story.kind === 'worker') {
        checks.workerSource = await exists(path.join(target, 'src/worker.ts'))
        checks.queueSource = await exists(path.join(target, 'src/queue.ts'))
        checks.workerStatus = /worker-status|dead|failed|retrying|retry/i.test(allContent)
        checks.eventLog = /events|event log|queue snapshot/i.test(allContent)
    }
    return checks
}

function slugify(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

await fs.rm(outRoot, { recursive: true, force: true })
await fs.mkdir(outRoot, { recursive: true })

const results = []
for (const story of stories) {
    const response = buildShareProjectResponse(story.prompt)
    if (!response) {
        results.push({ id: story.id, title: story.title, ok: false, reason: 'No builder response', checks: {} })
        continue
    }
    const files = parseToolFiles(response.message)
    const target = await writeFiles(story, files)
    const checks = await verify(story, target, files)
    const ok = Object.values(checks).every(Boolean)
    results.push({ id: story.id, title: story.title, ok, target, fileCount: files.length, checks })
    console.log(`${ok ? 'PASS' : 'FAIL'} ${story.id} ${story.title} (${files.length} files)`)
    if (!ok) {
        console.log(Object.entries(checks).filter(([, value]) => !value).map(([key]) => `  - ${key}`).join('\n'))
    }
}

const failed = results.filter((result) => !result.ok)
await fs.writeFile(path.join(outRoot, 'results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2))
if (failed.length) throw new Error(`${failed.length} hostile production stories failed.`)
console.log(`All ${results.length} hostile production stories passed.`)
