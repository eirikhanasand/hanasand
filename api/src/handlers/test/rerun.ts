import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import followTest from './follow.ts'

export default async function rerunTest(req: FastifyRequest, res: FastifyReply) {
    const { id } = (req.params as { id: string }) ?? {}
    if (!id) {
        return res.status(400).send({ error: 'Missing test id.' })
    }

    const result = await run('SELECT id, status FROM load_tests WHERE id = $1', [id])
    const test = result.rows[0]
    if (!test) {
        return res.status(404).send({ error: 'Test not found.' })
    }

    if (test.status === 'running') {
        return res.status(409).send({ error: 'Test is already running.' })
    }

    followTest(id, true).catch((error) => {
        console.error(`Failed to rerun test ${id}: ${error}`)
    })

    return res.send({ ok: true, status: 'running' })
}
