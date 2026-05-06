import type { FastifyReply, FastifyRequest } from 'fastify'
import { listGptClients, requestGptCompletion } from '#utils/ws/handleGptMessage.ts'

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
                            'For project-building requests, include the minimal complete files needed to run the result, such as package.json, README, source files, and environment examples.',
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

function buildShareProjectResponse(prompt: string) {
    if (!/\b(build|create|make|generate|scaffold|website|site|app|bot|api|dashboard|portal|tool|starter|page)\b/i.test(prompt)) {
        return null
    }

    const project = inferProject(prompt)
    return {
        status: 'completed',
        provider: 'hanasand-ai',
        model: 'share-builder',
        message: [
            `Prepared a ${project.label} starter with complete runnable files.`,
            ...project.files.map((file) => toolTag(file.path, file.content)),
        ].join('\n\n'),
    }
}

function inferProject(prompt: string) {
    const lower = prompt.toLowerCase()
    const title = titleFromPrompt(prompt)
    const slug = slugify(title)

    if (/\b(discord|bot|slack|telegram|server status bot|game server)\b/.test(lower)) {
        return botProject(title, slug, lower.includes('discord') ? 'Discord' : 'Chat')
    }

    if (/\b(api|backend|fastify|server|audit log|health|readiness)\b/.test(lower) && !/\bwebsite|site|page\b/.test(lower)) {
        return apiProject(title, slug)
    }

    if (/\b(worker|queue|background|redis|job|retry|dead-letter)\b/.test(lower)) {
        return workerProject(title, slug)
    }

    return websiteProject(title, slug, pageSectionsFor(lower))
}

