import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'

export default async function getVM(req: FastifyRequest, res: FastifyReply) {
    const { id, user } = req.params as { id?: string; user?: string }

    try {
        let result
        if (id) {
            result = await run("SELECT * FROM vms WHERE id = $1", [id])
        } else if (user) {
            result = await run("SELECT * FROM vms WHERE owner = $1", [user])
        } else {
            result = await run("SELECT * FROM vms")
        }

        if (result.rows.length === 0) {
            if (user) {
                return res.status(200).send([])
            }

            return res.status(404).send({ error: "VM not found" })
        }

        return res.send(result.rows)
    } catch (error) {
        console.log(error)
        return res.status(500).send({ error: "Internal server error" })
    }
}
