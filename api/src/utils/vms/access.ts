import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'

export async function vmViewer(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) { res.status(401).send({ error: 'Unauthorized.' }); return null }
    const { valid: admin } = await hasRole(req, res, 'system_admin')
    return { id, admin }
}

export async function requireVmAccess(req: FastifyRequest, res: FastifyReply, name: string) {
    const viewer = await vmViewer(req, res)
    if (!viewer) return null
    const result = await run('SELECT name, owner, created_by, access_users FROM vms WHERE LOWER(name) = LOWER($1) LIMIT 1', [name])
    const vm = result.rows[0]
    if (!vm || !viewer.admin && vm.owner !== viewer.id && vm.created_by !== viewer.id && !(Array.isArray(vm.access_users) && vm.access_users.includes(viewer.id))) {
        res.status(404).send({ error: 'VM not found.' }); return null
    }
    return { ...viewer, name: vm.name as string }
}
