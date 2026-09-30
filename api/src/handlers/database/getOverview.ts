import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'
import { collectLiveDatabaseOverview } from '#utils/db/overview.ts'

export default async function getDatabaseOverview(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) return res.status(401).send({ error: 'Unauthorized.' })

    const role = await hasHanasandInternalRouteAccess(req)
    if (!role.valid) return res.status(403).send({ error: 'Active Hanasand organization owner or editor access is required.' })

    return res.send(await collectLiveDatabaseOverview())
}
