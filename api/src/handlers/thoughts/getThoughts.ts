import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { requestedContentOrganization, requireContentOrganization } from '#utils/contentOrganization.ts'

/**
 * GET /thoughts
 * Fetch all thoughts
 */
export default async function getThoughts(req: FastifyRequest, res: FastifyReply) {
    const organizationId = requestedContentOrganization(req)
    if (!await requireContentOrganization(req, res, organizationId)) return
    const workspace = (req.query as { workspace?: string })?.workspace === 'true'
    try {
        const result = await run(organizationId || workspace
            ? 'SELECT * FROM thoughts WHERE organization_id IS NOT DISTINCT FROM $1'
            : 'SELECT * FROM thoughts', organizationId || workspace ? [organizationId] : undefined)
        if (!result.rows.length) {
            return res.send([])
        }

        return res.send(result.rows)
    } catch (error) {
        console.error(error)
        return res.status(500).send({ error: 'Internal Server Error.' })
    }
}
