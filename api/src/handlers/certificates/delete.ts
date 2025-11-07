import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'

export default async function deleteCertificate(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    if (!id) {
        return res.status(400).send({ error: "No certificate id provided" })
    }

    try {
        await run(`DELETE FROM certificates WHERE id = $1`, [id])
        return res.send({ ok: true })
    } catch (err: any) {
        console.error(err)
        res.status(500).send({ error: err.message })
    }
}
