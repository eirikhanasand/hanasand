import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { enqueueLoadTestRun } from './follow.ts'

export default async function rerunTest(req: FastifyRequest, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
    const { id } = (req.params as { id: string }) ?? {}
    if (!id) {
        return res.status(400).send({ error: 'Missing test id.' })
    }

    const result = await run('SELECT id, status FROM load_tests WHERE id = $1', [id])
    const test = result.rows[0]
    if (!test) {
        return res.status(404).send({ error: 'Test not found.' })
    }

    if (test.status === 'queued' || test.status === 'running') {
        return res.status(409).send({ error: 'Test is already running.' })
    }

    await enqueueLoadTestRun(id, true)

    return res.send({ ok: true, status: 'queued' })
}
