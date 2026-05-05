import { writeModelOverheadSample } from '#utils/modelOverhead.ts'
import config from '#constants'
import { getModelState, resetModelState, updateModelState } from '#utils/modelState.ts'
import { acquireModelLane, releaseModelLane } from '#utils/modelLanes.ts'
import runModelToolLoop from '#utils/tools/modelToolLoop.ts'

const DEFAULT_MAX_TOKENS = 10000
const CONFIGURED_CONTEXT_MAX_TOKENS = Number(process.env.HANASAND_MODEL_CONTEXT_MAX_TOKENS || 0)
const IS_CHAT_COMPLETIONS_BACKEND = process.env.HANASAND_MODEL_BACKEND === 'vllm'
    || process.env.HANASAND_MODEL_PROFILE?.includes('vllm')

let contextCache = {
    fetchedAt: 0,
    total: 0,
}
let lastSlotWarningAt = 0

function isExpectedStartupResponse(error: unknown) {
    return error instanceof Error && error.message === 'Failed to fetch slots: 503'
}

function logSlotWarning(error: unknown) {
    const now = Date.now()
    if (now - lastSlotWarningAt < 30000) {
        return
    }

    lastSlotWarningAt = now
    console.warn('Unable to fetch model slot metrics:', error)
}

function modelUrl(path: string, baseUrl = config.model_api) {
    return `${baseUrl}${path}`
}

export async function fetchSlotMetrics() {
    if (IS_CHAT_COMPLETIONS_BACKEND) {
        if (CONFIGURED_CONTEXT_MAX_TOKENS > 0) {
            contextCache = {
                fetchedAt: Date.now(),
                total: CONFIGURED_CONTEXT_MAX_TOKENS,
            }
        }
        return null
    }

    try {
        const response = await fetch(modelUrl('/slots'))
        if (!response.ok) {
            throw new Error(`Failed to fetch slots: ${response.status}`)
        }

        const slots = await response.json() as GPT_LlamaSlot[]
        if (!Array.isArray(slots) || !slots.length) {
            return null
        }

        const activeSlot = slots.find(slot => slot.is_processing) || slots[0]
        if (!activeSlot) {
            return null
        }

        if (activeSlot.n_ctx) {
            contextCache = {
                fetchedAt: Date.now(),
                total: activeSlot.n_ctx,
            }
        }

        return activeSlot
    } catch (error) {
        if (!isExpectedStartupResponse(error)) {
            logSlotWarning(error)
        }
        return null
    }
}

export async function syncModelRuntimeMetrics() {
    const slot = await fetchSlotMetrics()
    if (!slot) {
        if (CONFIGURED_CONTEXT_MAX_TOKENS > 0) {
            updateModelState({
                contextMaxTokens: CONFIGURED_CONTEXT_MAX_TOKENS,
            })
        }
        return getModelState()
    }

    const generatedTokens = slot.next_token?.n_decoded || 0
    const contextMaxTokens = slot.n_ctx || contextCache.total || getModelState().contextMaxTokens
    const requestedMaxTokens = slot.params?.max_tokens ?? getModelState().maxTokens
    const maxTokens = requestedMaxTokens && requestedMaxTokens > 0 ? requestedMaxTokens : DEFAULT_MAX_TOKENS

    if (!slot.is_processing) {
        resetModelState()
        updateModelState({
            maxTokens,
            contextMaxTokens,
        })
        return getModelState()
    }

    updateModelState({
        status: generatedTokens > 0 ? 'generating' : 'preparing',
        generatedTokens: Math.max(generatedTokens, getModelState().generatedTokens),
        maxTokens,
        contextMaxTokens,
        contextTokens: Math.max(getModelState().promptTokens + generatedTokens, getModelState().contextTokens),
    })

    return getModelState()
}

async function fetchContextMaxTokens() {
    if (CONFIGURED_CONTEXT_MAX_TOKENS > 0) {
        return CONFIGURED_CONTEXT_MAX_TOKENS
    }

    if (contextCache.total && Date.now() - contextCache.fetchedAt < 30000) {
        return contextCache.total
    }

    const slot = await fetchSlotMetrics()
    return slot?.n_ctx || contextCache.total || 0
}

