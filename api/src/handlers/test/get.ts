import run from '#db'
import type { FastifyReply, FastifyRequest } from 'fastify'

export default async function getTest(req: FastifyRequest, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
    const { id } = req.params as { id: string } ?? {}
    const result = await run('SELECT * FROM load_tests WHERE id = $1', [id])
    return res.send(result.rows[0])
}
