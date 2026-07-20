import type { FastifyReply, FastifyRequest } from 'fastify'

interface RunBody {
    batchSize?: number
}

export async function getTiEnrichment(_req: FastifyRequest, res: FastifyReply) {
    res.header('cache-control', 'no-store, max-age=0')
    return res.send({
        generatedAt: new Date().toISOString(),
        worker: {
            state: 'unavailable',
            mode: 'canonical_scraper_only',
            intervalSeconds: 0,
            batchSize: 0,
            lastSweepStartedAt: null,
            lastSweepFinishedAt: null,
            lastError: 'The API-owned actor publisher is retired; canonical evidence is collected by the TI scraper.',
            cursor: 0,
        },
        updatedActors: [],
        queuedActors: [],
        activity: [],
        auditLog: [],
        stats: { updatedLastHour: 0, queued: 0, auditedEvents: 0, automaticCoverage: 0, totalRefreshes: 0 },
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
