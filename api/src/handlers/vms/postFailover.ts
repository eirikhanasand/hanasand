import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import sanitize from '#utils/sanitize.ts'

export default async function postVmFailover(req: FastifyRequest, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id: rawId } = req.params as { id: string }
    const vmName = sanitize(rawId)
    if (!vmName) {
        return res.status(400).send({ error: 'Missing VM id.' })
    }

    const { valid: isAdmin } = await hasRole(req, res, 'system_admin')

    try {
        const currentResult = await run('SELECT * FROM vms WHERE LOWER(name) = LOWER($1)', [vmName])
        if (!currentResult.rows.length) {
            return res.status(404).send({ error: 'VM not found.' })
        }

        const vm = currentResult.rows[0] as {
            owner: string
            created_by: string
            access_users: string[] | null
            failover_enabled: boolean
            primary_host: string
            failover_host: string | null
        }
        const accessUsers = Array.isArray(vm.access_users) ? vm.access_users : []
        const canManage = isAdmin || vm.owner === userId || vm.created_by === userId || accessUsers.includes(userId)
        if (!canManage) {
            return res.status(403).send({ error: 'You do not have access to this VM.' })
        }

        if (!vm.failover_enabled || !vm.failover_host) {
            return res.status(402).send({ error: 'Failover is a premium option and is not enabled for this host.' })
        }

        const result = await run(`
            UPDATE vms
            SET primary_host = $2,
                failover_host = $3
            WHERE LOWER(name) = LOWER($1)
            RETURNING *
        `, [vmName, vm.failover_host, vm.primary_host])

        return res.send({
            message: `Failover target for ${vmName} is now ${result.rows[0].primary_host}.`,
            vm: result.rows[0],
        })
    } catch (error) {
        req.log.error({ err: error, vmName }, 'Unable to fail over VM host.')
        return res.status(500).send({ error: 'Unable to fail over host.' })
    }
}
