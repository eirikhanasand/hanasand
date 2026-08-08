import type { FastifyReply, FastifyRequest } from 'fastify'
import { searchThreatIntel } from '#utils/ti/search.ts'

interface SearchBody {
    query?: string
}

export const TI_QUERY_MAX_LENGTH = 200
export const TI_BATCH_MAX_QUERIES = 25

export default async function postTiSearch(req: FastifyRequest<{ Body: SearchBody }>, res: FastifyReply) {
    setNoStore(res)
    if (hasUnexpectedFields(req.body, ['query'])) {
        return res.status(400).send({ error: 'invalid_request', message: 'search accepts only the query field' })
    }
    const query = normalizeQuery(req.body?.query)

    if (!query) {
        return res.status(400).send({ error: 'invalid_query', message: `query must contain 2-${TI_QUERY_MAX_LENGTH} characters` })
    }

    const result = await searchThreatIntel({ query })
    return res.send(result)
}

export function normalizeBatchQueries(input?: unknown) {
    if (!Array.isArray(input)) return []
    const queries = new Map<string, string>()
    for (const value of input) {
        const query = normalizeQuery(value)
        if (query && !queries.has(query.toLowerCase())) queries.set(query.toLowerCase(), query)
    }
    return [...queries.values()]
}

function normalizeQuery(value: unknown) {
    if (typeof value !== 'string') return ''
    const query = value.trim()
    return query.length >= 2 && query.length <= TI_QUERY_MAX_LENGTH ? query : ''
}

function hasUnexpectedFields(value: unknown, allowed: string[]) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).some((key) => !allowed.includes(key)))
}

function setNoStore(res: FastifyReply) {
    res.header('cache-control', 'no-store, max-age=0')
    res.header('pragma', 'no-cache')
}
