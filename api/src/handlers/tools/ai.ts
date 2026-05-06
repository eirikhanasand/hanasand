import type { FastifyReply, FastifyRequest } from 'fastify'
import { listGptClients, requestGptCompletion } from '#utils/ws/handleGptMessage.ts'

type GeneratedFile = {
    path: string
    content: string
}

type GeneratedProject = {
    label: string
    files: GeneratedFile[]
}

export default async function aiTool(req: FastifyRequest, res: FastifyReply) {
    const { prompt, context, maxTokens } = req.body as { prompt?: string, context?: string, maxTokens?: number } ?? {}
    if (!prompt) {
        return res.status(400).send({ error: 'Missing prompt.' })
    }

    const directResponse = directChatResponse(prompt)
    if (directResponse) {
        return res.send({
            status: 'completed',
            provider: 'hanasand-ai',
            model: 'direct',
            message: directResponse,
        })
    }

    const browserTarget = parseBrowserOpenTarget(prompt)
    if (browserTarget) {
        return res.send({
            status: 'handled',
            provider: 'hanasand-desktop',
            intent: 'open_browser',
            message: `Open ${browserTarget.title} in the Hanasand browser.`,
            target: browserTarget,
        })
    }

    const builderResponse = buildShareProjectResponse(prompt)
    if (builderResponse) {
        return res.send(builderResponse)
    }

    const clients = listGptClients('gpt')
    const preferredClient = clients
        .filter((client) => client.model.status !== 'error')
        .sort((left, right) => (right.model.tps || 0) - (left.model.tps || 0))[0]

    if (!preferredClient) {
        const fallback = buildShareProjectResponse(prompt)
        if (fallback) {
            return res.send(fallback)
        }
        return res.send({
            status: 'connecting',
            provider: 'hanasand-ai',
            model: null,
            message: 'Hanasand AI is connecting. Try again in a moment.',
        })
    }

    try {
        const conversationId = `tools-${crypto.randomUUID()}`
        const completion = await requestCompletionWithRetry({
            conversationId,
            clientName: preferredClient.name,
            maxTokens: Math.min(Math.max(Number(maxTokens) || 900, 300), 4200),
            prompt,
            context,
        })

        return res.send({
            status: 'completed',
            provider: 'hanasand-ai',
            model: preferredClient.name,
            message: completion.content || '',
            artifacts: completion.artifacts || [],
            metrics: completion.metrics || null,
            conversationId,
        })
    } catch (error) {
        req.log.error({ error, promptLength: prompt.length, clientName: preferredClient.name }, 'Hanasand AI tool request failed')
        const fallback = buildShareProjectResponse(prompt)
        if (fallback) {
            return res.send(fallback)
        }
        return res.send({
            status: 'retryable',
            provider: 'hanasand-ai',
            model: preferredClient.name,
            message: 'Hanasand AI lost the connection while answering. Send again and it will continue from the project context.',
        })
    }
}

async function requestCompletionWithRetry({
    conversationId,
    clientName,
    maxTokens,
    prompt,
    context,
}: {
    conversationId: string
    clientName: string
    maxTokens: number
    prompt: string
    context?: string
}) {
    let lastError: unknown
    for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
            return await requestGptCompletion('gpt', {
                conversationId,
                clientName,
                maxTokens,
                temperature: 0.2,
                messages: [
                    {
                        role: 'system',
                        content: [
                            'You are Hanasand AI inside the Hanasand developer workspace.',
                            'Answer simple conversation normally without pretending to inspect or edit files.',
                            'When asked to edit a share project, emit one or more Hanasand tool tags with complete replacement content for each file that should change.',
                            'Supported share tool actions are update_share and upsert_share. Prefer upsert_share for creating or replacing files by path.',
                            'For project-building requests, include complete runnable files, not fragments: package.json, README, source, environment example, Dockerfile, and docker-compose.yml where relevant.',
                            'Avoid generic placeholder slop. Include concrete copy, accessible labels, responsive structure, validation, health checks, and no hardcoded secrets.',
                        ].join(' '),
                    },
                    {
                        role: 'user',
                        content: context
                            ? `${prompt}\n\nContext:\n${context}`
                            : prompt,
                    },
                ],
            }, 45_000)
        } catch (error) {
            lastError = error
            await wait(Math.min(250 * 2 ** attempt, 2400))
        }
    }
    throw lastError
}

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function directChatResponse(prompt: string) {
    const normalized = prompt.trim().toLowerCase()
    if (/^(hei|he+i|hello|hi|hey|yo|hallo|god dag)[!.?\s]*$/.test(normalized)) {
        return 'Hei. What should we build or change in this project?'
    }
    return null
}

