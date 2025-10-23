import run from '#db'
import type { FastifyReply, FastifyRequest } from 'fastify'

export default async function getVisits(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string } ?? {}
    const result = await run('UPDATE load_tests SET visits = visits + 1 WHERE id = $1 RETURNING visits;', [id])
    return res.send(result.rows[0])
}
