import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { saveRateLimitSettings } from '#utils/rateLimit/config.ts'

export default async function putRateLimitSettingsHandler(req: FastifyRequest, res: FastifyReply) {
    const access = await tokenWrapper(req, res)
    if (!access.valid || !access.id) {
        return res.status(401).send({ error: access.error || 'Unauthorized.' })
    }

    const role = await hasRole(req, res, 'system_admin')
    if (!role.valid) {
        return res.status(403).send({ error: role.error || 'Missing system_admin role.' })
    }

    const settings = await saveRateLimitSettings(req.body, access.id)
    return res.send({ settings })
}
