import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'

export default async function getAccessibleVMs(req: FastifyRequest, res: FastifyReply) {
    const { user } = req.params as { user: string }

    if (!user) {
        return res.status(400).send({ error: "Missing user." })
    }

    try {
        const result = await run(
            "SELECT * FROM vms WHERE $1 = ANY(access_users)",
            [user]
        )

        if (result.rows.length === 0) {
            return res.status(404).send({ error: "No accessible VMs found for this user" })
        }

        return res.send(result.rows)
    } catch (error) {
        console.log(error)
        res.status(500).send({ error: "Internal server error" })
    }
}
