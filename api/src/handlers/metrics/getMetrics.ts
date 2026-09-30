import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export default async function getMetrics(this: FastifyInstance, req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    if (!(await hasHanasandInternalRouteAccess(req)).valid) return res.status(403).send({ error: 'Active Hanasand organization owner or editor access is required.' })

    try {
        const cached = JSON.parse(this.stats.toString())
        const payload = cached?.data ?? cached

        if (cached?.status && cached.status >= 400) {
            return res.status(cached.status).send(payload)
        }

        return res.type('application/json').send(payload)
    } catch (error: any) {
        console.error('Error calling stats endpoint:', error)
        return res.status(500).send({ error: error.message })
    }
}
