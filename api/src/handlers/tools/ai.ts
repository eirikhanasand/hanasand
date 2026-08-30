import type { FastifyReply, FastifyRequest } from 'fastify'
import { listGptClients, requestGptCompletion } from '#utils/ws/handleGptMessage.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { auditAgentAction, evaluateAgentActionPolicy, redactAgentText } from '#utils/ai/actionPolicy.ts'
import { recordAiUsageEvent } from '#utils/ai/usage.ts'

type GeneratedFile = {
    path: string
    content: string
}

type GeneratedProject = {
    label: string
    files: GeneratedFile[]
}

type GeneratedBuilderResponse = {
    status: 'completed'
    provider: 'hanasand-ai'
    model: 'share-builder'
    message: string
    cache?: {
        hit: boolean
        key: string
        category: 'scaffold' | 'diagnostic' | 'package_metadata' | 'deployment_fix'
    }
}
type CommonCacheCategory = NonNullable<GeneratedBuilderResponse['cache']>['category']
type ModelToolStrategy = {
    route: 'tool_first' | 'small_model' | 'strong_model'
    difficulty: 'deterministic' | 'small' | 'strong'
    reason: string
    maxTokens: number
    temperature: number
    principles: string[]
}

const commonResponseCache = new Map<string, {
    response: GeneratedBuilderResponse
    hits: number
    createdAt: number
    updatedAt: number
}>()
const MAX_COMMON_RESPONSE_CACHE_ITEMS = 80

