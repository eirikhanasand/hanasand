import run from '#db'
import type { FastifyReply, FastifyRequest } from 'fastify'

type BodyProps = {
    name: string
    url: string
    timeout: number
    stages: Stage[]
}

type Stage = {
    duration: string
    target: number
}

export default async function postTest(req: FastifyRequest, res: FastifyReply) {
    const { name, url, timeout, stages } = req.body as BodyProps ?? {}
    const result = await run(
        'INSERT INTO load_tests (name, url, timeout, stages) VALUES ($1, $2, $3, $4) RETURNING *',
        [name, url, timeout, JSON.stringify(stages)]
    )

    return res.send(result.rows[0])
}
