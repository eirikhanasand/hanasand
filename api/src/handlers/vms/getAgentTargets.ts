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

export default async function getAgentTargets(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { valid: isAdmin } = await hasRole(req, res, 'system_admin')

    try {
        const result = isAdmin
            ? await run(`
                ${agentTargetSelect}
                ORDER BY v.name ASC
            `)
            : await run(`
                ${agentTargetSelect}
                WHERE v.owner = $1
                   OR v.created_by = $1
                   OR v.access_users ? $1
                ORDER BY v.name ASC
            `, [id])

        const targets = result.rows.map((row) => buildAgentTarget({
            vm: row as VMRow,
            currentUserId: id,
            canManage: isAdmin,
        }))

        return res.send({
            scope: isAdmin ? 'all' : 'accessible',
            count: targets.length,
            targets,
            missingPlatformCapabilities: [
                'remote shell command execution',
                'remote file writes',
                'interactive shell streaming',
                'VM-targeted repo sync',
            ],
        })
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Unable to load VM agent targets.' })
    }
}
