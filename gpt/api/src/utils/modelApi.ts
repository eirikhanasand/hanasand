import config from '#constants'
import { getModelState, updateModelState } from '#utils/modelState.ts'
import runModelToolLoop from '#utils/tools/modelToolLoop.ts'

const DEFAULT_MAX_TOKENS = 10000

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

function modelUrl(path: string) {
    return `${config.model_api}${path}`
}

export async function fetchSlotMetrics() {
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
        return getModelState()
    }

    const generatedTokens = slot.next_token?.n_decoded || 0
    const contextMaxTokens = slot.n_ctx || contextCache.total || getModelState().contextMaxTokens
    const requestedMaxTokens = slot.params?.max_tokens ?? getModelState().maxTokens
    const maxTokens = requestedMaxTokens && requestedMaxTokens > 0 ? requestedMaxTokens : DEFAULT_MAX_TOKENS

    updateModelState({
        status: slot.is_processing ? (generatedTokens > 0 ? 'generating' : 'preparing') : getModelState().status,
        generatedTokens: Math.max(generatedTokens, getModelState().generatedTokens),
        maxTokens,
        contextMaxTokens,
        contextTokens: Math.max(getModelState().promptTokens + generatedTokens, getModelState().contextTokens),
    })

    return getModelState()
}

async function fetchContextMaxTokens() {
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

function toPromptEvent(type: 'prompt_started' | 'prompt_delta' | 'prompt_complete' | 'prompt_error', payload: Record<string, unknown>) {
    return JSON.stringify({
        type,
        timestamp: new Date().toISOString(),
        ...payload,
    })
}

export async function promptModel(request: GPT_PromptRequest, send: (event: string) => void) {
    const currentState = getModelState()
    if (currentState.status === 'preparing' || currentState.status === 'generating') {
        throw new Error('Model is already handling another prompt.')
    }

    const maxTokens = request.maxTokens && request.maxTokens > 0 ? request.maxTokens : DEFAULT_MAX_TOKENS
    const promptSource = await renderChatPrompt(request.messages)
    const [promptTokens, contextMaxTokens] = await Promise.all([
        countTokens(promptSource),
        fetchContextMaxTokens(),
    ])

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
        const content = await runModelToolLoop(request)
        const completionId = `hanasand-${Date.now()}`
        const [generatedTokens, contextMax] = await Promise.all([
            countTokens(content),
            fetchContextMaxTokens(),
        ])

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

        send(toPromptEvent('prompt_delta', {
            conversationId: request.conversationId,
            completionId,
            clientName: request.clientName || null,
            delta: content,
            content,
            metrics: getModelState(),
        }))

        send(toPromptEvent('prompt_complete', {
            conversationId: request.conversationId,
            completionId,
            clientName: request.clientName || null,
            content,
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
        const state = getModelState()
        if (state.status === 'preparing' || state.status === 'generating') {
            updateModelState({
                status: 'idle',
            })
        }
    }
}
