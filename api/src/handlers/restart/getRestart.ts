import config from '#constants'
import sanitize from '#utils/sanitize.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'

export default async function restartHandler(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id: rawId } = req.params as { id: string }
    const id = sanitize(rawId)
    if (!id) {
        return res.status(400).send({ error: 'No service provided' })
    }

    try {
        const internalRes = await fetch(`${config.internal_api}/docker/restart/${id}`, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'hanasand_internal'
            }
        })

        const json = await internalRes.json()

        if (!internalRes.ok) {
            return res.status(internalRes.status).send(json)
        }

        return res.send({ ok: true, detail: json })
    } catch (err: any) {
        console.error(`Error calling internal redeploy for ${id}:`, err)
        return res.status(500).send({ error: err.message })
    }
}
