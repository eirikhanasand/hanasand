import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/tokenWrapper.ts'

export default async function postCertificate(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid) {
        return res.status(404).send({ error: 'Unauthorized.' })
    }

    const owner = id
    const created_by = id
    const { name, public_key } = req.body as {
        public_key: string
        name: string
    } ?? {}

    if (!id || !public_key || !name || !owner || !created_by) {
        return res.status(400).send({ error: "Missing required fields" })
    }

    try {
        const result = await run(
            `INSERT INTO certificates (id, public_key, name, owner, created_by)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO NOTHING
            RETURNING id`,
            [id, public_key, name, owner, created_by]
        )

        if (result.rows.length === 0) {
            return res.status(409).send({ error: 'Certificate already exists. Use PUT to edit it.' })
        }

        return res.status(201).send({ ok: true })
    } catch (error: any) {
        console.error(error)
        res.status(500).send({ error: error.message })
    }
}
