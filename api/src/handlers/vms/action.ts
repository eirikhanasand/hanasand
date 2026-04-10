import config from '#constants'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import sanitize from '#utils/sanitize.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'

const allowedActions = new Set(['start', 'stop', 'restart'])

export default async function vmAction(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    const { valid: validRole } = await hasRole(req, res, 'system_admin')
    if (!valid || !validRole) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id: rawId, action: rawAction } = req.params as { id: string, action: string }
    const id = sanitize(rawId)
    const action = sanitize(rawAction)

    if (!id || !action || !allowedActions.has(action)) {
        return res.status(400).send({ error: 'Invalid VM action.' })
    }

    try {
        const internalRes = await fetch(`${config.internal_api}/vm/${encodeURIComponent(id)}/${action}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${encodeURIComponent(config.vm_api_token || '')}`,
                'Content-Type': 'application/json',
                'User-Agent': 'hanasand_api',
            },
        })

        const text = await internalRes.text()
        const payload = text ? JSON.parse(text) : {}

        if (!internalRes.ok) {
            return res.status(internalRes.status).send(payload)
        }

        return res.send(payload)
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Unable to contact internal VM API.' })
    }
}
