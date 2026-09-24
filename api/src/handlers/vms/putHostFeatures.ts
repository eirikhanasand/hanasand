import { hasVmAccess } from '#utils/vms/access.ts'
import { enableFailover } from '#utils/vms/failover.ts'
import { vmLifecycleLock } from '#utils/vms/lifecycleLock.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import sanitize from '#utils/sanitize.ts'
import { applyAlwaysRunning } from '#utils/vms/ensureAlwaysRunning.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'

type FeatureBody = {
    always_running_enabled?: boolean
    always_running_premium?: boolean
    failover_enabled?: boolean
    failover_premium?: boolean
    primary_host?: string
    failover_host?: string | null
}

export default async function putVmHostFeatures(req: FastifyRequest, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id: rawId } = req.params as { id: string }
    const vmName = sanitize(rawId)
    if (!vmName) {
        return res.status(400).send({ error: 'Missing VM id.' })
    }

    const body = req.body as FeatureBody ?? {}
    const { valid: isAdmin } = await hasRole(req, res, 'system_admin')

    try {
        return await vmLifecycleLock(vmName, async () => {
            const currentResult = await run('SELECT * FROM vms WHERE LOWER(name) = LOWER($1)', [vmName])
            if (!currentResult.rows.length) {
                return res.status(404).send({ error: 'VM not found.' })
            }

            const vm = currentResult.rows[0] as {
                name: string
                owner: string
                created_by: string
                access_users: string[] | null
                always_running_premium: boolean
                always_running_enabled: boolean
                failover_premium: boolean
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

            const alwaysPremium = isAdmin && typeof body.always_running_premium === 'boolean'
                ? body.always_running_premium
                : vm.always_running_premium
            const failoverPremium = isAdmin && typeof body.failover_premium === 'boolean'
                ? body.failover_premium
                : vm.failover_premium
            const alwaysEnabled = resolveEnabled({
                requested: body.always_running_enabled,
                current: vm.always_running_enabled,
                premium: alwaysPremium,
                feature: 'Always running',
            })
            const failoverEnabled = resolveEnabled({
                requested: body.failover_enabled,
                current: vm.failover_enabled,
                premium: failoverPremium,
                feature: 'Failover',
            })
            const primaryHost = isAdmin && typeof body.primary_host === 'string'
                ? normalizeHost(body.primary_host, vm.primary_host)
                : vm.primary_host
            let failoverHost = isAdmin && Object.prototype.hasOwnProperty.call(body, 'failover_host')
                ? normalizeOptionalHost(body.failover_host)
                : vm.failover_host

            const transfer = (await run('SELECT requested_host FROM vm_failover WHERE vm_name = $1', [vm.name])).rows[0]
            if (transfer?.requested_host) return res.status(409).send({ error: 'Wait for the host switch to finish before changing options.' })
            if (primaryHost !== vm.primary_host) return res.status(409).send({ error: 'Use failover to transfer the container before changing its host.' })
            if (failoverEnabled && !vm.failover_enabled) failoverHost = await enableFailover(vm)

            if (alwaysEnabled !== vm.always_running_enabled || alwaysPremium !== vm.always_running_premium) {
                await applyAlwaysRunning({ name: vm.name, primary_host: primaryHost }, alwaysEnabled && alwaysPremium)
            }

            const result = await run(`
            UPDATE vms
            SET always_running_premium = $2,
                always_running_enabled = $3,
                failover_premium = $4,
                failover_enabled = $5,
                primary_host = $6,
                failover_host = $7
            WHERE LOWER(name) = LOWER($1)
            RETURNING *
        `, [vmName, alwaysPremium, alwaysEnabled, failoverPremium, failoverEnabled, primaryHost, failoverHost])

            await recordSystemEvent(req, {
                actionType: 'vm.features.updated',
                actorId: userId,
                targetType: 'vm',
                targetId: vmName,
                context: {
                    alwaysRunningEnabled: alwaysEnabled,
                    failoverEnabled,
                    primaryHost,
                    failoverHost,
                },
            })

            return res.send(result.rows[0])
        })
    } catch (error) {
        if (error instanceof PremiumFeatureError) {
            return res.status(402).send({ error: error.message })
        }

        req.log.error({ err: error, vmName }, 'Unable to update VM host features.')
        return res.status(500).send({ error: 'Unable to update host features.' })
    }
}

function resolveEnabled({
    requested,
    current,
    premium,
    feature,
}: {
    requested?: boolean
    current: boolean
    premium: boolean
    feature: string
}) {
    if (typeof requested !== 'boolean') {
        return premium && current
    }

    if (requested && !premium) {
        throw new PremiumFeatureError(`${feature} is a premium option for this host.`)
    }

    return requested
}

function normalizeHost(value: string, fallback: string) {
    const host = value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    return host || fallback
}

function normalizeOptionalHost(value: string | null | undefined) {
    if (value === null) {
        return null
    }

    if (typeof value !== 'string') {
        return null
    }

    const host = normalizeHost(value, '')
    return host || null
}

class PremiumFeatureError extends Error {}
