import hasRole from '#utils/auth/hasRole.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { RoleChangeError, saveRoleChanges, validateRoleChanges } from '#utils/roleChanges.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'

export default async function postRole(req: FastifyRequest, res: FastifyReply) {
    const identity = await tokenWrapper(req, res)
    if (!identity.valid || !identity.id) return res.status(401).send({ error: 'Unauthorized.' })
    if (!(await hasRole(req, res, 'user_admin')).valid && !(await hasRole(req, res, 'administrator')).valid) return res.status(403).send({ error: 'Unauthorized.' })
    try {
        const changes = validateRoleChanges(req.body, true)
        const id = (req.body as { id?: unknown }).id ?? crypto.randomUUID()
        if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new RoleChangeError(400, 'Invalid role id.')
        return res.status(201).send(await saveRoleChanges(req, id, identity.id, identity.authenticatedId || identity.id, changes, true))
    } catch (error) {
        if (error instanceof RoleChangeError) return res.status(error.status).send({ error: error.message })
        if ((error as { code?: string }).code === '23505') return res.status(409).send({ error: 'Role already exists' })
        req.log.error(error)
        return res.status(500).send({ error: 'Unable to create the role.' })
    }
}
