import hasPermissionToModifyRole from '#utils/auth/hasPermissionToModifyRole.ts'
import hasRole from '#utils/auth/hasRole.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { RoleChangeError, saveRoleChanges, validateRoleChanges } from '#utils/roleChanges.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'

export default async function putRole(req: FastifyRequest, res: FastifyReply) {
    const identity = await tokenWrapper(req, res)
    if (!identity.valid || !identity.id) return res.status(401).send({ error: 'Unauthorized.' })
    if (!(await hasRole(req, res, 'user_admin')).valid && !(await hasRole(req, res, 'administrator')).valid) return res.status(403).send({ error: 'Unauthorized.' })
    const { id } = req.params as { id: string }
    if (!id) return res.status(400).send({ error: 'Missing role id' })
    try {
        const changes = validateRoleChanges(req.body)
        const { valid: hasPermission } = await hasPermissionToModifyRole(req, res)
        if (!hasPermission) return res.status(403).send({ error: 'Unauthorized.' })
        return res.send(await saveRoleChanges(req, id, identity.id, identity.authenticatedId || identity.id, changes))
    } catch (error) {
        if (error instanceof RoleChangeError) return res.status(error.status).send({ error: error.message })
        if ((error as { code?: string }).code === '23505') return res.status(409).send({ error: 'Role name already exists' })
        req.log.error(error)
        return res.status(500).send({ error: 'Unable to save the role.' })
    }
}
