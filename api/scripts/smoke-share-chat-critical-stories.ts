import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type ToolFile = { action: string; path: string; content: string }

type Story = {
    id: number
    title: string
    prompt: string
    kind: 'website' | 'api' | 'bot' | 'worker'
    mustMention: RegExp[]
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const outRoot = path.join(repoRoot, 'sandbox', 'share-chat-critical-stories')

const stories: Story[] = [
    { id: 201, title: 'Angry Founder Landing Page', kind: 'website', prompt: 'Build an angry founder landing page for ProofForge. The user is criticizing generic AI slop and demands pricing, proof, objections, FAQ, exportable source, accessibility, and Docker.', mustMention: [/pricing/i, /proof/i, /faq/i, /docker/i] },
    { id: 202, title: 'Local Restaurant Reservation Site', kind: 'website', prompt: 'Create a local restaurant reservation site for Fjord Table with menu allergens reservations hours private dining location guest proof and mobile-first accessibility.', mustMention: [/allergen/i, /reservation/i, /location/i, /docker/i] },
    { id: 203, title: 'Discord Moderation Bot', kind: 'bot', prompt: 'Build a Discord moderation bot for Nordic Mods with safe token env handling role command stubs status and audit history. The user is worried about leaked tokens and destructive deletes.', mustMention: [/DISCORD_TOKEN/, /audit/i, /stub/i, /docker/i] },
    { id: 204, title: 'Healthcare Intake API', kind: 'api', prompt: 'Create a healthcare intake API for Care Intake with validation health readiness token handling shaped errors and a persistence seam.', mustMention: [/health/i, /ready/i, /title_required|validation/i, /API_TOKEN/] },
    { id: 205, title: 'Ecommerce Product Page Rebuild', kind: 'website', prompt: 'Rebuild an ecommerce product page for North Bag Co because the previous AI builder had awful product formatting. Include bundles shipping notes reviews FAQ return policy and SEO metadata.', mustMention: [/shipping/i, /faq/i, /metadata/i, /docker/i] },
    { id: 206, title: 'Webhook Idempotency Ledger', kind: 'api', prompt: 'Build a webhook idempotency ledger API with idempotency keys validation health readiness audit-shaped records and safe token handling.', mustMention: [/idempotency/i, /health/i, /ready/i, /API_TOKEN/] },
    { id: 207, title: 'Invoice Export Worker', kind: 'worker', prompt: 'Create an invoice export worker queue with enqueue API worker entrypoint retries dead-letter status worker-status endpoint and Redis production seam.', mustMention: [/dead/i, /retry/i, /worker-status/i, /redis/i] },
    { id: 208, title: 'Accessibility-First Service Site', kind: 'website', prompt: 'Build an accessibility-first service site for ClearPath Cleaning with WCAG-minded keyboard flow labels contrast skip links maintenance notes and responsive layout.', mustMention: [/Skip to content/i, /aria-label/i, /keyboard/i, /docker/i] },
    { id: 209, title: 'Local SEO Contractor Site', kind: 'website', prompt: 'Create a local SEO contractor site for Harbor Electric with services location proof reviews pricing ranges quote CTA metadata and exportable Docker source.', mustMention: [/local|location/i, /metadata/i, /quote|contact/i, /docker/i] },
    { id: 210, title: 'Multi-Tenant Admin Dashboard', kind: 'website', prompt: 'Build a multi-tenant admin dashboard for AgencyScope with tenant metrics risk flags task queues empty states and future real data integration notes.', mustMention: [/metrics/i, /risks/i, /Next production tasks/i, /docker/i] },
    { id: 211, title: 'Support Knowledge Base Portal', kind: 'website', prompt: 'Create a support knowledge base portal with quickstarts categories status callouts escalation paths readable typography and exportable code.', mustMention: [/Quickstart/i, /Support|status/i, /Docker/i, /README/i] },
    { id: 212, title: 'Privacy-Sensitive Portfolio', kind: 'website', prompt: 'Build a privacy-sensitive portfolio for an artist worried about scraping and lock-in. Include case studies contact replacement guidance export and no external image dependency.', mustMention: [/No platform lock-in/i, /contact/i, /export/i, /docker/i] },
    { id: 213, title: 'Restaurant Group Operations API', kind: 'api', prompt: 'Create a restaurant group operations API to track booking requests statuses readiness and admin review with validation health ready and token handling.', mustMention: [/health/i, /ready/i, /records|intakes/i, /API_TOKEN/] },
    { id: 214, title: 'Image Review Queue', kind: 'website', prompt: 'Build an image gallery review queue for a photographer with keep reject later collections export summary counters accessible controls and no immediate deletion.', mustMention: [/Review queue/i, /Reject later/i, /Export summary/i, /Accessible controls/i] },
    { id: 215, title: 'Compliance Audit API', kind: 'api', prompt: 'Create a compliance audit API with shaped records validation idempotency health readiness token handling and consistent errors.', mustMention: [/idempotency/i, /health/i, /request_error|internal_error/i, /API_TOKEN/] },
    { id: 216, title: 'CSV Import Worker', kind: 'worker', prompt: 'Build a CSV import worker queue with enqueue route worker entrypoint retry dead-letter state status endpoint Redis compose seam and verification notes.', mustMention: [/dead/i, /retry/i, /worker-status/i, /redis/i] },
    { id: 217, title: 'Conference Site With Schedule Pressure', kind: 'website', prompt: 'Create a conference site for NorthCode Summit with schedule speakers tracks sponsors tickets venue mobile CTAs and accessibility.', mustMention: [/Schedule|Speakers|Tickets/i, /aria-label/i, /Docker/i, /mobile/i] },
    { id: 218, title: 'Auth Repair Starter', kind: 'api', prompt: 'Build an auth repair API starter that does not fake auth but gates writes behind API_TOKEN and documents where real auth belongs with health readiness.', mustMention: [/API_TOKEN/, /Forbidden/i, /health/i, /ready/i] },
    { id: 219, title: 'Observability Status Page', kind: 'website', prompt: 'Create an observability status page with uptime proof incident timeline service cards customer messaging operational handoff notes and Docker export.', mustMention: [/Proof|status|incident/i, /handoff/i, /Docker/i, /responsive/i] },
    { id: 220, title: 'Game Server Control Bot', kind: 'bot', prompt: 'Build a Discord game server control bot with status commands maintenance notices audit trail and restart request stubs that never execute destructively by default.', mustMention: [/status/i, /audit/i, /stub/i, /DISCORD_TOKEN/] },
]

function parseToolFiles(message: string) {
    return [...message.matchAll(/<hanasand-tool>([\s\S]*?)<\/hanasand-tool>/g)].map((match) => JSON.parse(match[1]) as ToolFile)
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
        handoff: /handoff|verification|docker compose/i.test(await read(path.join(target, 'README.md'))),
        mentions: story.mustMention.every((pattern) => pattern.test(allContent)),
    }
    if (story.kind === 'website') {
        checks.page = await exists(path.join(target, 'src/app/page.tsx'))
        checks.layout = await exists(path.join(target, 'src/app/layout.tsx'))
        checks.accessible = /aria-label|<label|Skip to content/i.test(allContent)
        checks.responsive = /clamp\(|auto-fit|flexWrap|mobile/i.test(allContent)
        checks.exportable = /output:\s*'standalone'|docker compose/i.test(allContent)
    }
    if (story.kind === 'api') {
        checks.apiSource = await exists(path.join(target, 'src/index.ts'))
        checks.healthReady = /\/health|\/ready/.test(allContent)
        checks.validation = /title_required|Forbidden|setErrorHandler/i.test(allContent)
    }
    if (story.kind === 'bot') {
        checks.botSource = await exists(path.join(target, 'src/index.ts'))
        checks.audit = /auditLog|audit/i.test(allContent)
        checks.safeStubs = /stub|Destructive actions require explicit review|never execute destructively/i.test(allContent)
    }
    if (story.kind === 'worker') {
        checks.workerSource = await exists(path.join(target, 'src/worker.ts'))
        checks.queueSource = await exists(path.join(target, 'src/queue.ts'))
        checks.workerStatus = /worker-status|dead|failed|retry/i.test(allContent)
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
if (failed.length) {
    throw new Error(`${failed.length} share chat critical stories failed.`)
}
console.log(`All ${results.length} critical share chat stories passed.`)
