import { hasVmAccess } from '#utils/vms/access.ts'
import { requestFailover } from '#utils/vms/failover.ts'
import { vmLifecycleLock } from '#utils/vms/lifecycleLock.ts'
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
        return await vmLifecycleLock(vmName, async () => {
            const currentResult = await run('SELECT * FROM vms WHERE LOWER(name) = LOWER($1)', [vmName])
            if (!currentResult.rows.length) {
                return res.status(404).send({ error: 'VM not found.' })
            }

            const vm = currentResult.rows[0] as {
                name: string
                failover_premium: boolean
                owner: string
                created_by: string
                access_users: string[] | null
                failover_enabled: boolean
                primary_host: string
                deleted_at: string | null
                failover_host: string | null
            }
            const canManage = isAdmin || await hasVmAccess(vm.name, userId, true)
            if (!canManage) {
                return res.status(403).send({ error: 'You do not have access to this VM.' })
            }
            if (vm.deleted_at) return res.status(409).send({ error: 'This VM is scheduled for deletion. Restore it before making changes.' })

            if (!vm.failover_enabled || !vm.failover_premium || !vm.failover_host) {
                return res.status(402).send({ error: 'Failover is a premium option and is not enabled for this host.' })
            }

            const body = req.body as { targetHost?: string; requestId?: string } | undefined
            await requestFailover(vm, body?.targetHost, body?.requestId)
            return res.status(202).send({
                message: 'Host switch queued. The container will stop briefly while its final disk copy is transferred.',
                vm: currentResult.rows[0],
            })
        })
    } catch (error) {
        req.log.error({ err: error, vmName }, 'Unable to fail over VM host.')
        return res.status(500).send({ error: 'Unable to fail over host.' })
    }
}
