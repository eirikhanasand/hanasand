import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import hasInternalToken from '#utils/auth/internalToken.ts'

export default async function deleteVMs(req: FastifyRequest, res: FastifyReply) {
    const { vms } = req.body as { vms: string[] } ?? {}
    if (!hasInternalToken(req)) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    if (!vms) {
        return res.status(400).send({ error: "Missing vms to delete." })
    }

    try {
        const result = await run('DELETE FROM vms WHERE name = ANY($1) RETURNING *', [vms])
        return res.status(200).send(result.rows)
    } catch (error) {
        console.log(error)
        return res.status(500).send({ error: "Internal server error" })
    }
}
