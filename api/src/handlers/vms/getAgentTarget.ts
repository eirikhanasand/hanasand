import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { buildAgentTarget } from '#utils/vms/buildAgentTarget.ts'
import { agentTargetSelect } from '#utils/vms/agentTargetQuery.ts'

type VMRow = {
    name: string
    owner: string
    created_by: string
    access_users: string[] | null
    status: string
    type: string
    architecture: string
    created: string
    last_used: string
    config_image_description: string
    limits_cpu: string
    limits_memory: string
    device_eth0_ipv4_address: string
    last_checked: string
}

export default async function getAgentTarget(req: FastifyRequest, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string }
    if (!id) {
        return res.status(400).send({ error: 'Missing VM id.' })
    }

    const { valid: isAdmin } = await hasRole(req, res, 'system_admin')

    try {
        const result = await run(`
            ${agentTargetSelect}
            WHERE v.name = $1
            LIMIT 1
        `, [id])

        if (!result.rows.length) {
            return res.status(404).send({ error: 'VM not found.' })
        }

        const vm = result.rows[0] as VMRow
        const accessUsers = Array.isArray(vm.access_users) ? vm.access_users : []
        const canAccess =
            isAdmin
            || vm.owner === userId
            || vm.created_by === userId
            || accessUsers.includes(userId)

        if (!canAccess) {
            return res.status(403).send({ error: 'Forbidden.' })
        }

        return res.send(buildAgentTarget({
            vm,
            currentUserId: userId,
            canManage: isAdmin,
        }))
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Unable to load VM agent target.' })
    }
}
