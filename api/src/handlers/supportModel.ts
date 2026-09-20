import type { FastifyReply, FastifyRequest } from 'fastify'
import { hasSupportServiceKey } from '#utils/support/config.ts'
import { answerSupport } from '#utils/support/assistant.ts'

export async function supportModel(req: FastifyRequest<{ Body: { history?: unknown } }>, res: FastifyReply) {
    if (!hasSupportServiceKey(req)) return res.code(403).send({ error: 'Forbidden' })
    const history = req.body?.history
    if (!Array.isArray(history) || history.length > 20 || !history.every(item => item && ['user', 'assistant', 'support', 'system'].includes(item.sender_kind)
        && typeof item.body === 'string' && item.body.length <= 4000)) return res.code(400).send({ error: 'Invalid support history' })
    const worker = process.env.AI_HEALTH_WORKER_BASE
    try {
        if (worker) {
            if (req.headers['x-support-model-forwarded']) throw new Error('Support model forwarding loop')
            const response = await fetch(worker.replace(/\/$/, '') + '/api/support/model', { method: 'POST',
                headers: { 'content-type': 'application/json', 'x-support-service-key': process.env.SUPPORT_SERVICE_KEY!, 'x-support-model-forwarded': '1' },
                body: JSON.stringify({ history }), redirect: 'error', signal: AbortSignal.timeout(50000) })
            return res.code(response.status).send(await response.json())
        }
        return res.send({ answer: await answerSupport(history) })
    } catch { return res.code(503).send({ error: 'The AI worker is unavailable.' }) }
}
