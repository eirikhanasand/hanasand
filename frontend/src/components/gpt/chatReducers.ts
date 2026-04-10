import defaultModelMetrics from './defaultModelMetrics'
import { createAssistantMessage } from './chatMessages'

export function applyClientMetrics(session: ChatSession | null, client: GPT_Client) {
    if (!session || session.clientName !== client.name) return session
    return { ...session, metrics: client.model }
}

export function applyPromptEvent(session: ChatSession | null, msg: GptSocketMessage) {
    if (!session || session.conversationId !== msg.conversationId) return session
    if (msg.type === 'prompt_started') {
        return {
            ...session,
            isSending: true,
            metrics: msg.metrics || session.metrics,
            messages: session.messages.some(message => message.role === 'assistant' && message.pending)
                ? session.messages
                : [...session.messages, createAssistantMessage(session.conversationId)]
        }
    }

    if (msg.type === 'prompt_delta') {
        return updateAssistant(session, msg.content || '', msg.metrics || session.metrics, true, false, msg.delta)
    }

    if (msg.type === 'prompt_complete') {
        return updateAssistant(session, msg.content || '', msg.metrics || session.metrics, false, false)
    }

    if (msg.type === 'prompt_error') return applyPromptError(session, msg)
    return session
}

function updateAssistant(
    session: ChatSession,
    content: string,
    metrics: GPT_ModelMetrics,
    pending: boolean,
    error: boolean,
    delta?: string
) {
    const nextMessages = [...session.messages]
    const lastMessage = nextMessages[nextMessages.length - 1]
    if (lastMessage?.role === 'assistant') {
        nextMessages[nextMessages.length - 1] = {
            ...lastMessage,
            content: content || `${lastMessage.content}${delta || ''}`,
            pending,
            error,
        }
    }

    return { ...session, isSending: pending, metrics, messages: nextMessages }
}

function applyPromptError(session: ChatSession, msg: GptSocketMessage) {
    const content = msg.error || 'The model failed to answer this prompt.'
    const nextMessages = [...session.messages]
    const lastMessage = nextMessages[nextMessages.length - 1]
    if (lastMessage?.role === 'assistant' && lastMessage.pending) {
        nextMessages[nextMessages.length - 1] = { ...lastMessage, content, pending: false, error: true }
    } else {
        nextMessages.push({
            id: `${session.conversationId}-error-${Date.now()}`,
            role: 'assistant',
            content,
            error: true,
        })
    }

    return {
        ...session,
        isSending: false,
        metrics: msg.metrics || {
            ...defaultModelMetrics(),
            ...session.metrics,
            status: 'error',
            lastError: content,
        },
        messages: nextMessages,
    }
}