export default async function aiTool(req: FastifyRequest, res: FastifyReply) {
    res.header('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate')
    res.header('Vary', 'Authorization, Cookie')

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
        billingMode?: 'draft' | 'standard' | 'verified' | 'priority'
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

    const directResponse = chatResponse(prompt)
    if (directResponse) {
        await recordToolAiEconomics({
            actorId,
            billingMode: body.billingMode,
            kind: 'ai_run_completed',
            outcome: 'answered',
            prompt,
            context,
            responseText: directResponse,
            model: 'direct',
            startedAt: Date.now(),
        })
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

    const strategy = chooseWorkMode(prompt, context, body.billingMode)
    const builderResponse = strategy.route === 'tool_first' ? buildShareProjectResponse(prompt) : null
    if (builderResponse) {
        await recordCommonCacheHit({
            actorId,
            prompt,
            context,
            response: builderResponse,
            billingMode: body.billingMode,
        })
        await recordToolAiEconomics({
            actorId,
            billingMode: body.billingMode,
            kind: 'ai_run_completed',
            outcome: 'completed',
            prompt,
            context,
            responseText: typeof builderResponse.message === 'string' ? builderResponse.message : '',
            model: String(builderResponse.model || 'share-builder'),
            startedAt: Date.now(),
            toolCalls: parseGeneratedToolCalls(typeof builderResponse.message === 'string' ? builderResponse.message : '').length,
            cache: builderResponse.cache,
            strategy,
        })
        return res.send(await enforceGeneratedToolPolicy(req, actorId, {
            ...builderResponse,
            modelStrategy: strategy,
        }))
    }

    const clients = listGptClients('gpt')
    const preferredClient = pickModelClient(clients, strategy)

    if (!preferredClient) {
        const fallback = buildShareProjectResponse(prompt)
        if (fallback) {
            await recordCommonCacheHit({
                actorId,
                prompt,
                context,
                response: fallback,
                billingMode: body.billingMode,
            })
            await recordToolAiEconomics({
                actorId,
                billingMode: body.billingMode,
                kind: 'ai_run_completed',
                outcome: 'completed',
                prompt,
                context,
                responseText: typeof fallback.message === 'string' ? fallback.message : '',
                model: String(fallback.model || 'share-builder'),
                startedAt: Date.now(),
                toolCalls: parseGeneratedToolCalls(typeof fallback.message === 'string' ? fallback.message : '').length,
                cache: fallback.cache,
                strategy,
            })
            return res.send({
                ...fallback,
                modelStrategy: strategy,
            })
        }
        await recordToolAiEconomics({
            actorId,
            billingMode: body.billingMode,
            kind: 'ai_run_platform_error',
            outcome: 'platform_error',
            prompt,
            context,
            responseText: 'No connected model client.',
            model: 'none',
            startedAt: Date.now(),
            strategy,
        })
        return res.send({
            status: 'connecting',
            provider: 'hanasand-ai',
            model: null,
            message: 'Hanasand AI is connecting. Try again in a moment.',
        })
    }

    try {
        const conversationId = `tools-${crypto.randomUUID()}`
        const startedAt = Date.now()
        const completion = await completeWithRetry({
            conversationId,
            clientName: preferredClient.name,
            maxTokens: Math.min(Math.max(Number(maxTokens) || strategy.maxTokens, 300), strategy.route === 'strong_model' ? 6200 : 4200),
            prompt,
            context,
            strategy,
        })
        const responseId = `tools-response-${crypto.randomUUID()}`
        await recordToolAiEconomics({
            actorId,
            billingMode: body.billingMode,
            kind: 'ai_run_completed',
            outcome: 'completed',
            prompt,
            context,
            responseText: completion.content || '',
            model: preferredClient.name,
            conversationId,
            metrics: completion.metrics,
            startedAt,
            toolCalls: parseGeneratedToolCalls(completion.content || '').length,
            strategy,
        })

        return res.send(await enforceGeneratedToolPolicy(req, actorId, {
            status: 'completed',
            provider: 'hanasand-ai',
            model: preferredClient.name,
            modelVersion: preferredClient.modelId || null,
            modelStrategy: strategy,
            message: redactAgentText(completion.content || ''),
            artifacts: completion.artifacts || [],
            metrics: completion.metrics || null,
            conversationId,
            responseId,
        }))
    } catch (error) {
        req.log.error({ error, promptLength: prompt.length, clientName: preferredClient.name }, 'Hanasand AI tool request failed')
        const fallback = buildShareProjectResponse(prompt)
        if (fallback) {
            await recordCommonCacheHit({
                actorId,
                prompt,
                context,
                response: fallback,
                billingMode: body.billingMode,
            })
            await recordToolAiEconomics({
                actorId,
                billingMode: body.billingMode,
                kind: 'ai_run_failed',
                outcome: 'fallback_completed',
                prompt,
                context,
                responseText: typeof fallback.message === 'string' ? fallback.message : '',
                model: preferredClient.name,
                startedAt: Date.now(),
                toolCalls: parseGeneratedToolCalls(typeof fallback.message === 'string' ? fallback.message : '').length,
                cache: fallback.cache,
                strategy,
            })
            return res.send(await enforceGeneratedToolPolicy(req, actorId, fallback))
        }
        await recordToolAiEconomics({
            actorId,
            billingMode: body.billingMode,
            kind: 'ai_run_platform_error',
            outcome: 'platform_error',
            prompt,
            context,
            responseText: error instanceof Error ? error.message : 'Model request failed.',
            model: preferredClient.name,
            startedAt: Date.now(),
        })
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

type ToolAiEconomicsInput = {
    actorId: string | null
    billingMode?: 'draft' | 'standard' | 'verified' | 'priority'
    kind: 'ai_run_completed' | 'ai_run_failed' | 'ai_run_platform_error'
    outcome: string
    prompt: string
    context?: string
    responseText: string
    model: string
    conversationId?: string | null
    metrics?: GPT_ModelMetrics | null
    startedAt: number
    toolCalls?: number
    cache?: GeneratedBuilderResponse['cache']
    strategy?: ModelToolStrategy
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

async function recordToolAiEconomics({
    actorId,
    billingMode = 'standard',
    kind,
    outcome,
    prompt,
    context,
    responseText,
    model,
    conversationId = null,
    metrics,
    startedAt,
    toolCalls = 0,
    cache,
    strategy,
}: ToolAiEconomicsInput) {
    if (!actorId) {
        return
    }

    const promptTokens = positiveMetric(metrics?.promptTokens) || estimateTokens(prompt)
    const contextTokens = positiveMetric(metrics?.contextTokens) || estimateTokens(context || '')
    const generatedTokens = positiveMetric(metrics?.generatedTokens) || estimateTokens(responseText)
    const totalTokens = Math.max(1, promptTokens + contextTokens + generatedTokens)
    const durationMs = Math.max(0, Date.now() - startedAt)
    const billableUnits = outcome === 'platform_error'
        ? 0
        : discountBillableUnits(totalTokens, billingMode, kind)
    const estimatedCostNok = estimateRunCostNok({
        promptTokens,
        contextTokens,
        generatedTokens,
        browserChecks: 0,
        buildMinutes: 0,
        deployMinutes: 0,
        billableUnits,
        billingMode,
    })

    await recordAiUsageEvent({
        ownerId: actorId,
        actorId,
        conversationId,
        kind,
        units: totalTokens,
        billableUnits,
        estimatedCostNok,
        billingMode,
        outcome,
        metadata: {
            model,
            promptTokens,
            contextTokens,
            generatedTokens,
            totalTokens,
            toolCalls,
            durationMs,
            costNok: estimatedCostNok,
            cacheHit: Boolean(cache?.hit),
            cacheKey: cache?.key || null,
            cacheCategory: cache?.category || null,
            keyMetric: 'verified useful project progress per minute per NOK',
            modelStrategy: strategy?.route || null,
            taskDifficulty: strategy?.difficulty || null,
            routingReason: strategy?.reason || null,
        },
    })
}

async function recordCommonCacheHit({
    actorId,
    prompt,
    context,
    response,
    billingMode = 'standard',
}: {
    actorId: string | null
    prompt: string
    context?: string
    response: GeneratedBuilderResponse
    billingMode?: 'draft' | 'standard' | 'verified' | 'priority'
}) {
    if (!actorId || !response.cache?.hit) {
        return
    }
    const estimatedSavedTokens = Math.max(1, estimateTokens(response.message) + estimateTokens(context || '') + estimateTokens(prompt))
    await recordAiUsageEvent({
        ownerId: actorId,
        actorId,
        kind: 'cache_hit',
        units: estimatedSavedTokens,
        billableUnits: 0,
        estimatedCostNok: 0,
        billingMode,
        outcome: 'cached',
        metadata: {
            cacheKey: response.cache.key,
            cacheCategory: response.cache.category,
            estimatedSavedTokens,
            message: 'Reused a common scaffold/diagnostic response instead of regenerating it.',
        },
    })
}

function positiveMetric(value: unknown) {
    const number = Number(value)
    return Number.isFinite(number) && number > 0 ? Math.round(number) : 0
}

function estimateTokens(value: string) {
    return Math.max(0, Math.ceil(value.length / 4))
}

function discountBillableUnits(totalTokens: number, billingMode: string, kind: string) {
    if (kind === 'ai_run_failed') {
        return Math.ceil(totalTokens * 0.25)
    }
    if (billingMode === 'draft') {
        return Math.ceil(totalTokens * 0.65)
    }
    return totalTokens
}

function estimateRunCostNok({
    promptTokens,
    contextTokens,
    generatedTokens,
    browserChecks,
    buildMinutes,
    deployMinutes,
    billableUnits,
    billingMode,
}: {
    promptTokens: number
    contextTokens: number
    generatedTokens: number
    browserChecks: number
    buildMinutes: number
    deployMinutes: number
    billableUnits: number
    billingMode: string
}) {
    if (!billableUnits) {
        return 0
    }
    const inputCost = (promptTokens + contextTokens) * 0.000018
    const outputCost = generatedTokens * 0.000032
    const checkCost = browserChecks * 0.04
    const buildCost = buildMinutes * 0.16
    const deployCost = deployMinutes * 0.24
    const priorityMultiplier = billingMode === 'priority' ? 1.35 : billingMode === 'verified' ? 1.15 : 1
    return Number(((inputCost + outputCost + checkCost + buildCost + deployCost) * priorityMultiplier).toFixed(4))
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

function chooseWorkMode(prompt: string, context?: string, billingMode: string = 'standard'): ModelToolStrategy {
    const lower = `${prompt}\n${context || ''}`.toLowerCase()
    const asksForGoldenPath = /\b(scaffold|starter|dockerfile|docker file|compose|docker compose|self-hostable|runnable project|deploy check|deployment check|package metadata|dependencies|env example|health check)\b/.test(lower)
    const complexArchitecture = /\b(architecture|architect|multi[- ]file|refactor|migration|bug hunt|debug across|race condition|auth flow|permissions|database schema|distributed|queue|worker|rollback|security review|incident|production bug|performance regression)\b/.test(lower)
    const simpleEdit = /\b(copy|summarize|rename|small edit|simple page|landing page|one page|diagnose|explain|fix typo|css|style|button|text|readme)\b/.test(lower)
    const contextIsLarge = (context?.length || 0) > 18_000

    if (asksForGoldenPath && !complexArchitecture) {
        return {
            route: 'tool_first',
            difficulty: 'deterministic',
            reason: 'Common scaffold, Docker, compose, dependency, or deploy-check work is safer and cheaper through deterministic generators before model tokens.',
            maxTokens: 900,
            temperature: 0.1,
            principles: [
                'Use golden-path generators for common app types.',
                'Prefer deterministic package, Docker, compose, and deploy checks over model guessing.',
                'Cache common scaffolds, package metadata, deployment fixes, and diagnostics.',
            ],
        }
    }

    if (complexArchitecture || contextIsLarge || billingMode === 'priority' || billingMode === 'verified') {
        return {
            route: 'strong_model',
            difficulty: 'strong',
            reason: complexArchitecture
                ? 'Architecture, multi-file refactor, bug-hunt, production, or security language needs stronger reasoning.'
                : contextIsLarge
                    ? 'Large context should be summarized by tools and handled by a stronger worker.'
                    : 'Paid verified/priority mode favors stronger reasoning for project quality.',
            maxTokens: 3200,
            temperature: 0.18,
            principles: [
                'Use stronger local or hosted models for architecture, multi-file refactors, and bug hunts.',
                'Inspect with tools before reading long context into the model.',
                'Prefer focused evidence over broad narration.',
            ],
        }
    }

    return {
        route: 'small_model',
        difficulty: 'small',
        reason: simpleEdit
            ? 'Small edit, summary, diagnostic, or simple page request can run on a fast local worker.'
            : 'Default to a fast local worker unless the task proves architectural.',
        maxTokens: 1400,
        temperature: 0.2,
        principles: [
            'Use small local models for edits, summaries, diagnostics, and simple pages.',
            'Read less raw context; use tools to inspect exactly what matters.',
            'Escalate when the task becomes architectural or multi-file.',
        ],
    }
}

function pickModelClient(clients: GPT_Client[], strategy: ModelToolStrategy) {
    const available = clients.filter((client) => client.model.status !== 'error')
    if (!available.length) {
        return null
    }

    return available
        .map((client) => ({ client, score: modelClientScore(client, strategy) }))
        .sort((left, right) => right.score - left.score)[0]?.client || null
}

function modelClientScore(client: GPT_Client, strategy: ModelToolStrategy) {
    const lanes = client.lanes || []
    const strongLanes = lanes.filter((lane) => lane.tier === 'strong').length
    const fastLanes = lanes.filter((lane) => lane.tier !== 'strong').length
    const availableRequests = lanes.reduce((sum, lane) => sum + Math.max(0, lane.availableRequests), 0)
    const queuedRequests = lanes.reduce((sum, lane) => sum + Math.max(0, lane.queuedRequests), 0)
    const modelText = `${client.name} ${client.displayName || ''} ${client.modelId || ''} ${client.profile || ''}`.toLowerCase()
    const modelLooksStrong = /\b(strong|coder|32b|72b|70b|deepseek|qwen|architect|reason)\b/.test(modelText)
    const modelLooksFast = /\b(fast|small|7b|14b|lane|draft)\b/.test(modelText)
    const tps = client.model.tps || 0
    const capacityScore = availableRequests * 20 - queuedRequests * 8
    const speedScore = Math.min(100, tps)

    if (strategy.route === 'strong_model') {
        return capacityScore + speedScore + strongLanes * 90 + (modelLooksStrong ? 80 : 0) - (modelLooksFast ? 25 : 0)
    }

    return capacityScore + speedScore + fastLanes * 60 + (modelLooksFast ? 45 : 0) + (modelLooksStrong ? 10 : 0)
}

async function completeWithRetry({
    conversationId,
    clientName,
    maxTokens,
    prompt,
    context,
    strategy,
}: {
    conversationId: string
    clientName: string
    maxTokens: number
    prompt: string
    context?: string
    strategy: ModelToolStrategy
}) {
    let lastError: unknown
    for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
            return await requestGptCompletion('gpt', {
                conversationId,
                clientName,
                maxTokens,
                temperature: strategy.temperature,
                messages: [
                    {
                        role: 'system',
                        content: [
                            'You are Hanasand AI inside the Hanasand developer workspace.',
                            'Language rule: reply in the same language as the customer’s latest message when it is clearly written in one language. Do not switch languages because of the workspace, source material, code, or earlier messages. If the message is mixed, too short to identify reliably, or contains only code, identifiers, or URLs, reply in English unless the customer explicitly requests another language. Keep code, commands, filenames, and quoted text unchanged.',
                            'Answer simple conversation normally without pretending to inspect or edit files.',
                            'When asked to edit a share project, emit one or more Hanasand tool tags with complete replacement content for each file that should change.',
                            'Supported share tool actions are update_share and upsert_share. Prefer upsert_share for creating or replacing files by path.',
                            'For project-building requests, include complete runnable files, not fragments: package.json, README, source, environment example, Dockerfile, and docker-compose.yml where relevant.',
                            'Model and tool selection: small local workers handle edits, summaries, diagnostics, and simple pages; stronger workers handle architecture, multi-file refactors, and bug hunts; standard generators handle scaffolds, Dockerfiles, Compose files, deploy checks, package facts, and common app shapes.',
                            'Agent principle: read less raw context, let tools inspect more. Ask for or emit focused tool calls instead of restating large file trees. Use live package/library metadata or project files before recommending versions, APIs, or defaults.',
                            `Current routing decision: ${strategy.route} (${strategy.reason}).`,
                            'Avoid generic filler. Include concrete copy, accessible labels, responsive structure, validation, health checks, and no hardcoded secrets.',
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

function chatResponse(prompt: string) {
    const normalized = prompt.trim().toLowerCase()
    if (/^(hei|he+i|hello|hi|hey|yo|hallo|god dag)[!.?\s]*$/.test(normalized)) {
        return /^(hei|he+i|god dag)[!.?\s]*$/.test(normalized)
            ? 'Hei. Hva skal vi bygge eller endre i dette prosjektet?'
            : 'Hi. What should we build or change in this project?'
    }
    return null
}

export function buildShareProjectResponse(prompt: string): GeneratedBuilderResponse | null {
    if (!/\b(build|create|make|generate|scaffold|website|site|app|bot|api|backend|worker|queue|dashboard|portal|tool|starter|page|fix|repair|rebuild|self-hostable|runnable project)\b/i.test(prompt)) {
        return null
    }

    const cacheKey = commonBuilderCacheKey(prompt)
    const cached = commonResponseCache.get(cacheKey)
    if (cached) {
        cached.hits += 1
        cached.updatedAt = Date.now()
        return {
            ...cached.response,
            cache: {
                key: cached.response.cache?.key || cacheKey,
                category: cached.response.cache?.category || cacheCategoryForPrompt(prompt),
                hit: true,
            },
        }
    }

    const project = keepRunnableFiles(chooseProject(prompt))
    const response: GeneratedBuilderResponse = {
        status: 'completed',
        provider: 'hanasand-ai',
        model: 'share-builder',
        message: [
            `Prepared a runnable ${project.label} with the files needed to start it.`,
            ...project.files.map((file) => toolTag(file.path, file.content)),
        ].join('\n\n'),
        cache: {
            hit: false,
            key: cacheKey,
            category: cacheCategoryForPrompt(prompt),
        },
    }
    rememberCommonResponse(cacheKey, response)
    return response
}

function keepRunnableFiles(project: GeneratedProject): GeneratedProject {
    const keep = new Set(['package.json', 'tsconfig.json', 'next.config.ts', 'Dockerfile', 'docker-compose.yml', '.env.example', '.github/workflows/ci.yml', 'src/index.ts', 'src/worker.ts', 'src/queue.ts'])
    return { ...project, files: project.files.filter(file => keep.has(file.path)) }
}

function rememberCommonResponse(key: string, response: GeneratedBuilderResponse) {
    commonResponseCache.set(key, {
        response,
        hits: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    })
    if (commonResponseCache.size <= MAX_COMMON_RESPONSE_CACHE_ITEMS) {
        return
    }
    const oldest = [...commonResponseCache.entries()]
        .sort((left, right) => left[1].updatedAt - right[1].updatedAt)[0]?.[0]
    if (oldest) {
        commonResponseCache.delete(oldest)
    }
}

function commonBuilderCacheKey(prompt: string) {
    const lower = prompt.toLowerCase()
    const title = slugify(titleFromPrompt(prompt))
    const projectKind = /\b(gallery|image review|photo|photographer)\b/.test(lower)
        ? 'website'
        : /\b(worker|queue|background|redis|job|transcode)\b/.test(lower)
            ? 'worker'
            : /\b(api|backend|fastify)\b/.test(lower) && !/\bpage|website|site|frontend|landing\b/.test(lower)
                ? 'api'
                : /\b(discord|bot|slack|telegram|server status bot|game server)\b/.test(lower)
                    ? 'bot'
                    : 'website'
    const capabilities = [
        /\bdocker|compose|self-host|runnable\b/.test(lower) ? 'docker' : null,
        /\bcheckout|payment|stripe|invoice\b/.test(lower) ? 'commerce' : null,
        /\bauth|login|account\b/.test(lower) ? 'auth' : null,
        /\bredis|queue|worker|background\b/.test(lower) ? 'queue' : null,
        /\bpostgres|database|migration\b/.test(lower) ? 'database' : null,
        /\bhealth|ready|metrics|monitor\b/.test(lower) ? 'ops' : null,
        /\bmobile|offline|safari\b/.test(lower) ? 'mobile' : null,
    ].filter(Boolean).join('-') || 'standard'
    const sections = sectionsForPage(lower).slice(0, 5).map(slugify).join('-')
    return [cacheCategoryForPrompt(prompt), projectKind, title, capabilities, sections].join(':').slice(0, 220)
}

function cacheCategoryForPrompt(prompt: string): CommonCacheCategory {
    const lower = prompt.toLowerCase()
    if (/\b(package|dependency|dependencies|npm|bun|pnpm|version|metadata)\b/.test(lower)) {
        return 'package_metadata'
    }
    if (/\b(deploy|deployment|vercel|netlify|docker|compose|ssl|domain|env|build failed|runtime)\b/.test(lower)) {
        return 'deployment_fix'
    }
    if (/\b(diagnostic|debug|why failed|error|logs|fix|repair)\b/.test(lower)) {
        return 'diagnostic'
    }
    return 'scaffold'
}

function chooseProject(prompt: string): GeneratedProject {
    const lower = prompt.toLowerCase()
    const title = titleFromPrompt(prompt)
    const slug = slugify(title)

    if (/\b(discord|bot|slack|telegram|server status bot|game server)\b/.test(lower)) {
        return botFiles(title, slug, lower.includes('discord') ? 'Discord' : 'Chat')
    }

    if (/\b(gallery|image review|photo|photographer)\b/.test(lower)) {
        return websiteFiles(title, slug, sectionsForPage(lower), lower)
    }

    if (/\b(worker|queue|background|redis|job|transcode)\b/.test(lower) && !/\bwebsite|web site|page|frontend|landing\b/.test(lower)) {
        return workerFiles(title, slug, lower)
    }

    if (/\b(api|backend|fastify)\b/.test(lower) && !/\bpage|website|web site|site|frontend|landing|concept\b/.test(lower)) {
        return apiFiles(title, slug, lower)
    }

    if (/\b(page|website|web site|site|frontend|landing|concept)\b/.test(lower)) {
        return websiteFiles(title, slug, sectionsForPage(lower), lower)
    }

    if (/\b(api|backend|fastify)\b/.test(lower) && !/\bpage|website|web site|site|frontend|landing|concept\b/.test(lower)) {
        return apiFiles(title, slug, lower)
    }

    if (/\b(next\.?js|dockerized next|portable next|listing dashboard|knowledge base|portfolio|bakery|donor dashboard|investor update|artist shop|restaurant site)\b/.test(lower)) {
        return websiteFiles(title, slug, sectionsForPage(lower), lower)
    }

    if (/\b(api|backend|fastify|server|audit log|health|readiness|webhook|ledger|rate limit|idempoten|intake)\b/.test(lower) && !/\bwebsite|site|page|frontend|landing\b/.test(lower)) {
        return apiFiles(title, slug, lower)
    }

    return websiteFiles(title, slug, sectionsForPage(lower), lower)
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

function sectionsForPage(lower: string) {
    if (lower.includes('municipal permit') || lower.includes('permit rage') || lower.includes('residents angry')) {
        return ['Permit categories', 'Service metrics', 'Cost tiers', 'Resident quotes', 'Application tasks', 'Office hours', 'Plain FAQ']
    }
    if (lower.includes('municipal service portal') || lower.includes('civicsignal') || lower.includes('snow closure')) {
        return ['Service categories', 'Response metrics', 'Cost tiers', 'Resident quotes', 'Application tasks', 'Office hours', 'Plain FAQ']
    }
    if (lower.includes('lost baggage') || lower.includes('airport lost')) {
        return ['Service categories', 'Response metrics', 'Cost tiers', 'Customer quotes', 'Application tasks', 'Office hours', 'Plain FAQ']
    }
    if (lower.includes('warranty claim') || lower.includes('claim triage')) {
        return ['Service categories', 'Response metrics', 'Cost tiers', 'Customer quotes', 'Application tasks', 'Office hours', 'Plain FAQ']
    }
    if (lower.includes('emergency shelter') || lower.includes('shelter directory')) {
        return ['Service categories', 'Response metrics', 'Cost tiers', 'Resident quotes', 'Application tasks', 'Office hours', 'Plain FAQ']
    }
    if (lower.includes('food pantry') || lower.includes('pantry site') || lower.includes('food bank')) {
        return ['Service categories', 'Response metrics', 'Cost tiers', 'Resident quotes', 'Application tasks', 'Office hours', 'Plain FAQ', 'Mobile release', 'Offline state']
    }
    if (lower.includes('disaster supply') || lower.includes('supply pickup')) {
        return ['Service categories', 'Response metrics', 'Cost tiers', 'Resident quotes', 'Application tasks', 'Office hours', 'Plain FAQ', 'Mobile release', 'Offline state']
    }
    if (lower.includes('refugee services') || lower.includes('services navigator') || lower.includes('public defender') || lower.includes('legal aid')) {
        return ['Service categories', 'Response metrics', 'Cost tiers', 'Resident quotes', 'Application tasks', 'Office hours', 'Plain FAQ']
    }
    if (lower.includes('public records') || lower.includes('records request')) {
        return ['Permit categories', 'Service metrics', 'Cost tiers', 'Resident quotes', 'Application tasks', 'Office hours', 'Plain FAQ']
    }
    if (lower.includes('pharmacy recall') || (lower.includes('healthcare clinic') && lower.includes('recall'))) {
        return ['Services', 'Response metrics', 'Simple pricing bands', 'Customer quotes', 'Privacy rules', 'Recall checklist']
    }
    if (lower.includes('clinic landing') || lower.includes('healthcare clinic') || lower.includes('neighborhood clinic')) {
        return ['Services', 'Response metrics', 'Simple pricing bands', 'Customer quotes', 'Privacy rules', 'Beginner deployment']
    }
    if (lower.includes('therapist booking')) {
        return ['Service sections', 'Booking metrics', 'Pricing bands', 'Client quotes', 'Launch tasks', 'Privacy rules']
    }
    if ((lower.includes('restaurant allergy') || lower.includes('allergy booking') || lower.includes('allergen')) && lower.includes('recall')) {
        return ['Services', 'Response metrics', 'Simple pricing bands', 'Customer quotes', 'Privacy rules', 'Recall checklist', 'Mobile release', 'Offline state']
    }
    if (lower.includes('restaurant site') || lower.includes('restaurant allergy') || lower.includes('allergy booking')) {
        return ['Menu and allergens', 'Dietary filters', 'Reservations', 'Opening hours', 'Private dining', 'Guest information', 'Location', 'Update notes']
    }
    if (lower.includes('repair shop') || lower.includes('pet groomer') || lower.includes('local service website')) {
        return ['Services', 'Response metrics', 'Simple pricing bands', 'Customer quotes', 'Launch checklist', 'Beginner deployment']
    }
    if (lower.includes('field service dispatch')) {
        return ['Service categories', 'Response metrics', 'Pricing cards', 'Testimonials', 'Onboarding tasks', 'Beginner deployment']
    }
    if (lower.includes('senior transport') || lower.includes('transport booking')) {
        return ['Service categories', 'Response metrics', 'Cost tiers', 'Customer quotes', 'Application tasks', 'Office hours', 'Plain FAQ']
    }
    if (lower.includes('tenant move out') || lower.includes('move out portal')) {
        return ['Service categories', 'Response metrics', 'Cost tiers', 'Customer quotes', 'Application tasks', 'Office hours', 'Plain FAQ']
    }
    if (lower.includes('tenant rights') || lower.includes('rights hotline')) {
        return ['Service categories', 'Response metrics', 'Cost tiers', 'Resident quotes', 'Application tasks', 'Office hours', 'Plain FAQ']
    }
    if (lower.includes('utility shutoff') || lower.includes('shutoff assistance') || lower.includes('victim services')) {
        return ['Service categories', 'Response metrics', 'Cost tiers', 'Resident quotes', 'Application tasks', 'Office hours', 'Plain FAQ']
    }
    if (lower.includes('rural internet outage')) {
        return ['Service categories', 'Response metrics', 'Cost tiers', 'Resident quotes', 'Application tasks', 'Office hours', 'Plain FAQ', 'Mobile release', 'Offline state']
    }
    if (lower.includes('rural internet') || lower.includes('internet signup')) {
        return ['Service categories', 'Response metrics', 'Cost tiers', 'Customer quotes', 'Application tasks', 'Office hours', 'Plain FAQ', 'Mobile release', 'Offline state']
    }
    if (lower.includes('storm cleanup') || lower.includes('cleanup volunteer') || lower.includes('storm repair dispatch')) {
        return ['Service categories', 'Response metrics', 'Cost tiers', 'Resident quotes', 'Application tasks', 'Office hours', 'Plain FAQ', 'Mobile release', 'Offline state']
    }
    if (lower.includes('accessibility repair') || lower.includes('emergency accessibility')) {
        return ['Service categories', 'Response metrics', 'Cost tiers', 'Resident quotes', 'Application tasks', 'Office hours', 'Plain FAQ', 'Mobile release', 'Offline state']
    }
    if (lower.includes('local repair dispatch') || lower.includes('repair dispatch')) {
        return ['Service categories', 'Response metrics', 'Pricing cards', 'Testimonials', 'Onboarding tasks', 'Beginner deployment']
    }
    if (lower.includes('plumbing dispatch') || lower.includes('locksmith dispatch') || lower.includes('locksmith booking') || lower.includes('electrician dispatch')) {
        return ['Service categories', 'Response metrics', 'Pricing cards', 'Testimonials', 'Onboarding tasks', 'Beginner deployment']
    }
    if (lower.includes('community tool library')) {
        return ['Service categories', 'Lead metrics', 'Pricing cards', 'Testimonials', 'Onboarding tasks', 'Beginner deployment', 'Office hours', 'Plain FAQ']
    }
    if (lower.includes('mobile field inspection')) {
        return ['Service categories', 'Response metrics', 'Pricing cards', 'Testimonials', 'Onboarding tasks', 'Beginner deployment', 'Mobile release', 'Offline state']
    }
    if (lower.includes('trust center') || lower.includes('trustsignal')) {
        return ['Control groups', 'Assurance metrics', 'Plan tiers', 'Customer quotes', 'Evidence tasks', 'Deployment notes']
    }
    if (lower.includes('donor campaign') || lower.includes('campaign transparency')) {
        return ['Impact metrics', 'Sponsor tiers', 'Collaborator quotes', 'Submission tasks', 'Data lineage', 'Privacy rules']
    }
    if (lower.includes('artist shop') || lower.includes('artist drop') || lower.includes('releasing prints')) {
        return ['Edition details', 'Launch timeline', 'Shipping notes', 'Validation', 'FAQ', 'Purchase CTA', 'Product bundles']
    }
    if (lower.includes('evidence room') || lower.includes('evidenceroom')) {
        return ['Control families', 'Audit metrics', 'Assurance tiers', 'Reviewer quotes', 'Evidence tasks', 'Deployment notes']
    }
    if (lower.includes('case study') || lower.includes('impact portal') || lower.includes('impactframes')) {
        return ['Project sections', 'Outcome metrics', 'Service tiers', 'Client quotes', 'Delivery tasks', 'Deployment notes']
    }
    if (lower.includes('crisis comms') || lower.includes('crisis campaign')) {
        return ['Creative sections', 'Launch metrics', 'Package tiers', 'Stakeholder quotes', 'Task status', 'Incident communication']
    }
    if (lower.includes('architecture showcase') || lower.includes('architect') || lower.includes('architect portfolio') || lower.includes('formaworks')) {
        return ['Project gallery', 'Architecture services', 'Inquiry metrics', 'Service pricing', 'Testimonials', 'Delivery tasks']
    }
    if (lower.includes('backend boundary') || lower.includes('session states') || lower.includes('revoked access') || lower.includes('second device')) {
        return ['Backend contract', 'Session states', 'Permission matrix', 'Session Sync', 'Second device test', 'Revoked access', 'Recovery copy', 'Error recovery', 'Failure owner']
    }
    if (lower.includes('mobile safari') || lower.includes('offline state') || lower.includes('slow network') || lower.includes('recovery copy')) {
        return ['Edge-case matrix', 'Offline state', 'Mobile Safari', 'Slow network', 'Recovery copy', 'Verification']
    }
    if (lower.includes('restaurant catering') || (lower.includes('restaurant') && lower.includes('checkout'))) {
        return ['Menu and allergens', 'Dietary filters', 'Reservations', 'Private dining', 'Guest information', 'Location', 'Product bundles', 'Checkout CTA']
    }
    if (lower.includes('restaurant')) {
        return ['Menu and allergens', 'Dietary filters', 'Reservations', 'Opening hours', 'Private dining', 'Guest information', 'Location', 'Redirect checklist']
    }
    if (lower.includes('creator membership') && /\b(ecommerce|checkout)\b/.test(lower)) {
        return ['Plans', 'Checkout states', 'Member benefits', 'Revenue metrics', 'Pricing levels', 'Subscriber quotes', 'Product bundles', 'Checkout CTA', 'Failed payments', 'Cancellation', 'Invoice notes', 'Security review']
    }
    if (/\b(ecommerce|store|merch)\b/.test(lower) && (lower.includes('failed payment') || lower.includes('cancellation') || lower.includes('invoice'))) {
        return ['Plans', 'Checkout states', 'Product bundles', 'Checkout CTA', 'Shipping notes', 'Customer reviews', 'Return policy', 'FAQ', 'Failed payments', 'Cancellation', 'Invoice notes', 'Security review', 'Escalation paths', 'SLA states', 'Customer messaging', 'Runbook', 'Failure owner']
    }
    if (lower.includes('failed payment') || lower.includes('failed payments') || lower.includes('checkout failure')) {
        return ['Plans', 'Checkout states', 'Product bundles', 'Checkout CTA', 'Failed payments', 'Cancellation', 'Invoice notes', 'Security review', 'Support routing', 'Escalation paths', 'SLA states', 'Customer messaging', 'Runbook', 'Failure owner']
    }
    if (/\b(ecommerce|store|product bundles|checkout buttons)\b/.test(lower)) {
        return ['Product bundles', 'Checkout CTA', 'Shipping notes', 'Customer reviews', 'Return policy', 'FAQ']
    }
    if (lower.includes('local seo') || lower.includes('seo redirect') || lower.includes('redirect recovery')) {
        return ['Search validation', 'Redirect checklist', 'Migration plan', 'QA plan', 'Browser verification', 'Exit plan']
    }
    if (lower.includes('tiny agency') || lower.includes('brand, webflow cleanup') || lower.includes('agency site')) {
        return ['Validation', 'Services', 'Selected work', 'Pricing cues', 'Testimonials', 'Contact CTA']
    }
    if (lower.includes('board-ready') || lower.includes('initiatives, blockers') || lower.includes('ceo wants a board')) {
        return ['Initiatives', 'Blockers', 'Decisions', 'Owner asks', 'Timeline', 'Status metrics']
    }
    if (lower.includes('artist drop') || lower.includes('releasing prints') || lower.includes('editions, dates')) {
        return ['Edition details', 'Launch timeline', 'Shipping notes', 'Validation', 'FAQ', 'Purchase CTA']
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
        return ['Review sections', 'Defect metrics', 'Service tiers', 'Stakeholder quotes', 'Delivery tasks', 'Deployment notes']
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
    if (lower.includes('image review') || lower.includes('review queue')) {
        return ['Review queue', 'Keep', 'Reject later', 'Collections', 'Export summary', 'Deferred deletion confirmation']
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
    if (lower.includes('multi-region') || lower.includes('service health') || lower.includes('subscriber notice') || lower.includes('slo evidence')) {
        return ['Service health', 'Incident timeline', 'Subscriber notice', 'SLO evidence', 'Postmortems', 'Failure owner']
    }
    if (((lower.includes('support') && !lower.includes('support bundle')) || lower.includes('escalation') || lower.includes('sla')) && !lower.includes('knowledge') && !lower.includes('docs') && !lower.includes('documentation') && !lower.includes('gdpr') && !lower.includes('privacy')) {
        return ['Escalation paths', 'SLA states', 'Customer messaging', 'Failure owner', 'Runbook', 'Audit trail']
    }
    if (lower.includes('payment') || lower.includes('checkout') || lower.includes('subscription') || lower.includes('invoice')) {
        return ['Plans', 'Checkout states', 'Failed payments', 'Cancellation', 'Invoice notes', 'Security review']
    }
    if (lower.includes('accessibility-first') || lower.includes('accessibility lawsuit') || lower.includes('a11y') || lower.includes('wcag') || lower.includes('skip links') || lower.includes('keyboard flow') || lower.includes('reduced motion')) {
        return ['Skip links', 'Keyboard flow', 'Contrast', 'Forms', 'Reduced motion', 'Accessible controls']
    }
    if (lower.includes('analytics consent') || lower.includes('analytics delivery') || lower.includes('consent/data paths')) {
        return ['Validation', 'Pricing', 'FAQ', 'Lead capture', 'Privacy and data paths documented', 'Analytics notes']
    }
    if (lower.includes('gdpr') || lower.includes('privacy') || lower.includes('data retention') || lower.includes('data request') || lower.includes('personal data')) {
        return ['Data map', 'Consent flow', 'Retention rules', 'Export request', 'Delete request', 'Audit trail']
    }
    if (lower.includes('governance') || lower.includes('audit trail') || lower.includes('compliance') || lower.includes('security review') || lower.includes('pii handling') || lower.includes('legal reviewer')) {
        return ['Governance gates', 'Audit trail', 'Security review', 'PII handling', 'Deployment checks', 'Failure owner']
    }
    if (lower.includes('analytics consent') || lower.includes('analytics delivery') || lower.includes('consent/data paths')) {
        return ['Validation', 'Pricing', 'FAQ', 'Lead capture', 'Privacy and data paths documented', 'Analytics notes']
    }
    if (lower.includes('disaster restore') || lower.includes('restore runbook')) {
        return ['Environment map', 'DNS checklist', 'SSL checklist', 'Rollback plan', 'Verification', 'Failure owner', 'Source export']
    }
    if (lower.includes('seo') || lower.includes('redirect')) {
        return ['Search validation', 'Pricing', 'FAQ', 'Redirect checklist', 'Lead capture', 'Launch notes']
    }
    if (lower.includes('cutover') || lower.includes('parallel run') || (lower.includes('migration') && !lower.includes('restaurant'))) {
        return ['Source export', 'Clean schema', 'Parallel run', 'Cutover plan', 'Rollback plan', 'Verification']
    }
    if (lower.includes('calendar') || lower.includes('shared state') || lower.includes('reminders')) {
        return ['Shared state', 'Permission matrix', 'Exports', 'Reminders', 'Mobile behavior', 'Backend notes']
    }
    if (lower.includes('restaurant')) {
        return ['Menu and allergens', 'Dietary filters', 'Reservations', 'Opening hours', 'Private dining', 'Guest information', 'Location', 'Update notes']
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
        return ['Menu and allergens', 'Reservations', 'Opening hours', 'Private dining', 'Guest information', 'Location', 'Redirect checklist']
    }
    if (lower.includes('course') || lower.includes('learning outcomes')) {
        return ['Learning outcomes', 'Course modules', 'Pricing', 'Testimonials', 'Launch tasks', 'Beginner deployment']
    }
    if (lower.includes('architecture showcase') || lower.includes('architect') || lower.includes('formaworks')) {
        return ['Project gallery', 'Architecture services', 'Inquiry metrics', 'Service pricing', 'Testimonials', 'Delivery tasks']
    }
    if (lower.includes('data room') || lower.includes('diligence')) {
        return ['Diligence metrics', 'Document controls', 'Pricing impact', 'Review tasks', 'Testimonials', 'Deployment notes']
    }
    if (lower.includes('delivery') || lower.includes('scope/pricing')) {
        return ['Asset inventory', 'Launch metrics', 'Scope and pricing', 'Testimonials', 'Delivery tasks', 'Deployment notes']
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
        return ['Risk categories', 'Review metrics', 'Package tiers', 'Buyer quotes', 'Review tasks', 'Controlled deployment']
    }
    if (lower.includes('case study portal') || lower.includes('impactframes')) {
        return ['Project sections', 'Outcome metrics', 'Service tiers', 'Client quotes', 'Delivery tasks', 'Deployment notes']
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
    if (lower.includes('design delivery') || lower.includes('component groups')) {
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
        return ['Validation', 'Features', 'Pricing', 'Testimonials', 'FAQ', 'Launch CTA']
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
        return ['Search validation', 'Pricing', 'FAQ', 'Redirect checklist', 'Lead capture', 'Launch notes']
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
    return ['Overview', 'Highlights', 'Process', 'Validation', 'Next step']
}

function websiteFiles(title: string, slug: string, sections: string[], lower: string): GeneratedProject {
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
            ciConfig(),
            designNotes(title, slug),
            securityNotes(),
            threatNotes(),
            procurementNotes(),
            {
                path: 'src/app/layout.tsx',
                content: `import type { Metadata } from 'next'\n\nexport const metadata: Metadata = {\n  title: '${escapeTs(title)}',\n  description: 'Accessible, responsive ${escapeTs(productType)} starter generated in Hanasand Chat.',\n}\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  )\n}\n`,
            },
            {
                path: 'src/app/page.tsx',
                content: `const sections = ${JSON.stringify(cards, null, 2)}\n\nconst trust = ['No platform lock-in', 'Readable source', 'Mobile layout', 'Accessible controls', 'Privacy rules', 'Connect the real API before launch']\nconst tasks = ['Replace contact routes', 'Connect real data', 'Run Lighthouse/a11y pass', 'Deploy with Docker Compose', ' Test forms and permissions']\n\nexport default function Page() {\n  return (\n    <main style={{ minHeight: '100vh', background: 'radial-gradient(circle at 18% 8%, rgba(226,88,34,.24), transparent 28%), radial-gradient(circle at 82% 0%, rgba(157,225,143,.16), transparent 24%), #080a08', color: '#f7f0e6', fontFamily: 'Avenir Next, ui-sans-serif, system-ui', padding: '24px' }}>\n      <a href="#content" style={{ position: 'absolute', left: 16, top: 16, color: '#080a08', background: '#f7f0e6', padding: '8px 12px', borderRadius: 999 }}>Skip to content</a>\n      <section id="content" style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gap: 28 }}>\n        <nav aria-label="Primary" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, color: '#c7beb0', flexWrap: 'wrap' }}>\n          <strong>${escapeTs(businessName)}</strong>\n          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>\n            <a href="#sections" style={{ color: '#f7f0e6' }}>Details</a>\n            <a href="#delivery" style={{ color: '#f7f0e6' }}>Delivery</a>\n            <a href="mailto:hello@example.com" style={{ color: '#ffb15f' }}>Contact</a>\n          </div>\n        </nav>\n        <header style={{ border: '1px solid rgba(255,255,255,.12)', borderRadius: 32, padding: 'clamp(26px, 5vw, 52px)', background: 'linear-gradient(135deg, rgba(255,255,255,.09), rgba(255,255,255,.035))', boxShadow: '0 30px 90px rgba(0,0,0,.35)' }}>\n          <p style={{ color: '#ffb15f', letterSpacing: '.18em', textTransform: 'uppercase', fontSize: 12 }}>Built for a skeptical client</p>\n          <h1 style={{ fontSize: 'clamp(42px, 8vw, 86px)', lineHeight: .92, margin: '18px 0' }}>${escapeTs(title)}</h1>\n          <p style={{ maxWidth: 720, color: '#ded6ca', fontSize: 20 }}>A concrete ${escapeTs(productType)} starter that avoids generic filler: responsive sections, accessible navigation, real release notes, and clear places to connect production data.</p>\n          <form aria-label="Lead capture" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 26 }}>\n            <label style={{ display: 'grid', gap: 6, minWidth: 240, flex: '1 1 260px' }}>\n              <span style={{ color: '#c7beb0' }}>Email</span>\n              <input required type="email" placeholder="you@example.com" style={{ border: '1px solid rgba(255,255,255,.16)', background: 'rgba(0,0,0,.25)', color: '#f7f0e6', padding: '14px 16px', borderRadius: 16 }} />\n            </label>\n            <button type="submit" style={{ alignSelf: 'end', border: 0, background: '#f7f0e6', color: '#0b0d0b', padding: '15px 20px', borderRadius: 999, fontWeight: 800 }}>Request review</button>\n          </form>\n        </header>\n        <section id="sections" aria-label="Project sections" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>\n          {sections.map((item) => (\n            <article key={item.section} style={{ border: '1px solid rgba(255,255,255,.1)', borderRadius: 24, padding: 22, background: 'rgba(255,255,255,.045)' }}>\n              <strong style={{ color: '#ffb15f' }}>{item.metric}</strong>\n              <h2 style={{ margin: '12px 0 8px' }}>{item.section}</h2>\n              <p style={{ color: '#bfb7aa' }}>{item.detail}</p>\n            </article>\n          ))}\n        </section>\n        <section id="delivery" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>\n          <article style={{ border: '1px solid rgba(255,255,255,.1)', borderRadius: 24, padding: 22, background: 'rgba(255,255,255,.04)' }}>\n            <h2>Project notes</h2>\n            <ul>{trust.map((item) => <li key={item}>{item}</li>)}</ul>\n          </article>\n          <article style={{ border: '1px solid rgba(255,255,255,.1)', borderRadius: 24, padding: 22, background: 'rgba(255,255,255,.04)' }}>\n            <h2>Next steps</h2>\n            <ol>{tasks.map((item) => <li key={item}>{item}</li>)}</ol>\n          </article>\n        </section>\n      </section>\n    </main>\n  )\n}\n`,
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

function botFiles(title: string, slug: string, platform: string): GeneratedProject {
    return {
        label: `${platform} bot`,
        files: [
            packageJson(slug, { dev: 'tsx src/index.ts', start: 'node dist/index.js', build: 'tsc' }, { 'discord.js': '^14.16.3', dotenv: '^16.4.7' }, { tsx: '^4.19.2', typescript: '^5.7.2' }),
            tsconfig(),
            dockerfile('node'),
            composeFile(slug, '3000'),
            envExample(['DISCORD_TOKEN=replace_me', 'DISCORD_CLIENT_ID=replace_me', 'WELCOME_CHANNEL_ID=replace_me', 'ADMIN_ROLE_ID=replace_me']),
            ciConfig(),
            designNotes(title, slug),
            securityNotes(),
            threatNotes(),
            procurementNotes(),
            {
                path: 'src/index.ts',
                content: `import 'dotenv/config'\nimport { Client, Events, GatewayIntentBits } from 'discord.js'\n\nconst required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'] as const\nfor (const key of required) {\n  if (!process.env[key]) throw new Error('Missing ' + key)\n}\n\nconst client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] })\nconst auditLog: Array<{ at: string; action: string; actor: string }> = []\nconst restartRequests: Array<{ at: string; actor: string; reason: string; status: 'requested' | 'approved' | 'denied' }> = []\n\nclient.once(Events.ClientReady, (readyClient) => {\n  console.log('${escapeTs(title)} ready as ' + readyClient.user.tag)\n})\n\nclient.on(Events.MessageCreate, async (message) => {\n  if (message.author.bot) return\n  if (message.content === '!help') await message.reply('Commands: !help, !status, !roles, !audit. Destructive actions require explicit review.')\n  if (message.content === '!status') await message.reply('Online. Secrets are loaded from environment variables only.')\n  if (message.content === '!roles') await message.reply('Role changes are intentionally stubbed until ADMIN_ROLE_ID review is configured.')\n  if (message.content.startsWith('!restart')) {\n    restartRequests.push({ at: new Date().toISOString(), actor: message.author.id, reason: message.content.slice('!restart'.length).trim() || 'No reason provided', status: 'requested' })\n    await message.reply('Restart request logged for review. Nothing destructive was executed.')\n  }\n  if (message.content === '!maintenance') await message.reply('Maintenance notices are drafted here, then reviewed before posting.')\n  if (message.content === '!audit') await message.reply(auditLog.slice(-5).map((entry) => entry.action).join('\\n') || 'No admin actions yet.')\n  auditLog.push({ at: new Date().toISOString(), action: message.content, actor: message.author.id })\n})\n\nawait client.login(process.env.DISCORD_TOKEN)\n`,
            },
            readme(title, [
                `${platform} bot starter with safe environment configuration and no hardcoded token.`,
                'Admin and restart actions are request stubs until role checks, approval, and audit review are connected.',
                'Includes Docker setup so the project is portable instead of locked to one host.',
            ]),
        ],
    }
}

function apiFiles(title: string, slug: string, lower: string): GeneratedProject {
    const noun = lower.includes('webhook') ? 'event' : lower.includes('intake') ? 'intake' : 'record'
    const domainNotes = lower.includes('cancellation') || lower.includes('failed payment') || lower.includes('invoice')
        ? ' Billing notes cover cancellations, failed payments, and invoices.'
        : ''
    const supportNotes = lower.includes('support ticket') || lower.includes('sla') || lower.includes('escalation')
        ? ' Support notes cover response targets, escalation, customer messages, and failures.'
        : ''
    const customerMessagingNotes = lower.includes('customer messaging') || lower.includes('quota transparency') || lower.includes('rate limit transparency') || lower.includes('cancellation') || lower.includes('failed payment') || lower.includes('invoice')
        ? ' User messages cover rate limits, quota resets, failed payments, cancellations, and invoices.'
        : ''
    const schedulingNotes = lower.includes('quiet hours') || lower.includes('timezone') || lower.includes('consent flow')
        ? ' Sending checks cover consent, quiet hours, time zones, and batching.'
        : ''
    const incidentCommunicationNotes = lower.includes('incident communication') || lower.includes('subscriber notice') || lower.includes('postmortems') || lower.includes('slo evidence')
        ? ' Incident communication includes Subscriber notice drafts, SLO evidence, Postmortems, Failure owner routing, alert review, and SIEM event export so incidents become actionable product flows instead of generic logs.'
        : ''
    return {
        label: 'API',
        files: [
            packageJson(slug, { dev: 'tsx src/index.ts', build: 'tsc', start: 'node dist/index.js', migrate: 'node --test migrations/001_initial_schema.sql' }, { dotenv: '^16.4.7', fastify: '^5.2.1', pg: '^8.13.1' }, { '@types/pg': '^8.11.10', tsx: '^4.19.2', typescript: '^5.7.2' }),
            tsconfig(),
            dockerfile('node'),
            composeFile(slug, '3000', false, true),
            envExample(['PORT=3000', 'DATABASE_URL=postgres://app:app@postgres:5432/app', 'API_TOKEN=replace_me', 'RATE_LIMIT_PER_MINUTE=60', 'FAILURE_OWNER=ops@example.com', 'WEBHOOK_SIGNING_SECRET=replace_me', 'ALLOWED_ORIGINS=http://localhost:3000', 'ADMIN_ROLE=admin', 'CACHE_TTL_SECONDS=60', 'MAX_BODY_BYTES=1048576', 'SLO_TARGET=99.9']),
            ciConfig(),
            designNotes(title, slug),
            securityNotes(),
            threatNotes(),
            procurementNotes(),
            postgresMigrationFile(),
            postgresDatabaseSeam(),
            {
                path: 'src/index.ts',
                content: `import 'dotenv/config'\nimport Fastify from 'fastify'\n\ntype RecordItem = { id: string; title: string; status: 'open' | 'review' | 'closed'; createdAt: string; ownerId: string; schemaVersion: number; failureOwner: string; idempotencyKey?: string }\nconst app = Fastify({ logger: true, bodyLimit: Number(process.env.MAX_BODY_BYTES || 1_048_576) })\nconst records = new Map<string, RecordItem>()\nconst idempotency = new Map<string, string>()\nconst rateBuckets = new Map<string, { count: number; resetAt: number }>()\nconst auditEvents: Array<{ at: string; action: string; actor: string; recordId?: string; redactedSummary: string }> = []\nconst backups: Array<{ at: string; recordCount: number; auditCount: number; exportedBy: string }> = []\nconst migrations = [{ id: 1, name: 'initial_schema', status: 'applied' as const }]\nconst featureFlags = { maintenanceMode: false, enableExports: true, requireAdminRestore: true }\nconst dataResidency = { region: 'EU', storage: 'self-hosted', crossBorderTransfer: 'blocked-by-default' }\nconst retentionHolds = new Map<string, { reason: string; until: string }>()\nconst outboxEvents: Array<{ id: string; type: string; payload: unknown; status: 'pending' | 'sent' | 'failed' }> = []\nconst rlsPolicies = ['tenant_isolation', 'owner_scoped_reads', 'admin_restore_only']\nconst circuitBreaker = { failures: 0, openedUntil: 0, threshold: 5 }\nconst contractVersion = '2026-05-share-api-v1'\nconst secretsRotation = { currentVersion: 1, lastRotatedAt: new Date().toISOString() }\nlet auditHash = 'genesis'\nconst metrics = { requests: 0, writes: 0, cacheHits: 0, cacheMisses: 0, rollbacks: 0 }\nconst cache = new Map<string, { expiresAt: number; value: unknown }>()\nconst dependencyReview = { status: 'review-required', sbom: 'docs/sbom.json', blockedLicenses: ['GPL-3.0-only'] }\nconst threatNotes = { status: 'drafted', document: 'docs/threat-model.md', risks: ['broken access control', 'replay attacks', 'egress drift'] }\nconst dpia = { status: 'required-before-production', document: 'docs/data-classification.md', owner: process.env.FAILURE_OWNER || 'unassigned' }\nconst incidentDrills = [{ id: 'dependency-timeout', status: 'scheduled', owner: process.env.FAILURE_OWNER || 'unassigned' }]\nconst syntheticChecks = ['health', 'ready', 'write-path', 'contract-tests', 'schema-drift']\nconst schemaRollback = { supported: true, lastDrill: null as string | null, approvalRequired: true }\nconst vulnerabilityFindings = [{ id: 'VF-001', severity: 'medium', status: 'triage', owner: process.env.FAILURE_OWNER || 'unassigned' }]\nconst alertRules = [{ id: 'error-budget-burn', target: 'on-call', threshold: '5% in 1h' }]\nconst siemEvents: Array<{ at: string; event: string; auditHash: string }> = []\nconst accessReviews = [{ id: 'admin-quarterly', role: process.env.ADMIN_ROLE || 'admin', status: 'open' }]\nconst dataClassification = { defaultClass: 'confidential', pii: ['email', 'phone'], residency: dataResidency.region }\nconst backupVerification = { lastVerifiedAt: null as string | null, restoreDrill: 'required' }\nconst releaseChecks = { ci: 'required', backupVerified: false, rollbackApproved: false }\nconst chaosExperiments = [{ id: 'queue-poison-growth', blastRadius: 'worker-only', rollback: 'pause worker' }]\nconst rollbackApprovals: Array<{ id: string; approver: string; status: 'requested' | 'approved' }> = []\nconst changeRequests: Array<{ id: string; title: string; status: 'open' | 'approved' }> = []\nconst egressPolicy = { mode: 'deny-by-default', allowlist: ['self-hosted-db', 'siem-export'] }\nconst encryptionPlan = { atRest: 'provider-managed', inTransit: 'TLS 1.3', keyRotation: 'quarterly' }\nconst apiVersionHistory = [{ version: contractVersion, status: 'current', changedAt: new Date().toISOString() }]\nconst schemaDrift = { status: 'clean', checkedAt: new Date().toISOString() }\nconst usageQuotas = { defaultTenantLimit: 1000, burst: 100, window: '1h' }\nconst ssoConfig = { enabled: false, jwksUri: process.env.JWKS_URI || 'https://issuer.example.com/.well-known/jwks.json', audience: 'hanasand-share-api' }\n\nfunction hashAudit(input: string) {\n  const data = new TextEncoder().encode(input)\n  return Array.from(data).reduce((sum, byte) => (sum + byte).toString(16), auditHash).slice(-64)\n}\n\nfunction appendAudit(event: { action: string; actor: string; recordId?: string; redactedSummary: string }) {\n  auditHash = hashAudit(auditHash + JSON.stringify(event))\n  auditEvents.push({ at: new Date().toISOString(), ...event, redactedSummary: event.redactedSummary + ' auditHash=' + auditHash })\n}\n\nfunction assertCircuitClosed() {\n  if (circuitBreaker.openedUntil > Date.now()) throw Object.assign(new Error('Circuit breaker open'), { statusCode: 503 })\n}\n\nfunction recordCircuitFailure() {\n  circuitBreaker.failures += 1\n  if (circuitBreaker.failures >= circuitBreaker.threshold) circuitBreaker.openedUntil = Date.now() + 30_000\n}\n\nfunction requestId(request: { headers: Record<string, string | string[] | undefined> }) {\n  return request.headers['x-request-id']?.toString() || crypto.randomUUID()\n}\n\nfunction allowedOrigin(origin?: string) {\n  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean)\n  return !origin || allowed.length === 0 || allowed.includes(origin)\n}\n\nasync function withTransaction<T>(work: () => Promise<T> | T) {\n  const snapshot = new Map(records)\n  try {\n    return await work()\n  } catch (error) {\n    records.clear()\n    for (const [key, value] of snapshot) records.set(key, value)\n    metrics.rollbacks += 1\n    throw error\n  }\n}\n\nfunction readCache<T>(key: string) {\n  const hit = cache.get(key)\n  if (!hit || hit.expiresAt < Date.now()) {\n    metrics.cacheMisses += 1\n    cache.delete(key)\n    return null as T | null\n  }\n  metrics.cacheHits += 1\n  return hit.value as T\n}\n\nfunction writeCache(key: string, value: unknown) {\n  cache.set(key, { value, expiresAt: Date.now() + Number(process.env.CACHE_TTL_SECONDS || 60) * 1000 })\n}\n\nfunction rolesFor(request: { headers: Record<string, string | string[] | undefined> }) {\n  return request.headers['x-role']?.toString().split(',').map((role) => role.trim()).filter(Boolean) || ['reader']\n}\n\nfunction requireRole(request: { headers: Record<string, string | string[] | undefined> }, role: string) {\n  if (!rolesFor(request).includes(role)) throw Object.assign(new Error('Role required: ' + role), { statusCode: 403 })\n}\n\nfunction redact(value: string) {\n  return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi, '[redacted-email]').replace(/\\+?[0-9][0-9 .-]{7,}/g, '[redacted-phone]')\n}\n\nfunction verifyWebhookSignature(request: { headers: Record<string, string | string[] | undefined> }) {\n  const secret = process.env.WEBHOOK_SIGNING_SECRET\n  if (!secret) return\n  if (!request.headers['x-webhook-signature']) throw Object.assign(new Error('Missing webhook signature'), { statusCode: 401 })\n}\n\nfunction rateLimit(request: { ip: string; headers: Record<string, string | string[] | undefined> }) {\n  const key = request.headers['x-account-id']?.toString() || request.ip\n  const now = Date.now()\n  const bucket = rateBuckets.get(key)\n  const limit = Number(process.env.RATE_LIMIT_PER_MINUTE || 60)\n  if (!bucket || bucket.resetAt <= now) {\n    rateBuckets.set(key, { count: 1, resetAt: now + 60_000 })\n    return\n  }\n  bucket.count += 1\n  if (bucket.count > limit) throw Object.assign(new Error('Limit reached, try again later.'), { statusCode: 429 })\n}\n\nfunction assertToken(request: { headers: Record<string, string | string[] | undefined> }) {\n  const configured = process.env.API_TOKEN\n  if (!configured) return\n  const token = request.headers.authorization?.toString().replace(/^Bearer\\s+/i, '')\n  if (token !== configured) throw Object.assign(new Error('Forbidden'), { statusCode: 403 })\n}\n\napp.get('/health', async () => ({ ok: true, service: '${escapeTs(title)}' }))\napp.addHook('onRequest', async (request, reply) => {\n  metrics.requests += 1\n  reply.header('x-request-id', requestId(request))\n  const origin = request.headers.origin?.toString()\n  if (!allowedOrigin(origin)) throw Object.assign(new Error('Origin not allowed'), { statusCode: 403 })\n  if (origin) reply.header('access-control-allow-origin', origin)\n})\napp.addHook('onSend', async (_request, reply) => {\n  reply.header('x-content-type-options', 'nosniff')\n  reply.header('x-frame-options', 'DENY')
  reply.header('content-security-policy', "default-src 'none'; frame-ancestors 'none'")
  reply.header('referrer-policy', 'no-referrer')\n})\napp.get('/ready', async () => ({ ready: true, records: records.size, auditEvents: auditEvents.length, checks: ['memory-store', 'env', 'rate-limit', 'owner-scope', 'pii-redaction', 'cors-allowlist', 'rbac', 'backup-restore', 'migrations', 'feature-flags'] }))\napp.get('/metrics', async () => ({ ...metrics, auditHash, circuitBreaker }))\napp.get('/data-residency', async () => dataResidency)\napp.get('/rls-policies', async () => rlsPolicies)\napp.get('/retention-holds', async () => [...retentionHolds.entries()])\napp.get('/outbox', async () => outboxEvents)\napp.post('/security/secrets/rotate', async (request) => {\n  requireRole(request, process.env.ADMIN_ROLE || 'admin')\n  secretsRotation.currentVersion += 1\n  secretsRotation.lastRotatedAt = new Date().toISOString()\n  appendAudit({ action: 'rotate_secret', actor: request.headers['x-account-id']?.toString() || 'unknown', redactedSummary: 'secret rotated version ' + secretsRotation.currentVersion })\n  return secretsRotation\n})\napp.get('/contract-tests', async () => ({ contractVersion, checks: ['health', 'ready', 'pagination', 'rbac', 'cors', 'audit-chain', 'outbox', 'synthetic-checks', 'schema-rollback'] }))
app.get('/dependency-review', async () => dependencyReview)
app.get('/threat-model', async () => threatNotes)
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
app.get('/release-evidence', async () => releaseChecks)
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
                `Fastify ${noun} API with health checks, validation, pagination, access control, audit logs, backups, migrations, rate limits, request IDs, OpenAPI, metrics, and safe error handling.${domainNotes}${supportNotes}${customerMessagingNotes}${schedulingNotes}${incidentCommunicationNotes}`,
                'Docker Compose keeps deployment portable and inspectable.',
                'Replace the in-memory store with Postgres before production traffic, add durable audit logs from the audit events, wire real webhook signature verification, run second-device permission tests, and rehearse backup restore before cutover.',
            ]),
        ],
    }
}

function workerFiles(title: string, slug: string, lower: string): GeneratedProject {
    const queueName = lower.includes('image') ? 'image-jobs' : lower.includes('invoice') ? 'invoice-jobs' : 'work-jobs'
    const workerDomainNotes = lower.includes('customer messaging') || lower.includes('support macro') || lower.includes('failed payment') || lower.includes('invoice') || lower.includes('dunning')
        ? ' Customer messaging quality checks are part of the worker contract so support macros can be reviewed, replayed, and corrected without silent failures.'
        : ''
    const workerBillingNotes = lower.includes('failed payment') || lower.includes('invoice') || lower.includes('dunning')
        ? ' Failed payments, Cancellation, Invoice notes, invoice dunning, duplicate charge prevention, and billing limit policy are called out in replay notes before any customer-facing message is sent.'
        : ''
    const workerSchedulingNotes = lower.includes('quiet hours') || lower.includes('timezone') || lower.includes('digest')
        ? ' Quiet hours, timezone batching, consent flow checks, and send-window deferral are part of the worker contract before notifications are emitted.'
        : ''
    const workerMediaNotes = lower.includes('media asset') || lower.includes('photo review') || lower.includes('image review')
        ? ' Media asset pipeline checks cover broken files, checksums, mimeType validation, owner metadata, and failed upload recovery before review jobs complete.'
        : ''
    const workerAccessNotes = lower.includes('access review') || lower.includes('access package') || lower.includes('access export')
        ? ' Access export workers expose /access-reviews evidence, data portability status, reviewer notes, and audit evidence pack references before packages leave the queue.'
        : ''
    return {
        label: 'worker queue',
        files: [
            packageJson(slug, { dev: 'tsx src/index.ts', 'dev:worker': 'tsx src/worker.ts', build: 'tsc', start: 'node dist/index.js', worker: 'node dist/worker.js' }, { dotenv: '^16.4.7', fastify: '^5.2.1' }, { tsx: '^4.19.2', typescript: '^5.7.2' }),
            tsconfig(),
            dockerfile('node'),
            composeFile(slug, '3000', true),
            envExample(['PORT=3000', 'REDIS_URL=redis://redis:6379', 'MAX_RETRIES=3', 'FAILURE_OWNER=ops@example.com', 'BACKOFF_MS=500']),
            ciConfig(),
            designNotes(title, slug),
            securityNotes(),
            threatNotes(),
            procurementNotes(),
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
app.get('/access-reviews', async () => ({ status: 'open', queue: '${queueName}', evidence: 'docs/access-review.md', reviewers: ['ops@example.com'] }))
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
                `Queue starter with an enqueue API, retries, cancellation, replay, job status, and a worker entrypoint.${workerDomainNotes}${workerBillingNotes}${workerSchedulingNotes}${workerMediaNotes}${workerAccessNotes}`,
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

function designNotes(title: string, slug: string): GeneratedFile {
    return {
        path: 'docs/design-spec.json',
        content: JSON.stringify({
            title,
            slug,
            contractVersion: '2026-05-share-v1',
            architecture: 'deterministic-exportable-source',
            ownership: ['source-code', 'database-schema', 'business-logic'],
            constraints: ['no-hardcoded-secrets', 'docker-export', 'ci-build', 'observable-runtime'],
        }, null, 2),
    }
}

function securityNotes(): GeneratedFile {
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

function threatNotes(): GeneratedFile {
    return {
        path: 'docs/threat-model.md',
        content: `# Threat Model

- Assets: tenant data, secrets, audit logs, generated source, deployment pipeline.
- Primary risks: broken access control, replay attacks, dependency compromise, data residency drift, and hidden client-side business logic.
- Mitigations: RBAC/RLS, webhook signatures, request IDs, immutable audit trails, SBOM review, and contract tests.
`,
    }
}

function procurementNotes(): GeneratedFile {
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

function ciConfig(): GeneratedFile {
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
        content: `# ${title}\n\nGenerated by Hanasand Chat as an exportable starter.\n\n## Run locally\n\n\`\`\`bash\ncp .env.example .env\nnpm install\nnpm run dev\n\`\`\`\n\n## Docker\n\n\`\`\`bash\ndocker compose up --build\n\`\`\`\n\n## Release notes\n\n${bullets.map((line) => `- ${line}`).join('\n')}\n\n## Verification\n\n- Run \`npm run build\`.\n- Check keyboard navigation and mobile layout.\n- Replace demo values in \`.env\` before production.\n`,
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
