import type { FastifyReply, FastifyRequest } from 'fastify'
import { collectionStrategy, searchThreatIntel, type TiSearchResponse } from '#utils/ti/search.ts'

interface SearchBody {
    query?: string
    queries?: string[]
}

export default async function postTiSearch(req: FastifyRequest<{ Body: SearchBody }>, res: FastifyReply) {
    const query = req.body?.query?.trim()

    if (!query) {
        return res.status(400).send({ error: 'query_required', message: 'query is required' })
    }

    const result = await searchThreatIntel({ query })
    return res.send(result)
}

export async function postTiSearchBatch(req: FastifyRequest<{ Body: SearchBody }>, res: FastifyReply) {
    const queries = uniqueQueries(req.body?.queries)
    if (!queries.length) {
        return res.status(400).send({ error: 'queries_required', message: 'queries are required' })
    }

    const results = await mapConcurrent(queries.slice(0, 1000), 10, safeSearch)
    return res.send({ generatedAt: new Date().toISOString(), count: results.length, results })
}

function uniqueQueries(input?: string[]) {
    return [...new Set((input ?? []).map(query => query.trim()).filter(Boolean))]
}

async function mapConcurrent<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
    const results: R[] = []
    let index = 0
    async function worker() {
        while (index < items.length) {
            const item = items[index++]
            results.push(await mapper(item))
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
    return results
}

async function safeSearch(query: string): Promise<TiSearchResponse> {
    try {
        return await searchThreatIntel({ query })
    } catch {
        const generatedAt = new Date().toISOString()
        return { query, generatedAt, mode: 'live_search', status: 'searching', summary: 'Searching', confidence: 0, lastSeen: generatedAt, aliases: [], recentActivity: [], targets: [], ttps: [], datasets: [], sources: [], notes: ['transient_search_failure'], collectionStrategy: collectionStrategy() }
    }
}
