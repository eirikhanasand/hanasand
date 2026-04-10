import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

export default async function aiTool(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { prompt, context } = req.body as { prompt?: string, context?: string } ?? {}
    if (!prompt) {
        return res.status(400).send({ error: 'Missing prompt.' })
    }

    if (!process.env.OPENAI_API_KEY) {
        return res.send({
            status: 'configured_later',
            message: 'AI endpoint is wired and authenticated. Set OPENAI_API_KEY to enable live completions.',
            suggestion: `Draft request help: ${prompt.slice(0, 160)}${context ? ` Context: ${context.slice(0, 160)}` : ''}`,
        })
    }

    return res.status(501).send({
        error: 'AI provider call is intentionally disabled until model/provider policy is selected.',
    })
}
