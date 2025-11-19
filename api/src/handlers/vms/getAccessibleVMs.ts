import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

export default async function getAccessibleVMs(req: FastifyRequest, res: FastifyReply) {
    const { user } = req.params as { user: string }
    const { valid } = await tokenWrapper(req, res)
    if (!valid) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    if (!user) {
        return res.status(400).send({ error: "Missing user." })
    }

    try {
        const result = await run(
            "SELECT * FROM vms WHERE $1 = ANY(access_users)",
            [user]
        )

        if (result.rows.length === 0) {
            return res.status(200).send([])
        }

        return res.send(result.rows)
    } catch (error) {
        console.log(error)
        return res.status(500).send({ error: "Internal server error" })
    }
}
