import type { FastifyReply, FastifyRequest } from 'fastify'
import { collectionStrategy, searchThreatIntel, type TiSearchResponse } from '#utils/ti/search.ts'

interface SearchBody {
    query?: string
    queries?: string[]
}

export const TI_QUERY_MAX_LENGTH = 200
export const TI_BATCH_MAX_QUERIES = 25
const TI_BATCH_CONCURRENCY = 3

export default async function postTiSearch(req: FastifyRequest<{ Body: SearchBody }>, res: FastifyReply) {
    setNoStore(res)
    const query = normalizeQuery(req.body?.query)

    if (!query) {
        return res.status(400).send({ error: 'invalid_query', message: `query must contain 2-${TI_QUERY_MAX_LENGTH} characters` })
    }

    const result = await searchThreatIntel({ query })
    return res.send(result)
}

export async function postTiSearchBatch(req: FastifyRequest<{ Body: SearchBody }>, res: FastifyReply) {
    setNoStore(res)
    if (!hasAuthenticatedPrincipal(req)) {
        return res.status(401).send({ error: 'authentication_required', message: 'an API key or authenticated session is required for batch search' })
    }

    const queries = normalizeBatchQueries(req.body?.queries)
    if (!queries.length) {
        return res.status(400).send({ error: 'invalid_queries', message: `queries must contain values of 2-${TI_QUERY_MAX_LENGTH} characters` })
    }
    if (queries.length > TI_BATCH_MAX_QUERIES) {
        return res.status(400).send({ error: 'too_many_queries', message: `batch search accepts at most ${TI_BATCH_MAX_QUERIES} unique queries` })
    }

    const results = await mapConcurrent(queries, TI_BATCH_CONCURRENCY, safeSearch)
    return res.send({ generatedAt: new Date().toISOString(), count: results.length, results })
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

async function mapConcurrent<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
    const results = new Array<R>(items.length)
    let index = 0
    async function worker() {
        while (index < items.length) {
            const itemIndex = index++
            results[itemIndex] = await mapper(items[itemIndex])
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
    return results
}

function normalizeQuery(value: unknown) {
    if (typeof value !== 'string') return ''
    const query = value.trim()
    return query.length >= 2 && query.length <= TI_QUERY_MAX_LENGTH ? query : ''
}

function hasAuthenticatedPrincipal(req: FastifyRequest) {
    const request = req as FastifyRequest & { apiKeyAuth?: unknown; rateLimitSession?: unknown }
    return Boolean(request.apiKeyAuth || request.rateLimitSession)
}

function setNoStore(res: FastifyReply) {
    res.header('cache-control', 'no-store, max-age=0')
    res.header('pragma', 'no-cache')
}

async function safeSearch(query: string): Promise<TiSearchResponse> {
    try {
        return await searchThreatIntel({ query })
    } catch {
        const generatedAt = new Date().toISOString()
        return { query, generatedAt, mode: 'live_search', status: 'searching', summary: 'Searching', confidence: 0, lastSeen: '', aliases: [], recentActivity: [], targets: [], ttps: [], datasets: [], sources: [], notes: ['transient_search_failure'], collectionStrategy: collectionStrategy() }
    }
}
