import { useCallback, useState } from 'react'
import { createAssistantMessage, createUserMessage, toRequestMessages } from './chatMessages'
import { applyClientMetrics, applyPromptEvent } from './chatReducers'
import defaultModelMetrics from './defaultModelMetrics'
import normalizeClient from './normalizeClient'

export default function useGptChatSession(
    socketRef: React.RefObject<WebSocket | null>
) {
    const [chatSession, setChatSession] = useState<ChatSession | null>(null)

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
        const socket = socketRef.current
        if (!chatSession || !socket || socket.readyState !== WebSocket.OPEN) return
        const userMessage = createUserMessage(content)
        const requestMessages = toRequestMessages([...chatSession.messages, userMessage])
        setChatSession((prev) => prev
            ? {
                ...prev,
                isSending: true,
                messages: [...prev.messages, userMessage, createAssistantMessage(prev.conversationId)]
            }
            : prev)
        socket.send(JSON.stringify({
            type: 'prompt_request',
            conversationId: chatSession.conversationId,
            clientName: chatSession.clientName,
            messages: requestMessages,
            maxTokens: 512,
            temperature: 0.7,
        }))
    }

    const handleMessage = useCallback((msg: GptSocketMessage) => {
        setChatSession((prev) => {
            if (msg.type === 'update' && msg.client) {
                return applyClientMetrics(prev, normalizeClient(msg.client))
            }

            return applyPromptEvent(prev, msg)
        })
    }, [])

    return {
        handleMessage,
        chatSession,
        closeChat: () => setChatSession(null),
        openChat,
        sendPrompt,
    }
}