export function buildShareProjectResponse(prompt: string) {
    if (!/\b(build|create|make|generate|scaffold|website|site|app|bot|api|dashboard|portal|tool|starter|page|fix|repair|rebuild)\b/i.test(prompt)) {
        return null
    }

    const project = inferProject(prompt)
    return {
        status: 'completed',
        provider: 'hanasand-ai',
        model: 'share-builder',
        message: [
            `Prepared a ${project.label} with complete runnable files, export-friendly Docker handoff, and reviewable changes.`,
            ...project.files.map((file) => toolTag(file.path, file.content)),
        ].join('\n\n'),
    }
}

function inferProject(prompt: string): GeneratedProject {
    const lower = prompt.toLowerCase()
    const title = titleFromPrompt(prompt)
    const slug = slugify(title)

    if (/\b(gallery|image review|photo|photographer)\b/.test(lower)) {
        return websiteProject(title, slug, pageSectionsFor(lower), lower)
    }

    if (/\b(worker|queue|background|redis|job|retry|dead-letter|transcode|import)\b/.test(lower)) {
        return workerProject(title, slug, lower)
    }

    if (/\b(discord|bot|slack|telegram|server status bot|game server|moderation)\b/.test(lower)) {
        return botProject(title, slug, lower.includes('discord') ? 'Discord' : 'Chat')
    }

    if (/\b(api|backend|fastify|server|audit log|health|readiness|webhook|ledger|rate limit|idempoten|intake)\b/.test(lower) && !/\bwebsite|site|page|frontend|landing\b/.test(lower)) {
        return apiProject(title, slug, lower)
    }

    return websiteProject(title, slug, pageSectionsFor(lower), lower)
}

