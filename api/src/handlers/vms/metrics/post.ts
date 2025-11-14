import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'

export default async function postVMMetrics(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    const { valid: validRole } = await hasRole(req, res, 'system_admin')
    if (!valid || !validRole) {
        return res.status(404).send({ error: 'Unauthorized.' })
    }

    const data = req.body as any ?? {}
    if (!data || !data.vm_id) {
        return res.status(400).send({ error: "Missing vm_id" })
    }

    try {
        const fields = Object.keys(data)
        const placeholders = fields.map((_, i) => `$${i + 1}`)
        const values: string[] = Object.values(data)

        const query = `
            INSERT INTO vm_metrics (${fields.join(",")})
            VALUES (${placeholders.join(",")})
            RETURNING *
        `

        const result = await run(query, values)

        return res.status(201).send(result.rows[0])
    } catch (error) {
        console.error(error)
        return res.status(500).send({ error: "Failed to create vm metrics" })
    }
}
