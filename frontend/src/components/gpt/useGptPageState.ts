import { useEffect, useMemo, useRef, useState } from 'react'
import defaultModelMetrics from './defaultModelMetrics'
import normalizeClient from './normalizeClient'
import config from '@/config'

function createPendingAssistantMessage(conversationId: string): GPT_ChatMessage {
    return {
        id: `${conversationId}-assistant`,
        role: 'assistant',
        content: '',
        pending: true,
    }
}

export default function useGptPageState() {
    const [clients, setClients] = useState<GPT_Client[]>([])
    const [reconnect, setReconnect] = useState(false)
    const [isConnected, setIsConnected] = useState(false)
    const [participants, setParticipants] = useState(1)
    const [chatSession, setChatSession] = useState<ChatSession | null>(null)
    const socketRef = useRef<WebSocket | null>(null)

    useEffect(() => {
        const ws = new WebSocket(`${config.url.api_wss}/client/ws/gpt`)
        socketRef.current = ws

        ws.onopen = () => {
            setReconnect(false)
            setIsConnected(true)
        }

        ws.onclose = () => {
            setIsConnected(false)
            socketRef.current = null
        }

        ws.onerror = (error) => {
            console.log('WebSocket error:', error)
            setIsConnected(false)
        }

        ws.onmessage = (event) => {
            try {
                handleSocketMessage(JSON.parse(event.data) as GptSocketMessage, setChatSession, setClients, setParticipants)
            } catch (error) {
                console.error('Invalid message from server:', error)
            }
        }

        return () => ws.close()
    }, [reconnect])

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (!isConnected) {
                setReconnect(true)
            }
        }, 3000)

        return () => clearTimeout(timeout)
    }, [isConnected])

    function openChat(client: GPT_Client) {
        setChatSession((prev) => prev?.clientName === client.name
            ? { ...prev, metrics: client.model }
            : {
                clientName: client.name,
                conversationId: crypto.randomUUID(),
                messages: [],
                isSending: false,
                metrics: client.model || defaultModelMetrics(),
            })
    }

    function sendPrompt(content: string) {
        if (!chatSession || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            return
        }

        const userMessage: GPT_ChatMessage = { id: crypto.randomUUID(), role: 'user', content }
        const requestMessages = [...chatSession.messages, userMessage]
            .filter(message => message.role === 'user' || message.role === 'assistant')
            .map(message => ({ role: message.role, content: message.content }))

        setChatSession((prev) => prev
            ? {
                ...prev,
                isSending: true,
                messages: [...prev.messages, userMessage, createPendingAssistantMessage(prev.conversationId)],
            }
            : prev)

        socketRef.current.send(JSON.stringify({
            type: 'prompt_request',
            conversationId: chatSession.conversationId,
            clientName: chatSession.clientName,
            messages: requestMessages,
            maxTokens: 512,
            temperature: 0.7,
        }))
    }

    const activeClient = useMemo(() => {
        if (!chatSession) {
            return null
        }

        return clients.find(client => client.name === chatSession.clientName) || null
    }, [chatSession, clients])

    return {
        activeClient,
        chatSession,
        clients,
        closeChat: () => setChatSession(null),
        isConnected,
        openChat,
        participants,
        sendPrompt,
    }
}

function handleSocketMessage(
    msg: GptSocketMessage,
    setChatSession: React.Dispatch<React.SetStateAction<ChatSession | null>>,
    setClients: React.Dispatch<React.SetStateAction<GPT_Client[]>>,
    setParticipants: React.Dispatch<React.SetStateAction<number>>
) {
    switch (msg.type) {
        case 'update': {
            if (!msg.client) return
            const normalizedClient = normalizeClient(msg.client)
            setParticipants(msg.participants || 0)
            setClients((prev) => {
                const existing = prev.find(client => client.name === normalizedClient.name)
                return existing
                    ? prev.map(client => client.name === normalizedClient.name
                        ? { ...client, ...normalizedClient, model: normalizedClient.model }
                        : client)
                    : [...prev, normalizedClient]
            })
            setChatSession((prev) => (
                !prev || prev.clientName !== normalizedClient.name
                    ? prev
                    : { ...prev, metrics: normalizedClient.model }
            ))
            return
        }
        case 'join':
            setParticipants(msg.participants || 0)
            return
        case 'prompt_started':
            return setChatSession((prev) => updatePromptStart(prev, msg))
        case 'prompt_delta':
            return setChatSession((prev) => updatePromptDelta(prev, msg))
        case 'prompt_complete':
            return setChatSession((prev) => updatePromptComplete(prev, msg))
        case 'prompt_error':
            return setChatSession((prev) => updatePromptError(prev, msg))
        default:
            return
    }
}

function updatePromptStart(session: ChatSession | null, msg: GptSocketMessage) {
    if (!session || session.conversationId !== msg.conversationId) return session
    return {
        ...session,
        isSending: true,
        metrics: msg.metrics || session.metrics,
        messages: session.messages.some(message => message.role === 'assistant' && message.pending)
            ? session.messages
            : [...session.messages, createPendingAssistantMessage(session.conversationId)],
    }
}

function updatePromptDelta(session: ChatSession | null, msg: GptSocketMessage) {
    if (!session || session.conversationId !== msg.conversationId) return session
    const messages = [...session.messages]
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === 'assistant') {
        messages[messages.length - 1] = {
            ...lastMessage,
            content: msg.content || `${lastMessage.content}${msg.delta || ''}`,
            pending: true,
        }
    }

    return { ...session, isSending: true, metrics: msg.metrics || session.metrics, messages }
}

function updatePromptComplete(session: ChatSession | null, msg: GptSocketMessage) {
    if (!session || session.conversationId !== msg.conversationId) return session
    const messages = [...session.messages]
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === 'assistant') {
        messages[messages.length - 1] = {
            ...lastMessage,
            content: msg.content || lastMessage.content,
            pending: false,
        }
    }

    return { ...session, isSending: false, metrics: msg.metrics || session.metrics, messages }
}

function updatePromptError(session: ChatSession | null, msg: GptSocketMessage) {
    if (!session || session.conversationId !== msg.conversationId) return session
    const messages = [...session.messages]
    const lastMessage = messages[messages.length - 1]
    const content = msg.error || 'The model failed to answer this prompt.'
    if (lastMessage?.role === 'assistant' && lastMessage.pending) {
        messages[messages.length - 1] = { ...lastMessage, content, pending: false, error: true }
    } else {
        messages.push({
            id: `${session.conversationId}-error-${Date.now()}`,
            role: 'assistant',
            content,
            error: true,
        })
    }

    return {
        ...session,
        isSending: false,
        metrics: msg.metrics || { ...session.metrics, status: 'error', lastError: content },
        messages,
    }
}
