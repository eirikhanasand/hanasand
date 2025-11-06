import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/tokenWrapper.ts'
import { loadSQL } from '#utils/loadSQL.ts'

export default async function postCertificate(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid) {
        return res.status(404).send({ error: 'Unauthorized.' })
    }

    const owner = id
    const created_by = id
    const { name, public_key } = req.body as {
        name: string,
        public_key: string
    } ?? {}

    if (!id || !public_key || !name || !owner || !created_by) {
        return res.status(400).send({ error: "Missing required fields" })
    }

    try {
        const query = await loadSQL('checkIfCertificateExistsForUser.sql')
        const { rows } = await run(query, [owner, name])
        if (rows[0].exists) {
            return res.status(409).send({ error: 'You already have a certificate with this name. Use PUT to edit it.' })
        }

        await run(
            `INSERT INTO certificates (public_key, name, owner, created_by)
            VALUES ($1, $2, $3, $4, $5);`,
            [public_key, name, owner, created_by]
        )

        return res.status(201).send({ ok: true })
    } catch (error: any) {
        console.error(error)
        res.status(500).send({ error: error.message })
    }
}
