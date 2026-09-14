import type { FastifyReply, FastifyRequest } from 'fastify'
import { gpt, listGptClients } from '#utils/ws/handleGptMessage.ts'
import { buildAiRuntimeState } from './runtime.ts'

export default async function getAiModels(req: FastifyRequest, res: FastifyReply) {
    if (req.headers['x-ai-models-forwarded'] && process.env.AI_HEALTH_WORKER_BASE) {
        return res.status(503).send({ error: 'Model worker forwarding loop.' })
    }
    const state = await readModelState()
    return res.header('Cache-Control', 'no-store, max-age=0').header('Pragma', 'no-cache').send(state)
}

// Model sockets belong to the persistent inference worker, not HTTP replicas.
export async function readModelState() {
    const base = process.env.AI_HEALTH_WORKER_BASE?.trim()
    if (base) {
        try {
            const response = await fetch(`${base.replace(/\/$/, '')}/api/ai/models`, {
                headers: { 'x-ai-models-forwarded': '1' },
                signal: AbortSignal.timeout(5000),
                redirect: 'error',
            })
            if (!response.ok) throw Object.assign(new Error('Model worker is unavailable.'), { statusCode: 503 })
            const state = await response.json() as { connected: GPT_Client[], runtimeState: ReturnType<typeof buildAiRuntimeState> }
            if (!Array.isArray(state.connected) || !state.runtimeState) throw Object.assign(new Error('Invalid model worker response.'), { statusCode: 503 })
            return state
        } catch {
            throw Object.assign(new Error('Model worker is unavailable.'), { statusCode: 503 })
        }
    }
    const connected = listGptClients('gpt')

    return {
        connected,
        runtimeState: buildAiRuntimeState({
            clients: connected,
            participants: gpt.get('gpt')?.size || 0,
        }),
    }
}
