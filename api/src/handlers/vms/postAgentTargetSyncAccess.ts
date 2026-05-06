import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { agentTargetSelect } from '#utils/vms/agentTargetQuery.ts'
import syncUserCertificatesToVm from '#utils/vms/syncUserCertificatesToVm.ts'
import recordLog from '#utils/logs/recordLog.ts'

type VMRow = {
    name: string
    owner: string
    created_by: string
    access_users: string[] | null
}

type SyncScope = 'current_user' | 'all_access_users'

type SyncBody = {
    scope?: SyncScope
}

export default async function postAgentTargetSyncAccess(req: FastifyRequest, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string }
    if (!id) {
        return res.status(400).send({ error: 'Missing VM id.' })
    }

    const body = (req.body as SyncBody | undefined) ?? {}
    const scope = body.scope === 'all_access_users' ? 'all_access_users' : 'current_user'
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

        const canSyncAllUsers =
            isAdmin
            || vm.owner === userId
            || vm.created_by === userId

        if (scope === 'all_access_users' && !canSyncAllUsers) {
            return res.status(403).send({
                error: 'Only the VM owner, creator, or a system admin can sync access for every shared user.',
            })
        }

        const syncedUserIds = scope === 'all_access_users'
            ? uniqueUserIds([vm.owner, vm.created_by, ...accessUsers])
            : [userId]

        const syncResult = await syncUserCertificatesToVm({
            vmName: vm.name,
            userIds: syncedUserIds,
        })

        return res.send({
            ok: true,
            vmName: vm.name,
            scope,
            triggeredBy: userId,
            syncedUserIds,
            certificateCount: syncResult.certificates.length,
            received: syncResult.received,
            added: syncResult.added,
            total: syncResult.total,
            updatedAt: new Date().toISOString(),
            notes: syncResult.certificates.length
                ? ['Authorized keys were synchronized to the VM target.']
                : ['No certificates were linked to the selected users, so no remote key update was required.'],
        })
    } catch (error) {
        req.log.error({ err: error, vmId: id, userId, scope }, 'Unable to synchronize VM access.')
        void recordLog({
            level: 'warn',
            message: `Terminal access sync failed for ${id}: ${error instanceof Error ? error.message : String(error)}`,
            metadata: {
                category: 'terminal_failure',
                vmName: id,
                scope,
            },
        }).catch(() => {})
        return res.status(500).send({ error: 'Unable to synchronize VM access.' })
    }
}

function uniqueUserIds(userIds: string[]) {
    return [...new Set(userIds.map((userId) => userId.trim()).filter(Boolean))]
}
