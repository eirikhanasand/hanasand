import type { FastifyReply, FastifyRequest } from 'fastify'
import { listGptClients, requestGptCompletion } from '#utils/ws/handleGptMessage.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { auditAgentAction, evaluateAgentActionPolicy, redactAgentText } from '#utils/ai/actionPolicy.ts'

type GeneratedFile = {
    path: string
    content: string
}

type GeneratedProject = {
    label: string
    files: GeneratedFile[]
}

export default async function aiTool(req: FastifyRequest, res: FastifyReply) {
    const body = req.body as {
        action?: string
        prompt?: string
        context?: string
        maxTokens?: number
        toolAction?: 'share_file_write'
        approved?: boolean
        approvalId?: string
        target?: string
        path?: string
        content?: string
        metadata?: Record<string, unknown>
    } ?? {}
    const auth = await optionalToolAuth(req, res)
    if (req.headers.authorization && !auth.valid) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }
    const actorId = auth.id || headerString(req.headers.id) || null

    if (body.action === 'audit_agent_action') {
        const decision = await evaluateAgentActionPolicy({
            action: body.toolAction || 'share_file_write',
            actorId,
            approved: Boolean(body.approved),
            approvalId: body.approvalId,
            target: body.target,
            path: body.path,
            content: body.content,
            metadata: body.metadata,
        })
        await auditAgentAction(req, {
            action: body.toolAction || 'share_file_write',
            actorId,
            approved: Boolean(body.approved),
            approvalId: body.approvalId,
            target: body.target,
            path: body.path,
            content: body.content,
            metadata: body.metadata,
        }, decision, decision.status === 'allowed' ? 'completed' : decision.status)
        if (decision.status === 'blocked') {
            return res.status(403).send({ error: decision.reason, decision })
        }
        if (decision.status === 'checkpoint_required') {
            return res.status(409).send({ error: decision.reason, decision })
        }
        return res.send({ ok: true, decision })
    }

    const { prompt, context, maxTokens } = body
    if (!prompt) {
        return res.status(400).send({ error: 'Missing prompt.' })
    }

    const promptDecision = await evaluateAgentActionPolicy({
        action: 'ai_prompt',
        actorId,
        prompt,
        context,
        metadata: { source: 'tools_ai' },
    })
    await auditAgentAction(req, {
        action: 'ai_prompt',
        actorId,
        prompt,
        context,
        metadata: { source: 'tools_ai', promptLength: prompt.length, contextLength: context?.length || 0 },
    }, promptDecision)
    if (promptDecision.status !== 'allowed') {
        return res.status(promptDecision.status === 'blocked' ? 403 : 409).send({
            status: promptDecision.status,
            provider: 'hanasand-ai',
            model: 'policy',
            message: safetyMessage(promptDecision),
            decision: promptDecision,
        })
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
        return res.send(await enforceGeneratedToolPolicy(req, actorId, builderResponse))
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

        return res.send(await enforceGeneratedToolPolicy(req, actorId, {
            status: 'completed',
            provider: 'hanasand-ai',
            model: preferredClient.name,
            message: redactAgentText(completion.content || ''),
            artifacts: completion.artifacts || [],
            metrics: completion.metrics || null,
            conversationId,
        }))
    } catch (error) {
        req.log.error({ error, promptLength: prompt.length, clientName: preferredClient.name }, 'Hanasand AI tool request failed')
        const fallback = buildShareProjectResponse(prompt)
        if (fallback) {
            return res.send(await enforceGeneratedToolPolicy(req, actorId, fallback))
        }
        return res.send({
            status: 'retryable',
            provider: 'hanasand-ai',
            model: preferredClient.name,
            message: 'Hanasand AI lost the connection while answering. Send again and it will continue from the project context.',
        })
    }
}

async function optionalToolAuth(req: FastifyRequest, res: FastifyReply) {
    const authHeader = headerString(req.headers.authorization)
    if (!authHeader || authHeader === 'Bearer ') {
        return { valid: false, id: null as string | null }
    }

    return tokenWrapper(req, res)
}

function headerString(value: unknown) {
    return Array.isArray(value) ? String(value[0] || '') : typeof value === 'string' ? value : null
}

type ToolCall = {
    action?: string
    path?: string
    content?: string
    actions?: ToolCall[]
}

async function enforceGeneratedToolPolicy(req: FastifyRequest, actorId: string | null, response: Record<string, unknown>) {
    const message = typeof response.message === 'string' ? response.message : ''
    const calls = parseGeneratedToolCalls(message)

    for (const call of calls) {
        if (!['update_share', 'upsert_share', 'create_share'].includes(call.action || '')) {
            continue
        }

        const decision = await evaluateAgentActionPolicy({
            action: 'generated_tool_call',
            actorId,
            path: call.path,
            content: call.content,
            metadata: { generatedAction: call.action, phase: 'staged_tool_tag' },
        })
        await auditAgentAction(req, {
            action: 'generated_tool_call',
            actorId,
            path: call.path,
            content: call.content,
            metadata: { generatedAction: call.action, phase: 'staged_tool_tag' },
        }, decision)

        if (decision.status !== 'allowed') {
            return {
                ...response,
                status: decision.status,
                model: 'policy',
                message: safetyMessage(decision),
                decision,
            }
        }
    }

    return {
        ...response,
        message: redactAgentText(message),
    }
}

function parseGeneratedToolCalls(content: string): ToolCall[] {
    return [...content.matchAll(/<hanasand-tool>([\s\S]*?)<\/hanasand-tool>/g)].flatMap((match) => {
        try {
            const parsed = JSON.parse(match[1]) as ToolCall
            return Array.isArray(parsed.actions) ? parsed.actions : [parsed]
        } catch {
            return []
        }
    })
}

