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
    const { url, timeout, stages } = (req.body as BodyProps) ?? {}
    if (!url) {
        return res.status(400).send({ error: 'No url provided.' })
    }

    const fields: string[] = ['url']
    const values: any[] = [url]
    const placeholders: string[] = ['$1']

    if (timeout !== undefined) {
        fields.push('timeout')
        values.push(timeout)
        placeholders.push(`$${values.length}`)
    }

    if (stages !== undefined && stages !== null) {
        fields.push('stages')
        values.push(JSON.stringify(stages))
        placeholders.push(`$${values.length}`)
    }

    const sql = `
        INSERT INTO load_tests (${fields.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *;
    `

    const result = await run(sql, values)
    return res.send(result.rows[0])
}
