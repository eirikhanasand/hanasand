import type { FastifyReply, FastifyRequest } from 'fastify'
import { listGptClients, requestGptCompletion } from '#utils/ws/handleGptMessage.ts'

export function connectedModels() {
    return listGptClients('gpt').filter(client => Date.now() - Date.parse(client.lastSeen || '') < 120_000)
}

export async function getModelHealth(_req: FastifyRequest, res: FastifyReply) {
    const clients = connectedModels()
    return res.header('Cache-Control', 'no-store').status(clients.length ? 200 : 503).send({
        ok: clients.length > 0, connectedModels: clients.length,
        models: clients.map(client => ({ name: client.name, model: client.modelId, status: client.model.status })),
        checkedAt: new Date().toISOString(),
    })
}

type InferenceHealth = { ok: boolean, connectedModels: number, checkedAt: string, latencyMs: number, error?: string }
let cached: InferenceHealth | undefined
let pending: Promise<InferenceHealth> | undefined

export async function checkInference(): Promise<InferenceHealth> {
    const clients = connectedModels()
    if (!clients.length) return { ok: false, connectedModels: 0, checkedAt: new Date().toISOString(), latencyMs: 0, error: 'No model is connected.' }
    if (cached && Date.now() - Date.parse(cached.checkedAt) < 30_000) return { ...cached, connectedModels: clients.length }
    pending ||= (async() => {
        const started = Date.now()
        try {
            const completion = await requestGptCompletion('gpt', {
                conversationId: `health-${crypto.randomUUID()}`,
                clientName: clients.find(client => client.model.status !== 'error')?.name || clients[0].name,
                messages: [{ role: 'user', content: 'Reply with exactly OK.' }],
                maxTokens: 32, temperature: 0,
            }, 15_000)
            if (!completion.content?.trim()) throw new Error('The model returned an empty response.')
            return { ok: true, connectedModels: clients.length, checkedAt: new Date().toISOString(), latencyMs: Date.now() - started }
        } catch {
            return { ok: false, connectedModels: clients.length, checkedAt: new Date().toISOString(), latencyMs: Date.now() - started, error: 'The model did not complete the inference check.' }
        }
    })().then(result => { cached = result; return result }).finally(() => { pending = undefined })
    return pending
}

export async function getInferenceHealth(_req: FastifyRequest, res: FastifyReply) {
    const result = await checkInference()
    return res.header('Cache-Control', 'no-store').status(result.ok ? 200 : 503).send(result)
}