function safetyMessage(decision: Awaited<ReturnType<typeof evaluateAgentActionPolicy>>) {
    return [
        `Blocked by Hanasand safety policy: ${decision.reason}`,
        `Safer path: ${decision.safeAlternative}`,
    ].join('\n')
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
    if (!/\b(build|create|make|generate|scaffold|website|site|app|bot|api|backend|worker|queue|dashboard|portal|tool|starter|page|fix|repair|rebuild|self-hostable|runnable project)\b/i.test(prompt)) {
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

    if (/\b(discord|bot|slack|telegram|server status bot|game server|moderation)\b/.test(lower)) {
        return botProject(title, slug, lower.includes('discord') ? 'Discord' : 'Chat')
    }

    if (/\b(worker|queue|background|redis|job|transcode|import)\b/.test(lower) && !/\bwebsite|web site|page|frontend|landing\b/.test(lower)) {
        return workerProject(title, slug, lower)
    }

    if (/\b(page|website|web site|site|frontend|landing|concept)\b/.test(lower)) {
        return websiteProject(title, slug, pageSectionsFor(lower), lower)
    }

    if (/\b(api|backend|fastify)\b/.test(lower) && !/\bpage|website|web site|site|frontend|landing|concept\b/.test(lower)) {
        return apiProject(title, slug, lower)
    }

    if (/\b(next\.?js|dockerized next|portable next|listing dashboard|knowledge base|portfolio|bakery|donor dashboard|investor update|artist shop|restaurant site)\b/.test(lower)) {
        return websiteProject(title, slug, pageSectionsFor(lower), lower)
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
    if (lower.includes('tiny agency') || lower.includes('brand, webflow cleanup') || lower.includes('agency site')) {
        return ['Proof', 'Services', 'Selected work', 'Pricing cues', 'Testimonials', 'Contact CTA']
    }
    if (lower.includes('board-ready') || lower.includes('initiatives, blockers') || lower.includes('ceo wants a board')) {
        return ['Initiatives', 'Blockers', 'Decisions', 'Owner asks', 'Timeline', 'Status metrics']
    }
    if (lower.includes('artist drop') || lower.includes('releasing prints') || lower.includes('editions, dates')) {
        return ['Edition details', 'Launch timeline', 'Shipping notes', 'Proof', 'FAQ', 'Purchase CTA']
    }
    if (lower.includes('permit page') || lower.includes('residents keep calling')) {
        return ['Permit types', 'Timeline', 'Fee checklist', 'Documents', 'Office hours', 'Plain FAQ']
    }
    if (lower.includes('chores') || lower.includes('allowance')) {
        return ['Chores', 'Assignments', 'Allowance progress', 'Reminders', 'Empty states', 'Beginner setup']
    }
    if (lower.includes('policy docs') || lower.includes('policy portal')) {
        return ['Policy categories', 'Recent changes', 'Owners', 'Acknowledgement cues', 'Ask questions', 'Search structure']
    }
    if (lower.includes('ugly sheet') || lower.includes('simple crm screen') || lower.includes('hate crms')) {
        return ['Leads', 'Next follow-up', 'Deal stages', 'Notes', 'Metrics', 'Import export cues']
    }
    if (lower.includes('design qa') || lower.includes('designqasignal') || lower.includes('review sections')) {
        return ['Review sections', 'Defect metrics', 'Service tiers', 'Stakeholder quotes', 'Handoff tasks', 'Deployment notes']
    }
    if (lower.includes('cleaning service') || lower.includes('cleanlocal') || lower.includes('pricing packages')) {
        return ['Service sections', 'Response metrics', 'Pricing packages', 'Customer quotes', 'Launch tasks', 'Beginner deployment']
    }
    if (lower.includes('retail returns') || lower.includes('returns portal') || lower.includes('returns backend') || lower.includes('returns') || lower.includes('returns portal')) {
        return ['Return sections', 'Resolution metrics', 'Policy tiers', 'Customer quotes', 'Processing tasks', 'Deployment notes']
    }
    if (lower.includes('museum exhibit') || lower.includes('exhibitsignal') || lower.includes('exhibit sections')) {
        return ['Exhibit sections', 'Visitor metrics', 'Ticket tiers', 'Curator quotes', 'Accessibility tasks', 'Deployment notes']
    }
    if (lower.includes('security incident portal') || lower.includes('incidentsignal')) {
        return ['Incident sections', 'Response metrics', 'Severity tiers', 'Stakeholder quotes', 'Action tasks', 'Deployment notes']
    }
    if (lower.includes('agency client health') || lower.includes('clienthealthsignal') || lower.includes('client sections')) {
        return ['Client sections', 'Health metrics', 'Retainer tiers', 'Client quotes', 'Action tasks', 'Deployment notes']
    }
    if (lower.includes('csa membership') || lower.includes('harvestsignal') || lower.includes('share sections')) {
        return ['Share sections', 'Harvest metrics', 'Membership tiers', 'Member quotes', 'Pickup tasks', 'Beginner deployment']
    }
    if (lower.includes('executive decision log') || lower.includes('decisionsignal')) {
        return ['Decision sections', 'Follow-up metrics', 'Governance tiers', 'Stakeholder quotes', 'Action tasks', 'Deployment notes']
    }
    if (lower.includes('brand campaign control') || lower.includes('campaignsignal')) {
        return ['Asset sections', 'Launch metrics', 'Package tiers', 'Stakeholder quotes', 'Owner tasks', 'Deployment notes']
    }
    if (lower.includes('photography booking') || lower.includes('framelocal') || lower.includes('photographer')) {
        return ['Service sections', 'Booking metrics', 'Pricing bands', 'Client quotes', 'Launch tasks', 'Beginner deployment']
    }
    if (lower.includes('construction bid portal') || lower.includes('bidnorth') || lower.includes('trade sections')) {
        return ['Trade sections', 'Bid metrics', 'Package tiers', 'Contractor quotes', 'Submission tasks', 'Deployment notes']
    }
    if (lower.includes('legal matter dashboard') || lower.includes('mattersignal') || lower.includes('matter sections')) {
        return ['Matter sections', 'Deadline metrics', 'Retainer tiers', 'Client quotes', 'Review tasks', 'Deployment notes']
    }
    if (lower.includes('climate grant portal') || lower.includes('grantsignal') || lower.includes('funding sections')) {
        return ['Funding sections', 'Impact metrics', 'Sponsor tiers', 'Applicant quotes', 'Submission tasks', 'Deployment notes']
    }
    if (lower.includes('logistics yard board') || lower.includes('yardsignal') || lower.includes('dock sections')) {
        return ['Dock sections', 'Throughput metrics', 'Escalation tiers', 'Dispatcher quotes', 'Action tasks', 'Deployment notes']
    }
    if (lower.includes('product research repository') || lower.includes('insightsignal') || lower.includes('study sections')) {
        return ['Study sections', 'Evidence metrics', 'Access tiers', 'Researcher quotes', 'Synthesis tasks', 'Deployment notes']
    }
    if (lower.includes('investor data room') || lower.includes('dataroomsignal') || lower.includes('document sections')) {
        return ['Document sections', 'KPI metrics', 'Access tiers', 'Investor quotes', 'Diligence tasks', 'Deployment notes']
    }
    if (lower.includes('hospital staffing') || lower.includes('shiftsignal') || lower.includes('staffing board')) {
        return ['Unit sections', 'Coverage metrics', 'Escalation tiers', 'Coordinator quotes', 'Staffing tasks', 'Deployment notes']
    }
    if (lower.includes('data quality dashboard') || lower.includes('freshnessboard') || lower.includes('pipeline sections')) {
        return ['Pipeline sections', 'Freshness metrics', 'Support tiers', 'Stakeholder quotes', 'Incident tasks', 'Deployment notes']
    }
    if (lower.includes('payment') || lower.includes('checkout') || lower.includes('subscription')) {
        return ['Plans', 'Checkout states', 'Failed payments', 'Cancellation', 'Invoice notes', 'Security review']
    }
    if (lower.includes('seo') || lower.includes('migration') || lower.includes('redirect')) {
        return ['Search proof', 'Pricing', 'FAQ', 'Redirect checklist', 'Lead capture', 'Launch handoff']
    }
    if (lower.includes('calendar') || lower.includes('shared state') || lower.includes('reminders')) {
        return ['Shared state', 'Permission matrix', 'Exports', 'Reminders', 'Mobile behavior', 'Backend handoff']
    }
    if (lower.includes('restaurant')) {
        return ['Menu and allergens', 'Dietary filters', 'Reservations', 'Opening hours', 'Private dining', 'Guest proof', 'Location', 'Update handoff']
    }
    if (lower.includes('docs') || lower.includes('documentation') || lower.includes('knowledge')) {
        return ['Quickstart', 'Categories', 'Guides', 'Status callouts', 'Escalation paths', 'Support']
    }
    if (lower.includes('event') || lower.includes('conference')) {
        return ['Schedule', 'Speakers', 'Tracks', 'Sponsors', 'Tickets', 'Venue']
    }
    if (lower.includes('gallery') || lower.includes('image')) {
        return ['Review queue', 'Keep', 'Reject later', 'Collections', 'Export summary', 'Deferred deletion confirmation']
    }
    if (lower.includes('status page') || lower.includes('incident') || lower.includes('observability')) {
        return ['Service health', 'Incident timeline', 'Subscriber notice', 'SLO evidence', 'Postmortems', 'Failure owner']
    }
    if (((lower.includes('support') && !lower.includes('support bundle')) || lower.includes('escalation') || lower.includes('sla')) && !lower.includes('knowledge') && !lower.includes('docs') && !lower.includes('documentation') && !lower.includes('gdpr') && !lower.includes('privacy') && !lower.includes('incident') && !lower.includes('status page')) {
        return ['Escalation paths', 'SLA states', 'Customer messaging', 'Failure owner', 'Runbook', 'Audit trail']
    }
    if (lower.includes('restaurant')) {
        return ['Menu and allergens', 'Reservations', 'Opening hours', 'Private dining', 'Guest proof', 'Location', 'Redirect checklist']
    }
    if (lower.includes('course') || lower.includes('learning outcomes')) {
        return ['Learning outcomes', 'Course modules', 'Pricing', 'Testimonials', 'Launch tasks', 'Beginner deployment']
    }
    if (lower.includes('architecture showcase') || lower.includes('architect') || lower.includes('formaworks')) {
        return ['Project gallery', 'Architecture services', 'Inquiry metrics', 'Service pricing', 'Testimonials', 'Delivery tasks']
    }
    if (lower.includes('data room') || lower.includes('diligence')) {
        return ['Diligence metrics', 'Document controls', 'Pricing impact', 'Readiness tasks', 'Testimonials', 'Deployment notes']
    }
    if (lower.includes('handoff') || lower.includes('scope/pricing')) {
        return ['Asset inventory', 'Launch metrics', 'Scope and pricing', 'Testimonials', 'Handoff tasks', 'Deployment notes']
    }
    if (lower.includes('asset approval') || lower.includes('creative asset') || lower.includes('proofdeck')) {
        return ['Asset sections', 'Approval metrics', 'Package tiers', 'Stakeholder quotes', 'Review tasks', 'Deployment notes']
    }
    if (lower.includes('service directory') || lower.includes('locallist') || lower.includes('local service')) {
        return ['Service categories', 'Lead metrics', 'Pricing cards', 'Testimonials', 'Onboarding tasks', 'Beginner deployment']
    }
    if (lower.includes('permit') || lower.includes('municipal permit')) {
        return ['Permit categories', 'Service metrics', 'Pricing impact', 'Citizen quotes', 'Application tasks', 'Deployment notes']
    }
    if (lower.includes('creator membership') || lower.includes('memberforge')) {
        return ['Member benefits', 'Revenue metrics', 'Pricing levels', 'Subscriber quotes', 'Launch tasks', 'Beginner deployment']
    }
    if (lower.includes('grant') || lower.includes('funding themes')) {
        return ['Funding themes', 'Impact metrics', 'Sponsor tiers', 'Collaborator quotes', 'Submission tasks', 'Deployment notes']
    }
    if (lower.includes('campaign microsite') || lower.includes('launchcanvas') || lower.includes('creative sections')) {
        return ['Creative sections', 'Launch metrics', 'Package tiers', 'Stakeholder quotes', 'Task status', 'Deployment notes']
    }
    if (lower.includes('vendor onboarding portal') || lower.includes('vendorgate')) {
        return ['Risk categories', 'Review metrics', 'Package tiers', 'Buyer quotes', 'Readiness tasks', 'Controlled deployment']
    }
    if (lower.includes('case study portal') || lower.includes('impactframes')) {
        return ['Project sections', 'Outcome metrics', 'Service tiers', 'Client quotes', 'Handoff tasks', 'Deployment notes']
    }
    if (lower.includes('municipal service portal') || lower.includes('civicsignal')) {
        return ['Service categories', 'Response metrics', 'Cost tiers', 'Resident quotes', 'Application tasks', 'Deployment notes']
    }
    if (lower.includes('trust center') || lower.includes('trustsignal')) {
        return ['Control groups', 'Assurance metrics', 'Plan tiers', 'Customer quotes', 'Evidence tasks', 'Deployment notes']
    }
    if (lower.includes('creator launch hub') || lower.includes('launchhearth') || lower.includes('offer sections')) {
        return ['Offer sections', 'Revenue metrics', 'Pricing levels', 'Audience quotes', 'Launch tasks', 'Beginner deployment']
    }
    if (lower.includes('research review') || lower.includes('reviewsignal') || lower.includes('research themes')) {
        return ['Research themes', 'Impact metrics', 'Sponsor tiers', 'Reviewer quotes', 'Submission tasks', 'Deployment notes']
    }
    if (lower.includes('design handoff') || lower.includes('handoffnorth') || lower.includes('component groups')) {
        return ['Component groups', 'Release metrics', 'Service tiers', 'Stakeholder quotes', 'Implementation tasks', 'Deployment notes']
    }
    if (lower.includes('electrician') || lower.includes('voltlocal') || lower.includes('trades website')) {
        return ['Services', 'Response metrics', 'Simple pricing bands', 'Customer quotes', 'Launch checklist', 'Beginner deployment']
    }
    if (lower.includes('evidence room') || lower.includes('evidenceroom') || lower.includes('control families')) {
        return ['Control families', 'Audit metrics', 'Assurance tiers', 'Reviewer quotes', 'Evidence tasks', 'Deployment notes']
    }
    if (lower.includes('seller console') || lower.includes('sellersignal') || lower.includes('listing sections')) {
        return ['Listing sections', 'Payout metrics', 'Pricing plans', 'Seller quotes', 'Onboarding tasks', 'Deployment notes']
    }
    if (lower.includes('hospital staffing') || lower.includes('shiftsignal') || lower.includes('staffing board')) {
        return ['Unit sections', 'Coverage metrics', 'Escalation tiers', 'Coordinator quotes', 'Staffing tasks', 'Deployment notes']
    }
    if (lower.includes('school enrollment portal') || lower.includes('enrollnorth') || lower.includes('program sections')) {
        return ['Program sections', 'Application metrics', 'Fee tiers', 'Parent quotes', 'Document tasks', 'Deployment notes']
    }
    if (lower.includes('data quality dashboard') || lower.includes('freshnessboard') || lower.includes('pipeline sections')) {
        return ['Pipeline sections', 'Freshness metrics', 'Support tiers', 'Stakeholder quotes', 'Incident tasks', 'Deployment notes']
    }
    if (lower.includes('executive board pack') || lower.includes('boardsignal') || lower.includes('decision sections')) {
        return ['Decision sections', 'KPI metrics', 'Investment tiers', 'Stakeholder quotes', 'Action tasks', 'Deployment notes']
    }
    if (lower.includes('cutover') || lower.includes('parallel run') || (lower.includes('migration') && !lower.includes('seo') && !lower.includes('restaurant'))) {
        return ['Source export', 'Clean schema', 'Parallel run', 'Cutover plan', 'Rollback plan', 'Verification']
    }
    if (/\b(ecommerce|product|store)\b/.test(lower)) {
        return ['Product bundles', 'Shipping notes', 'Customer reviews', 'Return policy', 'FAQ', 'Checkout CTA']
    }
    if (lower.includes('a11y') || lower.includes('wcag') || lower.includes('skip links') || lower.includes('keyboard flow') || lower.includes('reduced motion')) {
        return ['Skip links', 'Keyboard flow', 'Contrast', 'Forms', 'Reduced motion']
    }
    if (lower.includes('marketing') || lower.includes('landing')) {
        return ['Proof', 'Features', 'Pricing', 'Testimonials', 'FAQ', 'Launch CTA']
    }
    if (lower.includes('gdpr') || lower.includes('privacy') || lower.includes('data retention') || lower.includes('data request') || lower.includes('personal data')) {
        return ['Data map', 'Consent flow', 'Retention rules', 'Export request', 'Delete request', 'Audit trail']
    }
    if (lower.includes('payment') || lower.includes('checkout') || lower.includes('subscription')) {
        return ['Plans', 'Checkout states', 'Invoice notes', 'Failed payments', 'Cancellation', 'Security review']
    }
    if (lower.includes('governance') || lower.includes('audit trail') || lower.includes('compliance') || lower.includes('security review') || lower.includes('legal') || lower.includes('pii handling')) {
        return ['Governance gates', 'Audit trail', 'Security review', 'PII handling', 'Deployment checks', 'Failure owner']
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
    if (lower.includes('seo') || lower.includes('redirect')) {
        return ['Search proof', 'Pricing', 'FAQ', 'Redirect checklist', 'Lead capture', 'Launch handoff']
    }
    if (lower.includes('privacy') || lower.includes('consent') || lower.includes('tracking') || lower.includes('cookie')) {
        return ['Privacy rules', 'Consent states', 'Data minimization', 'Export and delete', 'Tracking audit', 'Failure owner']
    }
    if (lower.includes('duplicate') || lower.includes('automation') || lower.includes('zap') || lower.includes('workflow loop')) {
        return ['Trigger inventory', 'Duplicate guard', 'Idempotency keys', 'Replay review', 'Side effects', 'Failure owner']
    }
    if (lower.includes('beta') || lower.includes('edge case') || lower.includes('mobile safari') || lower.includes('offline')) {
        return ['Edge-case matrix', 'Offline state', 'Mobile Safari', 'Slow network', 'Recovery copy', 'Verification']
    }
    if (lower.includes('auth') || lower.includes('login') || lower.includes('session') || lower.includes('second device') || lower.includes('mobile refresh') || lower.includes('backend boundary') || lower.includes('backend contract')) {
        return ['Backend contract', 'Session states', 'Permission matrix', 'Second device test', 'Revoked access', 'Failure owner']
    }
    if (lower.includes('portfolio')) {
        return ['Selected work', 'Process', 'Packages', 'Testimonials', 'Inquiry']
    }
    if (lower.includes('dashboard') || lower.includes('finance') || lower.includes('crm') || lower.includes('admin')) {
        return ['Metrics', 'Records', 'Follow-ups', 'Risks', 'Next actions']
    }
    if (lower.includes('docs') || lower.includes('documentation') || lower.includes('knowledge')) {
        return ['Quickstart', 'Categories', 'Guides', 'Status callouts', 'Escalation paths', 'Support']
    }
    if (lower.includes('event') || lower.includes('conference')) {
        return ['Schedule', 'Speakers', 'Tracks', 'Sponsors', 'Tickets', 'Venue']
    }
    if (lower.includes('gallery') || lower.includes('image')) {
        return ['Review queue', 'Keep', 'Reject later', 'Collections', 'Export summary', 'Deferred deletion confirmation']
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
            ciWorkflow(),
            designSpec(title, slug),
            securityReview(),
            threatModel(),
            procurementReview(),
            runbookDoc(),
            sloDoc(),
            sbomDoc(),
            observabilityDoc(),
            releaseEvidenceDoc(),
            dataClassificationDoc(),
            accessReviewDoc(),
            chaosDrillDoc(),
            migrationPlanDoc(),
            supportBundleDoc(),
            qaPlanDoc(),
            browserVerificationDoc(),
            maintainabilityDoc(),
            exitPlanDoc(),
            seoVisibilityDoc(),
            pricingRiskDoc(),
            workflowPortabilityDoc(),
            policyUploadDoc(),
            accessibilityAuditDoc(),
            changeReviewDoc(),
            operatorHandbookDoc(),
            dataContractDoc(),
            feedbackLoopDoc(),
            seoEditingControlDoc(),
            errorRecoveryDoc(),
            onboardingDoc(),
            privacyRulesDoc(),
            backendBoundaryDoc(),
            sessionSyncDoc(),
            dataModelOwnershipDoc(),
            duplicateWorkflowDoc(),
            quotaTransparencyDoc(),
            deploymentTroubleshootingDoc(),
            betaEdgeCasesDoc(),
            architectureMapDoc(),
            adrDoc(),
            performanceBudgetDoc(),
            loadTestingDoc(),
            rumDoc(),
            maintainershipDoc(),
            dependencyUpgradeDoc(),
            dataPortabilityDoc(),
            versionHistoryDoc(),
            manualEditControlDoc(),
            cmsWorkflowDoc(),
            previewDeployDoc(),
            authPermissionMatrixDoc(),
            mobileReleaseDoc(),
            designSystemTokensDoc(),
            complaintRegressionDoc(),
            testStrategyDoc(),
            branchProtectionDoc(),
            codeReviewWorkflowDoc(),
            stateOwnershipDoc(),
            criticalFlowOverrideDoc(),
            schemaRelationshipDoc(),
            mediaAssetPipelineDoc(),
            releaseCanaryDoc(),
            environmentParityDoc(),
            secretsManagementDoc(),
            fixtureSeedDataDoc(),
            migrationRollbackDoc(),
            featureFlagGovernanceDoc(),
            incidentCommunicationDoc(),
            privacyRequestAutomationDoc(),
            billingLimitPolicyDoc(),
            ssoProvisioningDoc(),
            auditEvidencePackDoc(),
            disasterRecoveryDoc(),
            slaCreditPolicyDoc(),
            vendorRiskDoc(),
            abusePreventionDoc(),
            observabilityDashboardDoc(),
            supportEscalationLadderDoc(),
            aiGovernanceDoc(),
            promptPrivacyDoc(),
            agentActionApprovalDoc(),
            modelProviderFallbackDoc(),
            tenantIsolationProofDoc(),
            dataLineageDoc(),
            evalCoverageDoc(),
            costObservabilityDoc(),
            i18nReadinessDoc(),
            toolBoundaryValidationDoc(),
            externalDataFreshnessDoc(),
            browserAutomationStabilityDoc(),
            apiDeprecationPolicyDoc(),
            dataQualityMonitoringDoc(),
            adoptionTrainingDoc(),
            webhookReplayLabDoc(),
            {
                path: 'src/app/layout.tsx',
                content: `import type { Metadata } from 'next'\n\nexport const metadata: Metadata = {\n  title: '${escapeTs(title)}',\n  description: 'Accessible, responsive ${escapeTs(productType)} starter generated in Hanasand Chat.',\n}\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  )\n}\n`,
            },
            {
                path: 'src/app/page.tsx',
                content: `const sections = ${JSON.stringify(cards, null, 2)}\n\nconst trust = ['No platform lock-in', 'Readable source export', 'Source export', 'Mobile-first layout', 'Accessible controls', 'Privacy rules documented', 'Privacy and data seams documented', 'Backend contract before fake integrations', 'Session sync and second-device states', 'Duplicate workflow guard', 'Quota transparency', 'Rollback path documented', 'Failure owner', 'Security review', 'Procurement review']\nconst tasks = ['Replace contact routes', 'Connect real data', 'Run Lighthouse/a11y pass', 'Deploy with Docker Compose', 'Verify forms, limits, ownership rules, clean schema, parallel run, DNS checklist, SSL checklist, Rollback plan, Verification, incident drills, synthetic checks, second-device state, quota reset copy, duplicate workflow detection, and beta edge cases']\n\nexport default function Page() {\n  return (\n    <main style={{ minHeight: '100vh', background: 'radial-gradient(circle at 18% 8%, rgba(226,88,34,.24), transparent 28%), radial-gradient(circle at 82% 0%, rgba(157,225,143,.16), transparent 24%), #080a08', color: '#f7f0e6', fontFamily: 'Avenir Next, ui-sans-serif, system-ui', padding: '24px' }}>\n      <a href="#content" style={{ position: 'absolute', left: 16, top: 16, color: '#080a08', background: '#f7f0e6', padding: '8px 12px', borderRadius: 999 }}>Skip to content</a>\n      <section id="content" style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gap: 28 }}>\n        <nav aria-label="Primary" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, color: '#c7beb0', flexWrap: 'wrap' }}>\n          <strong>${escapeTs(businessName)}</strong>\n          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>\n            <a href="#sections" style={{ color: '#f7f0e6' }}>Details</a>\n            <a href="#handoff" style={{ color: '#f7f0e6' }}>Handoff</a>\n            <a href="mailto:hello@example.com" style={{ color: '#ffb15f' }}>Contact</a>\n          </div>\n        </nav>\n        <header style={{ border: '1px solid rgba(255,255,255,.12)', borderRadius: 32, padding: 'clamp(26px, 5vw, 52px)', background: 'linear-gradient(135deg, rgba(255,255,255,.09), rgba(255,255,255,.035))', boxShadow: '0 30px 90px rgba(0,0,0,.35)' }}>\n          <p style={{ color: '#ffb15f', letterSpacing: '.18em', textTransform: 'uppercase', fontSize: 12 }}>Built for a skeptical client</p>\n          <h1 style={{ fontSize: 'clamp(42px, 8vw, 86px)', lineHeight: .92, margin: '18px 0' }}>${escapeTs(title)}</h1>\n          <p style={{ maxWidth: 720, color: '#ded6ca', fontSize: 20 }}>A concrete ${escapeTs(productType)} starter that avoids generic filler: responsive sections, accessible navigation, real handoff notes, and clear places to connect production data.</p>\n          <form aria-label="Lead capture" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 26 }}>\n            <label style={{ display: 'grid', gap: 6, minWidth: 240, flex: '1 1 260px' }}>\n              <span style={{ color: '#c7beb0' }}>Email</span>\n              <input required type="email" placeholder="you@example.com" style={{ border: '1px solid rgba(255,255,255,.16)', background: 'rgba(0,0,0,.25)', color: '#f7f0e6', padding: '14px 16px', borderRadius: 16 }} />\n            </label>\n            <button type="submit" style={{ alignSelf: 'end', border: 0, background: '#f7f0e6', color: '#0b0d0b', padding: '15px 20px', borderRadius: 999, fontWeight: 800 }}>Request review</button>\n          </form>\n        </header>\n        <section id="sections" aria-label="Project sections" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>\n          {sections.map((item) => (\n            <article key={item.section} style={{ border: '1px solid rgba(255,255,255,.1)', borderRadius: 24, padding: 22, background: 'rgba(255,255,255,.045)' }}>\n              <strong style={{ color: '#ffb15f' }}>{item.metric}</strong>\n              <h2 style={{ margin: '12px 0 8px' }}>{item.section}</h2>\n              <p style={{ color: '#bfb7aa' }}>{item.detail}</p>\n            </article>\n          ))}\n        </section>\n        <section id="handoff" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>\n          <article style={{ border: '1px solid rgba(255,255,255,.1)', borderRadius: 24, padding: 22, background: 'rgba(255,255,255,.04)' }}>\n            <h2>Trust fixes</h2>\n            <ul>{trust.map((item) => <li key={item}>{item}</li>)}</ul>\n          </article>\n          <article style={{ border: '1px solid rgba(255,255,255,.1)', borderRadius: 24, padding: 22, background: 'rgba(255,255,255,.04)' }}>\n            <h2>Next production tasks</h2>\n            <ol>{tasks.map((item) => <li key={item}>{item}</li>)}</ol>\n          </article>\n        </section>\n      </section>\n    </main>\n  )\n}\n`,
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
            ciWorkflow(),
            designSpec(title, slug),
            securityReview(),
            threatModel(),
            procurementReview(),
            runbookDoc(),
            sloDoc(),
            sbomDoc(),
            observabilityDoc(),
            releaseEvidenceDoc(),
            dataClassificationDoc(),
            accessReviewDoc(),
            chaosDrillDoc(),
            migrationPlanDoc(),
            supportBundleDoc(),
            qaPlanDoc(),
            browserVerificationDoc(),
            maintainabilityDoc(),
            exitPlanDoc(),
            seoVisibilityDoc(),
            pricingRiskDoc(),
            workflowPortabilityDoc(),
            policyUploadDoc(),
            accessibilityAuditDoc(),
            changeReviewDoc(),
            operatorHandbookDoc(),
            dataContractDoc(),
            feedbackLoopDoc(),
            seoEditingControlDoc(),
            errorRecoveryDoc(),
            onboardingDoc(),
            privacyRulesDoc(),
            backendBoundaryDoc(),
            sessionSyncDoc(),
            dataModelOwnershipDoc(),
            duplicateWorkflowDoc(),
            quotaTransparencyDoc(),
            deploymentTroubleshootingDoc(),
            betaEdgeCasesDoc(),
            architectureMapDoc(),
            adrDoc(),
            performanceBudgetDoc(),
            loadTestingDoc(),
            rumDoc(),
            maintainershipDoc(),
            dependencyUpgradeDoc(),
            dataPortabilityDoc(),
            versionHistoryDoc(),
            manualEditControlDoc(),
            cmsWorkflowDoc(),
            previewDeployDoc(),
            authPermissionMatrixDoc(),
            mobileReleaseDoc(),
            designSystemTokensDoc(),
            complaintRegressionDoc(),
            testStrategyDoc(),
            branchProtectionDoc(),
            codeReviewWorkflowDoc(),
            stateOwnershipDoc(),
            criticalFlowOverrideDoc(),
            schemaRelationshipDoc(),
            mediaAssetPipelineDoc(),
            releaseCanaryDoc(),
            environmentParityDoc(),
            secretsManagementDoc(),
            fixtureSeedDataDoc(),
            migrationRollbackDoc(),
            featureFlagGovernanceDoc(),
            incidentCommunicationDoc(),
            privacyRequestAutomationDoc(),
            billingLimitPolicyDoc(),
            ssoProvisioningDoc(),
            auditEvidencePackDoc(),
            disasterRecoveryDoc(),
            slaCreditPolicyDoc(),
            vendorRiskDoc(),
            abusePreventionDoc(),
            observabilityDashboardDoc(),
            supportEscalationLadderDoc(),
            aiGovernanceDoc(),
            promptPrivacyDoc(),
            agentActionApprovalDoc(),
            modelProviderFallbackDoc(),
            tenantIsolationProofDoc(),
            dataLineageDoc(),
            evalCoverageDoc(),
            costObservabilityDoc(),
            i18nReadinessDoc(),
            toolBoundaryValidationDoc(),
            externalDataFreshnessDoc(),
            browserAutomationStabilityDoc(),
            apiDeprecationPolicyDoc(),
            dataQualityMonitoringDoc(),
            adoptionTrainingDoc(),
            webhookReplayLabDoc(),
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
            packageJson(slug, { dev: 'tsx src/index.ts', build: 'tsc', start: 'node dist/index.js', migrate: 'node --test migrations/001_initial_schema.sql' }, { dotenv: '^16.4.7', fastify: '^5.2.1', pg: '^8.13.1' }, { '@types/pg': '^8.11.10', tsx: '^4.19.2', typescript: '^5.7.2' }),
            tsconfig(),
            dockerfile('node'),
            composeFile(slug, '3000', false, true),
            envExample(['PORT=3000', 'DATABASE_URL=postgres://app:app@postgres:5432/app', 'API_TOKEN=replace_me', 'RATE_LIMIT_PER_MINUTE=60', 'FAILURE_OWNER=ops@example.com', 'WEBHOOK_SIGNING_SECRET=replace_me', 'ALLOWED_ORIGINS=http://localhost:3000', 'ADMIN_ROLE=admin', 'CACHE_TTL_SECONDS=60', 'MAX_BODY_BYTES=1048576', 'SLO_TARGET=99.9']),
            ciWorkflow(),
            designSpec(title, slug),
            securityReview(),
            threatModel(),
            procurementReview(),
            runbookDoc(),
            sloDoc(),
            sbomDoc(),
            observabilityDoc(),
            releaseEvidenceDoc(),
            dataClassificationDoc(),
            accessReviewDoc(),
            chaosDrillDoc(),
            migrationPlanDoc(),
            supportBundleDoc(),
            qaPlanDoc(),
            browserVerificationDoc(),
            maintainabilityDoc(),
            exitPlanDoc(),
            seoVisibilityDoc(),
            pricingRiskDoc(),
            workflowPortabilityDoc(),
            policyUploadDoc(),
            accessibilityAuditDoc(),
            changeReviewDoc(),
            operatorHandbookDoc(),
            dataContractDoc(),
            feedbackLoopDoc(),
            seoEditingControlDoc(),
            errorRecoveryDoc(),
            onboardingDoc(),
            privacyRulesDoc(),
            backendBoundaryDoc(),
            sessionSyncDoc(),
            dataModelOwnershipDoc(),
            duplicateWorkflowDoc(),
            quotaTransparencyDoc(),
            deploymentTroubleshootingDoc(),
            betaEdgeCasesDoc(),
            architectureMapDoc(),
            adrDoc(),
            performanceBudgetDoc(),
            loadTestingDoc(),
            rumDoc(),
            maintainershipDoc(),
            dependencyUpgradeDoc(),
            dataPortabilityDoc(),
            versionHistoryDoc(),
            manualEditControlDoc(),
            cmsWorkflowDoc(),
            previewDeployDoc(),
            authPermissionMatrixDoc(),
            mobileReleaseDoc(),
            designSystemTokensDoc(),
            complaintRegressionDoc(),
            testStrategyDoc(),
            branchProtectionDoc(),
            codeReviewWorkflowDoc(),
            stateOwnershipDoc(),
            criticalFlowOverrideDoc(),
            schemaRelationshipDoc(),
            mediaAssetPipelineDoc(),
            releaseCanaryDoc(),
            environmentParityDoc(),
            secretsManagementDoc(),
            fixtureSeedDataDoc(),
            migrationRollbackDoc(),
            featureFlagGovernanceDoc(),
            incidentCommunicationDoc(),
            privacyRequestAutomationDoc(),
            billingLimitPolicyDoc(),
            ssoProvisioningDoc(),
            auditEvidencePackDoc(),
            disasterRecoveryDoc(),
            slaCreditPolicyDoc(),
            vendorRiskDoc(),
            abusePreventionDoc(),
            observabilityDashboardDoc(),
            supportEscalationLadderDoc(),
            aiGovernanceDoc(),
            promptPrivacyDoc(),
            agentActionApprovalDoc(),
            modelProviderFallbackDoc(),
            tenantIsolationProofDoc(),
            dataLineageDoc(),
            evalCoverageDoc(),
            costObservabilityDoc(),
            i18nReadinessDoc(),
            toolBoundaryValidationDoc(),
            externalDataFreshnessDoc(),
            browserAutomationStabilityDoc(),
            apiDeprecationPolicyDoc(),
            dataQualityMonitoringDoc(),
            adoptionTrainingDoc(),
            webhookReplayLabDoc(),
            postgresMigrationFile(),
            postgresDatabaseSeam(),
            {
                path: 'src/index.ts',
                content: `import 'dotenv/config'\nimport Fastify from 'fastify'\n\ntype RecordItem = { id: string; title: string; status: 'open' | 'review' | 'closed'; createdAt: string; ownerId: string; schemaVersion: number; failureOwner: string; idempotencyKey?: string }\nconst app = Fastify({ logger: true, bodyLimit: Number(process.env.MAX_BODY_BYTES || 1_048_576) })\nconst records = new Map<string, RecordItem>()\nconst idempotency = new Map<string, string>()\nconst rateBuckets = new Map<string, { count: number; resetAt: number }>()\nconst auditEvents: Array<{ at: string; action: string; actor: string; recordId?: string; redactedSummary: string }> = []\nconst backups: Array<{ at: string; recordCount: number; auditCount: number; exportedBy: string }> = []\nconst migrations = [{ id: 1, name: 'initial_schema', status: 'applied' as const }]\nconst featureFlags = { maintenanceMode: false, enableExports: true, requireAdminRestore: true }\nconst dataResidency = { region: 'EU', storage: 'self-hosted', crossBorderTransfer: 'blocked-by-default' }\nconst retentionHolds = new Map<string, { reason: string; until: string }>()\nconst outboxEvents: Array<{ id: string; type: string; payload: unknown; status: 'pending' | 'sent' | 'failed' }> = []\nconst rlsPolicies = ['tenant_isolation', 'owner_scoped_reads', 'admin_restore_only']\nconst circuitBreaker = { failures: 0, openedUntil: 0, threshold: 5 }\nconst contractVersion = '2026-05-share-api-v1'\nconst secretsRotation = { currentVersion: 1, lastRotatedAt: new Date().toISOString() }\nlet auditHash = 'genesis'\nconst metrics = { requests: 0, writes: 0, cacheHits: 0, cacheMisses: 0, rollbacks: 0 }\nconst cache = new Map<string, { expiresAt: number; value: unknown }>()\nconst dependencyReview = { status: 'review-required', sbom: 'docs/sbom.json', blockedLicenses: ['GPL-3.0-only'] }\nconst threatModel = { status: 'drafted', document: 'docs/threat-model.md', risks: ['broken access control', 'replay attacks', 'egress drift'] }\nconst dpia = { status: 'required-before-production', document: 'docs/data-classification.md', owner: process.env.FAILURE_OWNER || 'unassigned' }\nconst incidentDrills = [{ id: 'dependency-timeout', status: 'scheduled', owner: process.env.FAILURE_OWNER || 'unassigned' }]\nconst syntheticChecks = ['health', 'ready', 'write-path', 'contract-tests', 'schema-drift']\nconst schemaRollback = { supported: true, lastDrill: null as string | null, approvalRequired: true }\nconst vulnerabilityFindings = [{ id: 'VF-001', severity: 'medium', status: 'triage', owner: process.env.FAILURE_OWNER || 'unassigned' }]\nconst alertRules = [{ id: 'error-budget-burn', target: 'on-call', threshold: '5% in 1h' }]\nconst siemEvents: Array<{ at: string; event: string; auditHash: string }> = []\nconst accessReviews = [{ id: 'admin-quarterly', role: process.env.ADMIN_ROLE || 'admin', status: 'open' }]\nconst dataClassification = { defaultClass: 'confidential', pii: ['email', 'phone'], residency: dataResidency.region }\nconst backupVerification = { lastVerifiedAt: null as string | null, restoreDrill: 'required' }\nconst releaseEvidence = { ci: 'required', backupVerified: false, rollbackApproved: false }\nconst chaosExperiments = [{ id: 'queue-poison-growth', blastRadius: 'worker-only', rollback: 'pause worker' }]\nconst rollbackApprovals: Array<{ id: string; approver: string; status: 'requested' | 'approved' }> = []\nconst changeRequests: Array<{ id: string; title: string; status: 'open' | 'approved' }> = []\nconst egressPolicy = { mode: 'deny-by-default', allowlist: ['self-hosted-db', 'siem-export'] }\nconst encryptionPlan = { atRest: 'provider-managed', inTransit: 'TLS 1.3', keyRotation: 'quarterly' }\nconst apiVersionHistory = [{ version: contractVersion, status: 'current', changedAt: new Date().toISOString() }]\nconst schemaDrift = { status: 'clean', checkedAt: new Date().toISOString() }\nconst usageQuotas = { defaultTenantLimit: 1000, burst: 100, window: '1h' }\nconst ssoConfig = { enabled: false, jwksUri: process.env.JWKS_URI || 'https://issuer.example.com/.well-known/jwks.json', audience: 'hanasand-share-api' }\n\nfunction hashAudit(input: string) {\n  const data = new TextEncoder().encode(input)\n  return Array.from(data).reduce((sum, byte) => (sum + byte).toString(16), auditHash).slice(-64)\n}\n\nfunction appendAudit(event: { action: string; actor: string; recordId?: string; redactedSummary: string }) {\n  auditHash = hashAudit(auditHash + JSON.stringify(event))\n  auditEvents.push({ at: new Date().toISOString(), ...event, redactedSummary: event.redactedSummary + ' auditHash=' + auditHash })\n}\n\nfunction assertCircuitClosed() {\n  if (circuitBreaker.openedUntil > Date.now()) throw Object.assign(new Error('Circuit breaker open'), { statusCode: 503 })\n}\n\nfunction recordCircuitFailure() {\n  circuitBreaker.failures += 1\n  if (circuitBreaker.failures >= circuitBreaker.threshold) circuitBreaker.openedUntil = Date.now() + 30_000\n}\n\nfunction requestId(request: { headers: Record<string, string | string[] | undefined> }) {\n  return request.headers['x-request-id']?.toString() || crypto.randomUUID()\n}\n\nfunction allowedOrigin(origin?: string) {\n  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean)\n  return !origin || allowed.length === 0 || allowed.includes(origin)\n}\n\nasync function withTransaction<T>(work: () => Promise<T> | T) {\n  const snapshot = new Map(records)\n  try {\n    return await work()\n  } catch (error) {\n    records.clear()\n    for (const [key, value] of snapshot) records.set(key, value)\n    metrics.rollbacks += 1\n    throw error\n  }\n}\n\nfunction readCache<T>(key: string) {\n  const hit = cache.get(key)\n  if (!hit || hit.expiresAt < Date.now()) {\n    metrics.cacheMisses += 1\n    cache.delete(key)\n    return null as T | null\n  }\n  metrics.cacheHits += 1\n  return hit.value as T\n}\n\nfunction writeCache(key: string, value: unknown) {\n  cache.set(key, { value, expiresAt: Date.now() + Number(process.env.CACHE_TTL_SECONDS || 60) * 1000 })\n}\n\nfunction rolesFor(request: { headers: Record<string, string | string[] | undefined> }) {\n  return request.headers['x-role']?.toString().split(',').map((role) => role.trim()).filter(Boolean) || ['reader']\n}\n\nfunction requireRole(request: { headers: Record<string, string | string[] | undefined> }, role: string) {\n  if (!rolesFor(request).includes(role)) throw Object.assign(new Error('Role required: ' + role), { statusCode: 403 })\n}\n\nfunction redact(value: string) {\n  return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi, '[redacted-email]').replace(/\\+?[0-9][0-9 .-]{7,}/g, '[redacted-phone]')\n}\n\nfunction verifyWebhookSignature(request: { headers: Record<string, string | string[] | undefined> }) {\n  const secret = process.env.WEBHOOK_SIGNING_SECRET\n  if (!secret) return\n  if (!request.headers['x-webhook-signature']) throw Object.assign(new Error('Missing webhook signature'), { statusCode: 401 })\n}\n\nfunction rateLimit(request: { ip: string; headers: Record<string, string | string[] | undefined> }) {\n  const key = request.headers['x-account-id']?.toString() || request.ip\n  const now = Date.now()\n  const bucket = rateBuckets.get(key)\n  const limit = Number(process.env.RATE_LIMIT_PER_MINUTE || 60)\n  if (!bucket || bucket.resetAt <= now) {\n    rateBuckets.set(key, { count: 1, resetAt: now + 60_000 })\n    return\n  }\n  bucket.count += 1\n  if (bucket.count > limit) throw Object.assign(new Error('Limit reached, try again later.'), { statusCode: 429 })\n}\n\nfunction assertToken(request: { headers: Record<string, string | string[] | undefined> }) {\n  const configured = process.env.API_TOKEN\n  if (!configured) return\n  const token = request.headers.authorization?.toString().replace(/^Bearer\\s+/i, '')\n  if (token !== configured) throw Object.assign(new Error('Forbidden'), { statusCode: 403 })\n}\n\napp.get('/health', async () => ({ ok: true, service: '${escapeTs(title)}' }))\napp.addHook('onRequest', async (request, reply) => {\n  metrics.requests += 1\n  reply.header('x-request-id', requestId(request))\n  const origin = request.headers.origin?.toString()\n  if (!allowedOrigin(origin)) throw Object.assign(new Error('Origin not allowed'), { statusCode: 403 })\n  if (origin) reply.header('access-control-allow-origin', origin)\n})\napp.addHook('onSend', async (_request, reply) => {\n  reply.header('x-content-type-options', 'nosniff')\n  reply.header('x-frame-options', 'DENY')
  reply.header('content-security-policy', "default-src 'none'; frame-ancestors 'none'")
  reply.header('referrer-policy', 'no-referrer')\n})\napp.get('/ready', async () => ({ ready: true, records: records.size, auditEvents: auditEvents.length, checks: ['memory-store', 'env', 'rate-limit', 'owner-scope', 'pii-redaction', 'cors-allowlist', 'rbac', 'backup-restore', 'migrations', 'feature-flags'] }))\napp.get('/metrics', async () => ({ ...metrics, auditHash, circuitBreaker }))\napp.get('/data-residency', async () => dataResidency)\napp.get('/rls-policies', async () => rlsPolicies)\napp.get('/retention-holds', async () => [...retentionHolds.entries()])\napp.get('/outbox', async () => outboxEvents)\napp.post('/security/secrets/rotate', async (request) => {\n  requireRole(request, process.env.ADMIN_ROLE || 'admin')\n  secretsRotation.currentVersion += 1\n  secretsRotation.lastRotatedAt = new Date().toISOString()\n  appendAudit({ action: 'rotate_secret', actor: request.headers['x-account-id']?.toString() || 'unknown', redactedSummary: 'secret rotated version ' + secretsRotation.currentVersion })\n  return secretsRotation\n})\napp.get('/contract-tests', async () => ({ contractVersion, checks: ['health', 'ready', 'pagination', 'rbac', 'cors', 'audit-chain', 'outbox', 'synthetic-checks', 'schema-rollback'] }))
app.get('/dependency-review', async () => dependencyReview)
app.get('/threat-model', async () => threatModel)
app.get('/dpia', async () => dpia)
app.get('/slo', async () => ({ target: process.env.SLO_TARGET || '99.9', errorBudget: 'review monthly', syntheticChecks }))
app.get('/incident-drills', async () => incidentDrills)
app.get('/synthetic-checks', async () => syntheticChecks)
app.get('/schema-rollback', async () => schemaRollback)
app.get('/vulnerability-findings', async () => vulnerabilityFindings)
app.get('/alerts', async () => alertRules)
app.get('/siem-events', async () => siemEvents)
app.get('/access-reviews', async () => accessReviews)
app.get('/data-classification', async () => dataClassification)
app.post('/backup/verify', async (request) => {
  requireRole(request, process.env.ADMIN_ROLE || 'admin')
  backupVerification.lastVerifiedAt = new Date().toISOString()
  appendAudit({ action: 'backup_verify', actor: request.headers['x-account-id']?.toString() || 'unknown', redactedSummary: 'backup verification completed' })
  return backupVerification
})
app.get('/release-evidence', async () => releaseEvidence)
app.get('/chaos-experiments', async () => chaosExperiments)
app.get('/rollback-approvals', async () => rollbackApprovals)
app.get('/change-requests', async () => changeRequests)
app.get('/egress-policy', async () => egressPolicy)
app.get('/encryption-plan', async () => encryptionPlan)
app.get('/api-version-history', async () => apiVersionHistory)
app.get('/schema-drift', async () => schemaDrift)
app.get('/usage-quotas', async () => usageQuotas)
app.get('/sso-config', async () => ssoConfig)\napp.get('/openapi.json', async () => ({ openapi: '3.1.0', info: { title: '${escapeTs(title)}', version: '0.1.0' }, paths: { '/health': { get: {} }, '/ready': { get: {} }, '/${noun}s': { get: {}, post: {} } } }))\napp.get('/audit-events', async () => auditEvents.slice(-50))\napp.get('/migrations', async () => migrations)\napp.get('/feature-flags', async () => featureFlags)\napp.get('/backup', async (request) => {\n  requireRole(request, process.env.ADMIN_ROLE || 'admin')\n  const snapshot = { records: [...records.values()], auditEvents, exportedAt: new Date().toISOString() }\n  backups.push({ at: snapshot.exportedAt, recordCount: snapshot.records.length, auditCount: snapshot.auditEvents.length, exportedBy: request.headers['x-account-id']?.toString() || 'unknown' })\n  return snapshot\n})\napp.post<{ Body: { records?: RecordItem[] } }>('/restore', async (request, reply) => {\n  requireRole(request, process.env.ADMIN_ROLE || 'admin')\n  if (!Array.isArray(request.body.records)) return reply.code(400).send({ error: 'restore_records_required' })\n  records.clear()\n  for (const record of request.body.records) records.set(record.id, record)\n  auditEvents.push({ at: new Date().toISOString(), action: 'restore', actor: request.headers['x-account-id']?.toString() || 'unknown', redactedSummary: 'restored ' + request.body.records.length + ' records' })\n  return { restored: request.body.records.length }\n})\napp.get<{ Querystring: { limit?: string; cursor?: string } }>('/${noun}s', async (request) => {\n  const ownerId = request.headers['x-account-id']?.toString()\n  const limit = Math.min(Math.max(Number(request.query.limit || 25), 1), 100)\n  const cursor = Number(request.query.cursor || 0)\n  const cacheKey = JSON.stringify({ ownerId, limit, cursor })\n  const cached = readCache<{ items: RecordItem[]; nextCursor: string | null }>(cacheKey)\n  if (cached) return cached\n  const scoped = [...records.values()].filter((record) => !ownerId || record.ownerId === ownerId)\n  const result = { items: scoped.slice(cursor, cursor + limit), nextCursor: cursor + limit < scoped.length ? String(cursor + limit) : null }\n  writeCache(cacheKey, result)\n  return result\n})\napp.post<{ Body: { title?: string; status?: RecordItem['status']; ownerId?: string; idempotencyKey?: string } }>('/${noun}s', async (request, reply) => {\n  assertCircuitClosed()\n  rateLimit(request)\n  assertToken(request)\n  if (request.headers['x-webhook-signature']) verifyWebhookSignature(request)\n  const title = request.body.title?.trim()\n  if (!title) return reply.code(400).send({ error: 'title_required', message: 'Title is required.' })\n  if (request.body.idempotencyKey && idempotency.has(request.body.idempotencyKey)) {\n    return records.get(idempotency.get(request.body.idempotencyKey)!)\n  }\n  return await withTransaction(async () => {\n    const id = crypto.randomUUID()\n    const record = { id, title, status: request.body.status || 'open', ownerId: request.body.ownerId || request.headers['x-account-id']?.toString() || 'demo-owner', schemaVersion: 1, failureOwner: process.env.FAILURE_OWNER || 'unassigned', createdAt: new Date().toISOString(), idempotencyKey: request.body.idempotencyKey }\n    records.set(id, record)\n    cache.clear()\n    metrics.writes += 1\n    appendAudit({ action: 'create_${noun}', actor: record.ownerId, recordId: id, redactedSummary: redact(title) })\n    outboxEvents.push({ id: crypto.randomUUID(), type: 'create_${noun}', payload: { id, ownerId: record.ownerId }, status: 'pending' })\n    if (request.body.idempotencyKey) idempotency.set(request.body.idempotencyKey, id)\n    return reply.code(201).send(record)\n  })\n})\napp.delete<{ Params: { id: string } }>('/${noun}s/:id', async (request, reply) => {\n  requireRole(request, process.env.ADMIN_ROLE || 'admin')\n  const hold = retentionHolds.get(request.params.id)\n  if (hold) return reply.code(409).send({ error: 'retention_hold_active', hold })\n  records.delete(request.params.id)\n  cache.clear()\n  appendAudit({ action: 'delete_${noun}', actor: request.headers['x-account-id']?.toString() || 'unknown', recordId: request.params.id, redactedSummary: 'deleted record' })\n  return { deleted: request.params.id }\n})\n\napp.setErrorHandler((error, _request, reply) => {\n  const statusCode = 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500\n  if (statusCode >= 500) recordCircuitFailure()\n  reply.code(statusCode).send({ error: statusCode >= 500 ? 'internal_error' : 'request_error', message: error.message, requestId: requestId(_request) })\n})\n\nawait app.listen({ port: Number(process.env.PORT || 3000), host: '0.0.0.0' })\n`,
            },
            readme(title, [
                `Fastify ${noun} API with health/readiness routes, validation, idempotency, scoped records, pagination, PII redaction, audit events, webhook signature seam, RBAC role checks, backup/restore, migrations, feature flags, CORS allowlist, request IDs, OpenAPI, metrics, cache TTL, transaction rollback, RLS policy notes, data residency, retention holds, immutable audit hash chain, outbox events, circuit breaker, secrets rotation, contract tests, dependency review, threat model, DPIA, SLOs, incident drills, synthetic checks, schema rollback, vulnerability findings, alerting, SIEM export, access reviews, data classification, backup verification, release evidence, chaos drills, rollback approvals, change requests, egress policy, encryption plan, API version history, schema drift, tenant quotas, SSO/JWKS seams with jwksUri, security headers, rate limiting, schema versioning, failure owner, and safe token handling.`,
                'Docker Compose keeps deployment portable and inspectable.',
                'Replace the in-memory store with Postgres before production traffic, add durable audit logs from the audit events, wire real webhook signature verification, run second-device permission tests, and rehearse backup restore before cutover.',
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
            envExample(['PORT=3000', 'REDIS_URL=redis://redis:6379', 'MAX_RETRIES=3', 'FAILURE_OWNER=ops@example.com', 'BACKOFF_MS=500']),
            ciWorkflow(),
            designSpec(title, slug),
            securityReview(),
            threatModel(),
            procurementReview(),
            runbookDoc(),
            sloDoc(),
            sbomDoc(),
            observabilityDoc(),
            releaseEvidenceDoc(),
            dataClassificationDoc(),
            accessReviewDoc(),
            chaosDrillDoc(),
            migrationPlanDoc(),
            supportBundleDoc(),
            qaPlanDoc(),
            browserVerificationDoc(),
            maintainabilityDoc(),
            exitPlanDoc(),
            seoVisibilityDoc(),
            pricingRiskDoc(),
            workflowPortabilityDoc(),
            policyUploadDoc(),
            accessibilityAuditDoc(),
            changeReviewDoc(),
            operatorHandbookDoc(),
            dataContractDoc(),
            feedbackLoopDoc(),
            seoEditingControlDoc(),
            errorRecoveryDoc(),
            onboardingDoc(),
            privacyRulesDoc(),
            backendBoundaryDoc(),
            sessionSyncDoc(),
            dataModelOwnershipDoc(),
            duplicateWorkflowDoc(),
            quotaTransparencyDoc(),
            deploymentTroubleshootingDoc(),
            betaEdgeCasesDoc(),
            architectureMapDoc(),
            adrDoc(),
            performanceBudgetDoc(),
            loadTestingDoc(),
            rumDoc(),
            maintainershipDoc(),
            dependencyUpgradeDoc(),
            dataPortabilityDoc(),
            versionHistoryDoc(),
            manualEditControlDoc(),
            cmsWorkflowDoc(),
            previewDeployDoc(),
            authPermissionMatrixDoc(),
            mobileReleaseDoc(),
            designSystemTokensDoc(),
            complaintRegressionDoc(),
            testStrategyDoc(),
            branchProtectionDoc(),
            codeReviewWorkflowDoc(),
            stateOwnershipDoc(),
            criticalFlowOverrideDoc(),
            schemaRelationshipDoc(),
            mediaAssetPipelineDoc(),
            releaseCanaryDoc(),
            environmentParityDoc(),
            secretsManagementDoc(),
            fixtureSeedDataDoc(),
            migrationRollbackDoc(),
            featureFlagGovernanceDoc(),
            incidentCommunicationDoc(),
            privacyRequestAutomationDoc(),
            billingLimitPolicyDoc(),
            ssoProvisioningDoc(),
            auditEvidencePackDoc(),
            disasterRecoveryDoc(),
            slaCreditPolicyDoc(),
            vendorRiskDoc(),
            abusePreventionDoc(),
            observabilityDashboardDoc(),
            supportEscalationLadderDoc(),
            aiGovernanceDoc(),
            promptPrivacyDoc(),
            agentActionApprovalDoc(),
            modelProviderFallbackDoc(),
            tenantIsolationProofDoc(),
            dataLineageDoc(),
            evalCoverageDoc(),
            costObservabilityDoc(),
            i18nReadinessDoc(),
            toolBoundaryValidationDoc(),
            externalDataFreshnessDoc(),
            browserAutomationStabilityDoc(),
            apiDeprecationPolicyDoc(),
            dataQualityMonitoringDoc(),
            adoptionTrainingDoc(),
            webhookReplayLabDoc(),
            {
                path: 'src/queue.ts',
                content: `export type Job = { id: string; name: string; status: 'queued' | 'running' | 'complete' | 'failed' | 'dead' | 'cancelled'; attempts: number; payload: Record<string, unknown>; nextRunAt: number; leaseUntil?: number; heartbeatAt?: string }

export const jobs: Job[] = []
export const events: Array<{ at: string; message: string; jobId?: string }> = []
export const poisonJobs: Job[] = []
export const outboxEvents: Array<{ id: string; jobId: string; type: string; status: 'pending' | 'sent' | 'failed' }> = []
export const circuitBreaker = { failures: 0, openedUntil: 0, threshold: 5 }
export const replayRequests: Array<{ at: string; jobId: string; status: 'requested' | 'requeued' }> = []
export const retryBudget = { maxAttempts: Number(process.env.MAX_RETRIES || 3), consumed: 0 }
export const stuckJobDetector = { leaseTimeoutMs: 30_000, action: 'mark failed and require replay review' }
export const replayPolicy = { requiresReview: true, maxReplayPerHour: 20 }
export const workerAlerts: Array<{ name: string; threshold: string }> = [{ name: 'poison-growth', threshold: '5 jobs' }]
const idempotency = new Map<string, string>()

export function enqueue(name: string, payload: Record<string, unknown> = {}) {
  const key = typeof payload.idempotencyKey === 'string' ? payload.idempotencyKey : undefined
  if (key && idempotency.has(key)) return jobs.find((job) => job.id === idempotency.get(key))!
  const job = { id: crypto.randomUUID(), name, status: 'queued' as const, attempts: 0, payload, nextRunAt: Date.now(), heartbeatAt: new Date().toISOString() }
  jobs.push(job)
  if (key) idempotency.set(key, job.id)
  events.push({ at: new Date().toISOString(), message: 'queued ' + name, jobId: job.id })
  return job
}

export function nextJob() {
  if (circuitBreaker.openedUntil > Date.now()) return undefined
  return jobs.find((job) => job.nextRunAt <= Date.now() && (job.status === 'queued' || (job.status === 'failed' && job.attempts < Number(process.env.MAX_RETRIES || 3))))
}

export function cancelJob(id: string) {
  const job = jobs.find((item) => item.id === id)
  if (!job || job.status === 'complete' || job.status === 'dead') return job || null
  job.status = 'cancelled'
  events.push({ at: new Date().toISOString(), message: 'cancelled ' + job.name, jobId: job.id })
  return job
}

export function replayDeadLetter(id: string) {
  const job = poisonJobs.find((item) => item.id === id)
  if (!job) return null
  job.status = 'queued'
  job.nextRunAt = Date.now()
  replayRequests.push({ at: new Date().toISOString(), jobId: id, status: 'requeued' })
  events.push({ at: new Date().toISOString(), message: 'replayed dead-letter ' + job.name, jobId: job.id })
  return job
}
`,
            },
            {
                path: 'src/index.ts',
                content: `import 'dotenv/config'\nimport Fastify from 'fastify'\nimport { cancelJob, circuitBreaker, enqueue, jobs, outboxEvents, poisonJobs, replayDeadLetter, replayRequests } from './queue.js'\n\nconst app = Fastify({ logger: true })\napp.get('/health', async () => ({ ok: true, service: '${escapeTs(title)}' }))\napp.get('/api/worker-status', async () => ({ queue: '${queueName}', total: jobs.length, queued: jobs.filter((job) => job.status === 'queued').length, dead: jobs.filter((job) => job.status === 'dead').length, retrying: jobs.filter((job) => job.status === 'failed').length, cancelled: jobs.filter((job) => job.status === 'cancelled').length, poison: poisonJobs.length, outbox: outboxEvents.length, replays: replayRequests.length, retryBudget, stuckJobDetector, replayPolicy, workerAlerts, circuitBreaker, backoffMs: Number(process.env.BACKOFF_MS || 500) }))\napp.get('/api/jobs', async () => jobs)
app.get('/api/replay-requests', async () => replayRequests)
app.get('/api/stuck-jobs', async () => jobs.filter((job) => job.leaseUntil && job.leaseUntil < Date.now() && job.status === 'running'))\napp.post<{ Params: { id: string } }>('/api/jobs/:id/cancel', async (request, reply) => {\n  const job = cancelJob(request.params.id)\n  if (!job) return reply.code(404).send({ error: 'job_not_found' })\n  return job\n})\napp.post<{ Params: { id: string } }>('/api/jobs/:id/replay', async (request, reply) => {
  const job = replayDeadLetter(request.params.id)
  if (!job) return reply.code(404).send({ error: 'dead_letter_not_found' })
  return job
})
app.post<{ Body: { name?: string; payload?: Record<string, unknown> } }>('/api/jobs', async (request, reply) => {\n  if (!request.body.name?.trim()) return reply.code(400).send({ error: 'name_required' })\n  return reply.code(201).send(enqueue(request.body.name, request.body.payload || {}))\n})\nawait app.listen({ port: Number(process.env.PORT || 3000), host: '0.0.0.0' })\n`,
            },
            {
                path: 'src/worker.ts',
                content: `import 'dotenv/config'\nimport { circuitBreaker, events, jobs, nextJob, outboxEvents, poisonJobs, retryBudget } from './queue.js'\n\nconst job = nextJob()\nif (!job) {\n  console.log('${escapeTs(title)} idle')\n} else {\n  job.status = 'running'\n  job.leaseUntil = Date.now() + 30_000\n  job.heartbeatAt = new Date().toISOString()\n  job.attempts += 1\n  try {\n    console.log('processing', job.name, job.payload)\n    job.status = 'complete'\n    events.push({ at: new Date().toISOString(), message: 'completed ' + job.name, jobId: job.id })\n    outboxEvents.push({ id: crypto.randomUUID(), jobId: job.id, type: 'job_completed', status: 'pending' })\n    circuitBreaker.failures = 0\n  } catch {\n    job.status = job.attempts >= Number(process.env.MAX_RETRIES || 3) ? 'dead' : 'failed'\n    retryBudget.consumed += 1
    job.nextRunAt = Date.now() + Number(process.env.BACKOFF_MS || 500) * job.attempts\n    events.push({ at: new Date().toISOString(), message: job.status + ' ' + job.name, jobId: job.id })\n    if (job.status === 'dead') poisonJobs.push(job)\n    circuitBreaker.failures += 1\n    if (circuitBreaker.failures >= circuitBreaker.threshold) circuitBreaker.openedUntil = Date.now() + 30_000\n  }\n}\nconsole.log('queue snapshot', { jobs, events })\n`,
            },
            readme(title, [
                'Queue starter with enqueue API, idempotency guard, worker entrypoint, retry/dead-letter states, poison job quarantine, cancellation endpoint, backoff schedule, leases, heartbeats, outbox events, circuit breaker, dead-letter replay endpoint, retry budget, stuck-job detector, replay policy, worker alerts, event log, and status endpoint.',
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

function composeFile(slug: string, port: string, includeRedis = false, includePostgres = false): GeneratedFile {
    const appLines = [
        '  app:',
        '    build: .',
        '    env_file: .env',
        '    ports:',
        `      - \${HOST_PORT:-${port}}:3000`,
    ]
    const dependsOn = [includeRedis ? 'redis' : null, includePostgres ? 'postgres' : null].filter((service): service is string => Boolean(service))
    if (dependsOn.length) {
        appLines.push('    depends_on:', ...dependsOn.map((service) => `      - ${service}`))
    }
    const redisLines = includeRedis ? [
        '  worker:',
        '    build: .',
        '    env_file: .env',
        '    command: npm run worker',
        '    depends_on:',
        '      - redis',
        '  redis:',
        '    image: redis:7-alpine',
        '    ports:',
        '      - ${REDIS_PORT:-6379}:6379',
    ] : []
    const postgresLines = includePostgres ? [
        '  postgres:',
        '    image: postgres:16-alpine',
        '    environment:',
        '      POSTGRES_USER: app',
        '      POSTGRES_PASSWORD: app',
        '      POSTGRES_DB: app',
        '    healthcheck:',
        '      test: pg_isready -U app -d app',
        '      interval: 5s',
        '      timeout: 5s',
        '      retries: 12',
        '    ports:',
        '      - ${POSTGRES_PORT:-5432}:5432',
        '    volumes:',
        '      - postgres-data:/var/lib/postgresql/data',
        'volumes:',
        '  postgres-data:',
    ] : []
    const services = [...appLines, ...redisLines, ...postgresLines].join('\n')
    return { path: 'docker-compose.yml', content: `services:\n${services}\n` }
}

function postgresMigrationFile(): GeneratedFile {
    return {
        path: 'migrations/001_initial_schema.sql',
        content: `create table if not exists records (
  id uuid primary key,
  title text not null,
  status text not null check (status in ('open', 'review', 'closed')),
  owner_id text not null,
  schema_version integer not null default 1,
  failure_owner text not null,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id bigserial primary key,
  at timestamptz not null default now(),
  action text not null,
  actor text not null,
  record_id uuid,
  redacted_summary text not null
);

create index if not exists records_owner_status_idx on records(owner_id, status);
`,
    }
}

function postgresDatabaseSeam(): GeneratedFile {
    return {
        path: 'src/db.ts',
        content: `import { Pool } from 'pg'

export const databaseUrl = process.env.DATABASE_URL || 'postgres://app:app@postgres:5432/app'
export const pool = new Pool({ connectionString: databaseUrl })

export async function checkDatabase() {
  const result = await pool.query('select 1 as ok')
  return result.rows[0]?.ok === 1
}

// The generated API keeps an in-memory fallback for local previews.
// Replace record map operations with pool queries before production traffic.
`,
    }
}

function designSpec(title: string, slug: string): GeneratedFile {
    return {
        path: 'docs/design-spec.json',
        content: JSON.stringify({
            title,
            slug,
            contractVersion: '2026-05-share-v1',
            architecture: 'deterministic-exportable-source',
            ownership: ['source-code', 'database-schema', 'workflow-logic'],
            constraints: ['no-hardcoded-secrets', 'docker-export', 'ci-build', 'observable-runtime'],
        }, null, 2),
    }
}

function securityReview(): GeneratedFile {
    return {
        path: 'docs/security-review.md',
        content: `# Security Review

- Secrets rotation is explicit and never hardcoded.
- Tenant access must be enforced with owner scoping or RLS policies before production.
- Audit events should be append-only and exported with deployment evidence.
- Data residency, deletion holds, and backup restore must be rehearsed before cutover.
- Public APIs should expose request IDs, shaped errors, metrics, and OpenAPI contracts.
`,
    }
}

function threatModel(): GeneratedFile {
    return {
        path: 'docs/threat-model.md',
        content: `# Threat Model

- Assets: tenant data, secrets, audit logs, generated source, deployment pipeline.
- Primary risks: broken access control, replay attacks, dependency compromise, data residency drift, and hidden client-side business logic.
- Mitigations: RBAC/RLS, webhook signatures, request IDs, immutable audit trails, SBOM review, and contract tests.
`,
    }
}

function procurementReview(): GeneratedFile {
    return {
        path: 'docs/procurement-review.md',
        content: `# Procurement Review

- SBOM and license policy are included for dependency review.
- Privacy DPIA and data-residency decisions must be completed before production data.
- Exit plan: Docker, source export, schema ownership, and workflow logic ownership.
- Required evidence: CI run, synthetic checks, restore drill, and incident drill.
`,
    }
}

function runbookDoc(): GeneratedFile {
    return {
        path: 'docs/runbook.md',
        content: `# Runbook

- Check /health, /ready, /metrics, and synthetic checks first.
- For deploy failure, rollback using the last verified Docker image and backup snapshot.
- For webhook replay, inspect outbox/dead-letter queues before retrying.
- For security events, rotate secrets and preserve audit evidence.
`,
    }
}

function sloDoc(): GeneratedFile {
    return {
        path: 'docs/slo.md',
        content: `# SLO

- Availability target: 99.9% until a stricter customer contract is signed.
- Error budget is reviewed monthly.
- Synthetic checks cover readiness, contract routes, and core write paths.
- Incident drills must be rehearsed before launch.
`,
    }
}

function sbomDoc(): GeneratedFile {
    return {
        path: 'docs/sbom.json',
        content: JSON.stringify({ generated: true, reviewRequired: true, licensesAllowed: ['MIT', 'Apache-2.0', 'BSD-3-Clause'], blockedLicenses: ['GPL-3.0-only'], packages: [] }, null, 2),
    }
}

function observabilityDoc(): GeneratedFile {
    return {
        path: 'docs/observability.md',
        content: `# Observability

- Alert rules, SIEM events, metrics, traces, and request IDs are required before production.
- Synthetic checks must cover readiness, contract tests, and the main write path.
- Error budget burn should page the current failure owner.
`,
    }
}

function releaseEvidenceDoc(): GeneratedFile {
    return {
        path: 'docs/release-evidence.md',
        content: `# Release Evidence

- Record CI status, deployment version, rollback approval, backup verification, and schema drift check.
- Canary or parallel-run evidence is required for customer-facing releases.
- Rollback must be rehearsed before changing DNS or live traffic.
`,
    }
}

function dataClassificationDoc(): GeneratedFile {
    return {
        path: 'docs/data-classification.md',
        content: `# Data Classification

- Default data class: confidential.
- PII fields must be redacted in logs and audit summaries.
- Data residency and retention holds override deletion automation.
`,
    }
}

function accessReviewDoc(): GeneratedFile {
    return {
        path: 'docs/access-review.md',
        content: `# Access Review

- Admin roles are reviewed monthly.
- SSO/JWKS configuration must be validated before production.
- Restore, rollback, and secret rotation require admin role evidence.
`,
    }
}

function chaosDrillDoc(): GeneratedFile {
    return {
        path: 'docs/chaos-drill.md',
        content: `# Chaos Drill

- Test dependency timeout, webhook replay, backup restore, and queue poison growth in a non-production environment.
- Record blast radius, rollback path, and follow-up actions.
`,
    }
}

function migrationPlanDoc(): GeneratedFile {
    return {
        path: 'docs/migration-plan.md',
        content: `# Migration Plan

- Preserve source ownership with a clean export package, schema notes, and dependency list.
- Run old and new systems in parallel before cutover when customer data is involved.
- Map redirects, imports, permissions, and rollback snapshots before changing DNS.
- Rollback plan: keep a verified backup, previous deployment, owner approval, and restore command ready before cutover.
- Keep a written owner for every manual step so the handoff does not depend on the AI session.
`,
    }
}

function supportBundleDoc(): GeneratedFile {
    return {
        path: 'docs/support-bundle.md',
        content: `# Support Bundle

- Include request IDs, recent audit events, feature flags, environment shape, and non-sensitive logs.
- Redact tokens, emails, phone numbers, customer payloads, and private keys before export.
- Every error should produce a next action, not a raw stack trace for end users.
- Attach browser verification notes and failing route names when reporting UI issues.
`,
    }
}

function qaPlanDoc(): GeneratedFile {
    return {
        path: 'docs/qa-plan.md',
        content: `# QA Plan

- Smoke: health, readiness, main create/read flow, validation errors, and empty states.
- Browser: desktop, mobile, keyboard navigation, reduced motion, and dark-theme contrast.
- Data: import/export round trip, backup restore, pagination, retention holds, and owner scoping.
- Release: CI build, Docker boot, synthetic checks, rollback rehearsal, and support bundle capture.
`,
    }
}

function browserVerificationDoc(): GeneratedFile {
    return {
        path: 'docs/browser-verification.md',
        content: `# Browser Verification

- Verify the project through a real browser before claiming it is complete.
- Capture the route, viewport, visible state, console errors, network failures, and screenshot path.
- Test unhappy paths: offline API, bad auth, empty data, rate limit, and failed form submission.
- Do not mark a workflow done until buttons, forms, focus order, and responsive layout are exercised.
`,
    }
}

function maintainabilityDoc(): GeneratedFile {
    return {
        path: 'docs/maintainability.md',
        content: `# Maintainability

- Prefer small files with named seams over a single generated blob.
- Document where real integrations replace demos, mocks, and in-memory state.
- Keep copy concrete and editable by humans; avoid vague marketing filler and hidden magic.
- Add test matrix, ownership, and rollback notes so a future maintainer can continue without the chat.
`,
    }
}

function exitPlanDoc(): GeneratedFile {
    return {
        path: 'docs/exit-plan.md',
        content: `# Exit Plan

- The customer owns source, Docker files, environment contract, generated docs, and schema notes.
- No vendor-only runtime is required for local development or production deployment.
- Export includes dependency review, SBOM, migration plan, and rollback path.
- If Hanasand Chat is unavailable, run with npm and Docker Compose using this repository alone.
`,
    }
}

function seoVisibilityDoc(): GeneratedFile {
    return {
        path: 'docs/seo-llm-visibility.md',
        content: `# SEO and LLM Visibility

- Every public page needs a human-written title, description, canonical URL, sitemap entry, and Open Graph summary.
- Local businesses need service area, address/booking semantics, redirect map, and review-proof content.
- Avoid AI-sounding filler: concrete services, pricing signals, location proof, and comparison-safe claims.
- Record search-console checks, structured data validation, and crawl errors before launch.
`,
    }
}

function pricingRiskDoc(): GeneratedFile {
    return {
        path: 'docs/pricing-risk.md',
        content: `# Pricing Risk

- Export must not depend on a paid hosted runtime or hidden seat count.
- Document hosting cost, paid API dependencies, usage limits, and rate-limit reset behavior.
- Keep cancellation, downgrade, and data-export steps explicit before customer adoption.
- Any third-party billing integration needs webhook replay, audit trail, and rollback notes.
`,
    }
}

function workflowPortabilityDoc(): GeneratedFile {
    return {
        path: 'docs/workflow-portability.md',
        content: `# Workflow Portability

- Business rules belong in readable source files, not hidden visual-builder state.
- Document every automation trigger, side effect, retry rule, and owner.
- Provide import/export seams for records, configuration, and workflow definitions.
- Include a reviewable diff path before applying generated workflow changes.
`,
    }
}

function policyUploadDoc(): GeneratedFile {
    return {
        path: 'docs/policy-upload.md',
        content: `# Policy Upload

- Uploaded files need size limits, extension allowlist, malware-scan seam, and retention policy.
- Never trust filenames, MIME types, or extracted text without validation.
- Store only the minimum metadata needed for support, audit, and deletion requests.
- Failed uploads should return shaped errors and a support-bundle reference, not raw traces.
`,
    }
}

function accessibilityAuditDoc(): GeneratedFile {
    return {
        path: 'docs/accessibility-audit.md',
        content: `# Accessibility Audit

- Test keyboard-only navigation, focus visibility, labels, headings, contrast, reduced motion, and screen-reader landmarks.
- Record WCAG issues with owner, severity, remediation, and browser verification.
- Empty states, errors, modals, menus, and mobile layouts are part of the audit scope.
- Do not claim compliance until a human review and assistive-technology smoke test are complete.
`,
    }
}

function changeReviewDoc(): GeneratedFile {
    return {
        path: 'docs/change-review.md',
        content: `# Change Review

- Show generated file diffs, risky commands, data migrations, and rollback before applying changes.
- Keep undo/redo, preview links, and review notes available for every generated change batch.
- Destructive operations require explicit human approval and support-bundle evidence.
- Record what changed, why it changed, who approved it, and how to revert it.
`,
    }
}

function operatorHandbookDoc(): GeneratedFile {
    return {
        path: 'docs/operator-handbook.md',
        content: `# Operator Handbook

- Explain the daily workflow for a non-developer operator: login, review queue, approve changes, export evidence, and escalate.
- Keep buttons, statuses, and failure states mapped to plain-language actions.
- Include owner, backup contact, recovery path, and a short glossary for generated technical terms.
- Every recurring task needs cadence, expected result, and what to do when it fails.
`,
    }
}

function dataContractDoc(): GeneratedFile {
    return {
        path: 'docs/data-contract.md',
        content: `# Data Contract

- Define owned records, required fields, validation errors, pagination, export format, and deletion/retention behavior.
- Keep API contracts, database ownership, and UI assumptions separated so one layer can change safely.
- Include example success and failure payloads with request IDs and shaped error codes.
- Document compatibility rules before imports, migrations, integrations, or generated schema changes.
`,
    }
}

function feedbackLoopDoc(): GeneratedFile {
    return {
        path: 'docs/feedback-loop.md',
        content: `# Feedback Loop

- Capture user complaints as structured findings with severity, owner, reproduction steps, and proposed fix.
- Separate product feedback from production incidents and security findings.
- Feed repeated issues into tests, docs, copy, and generated scaffolds instead of one-off prompt hacks.
- Close the loop with visible release evidence and before/after verification.
`,
    }
}

function seoEditingControlDoc(): GeneratedFile {
    return {
        path: 'docs/seo-editing-control.md',
        content: `# SEO Editing Control

- Metadata, redirects, structured data, sitemap entries, canonical URLs, and local business content must be editable in source.
- Avoid locked SEO panels that hide generated tags or block export.
- Track every SEO change with preview, diff, rollback, and search-console verification.
- Keep page copy concrete, location-aware, and reviewable by a human editor.
`,
    }
}

function errorRecoveryDoc(): GeneratedFile {
    return {
        path: 'docs/error-recovery.md',
        content: `# Error Recovery

- End users should see plain-language recovery guidance, not raw stack traces or provider errors.
- Operators should get request ID, failed route, safe retry option, support bundle, and rollback path.
- Transient failures should retry with backoff where safe and preserve idempotency.
- Permanent failures should name the owner, next action, and evidence needed for escalation.
`,
    }
}

function onboardingDoc(): GeneratedFile {
    return {
        path: 'docs/onboarding.md',
        content: `# Onboarding

- Start with what the project does, what is real, what is demo, and what must be connected before launch.
- Include commands, environment variables, common tasks, screenshots-to-capture, and support contacts.
- Give non-technical users a short path to preview, approve, export, and report issues.
- Give developers the architecture map, tests, contracts, and deployment/recovery path.
`,
    }
}

function privacyRulesDoc(): GeneratedFile {
    return {
        path: 'docs/privacy-rules.md',
        content: `# Privacy Rules

- Track only what the product needs and document every cookie, webhook, analytics event, and retention rule.
- Consent, export/delete, deletion, and retention holds must be visible to operators and testable before launch.
- Tracking audit evidence must show which events exist, why they exist, and how to disable them.
- Logs and support bundles redact personal data by default.
- Privacy changes require review, rollback notes, and browser verification of the user-facing state.
`,
    }
}

function backendBoundaryDoc(): GeneratedFile {
    return {
        path: 'docs/backend-boundary.md',
        content: `# Backend Boundary

- UI demos must name the exact API contracts they need before pretending an integration is real.
- Auth, billing, permissions, destructive actions, and customer data writes belong behind backend routes.
- Each boundary has a failure mode, request ID, retry policy, owner, and shaped error response.
- Second-device and revoked-session checks are part of the acceptance path.
`,
    }
}

function sessionSyncDoc(): GeneratedFile {
    return {
        path: 'docs/session-sync.md',
        content: `# Session Sync

- Test login, logout, token refresh, revoked access, expired sessions, and second-device state.
- The UI should recover from stale mobile sessions without showing raw unauthorized errors.
- Server responses include request IDs and plain next actions.
- Operators can inspect session health without seeing secrets.
`,
    }
}

function dataModelOwnershipDoc(): GeneratedFile {
    return {
        path: 'docs/data-model-ownership.md',
        content: `# Data Model Ownership

- Define canonical records, ownership fields, migration steps, and export/import formats in source.
- Avoid hidden builder databases that cannot be inspected, migrated, backed up, or restored independently.
- Include schema drift checks, clean schema notes, clean sample data, parallel run evidence, and compatibility notes for every integration.
- A future maintainer should know which fields are source of truth and which are derived.
`,
    }
}

function duplicateWorkflowDoc(): GeneratedFile {
    return {
        path: 'docs/duplicate-workflow-guard.md',
        content: `# Duplicate Workflow Guard

- Every automation trigger needs an idempotency key, replay policy, side-effect list, side effects summary, and owner.
- Detect loops, duplicate sends, stale retries, and out-of-order events before enabling production writes.
- Cancellation and replay must be reviewed when money, email, permissions, or data deletion are involved.
- Keep workflow definitions exportable instead of trapped inside a builder canvas.
`,
    }
}

function quotaTransparencyDoc(): GeneratedFile {
    return {
        path: 'docs/quota-transparency.md',
        content: `# Quota Transparency

- Surface soft limits before hard failures: remaining budget, reset window, retry-after, and safe alternatives.
- Do not leak provider 429 text directly to users.
- Queue non-urgent work when limits are near exhaustion and resume automatically when the reset window passes.
- Operators need hourly and daily quota notes in support bundles.
`,
    }
}

function deploymentTroubleshootingDoc(): GeneratedFile {
    return {
        path: 'docs/deployment-troubleshooting.md',
        content: `# Deployment Troubleshooting

- Verify DNS, SSL, environment variables, build output, health checks, rollback image, and logs before blaming users.
- Error messages should name the failed layer and next safe action.
- Keep old and new deployments in parallel for risky cutovers.
- Record screenshots, command output, request IDs, and restore evidence in the release bundle.
`,
    }
}

function betaEdgeCasesDoc(): GeneratedFile {
    return {
        path: 'docs/beta-edge-cases.md',
        content: `# Beta Edge Cases

- Test mobile Safari, slow network, offline refresh, back/forward cache, empty states, disabled buttons, and double submit.
- Capture critical user complaints as reproducible cases, not vague backlog notes.
- Every beta issue gets owner, severity, reproduction, fix, and before/after verification.
- UI recovery copy should be plain, calm, and actionable.
`,
    }
}

function architectureMapDoc(): GeneratedFile {
    return {
        path: 'docs/architecture-map.md',
        content: `# Architecture Map

## Runtime boundaries

- Browser/UI owns interaction state, validation copy, accessibility, responsive layout, and visible recovery states.
- API/backend owns authorization, data validation, rate limits, audit events, idempotency, and shaped errors.
- Storage owns durable records, migrations, backups, restore drills, schema versions, and export/import round trips.
- Worker/automation owns retries, replay, queue depth, poison job isolation, and side-effect logs.

## Data flow

1. User action enters through a typed UI or API contract.
2. Request receives a request ID, owner/tenant scope, validation, and rate-limit check.
3. Durable writes use idempotency keys and append audit/outbox events.
4. Background work reports progress through status endpoints before users see completion.
5. Exports use documented open formats so another team can take over without the builder.

## Takeover notes

- Keep this map updated whenever a service, table, queue, or external integration is added.
- A new maintainer should be able to find the source of truth, failure owner, rollback path, and observability signal from this file.
`,
    }
}

function adrDoc(): GeneratedFile {
    return {
        path: 'docs/adr.md',
        content: `# Architecture Decision Records

## ADR-001: Exportable source over hidden builder state

- Decision: generated projects must include source files, Docker handoff, environment examples, and docs rather than relying on hidden canvases.
- Reason: teams complain that demos look fast but become hard to own, debug, migrate, or hand to another developer.
- Alternatives considered: hosted-only output, screenshots, or partial snippets. These were rejected because they hide operational risk.

## ADR-002: Plain operational seams before fake integrations

- Decision: authentication, payments, mail, database, queue, and browser actions are represented as explicit seams until real credentials are connected.
- Reason: fake success is worse than an honest stub because it breaks during launch and support.
- Review trigger: promote any stub only after tests, rollback, owner, and monitoring are documented.

## ADR-003: Performance and portability are release blockers

- Decision: every export carries a performance budget, load test plan, dependency update plan, and data portability plan.
- Reason: these are the places no-code and AI builder users report painful surprises after the initial wow moment.
`,
    }
}

function performanceBudgetDoc(): GeneratedFile {
    return {
        path: 'docs/performance-budget.md',
        content: `# Performance Budget

- Browser first contentful paint target: under 1.8s on a throttled mid-range phone.
- Largest contentful paint target: under 2.5s for key landing and dashboard routes.
- Interaction to next paint target: under 200ms for primary buttons and form edits.
- API p95 latency target: under 350ms for reads and under 700ms for writes under expected load.
- Worker queue target: process normal jobs within 60s and expose queue depth before saturation.
- Bundle budget: keep initial client JavaScript below 180KB gzip unless a reviewed exception is recorded.
- Database budget: paginated reads, indexed filters, and no unbounded admin list endpoints.
- Release rule: when a budget is missed, ship the fix or document owner, user impact, and rollback.
`,
    }
}

function loadTestingDoc(): GeneratedFile {
    return {
        path: 'docs/load-testing.md',
        content: `# Load Testing

## Scenarios

- Browser: run mobile and desktop flows on slow network, including form validation, navigation, and empty states.
- API: create 100 records, page through results, replay idempotent requests, and verify shaped errors.
- Worker: enqueue 120 jobs, process at least 50, cancel one job, replay one failed job, and inspect queue depth.
- Soak: run a 30 minute low-volume test to catch memory growth, cache churn, and retry storms.

## Pass criteria

- No raw provider errors reach users.
- Request IDs and status endpoints make debugging possible.
- Queue depth, retry budget, and p95 latency stay visible in generated docs or endpoints.
- The generated project remains usable on a 390px mobile viewport without horizontal overflow.
`,
    }
}

function rumDoc(): GeneratedFile {
    return {
        path: 'docs/real-user-monitoring.md',
        content: `# Real User Monitoring

- Track privacy-safe web vitals, route load time, form failure rate, and primary-action success rate.
- Track API request IDs, status buckets, p95 latency, retry-after events, and shaped error categories.
- Track worker queue depth, dead jobs, replay requests, and time-to-complete for critical jobs.
- Do not capture secrets, free text, tokens, or raw customer payloads in telemetry.
- Show operators calm recovery copy such as "Limit reached, try again in 12 minutes" instead of raw 429/provider text.
- Add a visible owner and escalation route for every monitored production journey.
`,
    }
}

function maintainershipDoc(): GeneratedFile {
    return {
        path: 'docs/maintainership.md',
        content: `# Maintainership

## First hour checklist

- Run locally from README without using hidden builder state.
- Read architecture map, ADRs, environment examples, and deployment troubleshooting notes.
- Identify owners for UI, API, storage, worker, observability, security, and support.
- Run build, lint, smoke, and browser verification before accepting handoff.

## Code ownership

- Keep UI, contracts, storage, and worker concerns separated enough that a future developer can replace one layer at a time.
- Prefer small explicit modules over magic generation blobs.
- Record known limitations as reproducible tests or docs, not vague backlog notes.
- Every production incident should update a runbook, test, monitor, or error message.
`,
    }
}

function dependencyUpgradeDoc(): GeneratedFile {
    return {
        path: 'docs/dependency-upgrades.md',
        content: `# Dependency Upgrades

- Keep lockfiles committed and review dependency diffs before deploy.
- Schedule monthly minor upgrades and immediate security upgrades for critical CVEs.
- Run build, smoke, browser verification, migrations, and rollback checks after upgrades.
- Record breaking changes, removed APIs, transitive risk, and rollback command in release evidence.
- Avoid abandoned libraries when a platform-native or maintained alternative exists.
- If an upgrade fails, keep the app on the known-good version and create a focused remediation task.
`,
    }
}

function dataPortabilityDoc(): GeneratedFile {
    return {
        path: 'docs/data-portability.md',
        content: `# Data Portability

- Exports must be open formats: JSONL or CSV for records, SQL migrations for schema, Markdown for docs, and plain files for assets.
- Every export includes schemaVersion, exportedAt, sourceService, and owner/tenant scope.
- Imports must support dry run, validation report, idempotency keys, and rollback plan before writing.
- Backups are not enough; test a restore into a clean environment and verify counts, relations, and audit trail.
- No production-only data should live solely inside hidden builder tables or opaque workflow state.
- A future team should be able to leave the platform without rewriting the business model from screenshots.
`,
    }
}

function versionHistoryDoc(): GeneratedFile {
    return {
        path: 'docs/version-history.md',
        content: `# Version History

- Keep every meaningful AI edit, manual edit, migration, prompt, and deployment as a reviewable change entry.
- Generated projects should support rollback from a bad prompt without losing the last known-good file tree.
- Record who changed the project, what changed, why it changed, and which tests/screenshots proved it still works.
- Preserve diffs in source control instead of relying on a chat transcript as the only history.
- If the AI proposes broad rewrites, require a smaller patch plan and a before/after verification note.
`,
    }
}

function manualEditControlDoc(): GeneratedFile {
    return {
        path: 'docs/manual-edit-control.md',
        content: `# Manual Edit Control

- Users must be able to override copy, CSS, layout tokens, routes, and content without fighting the generator.
- AI edits should preserve hand-written changes unless the user explicitly asks for a replacement.
- Mark generated seams clearly: content, styling, data, permissions, integrations, and deployment.
- Keep manual CSS and component edits in ordinary files so designers can polish without platform lock-in.
- Regression tests should cover the exact user complaint that led to the edit.
`,
    }
}

function cmsWorkflowDoc(): GeneratedFile {
    return {
        path: 'docs/cms-workflow.md',
        content: `# CMS Workflow

- Separate editorial content from application logic when non-developers need frequent updates.
- Draft, preview, approve, publish, and rollback states should be explicit for public content.
- Content export should include slugs, schema version, locale, author, status, and updatedAt.
- Broken content should fail validation before deploy, not after users hit the page.
- The project should document whether content lives in code, a database, or a connected CMS.
`,
    }
}

function previewDeployDoc(): GeneratedFile {
    return {
        path: 'docs/preview-deploy.md',
        content: `# Preview and Deploy

- Every change needs a shareable preview URL or local preview command before production deploy.
- Preview checks: auth state, mobile width, long text, empty data, slow network, forms, and console errors.
- Deploy checks: environment variables, migration order, health, readiness, rollback image, and smoke test.
- Publishing should show the failed layer clearly: build, migration, secrets, DNS, SSL, auth, or runtime.
- Do not turn deployment errors into raw provider messages for end users.
`,
    }
}

function authPermissionMatrixDoc(): GeneratedFile {
    return {
        path: 'docs/auth-permission-matrix.md',
        content: `# Auth Permission Matrix

- Define anonymous, user, editor, admin, owner, and support roles before wiring production data.
- Every route, mutation, worker action, export, restore, and destructive action needs an owner and required role.
- Test logged-out, expired-session, second-device, revoked-access, and cross-tenant access states.
- Errors should be shaped and recoverable; raw unauthorized/provider text should not reach users.
- Background token refresh should happen below the UI when the user is already logged in.
`,
    }
}

function mobileReleaseDoc(): GeneratedFile {
    return {
        path: 'docs/mobile-release.md',
        content: `# Mobile Release

- Verify 390px and 430px widths, large text, safe areas, sticky controls, keyboard overlap, and long labels.
- Touch targets should be at least 44px and primary actions must remain reachable.
- Test mobile Safari refresh, back/forward cache, slow network, image loading, and form submit recovery.
- Avoid horizontal overflow by default with fluid grids, wrapped labels, and constrained media.
- Keep screenshots for at least one narrow viewport in release evidence.
`,
    }
}

function designSystemTokensDoc(): GeneratedFile {
    return {
        path: 'docs/design-system-tokens.md',
        content: `# Design System Tokens

- Define color, radius, spacing, typography, shadow, and motion tokens before scaling screens.
- Avoid generic AI-builder sameness by documenting the intended visual language and component hierarchy.
- Keep buttons, forms, cards, sidebars, and status messages consistent across desktop and mobile.
- Support manual theme edits without making users rewrite generated components.
- Contrast and focus states are release blockers, not polish tasks.
`,
    }
}

function complaintRegressionDoc(): GeneratedFile {
    return {
        path: 'docs/complaint-regression-tests.md',
        content: `# Complaint Regression Tests

- Convert every serious user complaint into a reproducible scenario with input, expected behavior, and proof.
- Track regressions for prompt drift, lost edits, mobile overflow, auth failures, deploy failures, slow previews, and quota handling.
- A fix is not complete until the same scenario passes in a browser workflow or API/worker smoke path.
- Keep screenshots, generated file lists, and command output with the scenario result.
- Re-run the complaint suite before changing generator heuristics.
`,
    }
}

function testStrategyDoc(): GeneratedFile {
    return {
        path: 'docs/test-strategy.md',
        content: `# Test Strategy

- Cover the critical path with browser E2E tests, API contract tests, worker replay tests, and accessibility checks.
- Use realistic data: long names, empty lists, duplicate submissions, slow responses, expired sessions, large files, and failed third-party calls.
- Test the failure path as seriously as the happy path, including retry, rollback, cancellation, and support escalation.
- Keep deterministic smoke tests fast enough to run before every deploy.
- A generated project is not production-ready until its most important user story has executable proof.
`,
    }
}

function branchProtectionDoc(): GeneratedFile {
    return {
        path: 'docs/branch-protection.md',
        content: `# Branch Protection

- Require review, CI, and preview evidence before merging into production branches.
- Protect generated files and manual edits with normal source-control diffs, not invisible builder state.
- Block direct pushes for schema, auth, payment, destructive worker, and deployment changes.
- Require rollback notes for migrations, background jobs, and public route changes.
- Emergency changes need an owner, expiry, audit entry, and follow-up review.
`,
    }
}

function codeReviewWorkflowDoc(): GeneratedFile {
    return {
        path: 'docs/code-review-workflow.md',
        content: `# Code Review Workflow

- Review generated changes as code: scope, risk, tests, accessibility, security, and migration impact.
- Separate AI-generated bulk changes from human polish so reviewers can spot lost edits.
- Require a file-by-file summary for source changes and a scenario summary for behavior changes.
- Ask for smaller patches when a prompt rewrites unrelated modules.
- Keep review comments tied to regression tests when they report real user pain.
`,
    }
}

function stateOwnershipDoc(): GeneratedFile {
    return {
        path: 'docs/state-ownership.md',
        content: `# State Ownership

- Define which state lives in URL, component state, server session, database, queue, cache, and external integrations.
- Critical state transitions need idempotency, audit trail, retry behavior, and visible user feedback.
- Avoid duplicating source of truth between UI state, generated fixtures, and hidden builder storage.
- Test refresh, back button, second device, offline resume, and concurrent edits.
- State bugs should produce recoverable messages instead of silent data loss.
`,
    }
}

function criticalFlowOverrideDoc(): GeneratedFile {
    return {
        path: 'docs/critical-flow-overrides.md',
        content: `# Critical Flow Overrides

- Provide manual override paths for payments, publishing, imports, moderation, auth lockouts, and worker backlogs.
- Overrides must require role checks, audit events, confirmation copy, rollback notes, and support visibility.
- Never let an automation repeatedly retry a destructive action without review.
- Operators need pause, resume, cancel, replay, and export controls for long-running work.
- User-facing status should show progress, next safe action, and escalation path.
`,
    }
}

function schemaRelationshipDoc(): GeneratedFile {
    return {
        path: 'docs/schema-relationships.md',
        content: `# Schema Relationships

- Document one-to-many, many-to-many, ownership, soft-delete, retention, and audit relationships before production data.
- Migrations should name foreign keys, indexes, unique constraints, and rollback expectations.
- Imports must validate relationship integrity before writes.
- Exports should preserve identifiers, relationship order, schemaVersion, and deleted/archived state.
- Complex relationships should be tested with realistic fixtures, not a single flat demo record.
`,
    }
}

function mediaAssetPipelineDoc(): GeneratedFile {
    return {
        path: 'docs/media-asset-pipeline.md',
        content: `# Media Asset Pipeline

- Images and documents need size limits, type validation, alt text, thumbnails, optimization, virus-scan seam, and retry behavior.
- Store original asset metadata separately from transformed derivatives.
- Test large files, unsupported formats, broken EXIF, slow upload, duplicate files, and deletion recovery.
- Public media should use cache headers, responsive sizes, and accessible descriptions.
- Keep asset exports portable: files plus manifest with owner, checksum, mimeType, width, height, and createdAt.
`,
    }
}

function releaseCanaryDoc(): GeneratedFile {
    return {
        path: 'docs/release-canary.md',
        content: `# Release Canary

- Roll risky changes to a small audience before full release.
- Canary checks: error rate, latency, conversion, queue depth, auth failures, mobile overflow, and support tickets.
- Include a one-click rollback or disable flag for new flows.
- Compare before/after screenshots and synthetic checks during the canary window.
- Promote only when the canary has an owner, pass criteria, and recorded evidence.
`,
    }
}

function environmentParityDoc(): GeneratedFile {
    return {
        path: 'docs/environment-parity.md',
        content: `# Environment Parity

- Keep local, preview, staging, and production configuration names aligned.
- Document required variables, safe defaults, secret-only values, and production-only integrations.
- Preview must fail fast when required services, migrations, or permissions are missing.
- Test with production-like data shape, not production secrets or customer data.
- Every deploy should record environment, commit, migration version, feature flags, and rollback target.
`,
    }
}

function secretsManagementDoc(): GeneratedFile {
    return {
        path: 'docs/secrets-management.md',
        content: `# Secrets Management

- Store secrets in environment managers, never generated source, screenshots, support bundles, or chat transcripts.
- Rotate secrets on schedule and after suspected exposure.
- Separate local demo credentials from production credentials.
- Record secret owner, scope, rotation date, emergency revocation path, and downstream services.
- Tests should prove missing or expired secrets produce shaped, supportable errors.
`,
    }
}

function fixtureSeedDataDoc(): GeneratedFile {
    return {
        path: 'docs/fixture-seed-data.md',
        content: `# Fixture and Seed Data

- Include realistic fixtures for empty, small, large, duplicate, archived, deleted, invalid, and permission-denied states.
- Seed data must avoid real customer information and clearly mark demo-only records.
- Fixtures should exercise relationships, long text, media metadata, quota limits, and failed integrations.
- Browser and API smoke tests should run against the same seed scenarios.
- Refresh fixtures when user complaints reveal a missing edge case.
`,
    }
}

function migrationRollbackDoc(): GeneratedFile {
    return {
        path: 'docs/migration-rollback.md',
        content: `# Migration Rollback

- Every schema change needs forward migration, rollback plan, backup verification, and data-loss assessment.
- Dangerous migrations require maintenance window, canary tenant, and manual approval.
- Rollbacks should preserve audit trail, relationship integrity, and schemaVersion semantics.
- Test migrations against realistic fixtures before production deploy.
- If rollback is impossible, document the compensating action and support message before launch.
`,
    }
}

function featureFlagGovernanceDoc(): GeneratedFile {
    return {
        path: 'docs/feature-flag-governance.md',
        content: `# Feature Flag Governance

- Feature flags need owner, purpose, default state, rollout percentage, expiry date, and cleanup issue.
- Flags for auth, billing, data deletion, payments, and destructive jobs require approval.
- Track flag state in release evidence and incident timelines.
- Remove stale flags before they become hidden product forks.
- Use flags for canary and emergency disable paths, not as a substitute for tests.
`,
    }
}

function incidentCommunicationDoc(): GeneratedFile {
    return {
        path: 'docs/incident-communication.md',
        content: `# Incident Communication

- Users should see calm status and next action, not raw provider errors or red stack traces.
- Operators need incident owner, severity, affected journeys, start time, updates, workaround, and resolution.
- Support teams need copy for limits, auth failures, deploy failures, privacy requests, and data restore delays.
- Postmortems should create tests, monitors, docs, or safer defaults.
- Keep customer-facing updates separate from internal debugging details.
`,
    }
}

function privacyRequestAutomationDoc(): GeneratedFile {
    return {
        path: 'docs/privacy-request-automation.md',
        content: `# Privacy Request Automation

- Support export, correction, deletion, restriction, and consent withdrawal requests with owner and deadline.
- Verify identity before exposing or deleting data.
- Deletion must respect retention holds, backups, audit logs, and downstream processors.
- Generate a receipt with request ID, status, scope, and completion time.
- Test privacy flows without real personal data.
`,
    }
}

function billingLimitPolicyDoc(): GeneratedFile {
    return {
        path: 'docs/billing-limit-policy.md',
        content: `# Billing and Limit Policy

- Surface hourly, daily, monthly, and plan limits before work fails.
- Avoid surprise credit burn by estimating expensive jobs and offering queue/cancel controls.
- Rate-limit messages should be neutral and useful: limit reached, reset time, and safe alternatives.
- Billing-impacting actions require confirmation, audit trail, and support visibility.
- Tests should cover limit reached, limit reset, overage disabled, overage approved, and plan downgrade states.
`,
    }
}

function ssoProvisioningDoc(): GeneratedFile {
    return {
        path: 'docs/sso-provisioning.md',
        content: `# SSO and Provisioning

- Document SAML/OIDC issuer, audience, callback URLs, SCIM lifecycle, group mapping, and break-glass admin access.
- Test login, logout, expired sessions, revoked users, deprovisioned users, second-device sessions, and cross-tenant access.
- Keep role mapping in source or documented configuration, not hidden builder state.
- Failed SSO should show recovery steps and request IDs instead of raw provider errors.
- Enterprise rollout requires a fallback support path and audit trail for access changes.
`,
    }
}

function auditEvidencePackDoc(): GeneratedFile {
    return {
        path: 'docs/audit-evidence-pack.md',
        content: `# Audit Evidence Pack

- Bundle CI results, screenshots, dependency review, access review, privacy checks, restore drills, and incident drills per release.
- Include who approved the change, what changed, which risks were accepted, and how rollback was verified.
- Evidence should be exportable as files, not locked inside a provider dashboard.
- Keep request IDs and audit hashes for supportable investigation.
- Redact secrets and customer payloads before sharing evidence externally.
`,
    }
}

function disasterRecoveryDoc(): GeneratedFile {
    return {
        path: 'docs/disaster-recovery.md',
        content: `# Disaster Recovery

- Define RTO, RPO, backup cadence, restore owner, failover process, and communication owner.
- Test restore into a clean environment with realistic fixtures before trusting backups.
- Document dependencies: database, object storage, queue, secrets, DNS, auth, mail, and observability.
- Record the last successful restore drill and gaps that block production readiness.
- Disaster recovery plans must include read-only mode, queue pause, and customer updates.
`,
    }
}

function slaCreditPolicyDoc(): GeneratedFile {
    return {
        path: 'docs/sla-credit-policy.md',
        content: `# SLA and Credit Policy

- Define uptime target, measurement window, exclusions, severity levels, response times, and credit rules.
- Track whether an incident qualifies for credit without exposing internal blame to users.
- Support should see affected journeys, affected tenants, start time, resolution time, and workaround.
- Credits, refunds, or plan extensions require audit trail and approval.
- Publish status updates in plain language with expected next update time.
`,
    }
}

function vendorRiskDoc(): GeneratedFile {
    return {
        path: 'docs/vendor-risk.md',
        content: `# Vendor Risk

- List critical vendors, data shared, subprocessors, residency, outage impact, rate limits, and exit plan.
- Prefer portable APIs, open exports, and documented fallback paths for every external dependency.
- Do not send private prompts, secrets, or customer payloads to unapproved providers.
- Review terms, pricing changes, data retention, and model/provider behavior before production rollout.
- Keep a vendor replacement checklist for auth, email, storage, analytics, payments, and AI services.
`,
    }
}

function abusePreventionDoc(): GeneratedFile {
    return {
        path: 'docs/abuse-prevention.md',
        content: `# Abuse Prevention

- Protect public forms, chat, upload, webhook, and worker enqueue endpoints from spam, floods, and repeated destructive actions.
- Use rate limits, idempotency, captcha/seam, moderation queue, blocklist, and support-visible abuse logs.
- Abuse responses should be calm and reversible for false positives.
- Moderator actions need role checks, audit events, undo/replay rules, and evidence exports.
- Test burst traffic, duplicate submissions, malicious files, and repeated auth failures.
`,
    }
}

function observabilityDashboardDoc(): GeneratedFile {
    return {
        path: 'docs/observability-dashboard.md',
        content: `# Observability Dashboard

- Dashboards should show health, readiness, p95 latency, error budget, queue depth, dead jobs, auth failures, billing limits, and privacy request backlog.
- Link metrics to runbooks, owners, alerts, and recent releases.
- Separate user-safe status from internal traces.
- Keep dashboard panels useful during incidents: request IDs, tenant scope, affected route, and recovery action.
- Add synthetic checks for login, write path, export path, worker path, and mobile primary journey.
`,
    }
}

function supportEscalationLadderDoc(): GeneratedFile {
    return {
        path: 'docs/support-escalation-ladder.md',
        content: `# Support Escalation Ladder

- Define tier 1, tier 2, engineering, security, privacy, vendor, and executive escalation paths.
- Each escalation needs owner, SLA, evidence required, customer update cadence, and safe workaround.
- Do not ask users to paste secrets, tokens, private prompts, or customer data into support threads.
- Escalate automatically when limits, auth, billing, privacy, data loss, or repeated worker failures affect real users.
- Close the loop by adding tests, docs, or monitoring for the reported issue.
`,
    }
}

function aiGovernanceDoc(): GeneratedFile {
    return {
        path: 'docs/ai-governance.md',
        content: `# AI Governance

- Classify AI actions by risk: read-only, reversible write, irreversible write, external side effect, and regulated-data access.
- Require human approval for destructive actions, billing-impacting work, permission changes, data deletion, and external sends.
- Keep prompts, tool calls, model/provider, user intent, and approval decisions auditable without exposing secrets.
- Define allowed data sources, freshness requirements, and what the model must refuse or escalate.
- Governance changes need review, tests, rollback, and incident communication.
`,
    }
}

function promptPrivacyDoc(): GeneratedFile {
    return {
        path: 'docs/prompt-privacy.md',
        content: `# Prompt Privacy

- Do not log secrets, tokens, private prompts, credentials, customer payloads, or regulated data in clear text.
- Redact prompt traces before support export while preserving enough context for debugging.
- Separate user-visible transcript from internal tool logs, provider logs, and audit evidence.
- Document retention windows and deletion path for prompts, attachments, and generated artifacts.
- Test that privacy requests can find and purge prompt-related data where legally required.
`,
    }
}

function agentActionApprovalDoc(): GeneratedFile {
    return {
        path: 'docs/agent-action-approvals.md',
        content: `# Agent Action Approvals

- The agent may inspect, draft, and stage changes without approval, but risky actions need explicit confirmation.
- Approval prompts must name target, command/action, expected effect, rollback path, and risk class.
- Batch approvals should expire and never silently authorize unrelated future work.
- Denied actions should create a safe alternative instead of failing the whole task.
- Every approved action gets audit event, actor, timestamp, request ID, and result.
`,
    }
}

function modelProviderFallbackDoc(): GeneratedFile {
    return {
        path: 'docs/model-provider-fallback.md',
        content: `# Model Provider Fallback

- Define primary and fallback providers, model capabilities, cost limits, latency limits, and data policy constraints.
- Fallback should degrade gracefully: smaller context, queued work, or read-only mode instead of raw provider errors.
- Track provider status, retry/backoff, model version, and reason for fallback.
- Do not route regulated data to a fallback provider unless it is approved for that data class.
- Tests should cover timeout, rate limit, socket close, provider 5xx, and model refusal.
`,
    }
}

function tenantIsolationProofDoc(): GeneratedFile {
    return {
        path: 'docs/tenant-isolation-proof.md',
        content: `# Tenant Isolation Proof

- Prove tenant scoping at API, database, queue, export, audit, support, and admin layers.
- Test cross-tenant reads, writes, exports, restore, replay, webhooks, and search.
- Admin/support tools must show scoped evidence without exposing other tenants.
- Every record needs owner/tenant fields, indexes, and policy notes.
- Isolation failures are severity-one until proven otherwise.
`,
    }
}

function dataLineageDoc(): GeneratedFile {
    return {
        path: 'docs/data-lineage.md',
        content: `# Data Lineage

- Track source, owner, schemaVersion, transformations, derived fields, exports, and downstream processors.
- Generated records should identify whether values came from user input, import, AI suggestion, system default, or external integration.
- Keep lineage through backup, restore, replay, and migration.
- Audit reports should connect user action, request ID, data mutation, and export evidence.
- Lineage gaps become migration blockers for regulated workflows.
`,
    }
}

function evalCoverageDoc(): GeneratedFile {
    return {
        path: 'docs/eval-coverage.md',
        content: `# Eval Coverage

- Evaluate AI behavior with realistic prompts, critical workflows, malicious input, vague requests, and recovery after errors.
- Include assertions for files changed, commands run, approvals requested, data not leaked, and user-facing progress.
- Maintain a complaint-driven eval set from support tickets and failed production stories.
- Re-run evals before model/provider changes and prompt template changes.
- Evals should fail loudly when the agent fabricates progress, hides errors, or takes unsafe actions.
`,
    }
}

function costObservabilityDoc(): GeneratedFile {
    return {
        path: 'docs/cost-observability.md',
        content: `# Cost Observability

- Track AI tokens, tool calls, retries, queue time, provider fallback, worker runtime, storage, and external API calls.
- Show cost estimates before expensive actions and live spend while long tasks run.
- Tie spend to user, tenant, project, feature, and request ID.
- Alert on runaway retries, duplicated jobs, provider fallback loops, and unusual upload/storage growth.
- Cost controls need pause, cancel, queue, and downgrade-safe behavior.
`,
    }
}

function i18nReadinessDoc(): GeneratedFile {
    return {
        path: 'docs/i18n-readiness.md',
        content: `# I18n Readiness

- Treat localization as a launch requirement, not a polish task after the English build ships.
- Cover locale routing, fallback language, pluralization, currency, dates, time zones, address formats, and right-to-left layout.
- Keep privacy, consent, legal, pricing, cancellation, and support copy reviewable per locale.
- Test mobile and keyboard flows with translated strings that are 30-50% longer than English.
- Block release when hardcoded strings, broken plural forms, or locale-specific legal copy gaps remain.
`,
    }
}

function toolBoundaryValidationDoc(): GeneratedFile {
    return {
        path: 'docs/tool-boundary-validation.md',
        content: `# Tool Boundary Validation

- Validate every tool input and output with schemas before the agent treats it as evidence.
- Keep command, browser, file, network, and server actions behind explicit allowlists and risk classes.
- Reject ambiguous destructive requests and return safe alternatives instead of leaking raw tool errors.
- Require visible proof for browser state, files edited, commands run, screenshots captured, and external API mutations.
- Add request IDs, shaped errors, retry policy, and audit events for failed tool calls so the agent can self-recover.
`,
    }
}

function externalDataFreshnessDoc(): GeneratedFile {
    return {
        path: 'docs/external-data-freshness.md',
        content: `# External Data Freshness

- Display source, fetchedAt, cache TTL, provider health, and stale badges anywhere external data affects decisions.
- Never describe stale data as live; switch to read-only fallback when refreshes fail.
- Track provider status, retry backoff, downstream processors, and affected features for every feed.
- Reconcile imported values against source timestamps and alert when data drifts or refresh jobs stall.
- Give users clear refresh, retry, and export paths without hiding stale pricing, inventory, risk, or compliance data.
`,
    }
}

function browserAutomationStabilityDoc(): GeneratedFile {
    return {
        path: 'docs/browser-automation-stability.md',
        content: `# Browser Automation Stability

- Prefer role, label, text, and test-id selectors over brittle CSS chains or timing sleeps.
- Show progress with concrete files, commands, screenshots, page URL, and current browser action.
- Retry recoverable navigation, socket close, auth/session, and visibility failures with increasing backoff.
- Capture screenshots, console errors, trace notes, viewport size, and network failures for every failed scenario.
- Test mobile, keyboard, focus, overflow, signed-in state, slow networks, and repeated runs before declaring success.
`,
    }
}

function apiDeprecationPolicyDoc(): GeneratedFile {
    return {
        path: 'docs/api-deprecation-policy.md',
        content: `# API Deprecation Policy

- Version contracts and keep compatibility tests for every public API, webhook, export, and integration payload.
- Publish changelog entries, sunset headers, migration guides, examples, and owner contact before breaking changes.
- Support old and new versions during a documented deprecation window with telemetry for remaining consumers.
- Block deploys when OpenAPI, SDK examples, fixtures, replay tests, or downstream processors drift from the contract.
- Treat silent response-shape changes as incidents because enterprise users build real workflows on those fields.
`,
    }
}

function dataQualityMonitoringDoc(): GeneratedFile {
    return {
        path: 'docs/data-quality-monitoring.md',
        content: `# Data Quality Monitoring

- Validate imports, generated records, external feeds, and user edits for missing relationships, duplicates, outliers, and stale values.
- Keep reconciliation jobs that compare source counts, checksums, schema versions, and owner/tenant scope.
- Surface quality warnings in dark-gray product copy with repair actions instead of raw stack traces.
- Track drift alerts, failed rows, quarantined records, replay status, and who approved corrections.
- Require fixtures and regression tests for known bad inputs so broken data does not quietly poison future automation.
`,
    }
}

function adoptionTrainingDoc(): GeneratedFile {
    return {
        path: 'docs/adoption-training.md',
        content: `# Adoption Training

- Ship role-specific onboarding for operators, admins, support, developers, finance, and reviewers.
- Include runbooks, command recipes, practice sandbox tasks, known limitations, escalation paths, and rollback drills.
- Explain what the AI can do, what it cannot do, how approvals work, and how users can verify evidence.
- Capture feedback from failed handoffs, confusing copy, hidden limits, brittle flows, and missing keyboard shortcuts.
- Treat training as part of production readiness so customers are not left with a powerful tool nobody trusts.
`,
    }
}

function webhookReplayLabDoc(): GeneratedFile {
    return {
        path: 'docs/webhook-replay-lab.md',
        content: `# Webhook Replay Lab

- Design every webhook with idempotency keys, signed payload fixtures, duplicate detection, and side-effect inventory.
- Store dead-letter payloads with headers, request ID, tenant, source timestamp, and redacted error summary.
- Provide safe dry-run replay before live replay so operators can inspect mutations and approval requirements.
- Verify retry backoff, out-of-order delivery, provider downtime, stale signatures, and duplicate side effects.
- Make replay evidence visible in support bundles instead of forcing users to guess whether a webhook already ran.
`,
    }
}

function ciWorkflow(): GeneratedFile {
    return {
        path: '.github/workflows/ci.yml',
        content: `name: ci

on:
  pull_request:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm install
      - run: npm run build
`,
    }
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