async function countTokens(content: string) {
    if (!content) {
        return 0
    }

    if (IS_CHAT_COMPLETIONS_BACKEND) {
        return Math.ceil(content.length / 4)
    }

    try {
        const response = await fetch(modelUrl('/tokenize'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content,
            }),
        })

        if (!response.ok) {
            throw new Error(`Failed to tokenize: ${response.status}`)
        }

        const tokens = await response.json() as number[]
        return Array.isArray(tokens) ? tokens.length : 0
    } catch (error) {
        console.warn('Unable to count tokens:', error)
        return 0
    }
}

async function renderChatPrompt(messages: GPT_ChatMessage[]) {
    if (IS_CHAT_COMPLETIONS_BACKEND) {
        return messages.map(message => `${message.role}: ${message.content}`).join('\n')
    }

    try {
        const response = await fetch(modelUrl('/apply-template'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages,
            }),
        })

        if (!response.ok) {
            throw new Error(`Failed to apply chat template: ${response.status}`)
        }

        const payload = await response.json() as { prompt?: string }
        return payload.prompt || messages.map(message => message.content).join('\n')
    } catch (error) {
        console.warn('Unable to render chat prompt:', error)
        return messages.map(message => message.content).join('\n')
    }
}

function toPromptEvent(
    type: 'prompt_started' | 'prompt_delta' | 'prompt_complete' | 'prompt_error' | 'prompt_tool',
    payload: Record<string, unknown>,
) {
    return JSON.stringify({
        type,
        timestamp: new Date().toISOString(),
        ...payload,
    })
}

function updateMetricsFromTimings(timings: {
    cache_n?: number
    prompt_n?: number
    predicted_n?: number
    predicted_per_second?: number
} | undefined) {
    if (!timings) {
        return
    }

    updateModelState({
        status: 'generating',
        promptTokens: timings.prompt_n || getModelState().promptTokens,
        generatedTokens: timings.predicted_n || getModelState().generatedTokens,
        contextTokens: (timings.cache_n || 0) + (timings.prompt_n || 0) + (timings.predicted_n || 0),
        currentTokens: (timings.prompt_n || 0) + (timings.predicted_n || 0),
        tps: timings.predicted_per_second || getModelState().tps,
    })
}

async function emitStreamedContent(
    request: GPT_PromptRequest,
    completionId: string,
    content: string,
    send: (event: string) => void,
) {
    let accumulated = ''
    const chunks = content.match(/.{1,120}(\s|$)|.+$/g) || [content]

    for (const chunk of chunks) {
        accumulated += chunk
        send(toPromptEvent('prompt_delta', {
            conversationId: request.conversationId,
            completionId,
            clientName: request.clientName || null,
            delta: chunk,
            content: accumulated,
            metrics: getModelState(),
        }))
        await new Promise((resolve) => setTimeout(resolve, 12))
    }
}

