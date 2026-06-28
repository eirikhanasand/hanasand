import type { FastifyReply, FastifyRequest } from 'fastify'
import { getThreatIntelPipelineOverview, runDueThreatIntelPipeline } from '#utils/ti/autonomousPipeline.ts'

interface RunBody {
    batchSize?: number
}

export async function getTiPipeline(_req: FastifyRequest, res: FastifyReply) {
    res.header('cache-control', 'no-store, max-age=0')
    return res.send(await getThreatIntelPipelineOverview())
}

export async function postTiPipelineRun(req: FastifyRequest<{ Body: RunBody }>, res: FastifyReply) {
    const batchSize = Math.min(Math.max(Number(req.body?.batchSize) || 3, 1), 20)
    res.header('cache-control', 'no-store, max-age=0')
    try {
        const published = await runDueThreatIntelPipeline(batchSize)
        return res.send({
            ok: true,
            published,
            overview: await getThreatIntelPipelineOverview(),
        })
    } catch (error) {
        req.log.warn({ error }, 'Failed to run autonomous threat intelligence pipeline')
        return res.status(500).send({
            ok: false,
            error: 'ti_pipeline_failed',
            message: error instanceof Error ? error.message : String(error),
            overview: await getThreatIntelPipelineOverview().catch(() => null),
        })
    }
}
