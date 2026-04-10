import run from '#db'
import type { FastifyReply, FastifyRequest } from 'fastify'

type QueryProps = {
    limit?: string
}

export async function getRecentTests(req: FastifyRequest, res: FastifyReply) {
    const { limit } = (req.query as QueryProps) ?? {}
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50)
    const result = await run(
        `SELECT * FROM load_tests
         ORDER BY created_at DESC
         LIMIT $1`,
        [safeLimit]
    )
    return res.send(result.rows)
}

export async function getMyRecentTests(req: FastifyRequest, res: FastifyReply) {
    const ownerId = req.headers.id as string | undefined
    const { limit } = (req.query as QueryProps) ?? {}
    if (!ownerId) {
        return res.status(400).send({ error: 'Missing user id.' })
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50)
    const result = await run(
        `SELECT * FROM load_tests
         WHERE owner_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [ownerId, safeLimit]
    )
    return res.send(result.rows)
}
