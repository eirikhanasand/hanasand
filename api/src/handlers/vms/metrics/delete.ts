import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import hasRole from '#utils/auth/hasRole.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

export default async function deleteVMMetrics(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    const { valid: validRole } = await hasRole(req, res, 'system_admin')
    if (!valid || !validRole) {
        return res.status(404).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string }
    if (!id) {
        return res.status(400).send({ error: "Missing metrics id" })
    }

    try {
        const result = await run(
            "DELETE FROM vm_metrics WHERE id = $1 RETURNING *",
            [id]
        )

        if (result.rowCount === 0) {
            return res.status(404).send({ error: "Metrics not found" })
        }

        return res.send({
            deleted: true,
            metrics: result.rows[0]
        })
    } catch (error) {
        console.error(error)
        return res.status(500).send({ error: "Failed to delete vm metrics" })
    }
}
