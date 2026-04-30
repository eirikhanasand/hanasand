import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { listGptClients, requestGptCompletion } from '#utils/ws/handleGptMessage.ts'

export default async function aiTool(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { prompt, context } = req.body as { prompt?: string, context?: string } ?? {}
    if (!prompt) {
        return res.status(400).send({ error: 'Missing prompt.' })
    }

    const clients = listGptClients('gpt')
    const preferredClient = clients
        .filter((client) => client.model.status !== 'error')
        .sort((left, right) => (right.model.tps || 0) - (left.model.tps || 0))[0]

    if (!preferredClient) {
        return res.status(503).send({
            error: 'No Hanasand AI model client is connected.',
        })
    }

    const conversationId = `tools-${crypto.randomUUID()}`
    const completion = await requestGptCompletion('gpt', {
        conversationId,
        clientName: preferredClient.name,
        maxTokens: 900,
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content: 'You are Hanasand AI inside the Hanasand developer workspace. Answer directly and use the provided context when it is relevant.',
            },
            {
                role: 'user',
                content: context
                    ? `${prompt}\n\nContext:\n${context}`
                    : prompt,
            },
        ],
    })

    return res.send({
        status: 'completed',
        provider: 'hanasand-ai',
        model: preferredClient.name,
        message: completion.content || '',
        artifacts: completion.artifacts || [],
        metrics: completion.metrics || null,
        conversationId,
    })
}