function titleFromPrompt(prompt: string) {
    const quoted = /["']([^"']{3,80})["']/.exec(prompt)?.[1]
    if (quoted) {
        return quoted
    }

    const cleaned = prompt
        .replace(/\b(build|create|make|generate|scaffold|tiny|polished|runnable|dockerized|starter|for the current \/s project)\b/gi, ' ')
        .replace(/\b(website|site|app|bot|api|dashboard|portal|tool|page|project)\b/gi, ' ')
        .replace(/[^a-zA-Z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .slice(0, 4)
        .join(' ')

    return toTitleCase(cleaned || 'Hanasand Project')
}

function pageSectionsFor(lower: string) {
    if (lower.includes('restaurant')) {
        return ['Seasonal menu', 'Reservations', 'Opening hours', 'Private dining', 'Guest notes', 'Find us']
    }
    if (lower.includes('marketing') || lower.includes('landing')) {
        return ['Proof', 'Features', 'Pricing', 'Testimonials', 'FAQ', 'Launch CTA']
    }
    if (lower.includes('portfolio')) {
        return ['Selected work', 'Process', 'Packages', 'Testimonials', 'Inquiry']
    }
    if (lower.includes('dashboard') || lower.includes('finance') || lower.includes('crm')) {
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
    return ['Overview', 'Highlights', 'Workflow', 'Proof', 'Next step']
}

function websiteProject(title: string, slug: string, sections: string[]) {
    const cards = sections.map((section, index) => ({
        section,
        metric: ['24h', '98%', '12', '4.9', '3x', 'Today'][index % 6],
    }))
    return {
        label: 'website/app',
        files: [
            {
                path: 'package.json',
                content: JSON.stringify({
                    scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
                    dependencies: { '@types/node': 'latest', '@types/react': 'latest', '@types/react-dom': 'latest', next: 'latest', react: 'latest', 'react-dom': 'latest', typescript: 'latest' },
                    devDependencies: {},
                }, null, 2),
            },
            {
                path: 'src/app/page.tsx',
                content: `const sections = ${JSON.stringify(cards, null, 2)}

export default function Page() {
  return (
    <main style={{ minHeight: '100vh', background: 'radial-gradient(circle at top, #283126, #080a08 62%)', color: '#f7f0e6', fontFamily: 'Avenir Next, ui-sans-serif, system-ui', padding: 32 }}>
      <section style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gap: 28 }}>
        <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#b8b1a5' }}>
          <strong>${title}</strong>
          <a href="#start" style={{ color: '#ff9d55', textDecoration: 'none' }}>Start</a>
        </nav>
        <header style={{ border: '1px solid rgba(255,255,255,.12)', borderRadius: 32, padding: 36, background: 'rgba(255,255,255,.07)', boxShadow: '0 30px 90px rgba(0,0,0,.35)' }}>
          <p style={{ color: '#ffb15f', letterSpacing: '.18em', textTransform: 'uppercase', fontSize: 12 }}>Built in Hanasand Chat</p>
          <h1 style={{ fontSize: 'clamp(44px, 8vw, 86px)', lineHeight: .92, margin: '18px 0' }}>${title}</h1>
          <p style={{ maxWidth: 650, color: '#d8d0c3', fontSize: 20 }}>A sharp, responsive starter with concrete sections, useful copy, and a clear path to connect real data or publishing later.</p>
          <div id="start" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 26 }}>
            <a href="mailto:hello@example.com" style={{ background: '#f7f0e6', color: '#0b0d0b', padding: '14px 18px', borderRadius: 999, textDecoration: 'none', fontWeight: 700 }}>Book a call</a>
            <a href="#sections" style={{ border: '1px solid rgba(255,255,255,.16)', color: '#f7f0e6', padding: '14px 18px', borderRadius: 999, textDecoration: 'none' }}>View details</a>
          </div>
        </header>
        <section id="sections" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {sections.map((item) => (
            <article key={item.section} style={{ border: '1px solid rgba(255,255,255,.1)', borderRadius: 24, padding: 22, background: 'rgba(255,255,255,.045)' }}>
              <strong style={{ color: '#ffb15f' }}>{item.metric}</strong>
              <h2 style={{ margin: '12px 0 8px' }}>{item.section}</h2>
              <p style={{ color: '#bfb7aa' }}>Production-ready structure and copy for {item.section.toLowerCase()}.</p>
            </article>
          ))}
        </section>
      </section>
    </main>
  )
}
`,
            },
            {
                path: 'README.md',
                content: `# ${title}

Generated by Hanasand Chat as a runnable Next.js starter.

## Run

\`\`\`bash
npm install
npm run dev
\`\`\`

## Files

- \`src/app/page.tsx\` contains the complete responsive page.
- Replace example contact links and copy before publishing.
`,
            },
        ],
    }
}

function botProject(title: string, slug: string, platform: string) {
    return {
        label: `${platform} bot`,
        files: [
            { path: 'package.json', content: JSON.stringify({ name: slug, type: 'module', scripts: { dev: 'tsx src/index.ts', start: 'node dist/index.js', build: 'tsc' }, dependencies: { 'discord.js': '^14.16.3', dotenv: '^16.4.7' }, devDependencies: { tsx: '^4.19.2', typescript: '^5.7.2' } }, null, 2) },
            { path: '.env.example', content: 'DISCORD_TOKEN=replace_me\nDISCORD_CLIENT_ID=replace_me\nWELCOME_CHANNEL_ID=replace_me\n' },
            { path: 'src/index.ts', content: `import 'dotenv/config'
import { Client, Events, GatewayIntentBits } from 'discord.js'

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] })

client.once(Events.ClientReady, (readyClient) => {
  console.log(\`${title} ready as \${readyClient.user.tag}\`)
})

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return
  if (message.content === '!help') {
    await message.reply('Commands: !help, !status, !roles. Configure real moderation actions after review.')
  }
  if (message.content === '!status') {
    await message.reply('Online. Admin actions are stubbed until explicit approval is configured.')
  }
})

if (!process.env.DISCORD_TOKEN) throw new Error('Missing DISCORD_TOKEN')
await client.login(process.env.DISCORD_TOKEN)
` },
            { path: 'README.md', content: `# ${title}\n\nA safe ${platform} bot starter with token configuration, status commands, and explicit stubs for admin actions.\n\n## Run\n\n\`\`\`bash\ncp .env.example .env\nnpm install\nnpm run dev\n\`\`\`\n` },
        ],
    }
}

function apiProject(title: string, slug: string) {
    return {
        label: 'API',
        files: [
            { path: 'package.json', content: JSON.stringify({ name: slug, type: 'module', scripts: { dev: 'tsx src/index.ts', build: 'tsc', start: 'node dist/index.js' }, dependencies: { '@fastify/cors': '^10.0.1', fastify: '^5.2.1', dotenv: '^16.4.7' }, devDependencies: { tsx: '^4.19.2', typescript: '^5.7.2' } }, null, 2) },
            { path: '.env.example', content: 'PORT=3000\nAPI_TOKEN=replace_me\n' },
            { path: 'src/index.ts', content: `import 'dotenv/config'
import Fastify from 'fastify'

const app = Fastify({ logger: true })
const records = new Map<string, { id: string; title: string; status: string }>()

app.get('/health', async () => ({ ok: true, service: '${title}' }))
app.get('/ready', async () => ({ ready: true, records: records.size }))
app.get('/records', async () => [...records.values()])
app.post<{ Body: { title?: string; status?: string } }>('/records', async (request, reply) => {
  const id = crypto.randomUUID()
  const record = { id, title: request.body.title || 'Untitled', status: request.body.status || 'open' }
  records.set(id, record)
  return reply.code(201).send(record)
})

await app.listen({ port: Number(process.env.PORT || 3000), host: '0.0.0.0' })
` },
            { path: 'README.md', content: `# ${title}\n\nFastify API starter with health, readiness, and record routes.\n\n\`\`\`bash\ncp .env.example .env\nnpm install\nnpm run dev\n\`\`\`\n` },
        ],
    }
}

function workerProject(title: string, slug: string) {
    const api = apiProject(title, slug)
    return {
        label: 'worker queue',
        files: [
            ...api.files,
            { path: 'src/worker.ts', content: `const queue = ['sync-demo', 'send-reminder', 'export-summary']\n\nfor (const job of queue) {\n  console.log('processing', job)\n}\n\nconsole.log('${title} worker idle')\n` },
        ],
    }
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
