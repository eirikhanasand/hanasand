import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { loadSQL } from '#utils/loadSQL.ts'

export default async function getUserCertificates(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    if (!id) {
        return res.status(400).send({ error: "No user ID provided" })
    }

    try {
        const query = await loadSQL('getUserCertificates.sql')
        const result = await run(query, [Number(id)])
        if (result.rows.length === 0) {
            return res.status(404).send({ error: "No certificates found for this user" })
        }

        return res.send({ id, certificates: result.rows })
    } catch (err: any) {
        console.error(err)
        return res.status(500).send({ error: err.message })
    }
}
