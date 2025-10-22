import run from '#db'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { spawn } from 'child_process'
import broadcast from '#utils/ws/broadcast.ts'
import { testClients } from '#ws'

export default async function getTest(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string } ?? {}
    const result = await run('SELECT * FROM load_tests WHERE id = $1', [id])
    const test = result.rows[0]

    if (!test) {
        return res.status(404).send({ error: 'Test not found' })
    }

    await run('UPDATE load_tests SET status = $1 WHERE id = $2', ['running', id])

    const k6 = spawn('k6', [
        'run',
        '--env', `URL=${test.url}`,
        '--env', `TIMEOUT=${test.timeout}`,
        '--env', `STAGES=${JSON.stringify(test.stages)}`,
        '../../utils/test.ts'
    ])

    k6.stdout.on('data', (data) => {
        const message = data.toString()
        broadcast({ data: { type: 'log', message }, id, clients: testClients })
    })

    k6.stderr.on('data', (data) => {
        broadcast({ data: { type: 'error', message: data.toString() }, id, clients: testClients })
    })

    k6.on('close', async (code) => {
        await run('UPDATE load_tests SET status = $1 WHERE id = $2', ['done', id])
        broadcast({ data: { type: 'done', code }, id, clients: testClients })
    })

    res.send({ message: 'Load test started', testId: id })
}
