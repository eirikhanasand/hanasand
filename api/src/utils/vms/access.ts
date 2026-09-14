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

export async function requireVmAccess(req: FastifyRequest, res: FastifyReply, name: string, allowDeleted = false) {
    const viewer = await vmViewer(req, res)
    if (!viewer) return null
    const result = await run('SELECT name, owner, created_by, access_users, deleted_at FROM vms WHERE LOWER(name) = LOWER($1) LIMIT 1', [name])
    const vm = result.rows[0]
    if (!vm || !viewer.admin && !await hasVmAccess(vm.name, viewer.id)) {
        res.status(404).send({ error: 'VM not found.' }); return null
    }
    if (vm.deleted_at && !allowDeleted) { res.status(409).send({ error: 'This VM is scheduled for deletion. Restore it before connecting.' }); return null }
    return { ...viewer, name: vm.name as string }
}

export async function hasVmAccess(name: string, userId: string) {
    const result = await run('SELECT vm_user_has_access($1, $2) AS allowed', [name, userId])
    return result.rows[0]?.allowed === true
}
