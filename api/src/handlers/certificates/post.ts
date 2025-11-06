import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/tokenWrapper.ts'

export default async function postCertificate(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid) {
        return res.status(404).send({ error: 'Unauthorized.' })
    }

    const { public_key, name, owner, created_by } = req.body as {
        id: string
        public_key: string
        name: string
        owner: string
        created_by: string
    }

    if (!id || !public_key || !name || !owner || !created_by) {
        return res.status(400).send({ error: "Missing required fields" })
    }

    try {
        await run(
            `INSERT INTO certificates (id, public_key, name, owner, created_by) VALUES ($1, $2, $3, $4, $5)`,
            [id, public_key, name, owner, created_by]
        )

        return res.status(201).send({ ok: true })
    } catch (err: any) {
        console.error(err)
        res.status(500).send({ error: err.message })
    }
}
