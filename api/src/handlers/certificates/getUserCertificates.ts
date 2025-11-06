import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'

export default async function getUserCertificates(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }

    if (!id) {
         return res.status(400).send({ error: "No user ID provided" })
    }

    try {
        const result = await run(
            `SELECT c.* 
             FROM certificates c
             JOIN user_certificates uc ON c.id = uc.certificate_id
             WHERE uc.user_id = $1`,
            [id]
        )

        if (result.rows.length === 0) {
            return res.status(404).send({ error: "No certificates found for this user" })
        }

        return res.send({ id, certificates: result.rows })
    } catch (err: any) {
        console.error(err)
        return res.status(500).send({ error: err.message })
    }
}
