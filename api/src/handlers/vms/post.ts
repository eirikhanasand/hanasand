import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { loadSQL } from '#utils/loadSQL.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import hasInternalToken from '#utils/auth/internalToken.ts'
import syncUserCertificatesToVm from '#utils/vms/syncUserCertificatesToVm.ts'

export default async function postVM(req: FastifyRequest, res: FastifyReply) {
    const body = req.body as {
        name: string
        owner?: string
        created_by?: string
        access_users?: string[]
    } ?? {}
    const { name, access_users } = body
    let owner = body.owner
    let created_by = body.created_by

    if (!hasInternalToken(req)) {
        const { valid, id } = await tokenWrapper(req, res)
        const { valid: validRole } = await hasRole(req, res, 'system_admin')
        if (!valid || !validRole || !id) {
            return res.status(401).send({ error: 'Unauthorized.' })
        }

        owner = owner || id
        created_by = created_by || id
    }

    if (!name || !owner || !created_by) {
        return res.status(400).send({ error: "Missing required fields" })
    }

    try {
        const query = await loadSQL('insertVM.sql')
        const result = await run(query, [name, owner, created_by, JSON.stringify(access_users ?? [])])
        if (!result.rows.length) {
            return res.status(409).send({ error: 'VM already exists' })
        }

        await syncUserCertificatesToVm({
            vmName: name,
            userIds: [owner, created_by, ...(access_users ?? [])]
        }).catch((error) => {
            req.log.warn({ err: error, vmName: name }, 'Unable to synchronize user certificates to the VM after creation.')
        })

        return res.status(201).send(result.rows[0])
    } catch (error) {
        console.log(error)
        return res.status(500).send({ error: "Internal server error" })
    }
}