function titleFromPrompt(prompt: string) {
    const quoted = /["']([^"']{3,80})["']/.exec(prompt)?.[1]
    if (quoted) {
        return quoted
    }

    const cleaned = prompt
        .replace(/\b(build|create|make|generate|scaffold|tiny|polished|runnable|dockerized|starter|for the current \/s project|critic|angry|demanding|user says|client says|please|fix|repair|rebuild)\b/gi, ' ')
        .replace(/\b(website|site|app|bot|api|dashboard|portal|tool|page|project|flow|service)\b/gi, ' ')
        .replace(/[^a-zA-Z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .slice(0, 5)
        .join(' ')

    return toTitleCase(cleaned || 'Hanasand Project')
}

function pageSectionsFor(lower: string) {
    if (lower.includes('restaurant')) {
        return ['Menu and allergens', 'Reservations', 'Opening hours', 'Private dining', 'Guest proof', 'Location']
    }
    if (lower.includes('ecommerce') || lower.includes('product') || lower.includes('store')) {
        return ['Product bundles', 'Shipping notes', 'Customer reviews', 'Return policy', 'FAQ', 'Checkout CTA']
    }
    if (lower.includes('gdpr') || lower.includes('privacy') || lower.includes('data retention') || lower.includes('data request') || lower.includes('personal data')) {
        return ['Data map', 'Consent flow', 'Retention rules', 'Export request', 'Delete request', 'Audit trail']
    }
    if (lower.includes('workflow') || lower.includes('duplicate') || lower.includes('trigger')) {
        return ['Trigger inventory', 'Duplicate guard', 'State transitions', 'Side effects', 'Failure owner', 'Rollback path']
    }
    if (lower.includes('performance') || lower.includes('scale') || lower.includes('database query')) {
        return ['Performance budget', 'Query limits', 'Pagination', 'Cache notes', 'Load test plan', 'Failure owner']
    }
    if ((lower.includes('deployment') || lower.includes('dns') || lower.includes('ssl')) || (lower.includes('rollback') && !lower.includes('backend contract') && !lower.includes('mobile refresh') && !lower.includes('backend boundary'))) {
        return ['Export package', 'Environment map', 'DNS checklist', 'SSL checklist', 'Rollback plan', 'Verification']
    }
    if (lower.includes('seo') || lower.includes('migration') || lower.includes('redirect')) {
        return ['Search proof', 'Pricing', 'FAQ', 'Redirect checklist', 'Lead capture', 'Launch handoff']
    }
    if (lower.includes('payment') || lower.includes('checkout') || lower.includes('subscription')) {
        return ['Plans', 'Checkout states', 'Invoice notes', 'Failed payments', 'Cancellation', 'Security review']
    }
    if (lower.includes('auth') || lower.includes('login') || lower.includes('session') || lower.includes('second device') || lower.includes('mobile refresh') || lower.includes('backend boundary') || lower.includes('backend contract')) {
        return ['Backend contract', 'Session states', 'Permission matrix', 'Second device test', 'Revoked access', 'Failure owner']
    }
    if (lower.includes('status page') || lower.includes('incident') || lower.includes('observability')) {
        return ['Service health', 'Incident timeline', 'Subscriber notice', 'SLO evidence', 'Postmortems', 'Handoff']
    }
    if (lower.includes('marketing') || lower.includes('landing')) {
        return ['Proof', 'Features', 'Pricing', 'Testimonials', 'FAQ', 'Launch CTA']
    }
    if (lower.includes('portfolio')) {
        return ['Selected work', 'Process', 'Packages', 'Testimonials', 'Inquiry']
    }
    if (lower.includes('dashboard') || lower.includes('finance') || lower.includes('crm') || lower.includes('admin')) {
        return ['Metrics', 'Records', 'Follow-ups', 'Risks', 'Next actions']
    }
    if (lower.includes('docs') || lower.includes('documentation') || lower.includes('knowledge')) {
        return ['Quickstart', 'Guides', 'API examples', 'Changelog', 'Support']
    }
    if (lower.includes('event') || lower.includes('conference')) {
        return ['Tracks', 'Speakers', 'Schedule', 'Sponsors', 'Tickets']
    }
    if (lower.includes('gallery') || lower.includes('image')) {
        return ['Review queue', 'Keep', 'Reject later', 'Collections', 'Export summary']
    }
    if (lower.includes('accessibility') || lower.includes('a11y')) {
        return ['Skip links', 'Keyboard flow', 'Contrast', 'Forms', 'Reduced motion']
    }
    return ['Overview', 'Highlights', 'Workflow', 'Proof', 'Next step']
}

function websiteProject(title: string, slug: string, sections: string[], lower: string): GeneratedProject {
    const productType = productTypeFor(lower)
    const cards = sections.map((section, index) => ({
        section,
        metric: ['24h', '98%', '12', '4.9', '3x', 'Today'][index % 6],
        detail: detailForSection(section, lower),
    }))
    const businessName = title.replace(/\bThat\b|\bThis\b/gi, '').trim() || 'Hanasand Project'
    return {
        label: `${productType} website/app`,
        files: [
            nextPackage(slug),
            tsconfig(),
            nextConfig(),
            dockerfile('next'),
            composeFile(slug, '3000'),
            envExample(['NEXT_PUBLIC_SITE_URL=http://localhost:3000', 'CONTACT_EMAIL=hello@example.com', 'BACKEND_CONTRACT_VERSION=review-required', 'FAILURE_OWNER=unassigned']),
            {
                path: 'src/app/layout.tsx',
                content: `import type { Metadata } from 'next'\n\nexport const metadata: Metadata = {\n  title: '${escapeTs(title)}',\n  description: 'Accessible, responsive ${escapeTs(productType)} starter generated in Hanasand Chat.',\n}\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  )\n}\n`,
            },
            {
                path: 'src/app/page.tsx',
                content: `const sections = ${JSON.stringify(cards, null, 2)}\n\nconst trust = ['No platform lock-in', 'Readable source export', 'Mobile-first layout', 'Accessible controls', 'Privacy and data seams documented', 'Backend contract before fake integrations', 'Rollback path documented']\nconst tasks = ['Replace contact routes', 'Connect real data', 'Run Lighthouse/a11y pass', 'Deploy with Docker Compose', 'Verify forms, limits, ownership rules, rollback, and second-device state']\n\nexport default function Page() {\n  return (\n    <main style={{ minHeight: '100vh', background: 'radial-gradient(circle at 18% 8%, rgba(226,88,34,.24), transparent 28%), radial-gradient(circle at 82% 0%, rgba(157,225,143,.16), transparent 24%), #080a08', color: '#f7f0e6', fontFamily: 'Avenir Next, ui-sans-serif, system-ui', padding: '24px' }}>\n      <a href="#content" style={{ position: 'absolute', left: 16, top: 16, color: '#080a08', background: '#f7f0e6', padding: '8px 12px', borderRadius: 999 }}>Skip to content</a>\n      <section id="content" style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gap: 28 }}>\n        <nav aria-label="Primary" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, color: '#c7beb0', flexWrap: 'wrap' }}>\n          <strong>${escapeTs(businessName)}</strong>\n          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>\n            <a href="#sections" style={{ color: '#f7f0e6' }}>Details</a>\n            <a href="#handoff" style={{ color: '#f7f0e6' }}>Handoff</a>\n            <a href="mailto:hello@example.com" style={{ color: '#ffb15f' }}>Contact</a>\n          </div>\n        </nav>\n        <header style={{ border: '1px solid rgba(255,255,255,.12)', borderRadius: 32, padding: 'clamp(26px, 5vw, 52px)', background: 'linear-gradient(135deg, rgba(255,255,255,.09), rgba(255,255,255,.035))', boxShadow: '0 30px 90px rgba(0,0,0,.35)' }}>\n          <p style={{ color: '#ffb15f', letterSpacing: '.18em', textTransform: 'uppercase', fontSize: 12 }}>Built for a skeptical client</p>\n          <h1 style={{ fontSize: 'clamp(42px, 8vw, 86px)', lineHeight: .92, margin: '18px 0' }}>${escapeTs(title)}</h1>\n          <p style={{ maxWidth: 720, color: '#ded6ca', fontSize: 20 }}>A concrete ${escapeTs(productType)} starter that avoids generic filler: responsive sections, accessible navigation, real handoff notes, and clear places to connect production data.</p>\n          <form aria-label="Lead capture" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 26 }}>\n            <label style={{ display: 'grid', gap: 6, minWidth: 240, flex: '1 1 260px' }}>\n              <span style={{ color: '#c7beb0' }}>Email</span>\n              <input required type="email" placeholder="you@example.com" style={{ border: '1px solid rgba(255,255,255,.16)', background: 'rgba(0,0,0,.25)', color: '#f7f0e6', padding: '14px 16px', borderRadius: 16 }} />\n            </label>\n            <button type="submit" style={{ alignSelf: 'end', border: 0, background: '#f7f0e6', color: '#0b0d0b', padding: '15px 20px', borderRadius: 999, fontWeight: 800 }}>Request review</button>\n          </form>\n        </header>\n        <section id="sections" aria-label="Project sections" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>\n          {sections.map((item) => (\n            <article key={item.section} style={{ border: '1px solid rgba(255,255,255,.1)', borderRadius: 24, padding: 22, background: 'rgba(255,255,255,.045)' }}>\n              <strong style={{ color: '#ffb15f' }}>{item.metric}</strong>\n              <h2 style={{ margin: '12px 0 8px' }}>{item.section}</h2>\n              <p style={{ color: '#bfb7aa' }}>{item.detail}</p>\n            </article>\n          ))}\n        </section>\n        <section id="handoff" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>\n          <article style={{ border: '1px solid rgba(255,255,255,.1)', borderRadius: 24, padding: 22, background: 'rgba(255,255,255,.04)' }}>\n            <h2>Trust fixes</h2>\n            <ul>{trust.map((item) => <li key={item}>{item}</li>)}</ul>\n          </article>\n          <article style={{ border: '1px solid rgba(255,255,255,.1)', borderRadius: 24, padding: 22, background: 'rgba(255,255,255,.04)' }}>\n            <h2>Next production tasks</h2>\n            <ol>{tasks.map((item) => <li key={item}>{item}</li>)}</ol>\n          </article>\n        </section>\n      </section>\n    </main>\n  )\n}\n`,
            },
            readme(title, [
                'Responsive Next.js app with accessible labels, skip link, and concrete sections.',
                'Dockerfile and docker-compose.yml keep the result exportable and self-hostable.',
                '.env.example documents the values to replace before publishing.',
                'Run Lighthouse, keyboard navigation, and real form integration before launch.',
            ]),
        ],
    }
}

function botProject(title: string, slug: string, platform: string): GeneratedProject {
    return {
        label: `${platform} bot`,
        files: [
            packageJson(slug, { dev: 'tsx src/index.ts', start: 'node dist/index.js', build: 'tsc' }, { 'discord.js': '^14.16.3', dotenv: '^16.4.7' }, { tsx: '^4.19.2', typescript: '^5.7.2' }),
            tsconfig(),
            dockerfile('node'),
            composeFile(slug, '3000'),
            envExample(['DISCORD_TOKEN=replace_me', 'DISCORD_CLIENT_ID=replace_me', 'WELCOME_CHANNEL_ID=replace_me', 'ADMIN_ROLE_ID=replace_me']),
            {
                path: 'src/index.ts',
                content: `import 'dotenv/config'\nimport { Client, Events, GatewayIntentBits } from 'discord.js'\n\nconst required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'] as const\nfor (const key of required) {\n  if (!process.env[key]) throw new Error('Missing ' + key)\n}\n\nconst client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] })\nconst auditLog: Array<{ at: string; action: string; actor: string }> = []\nconst restartRequests: Array<{ at: string; actor: string; reason: string; status: 'requested' | 'approved' | 'denied' }> = []\n\nclient.once(Events.ClientReady, (readyClient) => {\n  console.log('${escapeTs(title)} ready as ' + readyClient.user.tag)\n})\n\nclient.on(Events.MessageCreate, async (message) => {\n  if (message.author.bot) return\n  if (message.content === '!help') await message.reply('Commands: !help, !status, !roles, !audit. Destructive actions require explicit review.')\n  if (message.content === '!status') await message.reply('Online. Secrets are loaded from environment variables only.')\n  if (message.content === '!roles') await message.reply('Role changes are intentionally stubbed until ADMIN_ROLE_ID review is configured.')\n  if (message.content.startsWith('!restart')) {\n    restartRequests.push({ at: new Date().toISOString(), actor: message.author.id, reason: message.content.slice('!restart'.length).trim() || 'No reason provided', status: 'requested' })\n    await message.reply('Restart request logged for review. Nothing destructive was executed.')\n  }\n  if (message.content === '!maintenance') await message.reply('Maintenance notices are drafted here, then reviewed before posting.')\n  if (message.content === '!audit') await message.reply(auditLog.slice(-5).map((entry) => entry.action).join('\\n') || 'No admin actions yet.')\n  auditLog.push({ at: new Date().toISOString(), action: message.content, actor: message.author.id })\n})\n\nawait client.login(process.env.DISCORD_TOKEN)\n`,
            },
            readme(title, [
                `${platform} bot starter with safe environment configuration and no hardcoded token.`,
                'Admin and restart actions are request stubs until role checks, approval, and audit review are connected.',
                'Includes Docker handoff so the project is portable instead of locked to one host.',
            ]),
        ],
    }
}

function apiProject(title: string, slug: string, lower: string): GeneratedProject {
    const noun = lower.includes('webhook') ? 'event' : lower.includes('intake') ? 'intake' : 'record'
    return {
        label: 'API',
        files: [
            packageJson(slug, { dev: 'tsx src/index.ts', build: 'tsc', start: 'node dist/index.js' }, { dotenv: '^16.4.7', fastify: '^5.2.1' }, { tsx: '^4.19.2', typescript: '^5.7.2' }),
            tsconfig(),
            dockerfile('node'),
            composeFile(slug, '3000'),
            envExample(['PORT=3000', 'API_TOKEN=replace_me', 'RATE_LIMIT_PER_MINUTE=60', 'FAILURE_OWNER=ops@example.com']),
            {
                path: 'src/index.ts',
                content: `import 'dotenv/config'\nimport Fastify from 'fastify'\n\ntype RecordItem = { id: string; title: string; status: 'open' | 'review' | 'closed'; createdAt: string; ownerId: string; schemaVersion: number; failureOwner: string; idempotencyKey?: string }\nconst app = Fastify({ logger: true })\nconst records = new Map<string, RecordItem>()\nconst idempotency = new Map<string, string>()\nconst rateBuckets = new Map<string, { count: number; resetAt: number }>()\n\nfunction rateLimit(request: { ip: string; headers: Record<string, string | string[] | undefined> }) {\n  const key = request.headers['x-account-id']?.toString() || request.ip\n  const now = Date.now()\n  const bucket = rateBuckets.get(key)\n  const limit = Number(process.env.RATE_LIMIT_PER_MINUTE || 60)\n  if (!bucket || bucket.resetAt <= now) {\n    rateBuckets.set(key, { count: 1, resetAt: now + 60_000 })\n    return\n  }\n  bucket.count += 1\n  if (bucket.count > limit) throw Object.assign(new Error('Limit reached, try again later.'), { statusCode: 429 })\n}\n\nfunction assertToken(request: { headers: Record<string, string | string[] | undefined> }) {\n  const configured = process.env.API_TOKEN\n  if (!configured) return\n  const token = request.headers.authorization?.toString().replace(/^Bearer\\s+/i, '')\n  if (token !== configured) throw Object.assign(new Error('Forbidden'), { statusCode: 403 })\n}\n\napp.get('/health', async () => ({ ok: true, service: '${escapeTs(title)}' }))\napp.get('/ready', async () => ({ ready: true, records: records.size, checks: ['memory-store', 'env', 'rate-limit', 'owner-scope'] }))\napp.get<{ Querystring: { limit?: string; cursor?: string } }>('/${noun}s', async (request) => {\n  const ownerId = request.headers['x-account-id']?.toString()\n  const limit = Math.min(Math.max(Number(request.query.limit || 25), 1), 100)\n  const cursor = Number(request.query.cursor || 0)\n  const scoped = [...records.values()].filter((record) => !ownerId || record.ownerId === ownerId)\n  return { items: scoped.slice(cursor, cursor + limit), nextCursor: cursor + limit < scoped.length ? String(cursor + limit) : null }\n})\napp.post<{ Body: { title?: string; status?: RecordItem['status']; ownerId?: string; idempotencyKey?: string } }>('/${noun}s', async (request, reply) => {\n  rateLimit(request)\n  assertToken(request)\n  const title = request.body.title?.trim()\n  if (!title) return reply.code(400).send({ error: 'title_required', message: 'Title is required.' })\n  if (request.body.idempotencyKey && idempotency.has(request.body.idempotencyKey)) {\n    return records.get(idempotency.get(request.body.idempotencyKey)!)\n  }\n  const id = crypto.randomUUID()\n  const record = { id, title, status: request.body.status || 'open', ownerId: request.body.ownerId || request.headers['x-account-id']?.toString() || 'demo-owner', schemaVersion: 1, failureOwner: process.env.FAILURE_OWNER || 'unassigned', createdAt: new Date().toISOString(), idempotencyKey: request.body.idempotencyKey }\n  records.set(id, record)\n  if (request.body.idempotencyKey) idempotency.set(request.body.idempotencyKey, id)\n  return reply.code(201).send(record)\n})\n\napp.setErrorHandler((error, _request, reply) => {\n  const statusCode = 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500\n  reply.code(statusCode).send({ error: statusCode >= 500 ? 'internal_error' : 'request_error', message: error.message })\n})\n\nawait app.listen({ port: Number(process.env.PORT || 3000), host: '0.0.0.0' })\n`,
            },
            readme(title, [
                `Fastify ${noun} API with health/readiness routes, validation, idempotency, scoped records, pagination, rate limiting, schema versioning, failure owner, and safe token handling.`,
                'Docker Compose keeps deployment portable and inspectable.',
                'Replace the in-memory store with Postgres before production traffic, add durable audit logs, and run second-device permission tests.',
            ]),
        ],
    }
}

function workerProject(title: string, slug: string, lower: string): GeneratedProject {
    const queueName = lower.includes('image') ? 'image-jobs' : lower.includes('invoice') ? 'invoice-jobs' : 'work-jobs'
    return {
        label: 'worker queue',
        files: [
            packageJson(slug, { dev: 'tsx src/index.ts', 'dev:worker': 'tsx src/worker.ts', build: 'tsc', start: 'node dist/index.js', worker: 'node dist/worker.js' }, { dotenv: '^16.4.7', fastify: '^5.2.1' }, { tsx: '^4.19.2', typescript: '^5.7.2' }),
            tsconfig(),
            dockerfile('node'),
            composeFile(slug, '3000', true),
            envExample(['PORT=3000', 'REDIS_URL=redis://redis:6379', 'MAX_RETRIES=3', 'FAILURE_OWNER=ops@example.com']),
            {
                path: 'src/queue.ts',
                content: `export type Job = { id: string; name: string; status: 'queued' | 'running' | 'complete' | 'failed' | 'dead'; attempts: number; payload: Record<string, unknown> }

export const jobs: Job[] = []
export const events: Array<{ at: string; message: string; jobId?: string }> = []
const idempotency = new Map<string, string>()

export function enqueue(name: string, payload: Record<string, unknown> = {}) {
  const key = typeof payload.idempotencyKey === 'string' ? payload.idempotencyKey : undefined
  if (key && idempotency.has(key)) return jobs.find((job) => job.id === idempotency.get(key))!
  const job = { id: crypto.randomUUID(), name, status: 'queued' as const, attempts: 0, payload }
  jobs.push(job)
  if (key) idempotency.set(key, job.id)
  events.push({ at: new Date().toISOString(), message: 'queued ' + name, jobId: job.id })
  return job
}

export function nextJob() {
  return jobs.find((job) => job.status === 'queued' || (job.status === 'failed' && job.attempts < Number(process.env.MAX_RETRIES || 3)))
}
`,
            },
            {
                path: 'src/index.ts',
                content: `import 'dotenv/config'\nimport Fastify from 'fastify'\nimport { enqueue, jobs } from './queue.js'\n\nconst app = Fastify({ logger: true })\napp.get('/health', async () => ({ ok: true, service: '${escapeTs(title)}' }))\napp.get('/api/worker-status', async () => ({ queue: '${queueName}', total: jobs.length, queued: jobs.filter((job) => job.status === 'queued').length, dead: jobs.filter((job) => job.status === 'dead').length, retrying: jobs.filter((job) => job.status === 'failed').length }))\napp.get('/api/jobs', async () => jobs)\napp.post<{ Body: { name?: string; payload?: Record<string, unknown> } }>('/api/jobs', async (request, reply) => {\n  if (!request.body.name?.trim()) return reply.code(400).send({ error: 'name_required' })\n  return reply.code(201).send(enqueue(request.body.name, request.body.payload || {}))\n})\nawait app.listen({ port: Number(process.env.PORT || 3000), host: '0.0.0.0' })\n`,
            },
            {
                path: 'src/worker.ts',
                content: `import 'dotenv/config'\nimport { events, jobs, nextJob } from './queue.js'\n\nconst job = nextJob()\nif (!job) {\n  console.log('${escapeTs(title)} idle')\n} else {\n  job.status = 'running'\n  job.attempts += 1\n  try {\n    console.log('processing', job.name, job.payload)\n    job.status = 'complete'\n    events.push({ at: new Date().toISOString(), message: 'completed ' + job.name, jobId: job.id })\n  } catch {\n    job.status = job.attempts >= Number(process.env.MAX_RETRIES || 3) ? 'dead' : 'failed'\n    events.push({ at: new Date().toISOString(), message: job.status + ' ' + job.name, jobId: job.id })\n  }\n}\nconsole.log('queue snapshot', { jobs, events })\n`,
            },
            readme(title, [
                'Queue starter with enqueue API, idempotency guard, worker entrypoint, retry/dead-letter states, event log, and status endpoint.',
                'Redis is included in Docker Compose as the production replacement seam; the starter runs locally with an in-memory queue.',
                'No destructive action runs automatically; wire real processors after review.',
            ]),
        ],
    }
}

function nextPackage(slug: string) {
    return packageJson(slug, { dev: 'next dev', build: 'next build', start: 'next start' }, { next: 'latest', react: 'latest', 'react-dom': 'latest' }, { '@types/node': 'latest', '@types/react': 'latest', '@types/react-dom': 'latest', typescript: 'latest' })
}

function packageJson(name: string, scripts: Record<string, string>, dependencies: Record<string, string>, devDependencies: Record<string, string>): GeneratedFile {
    return {
        path: 'package.json',
        content: JSON.stringify({ name, version: '0.1.0', private: true, type: 'module', scripts, dependencies, devDependencies }, null, 2),
    }
}

function tsconfig(): GeneratedFile {
    return {
        path: 'tsconfig.json',
        content: JSON.stringify({ compilerOptions: { target: 'ES2022', lib: ['ES2022', 'DOM'], module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, esModuleInterop: true, skipLibCheck: true, forceConsistentCasingInFileNames: true, outDir: 'dist', jsx: 'preserve' }, include: ['src/**/*'] }, null, 2),
    }
}

function nextConfig(): GeneratedFile {
    return { path: 'next.config.ts', content: 'import type { NextConfig } from \'next\'\n\nconst nextConfig: NextConfig = {\n  output: \'standalone\',\n}\n\nexport default nextConfig\n' }
}

function dockerfile(kind: 'next' | 'node'): GeneratedFile {
    if (kind === 'next') {
        return { path: 'Dockerfile', content: 'FROM node:22-alpine AS deps\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\n\nFROM node:22-alpine AS builder\nWORKDIR /app\nCOPY --from=deps /app/node_modules ./node_modules\nCOPY . .\nRUN npm run build\n\nFROM node:22-alpine AS runner\nWORKDIR /app\nENV NODE_ENV=production\nCOPY --from=builder /app/.next/standalone ./\nCOPY --from=builder /app/.next/static ./.next/static\nCOPY --from=builder /app/public ./public\nEXPOSE 3000\nCMD ["node", "server.js"]\n' }
    }
    return { path: 'Dockerfile', content: 'FROM node:22-alpine AS deps\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\n\nFROM node:22-alpine AS builder\nWORKDIR /app\nCOPY --from=deps /app/node_modules ./node_modules\nCOPY . .\nRUN npm run build\n\nFROM node:22-alpine AS runner\nWORKDIR /app\nENV NODE_ENV=production\nCOPY --from=builder /app/dist ./dist\nCOPY --from=builder /app/node_modules ./node_modules\nCOPY package.json ./package.json\nEXPOSE 3000\nCMD ["npm", "run", "start"]\n' }
}

function composeFile(slug: string, port: string, includeRedis = false): GeneratedFile {
    const services = includeRedis
        ? `  app:\n    build: .\n    env_file: .env\n    ports:\n      - "\${HOST_PORT:-${port}}:3000"\n    depends_on:\n      - redis\n  worker:\n    build: .\n    env_file: .env\n    command: npm run worker\n    depends_on:\n      - redis\n  redis:\n    image: redis:7-alpine\n    ports:\n      - "\${REDIS_PORT:-6379}:6379"\n`
        : `  app:\n    build: .\n    env_file: .env\n    ports:\n      - "\${HOST_PORT:-${port}}:3000"\n`
    return { path: 'docker-compose.yml', content: `services:\n${services}\n` }
}

function envExample(lines: string[]): GeneratedFile {
    return { path: '.env.example', content: `${['HOST_PORT=3000', ...lines].join('\n')}\n` }
}

function readme(title: string, bullets: string[]): GeneratedFile {
    return {
        path: 'README.md',
        content: `# ${title}\n\nGenerated by Hanasand Chat as an exportable starter.\n\n## Run locally\n\n\`\`\`bash\ncp .env.example .env\nnpm install\nnpm run dev\n\`\`\`\n\n## Docker\n\n\`\`\`bash\ndocker compose up --build\n\`\`\`\n\n## Handoff notes\n\n${bullets.map((line) => `- ${line}`).join('\n')}\n\n## Verification\n\n- Run \`npm run build\`.\n- Check keyboard navigation and mobile layout.\n- Replace demo values in \`.env\` before production.\n`,
    }
}

function detailForSection(section: string, lower: string) {
    if (lower.includes('complain') || lower.includes('critic') || lower.includes('angry')) {
        return `Specific, reviewable ${section.toLowerCase()} work with no vague filler and an obvious production seam.`
    }
    return `Concrete ${section.toLowerCase()} content with clear next steps and accessible structure.`
}

function productTypeFor(lower: string) {
    if (lower.includes('restaurant')) return 'restaurant reservation'
    if (lower.includes('marketing') || lower.includes('landing')) return 'marketing landing'
    if (lower.includes('dashboard') || lower.includes('admin')) return 'operations dashboard'
    if (lower.includes('ecommerce') || lower.includes('store')) return 'ecommerce'
    if (lower.includes('accessibility') || lower.includes('a11y')) return 'accessibility-first'
    if (lower.includes('seo') || lower.includes('local')) return 'local SEO'
    return 'product'
}

function toolTag(path: string, content: string) {
    return `<hanasand-tool>${JSON.stringify({ action: 'upsert_share', path, content })}</hanasand-tool>`
}

function slugify(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'hanasand-project'
}

function toTitleCase(value: string) {
    return value.replace(/\w\S*/g, (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
}

function escapeTs(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')
}

function parseBrowserOpenTarget(prompt: string) {
    const trimmed = prompt.trim()
    const match = /^(?:open|go to|browse|show)\s+(.+?)\s*$/i.exec(trimmed)
    const rawTarget = match?.[1]?.replace(/\s+(?:in )?(?:browser|the browser)$/i, '').trim()
    if (!rawTarget) {
        return null
    }

    const shortcuts: Record<string, { url: string, title: string }> = {
        vg: { url: 'https://www.vg.no', title: 'VG' },
        'vg.no': { url: 'https://www.vg.no', title: 'VG' },
        nrk: { url: 'https://www.nrk.no', title: 'NRK' },
        'nrk.no': { url: 'https://www.nrk.no', title: 'NRK' },
        google: { url: 'https://www.google.com', title: 'Google' },
        github: { url: 'https://github.com', title: 'GitHub' },
        hanasand: { url: 'https://hanasand.com', title: 'Hanasand' },
    }
    const shortcut = shortcuts[rawTarget.toLowerCase()]
    if (shortcut) {
        return shortcut
    }

    try {
        const url = new URL(rawTarget.includes('://') ? rawTarget : `https://${rawTarget}`)
        if (!url.hostname.includes('.')) {
            return null
        }
        return {
            url: url.toString(),
            title: url.hostname.replace(/^www\./, ''),
        }
    } catch {
        return null
    }
}
