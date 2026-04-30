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

    const browserTarget = parseBrowserOpenTarget(prompt)
    if (browserTarget) {
        return res.send({
            status: 'handled',
            provider: 'hanasand-desktop',
            intent: 'open_browser',
            message: `Open ${browserTarget.title} in the Hanasand browser.`,
            target: browserTarget,
        })
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

    try {
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
    } catch (error) {
        req.log.error({ error, promptLength: prompt.length, clientName: preferredClient.name }, 'Hanasand AI tool request failed')
        return res.status(502).send({
            error: error instanceof Error ? error.message : 'Hanasand AI failed to generate a response.',
        })
    }
}

function parseBrowserOpenTarget(prompt: string) {
    const trimmed = prompt.trim()
    const match = /^(?:open|go to|browse|show)\s+(.+?)\s*$/i.exec(trimmed)
    const rawTarget = match?.[1]?.replace(/\s+(?:in )?(?:browser|the browser)$/i, '').trim()
    if (!rawTarget) {
        return null
    }

    const shortcuts: Record<string, { url: string, title: string }> = {
        vg: { url: 'https://www.vg.no', title: 'VG' },
        'vg.no': { url: 'https://www.vg.no', title: 'VG' },
        nrk: { url: 'https://www.nrk.no', title: 'NRK' },
        'nrk.no': { url: 'https://www.nrk.no', title: 'NRK' },
        google: { url: 'https://www.google.com', title: 'Google' },
        github: { url: 'https://github.com', title: 'GitHub' },
        hanasand: { url: 'https://hanasand.com', title: 'Hanasand' },
    }
    const shortcut = shortcuts[rawTarget.toLowerCase()]
    if (shortcut) {
        return shortcut
    }

    try {
        const url = new URL(rawTarget.includes('://') ? rawTarget : `https://${rawTarget}`)
        if (!url.hostname.includes('.')) {
            return null
        }
        return {
            url: url.toString(),
            title: url.hostname.replace(/^www\./, ''),
        }
    } catch {
        return null
    }
}
