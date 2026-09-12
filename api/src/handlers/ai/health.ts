import type { FastifyReply, FastifyRequest } from 'fastify'
import { listGptClients, requestGptCompletion } from '#utils/ws/handleGptMessage.ts'

export function connectedModels() {
    return listGptClients('gpt').filter(client => Date.now() - Date.parse(client.lastSeen || '') < 120_000)
}

export async function getModelHealth(req: FastifyRequest, res: FastifyReply) {
    if (await forwardWorkerHealth(req, res, 'models')) return
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

export async function getInferenceHealth(req: FastifyRequest, res: FastifyReply) {
    if (await forwardWorkerHealth(req, res, 'inference')) return
    const result = await checkInference()
    return res.header('Cache-Control', 'no-store').status(result.ok ? 200 : 503).send(result)
}

// HTTP replicas do not own model sockets. Ask the worker that performs inference.
async function forwardWorkerHealth(req: FastifyRequest, res: FastifyReply, check: 'models' | 'inference') {
    const base = process.env.AI_HEALTH_WORKER_BASE?.trim()
    if (!base) return false
    res.header('Cache-Control', 'no-store')
    try {
        if (req.headers['x-ai-health-forwarded']) throw new Error('Health forwarding loop')
        const response = await fetch(`${base.replace(/\/$/, '')}/api/ai/health/${check}`, {
            headers: { 'x-ai-health-forwarded': '1' },
            signal: AbortSignal.timeout(20_000),
            redirect: 'error',
        })
        const result = await response.json()
        if (![200, 503].includes(response.status) || typeof result?.ok !== 'boolean'
            || !Number.isInteger(result.connectedModels) || result.connectedModels < 0
            || (response.status === 200) !== result.ok) throw new Error('Invalid worker health response')
        res.status(response.status).send(result)
    } catch {
        res.status(503).send({ ok: false, connectedModels: 0, checkedAt: new Date().toISOString(), error: 'The inference worker health check is unavailable.' })
    }
    return true
}
