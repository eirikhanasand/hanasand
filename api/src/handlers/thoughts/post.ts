import { requestedContentOrganization, requireEditorialWrite } from '#utils/contentOrganization.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'

export default async function postThought(req: FastifyRequest<{ Body: { title: string, id: string } }>, res: FastifyReply) {
    const organizationId = requestedContentOrganization(req)
    if (!await requireEditorialWrite(req, res, organizationId)) return

    const { title } = req.body ?? {}
    const id = req.headers.id as string
    if (!title || !id) {
        return res.status(400).send({ error: 'Missing thought title or creator.' })
    }

    try {
        const result = await run(
            'INSERT INTO thoughts (title, created_by, organization_id) VALUES ($1, $2, $3) RETURNING *',
            [title, id, organizationId]
        )

        return res.status(201).send(result.rows[0])
    } catch (error: any) {
        if (error.code === '23505') {
            return res.status(409).send({ error: 'Thought already exists' })
        }

        console.error(error)
        return res.status(500).send({ error: 'Internal Server Error' })
    }
}
