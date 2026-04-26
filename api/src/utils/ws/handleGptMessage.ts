import type { RawData } from 'ws'
import { WebSocket as WS } from 'ws'

export const gpt = new Map<string, Set<WS>>()
export const gptSockets = new Map<WS, GPT_SocketState>()
type RegisteredGptClient = GPT_Client & {
    lastSeen: string
    socket: WS
}

const gptClientRegistry = new Map<string, Map<string, RegisteredGptClient>>()

function defaultModelMetrics(): GPT_ModelMetrics {
    return {
        conversationId: null,
        status: 'idle',
        currentTokens: 0,
        maxTokens: 0,
        promptTokens: 0,
        generatedTokens: 0,
        contextTokens: 0,
        contextMaxTokens: 0,
        tps: 0,
        lastUpdated: null,
        lastError: null,
    }
}

function normalizeClient(client: GPT_Client): GPT_Client {
    return {
        ...client,
        model: {
            ...defaultModelMetrics(),
            ...(client.model || {}),
        },
    }
}

export async function handleGptMessage(
    id: string,
    socket: WS,
    rawMessage: RawData,
) {
    try {
        const msg = JSON.parse(rawMessage.toString()) as { type?: string, client?: GPT_Client }

        switch (msg.type) {
            case 'update': {
                if (!msg.client) {
                    return
                }

                const normalizedClient = normalizeClient(msg.client)
                rememberClient(id, socket, normalizedClient)

                gptSockets.set(socket, {
                    role: 'producer',
                    clientName: normalizedClient.name,
                })
                broadcastUpdate(id, socket, normalizedClient)
                return
            }

            case 'prompt_request':
                relayPromptRequest(id, socket, msg as GPT_PromptRequest)
                return

            case 'prompt_started':
            case 'prompt_tool':
            case 'prompt_delta':
            case 'prompt_complete':
            case 'prompt_error':
                broadcastPromptEvent(id, socket, msg)
                return

            default:
                return
        }
    } catch (err) {
        console.error('Invalid WebSocket message:', err)
    }
}

function rememberClient(id: string, socket: WS, client: GPT_Client) {
    const bucket = gptClientRegistry.get(id) || new Map<string, RegisteredGptClient>()
    bucket.set(client.name, {
        ...client,
        lastSeen: new Date().toISOString(),
        socket,
    })
    gptClientRegistry.set(id, bucket)
}

export function listGptClients(id: string) {
    const bucket = gptClientRegistry.get(id)
    return bucket ? [...bucket.values()].map(({ socket, ...client }) => {
        void socket
        return client
    }) : []
}

export function unregisterGptSocket(id: string, socket: WS) {
    const state = gptSockets.get(socket)
    gptSockets.delete(socket)
    if (!state?.clientName) {
        return
    }

    const bucket = gptClientRegistry.get(id)
    if (!bucket) {
        return
    }

    const entry = bucket.get(state.clientName)
    if (!entry || entry.socket !== socket) {
        return
    }

    bucket.delete(state.clientName)
    if (!bucket.size) {
        gptClientRegistry.delete(id)
    }
}

export function sendGptSnapshot(id: string, socket: WS) {
    const clients = listGptClients(id)
    const participants = gpt.get(id)?.size || 0
    socket.send(JSON.stringify({
        type: 'snapshot',
        clients,
        participants,
        timestamp: new Date().toISOString(),
    }))
}

function relayPromptRequest(id: string, requester: WS, request: GPT_PromptRequest) {
    const clients = gpt.get(id)
    if (!clients) {
        return
    }

    const targets = [...clients].filter((client) => {
        if (client === requester || client.readyState !== WS.OPEN) {
            return false
        }

        const state = gptSockets.get(client)
        if (!state || state.role !== 'producer') {
            return false
        }

        return !request.clientName || state.clientName === request.clientName
    })

    if (!targets.length) {
        requester.send(JSON.stringify({
            type: 'prompt_error',
            conversationId: request.conversationId,
            clientName: request.clientName || null,
            error: request.clientName
                ? `Client ${request.clientName} is not connected.`
                : 'No model client is connected.',
            timestamp: new Date().toISOString(),
        }))
        return
    }

    targets[0].send(JSON.stringify(request))
}

function broadcastUpdate(id: string, sender: WS, client: GPT_Client) {
    const clients = gpt.get(id)
    if (!clients) {
        return
    }

    const payload = JSON.stringify({
        type: 'update',
        client,
        timestamp: new Date().toISOString(),
        participants: clients.size
    })

    for (const clientSocket of clients) {
        if (clientSocket !== sender && clientSocket.readyState === WS.OPEN) {
            clientSocket.send(payload)
        }
    }
}

function broadcastPromptEvent(id: string, sender: WS, event: { type?: string }) {
    const clients = gpt.get(id)
    if (!clients) {
        return
    }

    const payload = JSON.stringify({
        ...event,
        timestamp: new Date().toISOString(),
    })

    for (const clientSocket of clients) {
        if (clientSocket !== sender && clientSocket.readyState === WS.OPEN) {
            clientSocket.send(payload)
        }
    }
}
