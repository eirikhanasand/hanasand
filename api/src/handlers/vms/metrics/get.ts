import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'

export default async function getVMMetrics(req: FastifyRequest, res: FastifyReply) {
    const { id, name } = req.params as { id?: string; name?: string }

    try {
        let result

        if (id) {
            result = await run("SELECT * FROM vm_metrics WHERE name = $1", [id])
        } else if (name) {
            result = await run("SELECT * FROM vm_metrics WHERE name = $1 ORDER BY created_at DESC", [name])
        } else {
            result = await run("SELECT * FROM vm_metrics ORDER BY created_at DESC")
        }

        if (result.rows.length === 0) {
            return res.status(404).send({ error: "Metrics not found" })
        }

        return res.send(result.rows)
    } catch (error) {
        console.error(error)
        return res.status(500).send({ error: "Internal server error" })
    }
}
