import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'

export default async function putCertificate(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    const { public_key, name, owner } = req.body as { public_key?: string; name?: string; owner?: string }

    if (!id) {
        return res.status(400).send({ error: "No certificate id provided" })
    }

    try {
        const fields: string[] = []
        const values: any[] = []
        let idx = 1

        if (public_key) {
            fields.push(`public_key = $${idx++}`); values.push(public_key)
        }

        if (name) {
            fields.push(`name = $${idx++}`); values.push(name)
        }

        if (owner) {
            fields.push(`owner = $${idx++}`); values.push(owner)
        }

        if (fields.length === 0) {
            return res.status(400).send({ error: "No fields to update" })
        }

        values.push(id)
        const query = `UPDATE certificates SET ${fields.join(', ')} WHERE id = $${idx}`

        const result = await run(query, values)

        return res.send({ ok: true })
    } catch (err: any) {
        console.error(err)
        res.status(500).send({ error: err.message })
    }
}
