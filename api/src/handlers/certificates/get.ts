import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'

export default async function getCertificate(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }

    try {
        const result = await run("SELECT * FROM certificates WHERE id = $1", [id])
        if (result.rows.length === 0) {
            return res.status(404).send({ error: "Certificate not found" })
        }

        return res.send(result.rows[0])
    } catch (error) {
        console.log(error)
        res.status(500).send({ error: "Internal server error" })
    }
}
