import type { FastifyReply, FastifyRequest } from 'fastify'
import { searchThreatIntel } from '#utils/ti/search.ts'

interface SearchBody {
    query?: string
}

export default async function postTiSearch(req: FastifyRequest<{ Body: SearchBody }>, res: FastifyReply) {
    const query = req.body?.query?.trim()

    if (!query) {
        return res.status(400).send({ error: 'query_required', message: 'query is required' })
    }

    const result = await searchThreatIntel({ query })
    return res.send(result)
}
