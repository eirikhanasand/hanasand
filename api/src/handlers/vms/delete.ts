import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'

export default async function deleteVM(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }

    if (!id) {
        return res.status(400).send({ error: "Missing VM id parameter" })
    }

    try {
        const result = await run(
            "DELETE FROM vms WHERE id = $1 RETURNING *",
            [id]
        )

        if (result.rows.length === 0) {
            return res.status(404).send({ error: "VM not found" })
        }

        return res.send({ message: "VM deleted successfully", vm: result.rows[0] })
    } catch (error) {
        console.log(error)
        return res.status(500).send({ error: "Internal server error" })
    }
}
