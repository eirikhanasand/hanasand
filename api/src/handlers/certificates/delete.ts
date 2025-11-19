import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'

export default async function deleteCertificate(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    const { valid: validRole } = await hasRole(req, res, 'user_admin')
    if (!valid || !validRole) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string }
    if (!id) {
        return res.status(400).send({ error: "No certificate id provided" })
    }

    try {
        await run(`DELETE FROM certificates WHERE id = $1`, [id])
        return res.send({ ok: true })
    } catch (err: any) {
        console.error(err)
        return res.status(500).send({ error: err.message })
    }
}