export async function promptModel(request: GPT_PromptRequest, send: (event: string) => void) {
    const startedAt = Date.now()
    const selectedModelApi = acquireModelLane(request)

    const maxTokens = request.maxTokens && request.maxTokens > 0 ? request.maxTokens : DEFAULT_MAX_TOKENS
    const renderStartedAt = Date.now()
    const promptSource = await renderChatPrompt(request.messages)
    const renderPromptMs = Date.now() - renderStartedAt

    const tokenizeStartedAt = Date.now()
    const promptTokensPromise = countTokens(promptSource)
    const contextStartedAt = Date.now()
    const contextMaxTokensPromise = fetchContextMaxTokens()
    const [promptTokens, contextMaxTokens] = await Promise.all([
        promptTokensPromise,
        contextMaxTokensPromise,
    ])
    const tokenizePromptMs = Date.now() - tokenizeStartedAt
    const fetchContextMs = Date.now() - contextStartedAt

    updateModelState({
        conversationId: request.conversationId,
        status: 'preparing',
        maxTokens,
        promptTokens,
        generatedTokens: 0,
        currentTokens: promptTokens,
        contextTokens: promptTokens,
        contextMaxTokens,
        tps: 0,
        lastError: null,
    })

    send(toPromptEvent('prompt_started', {
        conversationId: request.conversationId,
        clientName: request.clientName || null,
        metrics: getModelState(),
    }))

    try {
        const toolLoopStartedAt = Date.now()
        const result = await runModelToolLoop(request, selectedModelApi, (toolEvent) => {
            send(toPromptEvent('prompt_tool', {
                conversationId: request.conversationId,
                clientName: request.clientName || null,
                toolId: toolEvent.toolId,
                toolLabel: toolEvent.toolLabel,
                toolState: toolEvent.toolState,
                toolDetail: toolEvent.toolDetail || null,
                metrics: getModelState(),
            }))
        })
        const toolLoopMs = Date.now() - toolLoopStartedAt
        const content = result.content
        const completionId = `hanasand-${Date.now()}`
        updateMetricsFromTimings(result.timings)
        const outputTokenizeStartedAt = Date.now()
        const generatedTokensPromise = countTokens(content)
        const outputContextStartedAt = Date.now()
        const contextMaxPromise = fetchContextMaxTokens()
        const [generatedTokens, contextMax] = await Promise.all([
            generatedTokensPromise,
            contextMaxPromise,
        ])
        const tokenizeOutputMs = Date.now() - outputTokenizeStartedAt
        const syncOutputContextMs = Date.now() - outputContextStartedAt

        const finalPromptTokens = getModelState().promptTokens || promptTokens
        const finalGeneratedTokens = Math.max(generatedTokens, getModelState().generatedTokens)
        updateModelState({
            status: 'idle',
            promptTokens: finalPromptTokens,
            generatedTokens: finalGeneratedTokens,
            currentTokens: finalPromptTokens + finalGeneratedTokens,
            contextTokens: finalPromptTokens + finalGeneratedTokens,
            contextMaxTokens: contextMax || contextMaxTokens,
            tps: getModelState().tps,
        })

        const emitStartedAt = Date.now()
        await emitStreamedContent(request, completionId, content, send)
        const streamEmitMs = Date.now() - emitStartedAt
        const totalMs = Date.now() - startedAt
        const persistedOverhead = await writeModelOverheadSample({
            sampleId: `${request.conversationId}:${Date.now()}`,
            sampleSource: 'runtime_prompt_loop',
            profileTag: process.env.HANASAND_MODEL_PROFILE || process.env.MODEL_NAME_OVERRIDE || null,
            recordedAt: new Date().toISOString(),
            conversationId: request.conversationId,
            clientName: request.clientName || null,
            modelApi: selectedModelApi,
            promptMessages: request.messages.length,
            maxTokens,
            promptTokens: finalPromptTokens,
            generatedTokens: finalGeneratedTokens,
            contextMaxTokens: contextMax || contextMaxTokens,
            tps: getModelState().tps,
            stages: {
                renderPromptMs,
                tokenizePromptMs,
                fetchContextMs,
                toolLoopMs,
                tokenizeOutputMs,
                syncOutputContextMs,
                streamEmitMs,
                totalMs,
            },
            loop: result.overhead,
            llama: {
                cache_n: result.timings?.cache_n || 0,
                prompt_n: result.timings?.prompt_n || 0,
                predicted_n: result.timings?.predicted_n || 0,
                predicted_per_second: result.timings?.predicted_per_second || 0,
            },
        })

        send(toPromptEvent('prompt_complete', {
            conversationId: request.conversationId,
            completionId,
            clientName: request.clientName || null,
            content,
            artifacts: result.artifacts || [],
            overhead: persistedOverhead.sample,
            metrics: getModelState(),
        }))

        return content
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown model error'
        updateModelState({
            status: 'error',
            lastError: message,
            tps: 0,
        })

        send(toPromptEvent('prompt_error', {
            conversationId: request.conversationId,
            clientName: request.clientName || null,
            error: message,
            metrics: getModelState(),
        }))

        throw error
    } finally {
        releaseModelLane(selectedModelApi)
        const state = getModelState()
        if (state.status === 'preparing' || state.status === 'generating') {
            updateModelState({
                status: 'idle',
            })
        }
    }
}
