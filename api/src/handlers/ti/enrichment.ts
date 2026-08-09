import type { FastifyReply, FastifyRequest } from 'fastify'

interface RunBody {
    batchSize?: number
}

export async function getTiEnrichment(_req: FastifyRequest, res: FastifyReply) {
    res.header('cache-control', 'no-store, max-age=0')
    return res.status(410).send({
        ok: false,
        error: 'api_ti_enrichment_retired',
        message: 'API-owned actor enrichment is retired. Read canonical evidence through the TI scraper.',
        canonicalRoute: '/v1/intel/search',
    })
}

export async function postTiEnrichmentRun(req: FastifyRequest<{ Body: RunBody }>, res: FastifyReply) {
    res.header('cache-control', 'no-store, max-age=0')
    return res.status(409).send({
        ok: false,
        error: 'api_ti_enrichment_retired',
        message: 'API-owned actor enrichment is retired. Run collection through the canonical TI scraper.',
        canonicalRoute: '/v1/intel/search',
    })
}
