import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { vmViewer } from '#utils/vms/access.ts'

export default async function getAccessibleVMs(req: FastifyRequest, res: FastifyReply) {
    const { user } = req.params as { user: string }
    const viewer = await vmViewer(req, res)
    if (!viewer) return
    if (user !== viewer.id && !viewer.admin) return res.status(403).send({ error: 'Forbidden.' })

    if (!user) {
        return res.status(400).send({ error: 'Missing user.' })
    }

    try {
        const result = await run(
            `SELECT *
             FROM vms
             WHERE access_users ? $1`,
            [user]
        )

        if (result.rows.length === 0) {
            return res.status(200).send([])
        }

        return res.send(result.rows)
    } catch (error) {
        console.log(error)
        return res.status(500).send({ error: 'Internal server error' })
    }
}
