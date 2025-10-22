import run from '#db'
import type { FastifyReply, FastifyRequest } from 'fastify'

type BodyProps = {
    url: string
    timeout?: number
    stages?: Stage[]
}

type Stage = {
    duration: string
    target: number
}

export default async function postTest(req: FastifyRequest, res: FastifyReply) {
    const { url, timeout, stages } = req.body as BodyProps ?? {}
    const result = await run(
        'INSERT INTO load_tests (url, timeout, stages) VALUES ($1, $2, $3) RETURNING *',
        [url, timeout || null, JSON.stringify(stages) || null]
    )

    return res.send(result.rows[0])
}
