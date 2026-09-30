import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'
import { getRateLimitSettings, listRateLimitRoutes } from '#utils/rateLimit/config.ts'
import { listApiKeyTierPresets } from '#utils/auth/apiKeys.ts'

export default async function getRateLimitSettingsHandler(req: FastifyRequest, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')

    const access = await tokenWrapper(req, res)
    if (!access.valid) {
        return res.status(401).send({ error: access.error || 'Unauthorized.' })
    }

    const role = await hasHanasandInternalRouteAccess(req)
    if (!role.valid) {
        return res.status(403).send({ error: role.error || 'Active Hanasand organization owner or editor access is required.' })
    }

    const settings = await getRateLimitSettings({ fresh: true })
    return res.send({
        settings,
        routes: listRateLimitRoutes(),
        tierPresets: listApiKeyTierPresets(),
    })
}
