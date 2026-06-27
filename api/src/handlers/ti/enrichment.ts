import type { FastifyReply, FastifyRequest } from 'fastify'
import {
    getThreatActorEnrichmentOverview,
    recordThreatActorProfileWarmFailure,
    warmThreatActorProfileCache,
} from '#utils/ti/search.ts'

interface RunBody {
    batchSize?: number
}

export async function getTiEnrichment(_req: FastifyRequest, res: FastifyReply) {
    res.header('cache-control', 'no-store, max-age=0')
    return res.send(getThreatActorEnrichmentOverview())
}

export async function postTiEnrichmentRun(req: FastifyRequest<{ Body: RunBody }>, res: FastifyReply) {
    const batchSize = Math.min(Math.max(Number(req.body?.batchSize) || 8, 1), 50)
    res.header('cache-control', 'no-store, max-age=0')
    try {
        const warmed = await warmThreatActorProfileCache(batchSize)
        return res.send({
            ok: true,
            warmed,
            overview: getThreatActorEnrichmentOverview(),
        })
    } catch (error) {
        recordThreatActorProfileWarmFailure(error)
        req.log.warn({ error }, 'Failed to run threat actor enrichment manually')
        return res.status(500).send({
            ok: false,
            error: 'ti_enrichment_failed',
            message: error instanceof Error ? error.message : String(error),
            overview: getThreatActorEnrichmentOverview(),
        })
    }
}
