import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'

export default async function stopVms(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    const { valid: validRole } = await hasRole(req, res, 'system_admin')
    if (!valid || !validRole) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    try {
        const { id } = req.params as { id?: string }
        const { vms } = req.body as { vms?: string[] } ?? {}

        const names = Array.isArray(vms) && vms.length
            ? vms
            : id
                ? [id]
                : []

        let targetNames = names

        if (!targetNames.length) {
            const result = await run(`
                SELECT v.name
                FROM vms v
                LEFT JOIN vm_details d ON d.name = v.name
                WHERE LOWER(COALESCE(d.status, 'stopped')) <> 'stopped'
                ORDER BY v.name ASC
            `)

            targetNames = result.rows.map((row) => String(row.name))
        }

        if (!targetNames.length) {
            return res.send({
                success: true,
                message: 'No running VMs to stop.',
                vms: [],
            })
        }

        const result = await run(`
            INSERT INTO vm_shutdown (name, "time")
            SELECT unnest($1::text[]) AS name, NOW() + INTERVAL '20 minutes'
            ON CONFLICT (name) DO UPDATE
            SET "time" = EXCLUDED."time"
            RETURNING name
        `, [targetNames])

        return res.send({
            success: true,
            message: `Queued shutdown for ${result.rows.length} VM${result.rows.length === 1 ? '' : 's'}.`,
            vms: result.rows.map((row) => String(row.name)),
        })
    } catch (error) {
        console.error(error)
        return res.status(500).send({ error: "Internal server error" })
    }
}
