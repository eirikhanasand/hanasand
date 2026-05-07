import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }
type Kind = 'website' | 'api' | 'bot' | 'worker'
type Story = { id: number; title: string; prompt: string; kind: Kind; mustMention: RegExp[] }

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'share-chat-compliance-chaos-stories')

const stories: Story[] = [
    { id: 261, title: 'Legal Governance Launch Site', kind: 'website', prompt: 'Build a legal governance launch site with governance gates audit trail security review PII handling deployment checks failure owner Docker.', mustMention: [/Governance gates/i, /Audit trail/i, /Security review/i, /PII handling/i, /Failure owner/i] },
    { id: 262, title: 'PII-Safe Support API', kind: 'api', prompt: 'Create a PII safe support API with owner scoping PII redaction audit events rate limiting pagination schemaVersion failureOwner health readiness token gate.', mustMention: [/redact/i, /auditEvents/i, /ownerId/i, /schemaVersion/i, /failureOwner/i] },
    { id: 263, title: 'Poison Job Import Worker', kind: 'worker', prompt: 'Build an import worker with idempotency guard event log retry dead-letter states poison job quarantine worker status Redis seam.', mustMention: [/poisonJobs/i, /idempotency/i, /events/i, /poison/i, /worker-status/i] },
    { id: 264, title: 'Billing Webhook Signature API', kind: 'api', prompt: 'Create billing webhook API with WEBHOOK_SIGNING_SECRET verifyWebhookSignature idempotency audit events scoped records rate limiting pagination health readiness.', mustMention: [/WEBHOOK_SIGNING_SECRET/i, /verifyWebhookSignature/i, /auditEvents/i, /idempotency/i, /rateLimit/i] },
    { id: 265, title: 'Support Escalation Runbook Site', kind: 'website', prompt: 'Build a support escalation runbook site with escalation paths SLA states customer messaging failure owner runbook audit trail Docker.', mustMention: [/Escalation paths/i, /SLA states/i, /Customer messaging/i, /Runbook/i, /Audit trail/i] },
    { id: 266, title: 'Migration Parallel Run Site', kind: 'website', prompt: 'Create migration parallel run cutover site with source export clean schema parallel run cutover plan rollback plan verification Docker.', mustMention: [/Source export/i, /Clean schema/i, /Parallel run/i, /Cutover plan/i, /Rollback plan/i] },
    { id: 267, title: 'PII Deletion Request API', kind: 'api', prompt: 'Build a deletion request API with PII redaction audit events scoped records idempotency rate limiting pagination schemaVersion failureOwner health readiness.', mustMention: [/redact/i, /auditEvents/i, /ownerId/i, /nextCursor/i, /failureOwner/i] },
    { id: 268, title: 'Moderation Evidence Bot', kind: 'bot', prompt: 'Create Discord moderation evidence bot with audit evidence restart maintenance requests safe role stubs safe env Docker no destructive actions.', mustMention: [/auditLog/i, /restartRequests/i, /maintenance/i, /stub/i, /DISCORD_TOKEN/i] },
    { id: 269, title: 'Webhook Replay Audit API', kind: 'api', prompt: 'Create webhook replay audit API with signing secret seam idempotency audit events account scoping rate limiting pagination schemaVersion failureOwner shaped errors.', mustMention: [/verifyWebhookSignature/i, /auditEvents/i, /idempotency/i, /ownerId/i, /nextCursor/i] },
    { id: 270, title: 'SLA Status Page', kind: 'website', prompt: 'Build SLA status support page with escalation paths SLA states customer messaging failure owner runbook audit trail Docker export.', mustMention: [/Escalation paths/i, /SLA states/i, /Customer messaging/i, /Failure owner/i, /Runbook/i] },
    { id: 271, title: 'Poison Report Worker', kind: 'worker', prompt: 'Build report worker with poison jobs quarantine idempotency guard event log dead retrying poison counts worker status Redis.', mustMention: [/poisonJobs/i, /idempotency/i, /dead/i, /retrying/i, /poison/i] },
    { id: 272, title: 'Tenant Isolation Audit API', kind: 'api', prompt: 'Create tenant isolation audit API with owner scoping audit events PII redaction pagination schemaVersion failureOwner token gate rate limiting health readiness.', mustMention: [/ownerId/i, /auditEvents/i, /redact/i, /schemaVersion/i, /rateLimit/i] },
    { id: 273, title: 'Deployment Cutover Runbook Site', kind: 'website', prompt: 'Build deployment cutover runbook site with source export environment map DNS SSL checks parallel run rollback plan verification failure owner Docker.', mustMention: [/Source export|Environment map/i, /DNS checklist/i, /SSL checklist/i, /Rollback plan/i, /Verification/i] },
    { id: 274, title: 'Refund Audit Trail API', kind: 'api', prompt: 'Build refund audit trail API with audit events PII redaction idempotency scoped records pagination schemaVersion failureOwner rate limiting token gate.', mustMention: [/auditEvents/i, /redact/i, /idempotency/i, /ownerId/i, /nextCursor/i] },
    { id: 275, title: 'Failed Payment Support Site', kind: 'website', prompt: 'Create failed payment support escalation site with escalation paths SLA states customer messaging runbook audit trail failure owner Docker.', mustMention: [/Escalation paths/i, /SLA states/i, /Customer messaging/i, /Runbook/i, /Failure owner/i] },
    { id: 276, title: 'Poison Notification Worker', kind: 'worker', prompt: 'Create notification worker with poison job quarantine event logs retry dead-letter states worker status poison dead retrying counts Redis.', mustMention: [/poisonJobs/i, /events/i, /dead/i, /retrying/i, /poison/i] },
    { id: 277, title: 'Security Review Dashboard Site', kind: 'website', prompt: 'Build security review dashboard with governance gates audit trail PII handling deployment checks failure owner verification Docker.', mustMention: [/Governance gates/i, /Audit trail/i, /PII handling/i, /Deployment checks/i, /Failure owner/i] },
    { id: 278, title: 'Customer Evidence API', kind: 'api', prompt: 'Create customer evidence API with audit events PII redaction scoped records idempotency rate limiting pagination schemaVersion failureOwner health readiness token gate.', mustMention: [/auditEvents/i, /redact/i, /ownerId/i, /idempotency/i, /failureOwner/i] },
    { id: 279, title: 'Cutover Checklist Site', kind: 'website', prompt: 'Build cutover checklist migration page with source export clean schema parallel run rollback plan verification DNS SSL notes Docker.', mustMention: [/Source export/i, /Clean schema/i, /Parallel run/i, /Rollback plan/i, /Verification/i] },
    { id: 280, title: 'Production Support API', kind: 'api', prompt: 'Create production support API with PII redaction audit events owner scoping pagination schemaVersion failureOwner rate limiting token gate idempotency health readiness webhook signature seam.', mustMention: [/redact/i, /auditEvents/i, /ownerId/i, /WEBHOOK_SIGNING_SECRET/i, /verifyWebhookSignature/i] },
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
        enoughFiles: files.length >= (story.kind === 'website' ? 8 : 7), packageJson: await exists(path.join(target, 'package.json')), readme: await exists(path.join(target, 'README.md')), envExample: await exists(path.join(target, '.env.example')), dockerfile: await exists(path.join(target, 'Dockerfile')), compose: await exists(path.join(target, 'docker-compose.yml')), noHardcodedSecrets: !/(sk-[a-z0-9]|xox[baprs]-|DISCORD_TOKEN\s*=\s*[^\n]*[A-Za-z0-9]{20,})/i.test(allContent), noLorem: !/lorem ipsum|placeholder text|todo: write copy/i.test(allContent), handoff: /handoff|verification|docker compose|failure owner|rollback/i.test(await read(path.join(target, 'README.md'))), mentions: story.mustMention.every((pattern) => pattern.test(allContent)),
    }
    if (story.kind === 'website') { checks.page = await exists(path.join(target, 'src/app/page.tsx')); checks.layout = await exists(path.join(target, 'src/app/layout.tsx')); checks.accessible = /aria-label|<label|Skip to content/i.test(allContent); checks.responsive = /clamp\(|auto-fit|flexWrap|mobile/i.test(allContent); checks.exportable = /output:\s*'standalone'|docker compose/i.test(allContent) }
    if (story.kind === 'api') { checks.apiSource = await exists(path.join(target, 'src/index.ts')); checks.healthReady = /\/health|\/ready/.test(allContent); checks.validation = /title_required|Forbidden|setErrorHandler/i.test(allContent); checks.rateLimit = /rateBuckets|rateLimit|429|Limit reached/i.test(allContent); checks.scoped = /ownerId|x-account-id/i.test(allContent); checks.pagination = /nextCursor|limit = Math\.min|cursor/i.test(allContent); checks.schemaOwner = /schemaVersion|failureOwner/i.test(allContent); checks.auditPrivacy = /auditEvents|redact|WEBHOOK_SIGNING_SECRET|verifyWebhookSignature/i.test(allContent) }
    if (story.kind === 'bot') { checks.botSource = await exists(path.join(target, 'src/index.ts')); checks.audit = /auditLog|audit/i.test(allContent); checks.safeStubs = /restartRequests|Restart request logged|maintenance|stub/i.test(allContent) }
    if (story.kind === 'worker') { checks.workerSource = await exists(path.join(target, 'src/worker.ts')); checks.queueSource = await exists(path.join(target, 'src/queue.ts')); checks.idempotent = /idempotency|idempotencyKey/i.test(allContent); checks.workerStatus = /worker-status|dead|failed|retrying|retry|poison/i.test(allContent); checks.eventLog = /events|event log|queue snapshot/i.test(allContent); checks.poison = /poisonJobs|poison/i.test(allContent) }
    return checks
}
function slugify(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }
await fs.rm(outRoot, { recursive: true, force: true }); await fs.mkdir(outRoot, { recursive: true })
const results = []
for (const story of stories) {
    const response = buildShareProjectResponse(story.prompt)
    if (!response) { results.push({ id: story.id, title: story.title, ok: false, reason: 'No builder response', checks: {} }); continue }
    const files = parseToolFiles(response.message); const target = await writeFiles(story, files); const checks = await verify(story, target, files); const ok = Object.values(checks).every(Boolean)
    results.push({ id: story.id, title: story.title, ok, target, fileCount: files.length, checks }); console.log(`${ok ? 'PASS' : 'FAIL'} ${story.id} ${story.title} (${files.length} files)`); if (!ok) console.log(Object.entries(checks).filter(([, value]) => !value).map(([key]) => `  - ${key}`).join('\n'))
}
const failed = results.filter((result) => !result.ok); await fs.writeFile(path.join(outRoot, 'results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)); if (failed.length) throw new Error(`${failed.length} compliance chaos stories failed.`); console.log(`All ${results.length} compliance chaos stories passed.`)
