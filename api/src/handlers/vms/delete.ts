import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { recordAdminAuditEvent } from '#utils/adminAudit.ts'

export default async function deleteVM(req: FastifyRequest, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    const { valid: validRole } = await hasRole(req, res, 'system_admin')
    if (!valid || !validRole) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string }
    if (!id) {
        return res.status(400).send({ error: 'Missing VM id parameter' })
    }

    try {
        const result = await run(
            'DELETE FROM vms WHERE name = $1 RETURNING *',
            [id]
        )

        if (result.rows.length === 0) {
            return res.status(404).send({ error: 'VM not found' })
        }

        await recordAdminAuditEvent(req, {
            actionType: 'vm.deleted',
            actorId: userId || null,
            targetType: 'vm',
            targetId: id,
            context: { vm: result.rows[0] },
        })

        return res.send({ message: 'VM deleted successfully', vm: result.rows[0] })
    } catch (error) {
        console.log(error)
        return res.status(500).send({ error: 'Internal server error' })
    }
}
