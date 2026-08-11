import type { FastifyReply, FastifyRequest } from 'fastify'
import { searchThreatIntel } from '#utils/ti/search.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { consumeBillingQuota, getBillingQuota } from '../billing.ts'

interface SearchBody {
    query?: string
    preferCached?: boolean
}

export const TI_QUERY_MAX_LENGTH = 200
export const TI_BATCH_MAX_QUERIES = 25

export default async function postTiSearch(req: FastifyRequest<{ Body: SearchBody }>, res: FastifyReply) {
    setNoStore(res)
    const presentedCredentials = Boolean(req.headers?.authorization || req.headers?.cookie)
    const auth = presentedCredentials ? await tokenWrapper(req, res) : null
    if (presentedCredentials && (!auth?.valid || !auth.id)) return res.status(401).send({ error: 'Unauthorized.' })
    if (hasUnexpectedFields(req.body, ['query', 'preferCached'])) {
        return res.status(400).send({ error: 'invalid_request', message: 'search accepts only the query and preferCached fields' })
    }
    const query = normalizeQuery(req.body?.query)

    if (!query) {
        return res.status(400).send({ error: 'invalid_query', message: `query must contain 2-${TI_QUERY_MAX_LENGTH} characters` })
    }

    if (auth?.id) {
        const quota = await getBillingQuota(auth.id, 'searchesPerDay')
        if (quota.limit === null || quota.remaining === 0) return res.status(quota.limit === null ? 402 : 429).send({ error: quota.limit === null ? 'subscription_required' : 'quota_exhausted', message: quota.limit === null ? 'A Threat Intelligence plan is required to search.' : 'Your daily Threat Intelligence search quota has been reached.', quota })
    }

    const result = await searchThreatIntel({ query, preferCached: req.body?.preferCached === true })
    const publicResult = sanitizeBrowserSearchResult(result)
    if (result.status === 'unavailable' || result.mode === 'unavailable') {
        return res.status(503).send(publicResult)
    }
    if (auth?.id) {
        const quota = await consumeBillingQuota(auth.id, 'searchesPerDay')
        if (!quota.allowed) return res.status(429).send({ error: 'quota_exhausted', message: 'Your daily Threat Intelligence search quota has been reached.', quota })
    }
    return res.send(publicResult)
}

const internalSearchFields = ['planner', 'graph', 'publicChannel', 'restrictedMetadata', 'darknetMetadata'] as const

export function sanitizeBrowserSearchResult<T extends Record<string, unknown>>(result: T): Omit<T, typeof internalSearchFields[number]> {
    const publicResult = { ...result } as T & Partial<Record<typeof internalSearchFields[number], unknown>>
    for (const field of internalSearchFields) delete publicResult[field]
    return publicResult as Omit<T, typeof internalSearchFields[number]>
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
