import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { loadSQL } from '#utils/loadSQL.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import hasInternalToken from '#utils/auth/internalToken.ts'
import syncUserCertificatesToVm from '#utils/vms/syncUserCertificatesToVm.ts'
import config from '#constants'
import { canUseLocalLxd, provisionLocalLxdInstance } from '#utils/vms/lxd.ts'
import recordLog from '#utils/logs/recordLog.ts'

export default async function postVM(req: FastifyRequest, res: FastifyReply) {
    const body = req.body as {
        name: string
        owner?: string
        created_by?: string
        access_users?: string[]
        provision_local?: boolean
    } ?? {}
    const { name, access_users } = body
    let owner = body.owner
    let created_by = body.created_by

    const internal = hasInternalToken(req)
    if (!internal) {
        const { valid, id } = await tokenWrapper(req, res)
        const { valid: validRole } = await hasRole(req, res, 'system_admin')
        if (!valid || !id) {
            return res.status(401).send({ error: 'Unauthorized.' })
        }

        owner = validRole ? owner || id : id
        created_by = validRole ? created_by || id : id
    }

    if (!name || !owner || !created_by) {
        return res.status(400).send({ error: 'Missing required fields' })
    }

    try {
        await run(`
            DELETE FROM vms
            WHERE name = $1
              AND owner = 'ownerless'
              AND EXISTS (
                  SELECT 1
                  FROM vms owned
                  WHERE LOWER(owned.name) = LOWER($1)
                    AND owned.name <> $1
                    AND owned.owner <> 'ownerless'
              )
        `, [name])

        const existingResult = await run(`
            SELECT name, owner, created_by, access_users
            FROM vms
            WHERE LOWER(name) = LOWER($1)
            ORDER BY
                CASE WHEN owner = 'ownerless' THEN 1 ELSE 0 END,
                CASE WHEN name = $1 THEN 0 ELSE 1 END
            LIMIT 1
        `, [name])
        const existing = existingResult.rows[0] as {
            name: string
            owner: string
            created_by: string
            access_users: string[]
        } | undefined

        if (existing) {
            const nextOwner = owner === 'ownerless' ? existing.owner : owner
            const nextCreatedBy = created_by === 'unknown' ? existing.created_by : created_by
            const nextAccessUsers = (access_users ?? []).length ? access_users : existing.access_users

            const result = await run(`
                UPDATE vms
                SET name = $1,
                    owner = $2,
                    created_by = $3,
                    access_users = $4,
                    primary_host = $6
                WHERE name = $5
                RETURNING *
            `, [name, nextOwner, nextCreatedBy, JSON.stringify(nextAccessUsers ?? []), existing.name, config.vm_host_id])

            await provisionIfLocal(name, req, body.provision_local !== false)

            return res.status(201).send(result.rows[0])
        }

        await run(`
            UPDATE vms
            SET name = $1
            WHERE LOWER(name) = LOWER($1)
              AND name <> $1
              AND NOT EXISTS (SELECT 1 FROM vms WHERE name = $1)
        `, [name])

        const query = await loadSQL('insertVM.sql')
        const result = await run(query, [name, owner, created_by, JSON.stringify(access_users ?? [])])
        if (!result.rows.length) {
            return res.status(409).send({ error: 'VM already exists' })
        }

        await run('UPDATE vms SET primary_host = $2 WHERE name = $1', [name, config.vm_host_id])
        await provisionIfLocal(name, req, body.provision_local !== false)

        await syncUserCertificatesToVm({
            vmName: name,
            userIds: [owner, created_by, ...(access_users ?? [])]
        }).catch((error) => {
            req.log.warn({ err: error, vmName: name }, 'Unable to synchronize user certificates to the VM after creation.')
            void recordVmProvisioningError(name, error, 'certificate_sync')
        })

        return res.status(201).send(result.rows[0])
    } catch (error) {
        req.log.error({ err: error, vmName: name }, 'Unable to create or provision VM.')
        void recordVmProvisioningError(name || 'unknown', error, 'create_or_provision')
        return res.status(500).send({ error: 'Internal server error' })
    }
}

async function provisionIfLocal(name: string, req: FastifyRequest, shouldProvision: boolean) {
    if (!shouldProvision) {
        return
    }

    if (config.vm_host_id !== 'inspur') {
        return
    }

    if (!await canUseLocalLxd()) {
        req.log.warn({ vmName: name }, 'Local LXD socket is not available; VM row was recorded without local provisioning.')
        void recordVmProvisioningError(name, 'Local LXD socket is not available.', 'lxd_unavailable')
        return
    }

    await provisionLocalLxdInstance(name)
}

async function recordVmProvisioningError(vmName: string, error: unknown, phase: string) {
    await recordLog({
        level: 'error',
        message: `VM provisioning ${phase} failed for ${vmName}: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
            category: 'vm_provisioning_error',
            vmName,
            phase,
        },
    }).catch(() => {})
}
