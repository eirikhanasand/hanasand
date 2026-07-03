import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { collectLiveDatabaseOverview } from '#utils/db/overview.ts'

export default async function getDatabaseOverview(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) return res.status(401).send({ error: 'Unauthorized.' })

    const role = await hasRole(req, res, 'system_admin')
    if (!role.valid) return res.status(403).send({ error: 'Missing system_admin role.' })

    return res.send(await collectLiveDatabaseOverview())
}
