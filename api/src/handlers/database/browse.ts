import type { FastifyReply, FastifyRequest } from 'fastify'
import { requireDatabaseAccess } from './query.ts'
import { browseDatabase, type BrowseInput } from '#utils/db/browse.ts'

export default async function getDatabaseBrowse(req: FastifyRequest<{ Querystring: BrowseInput }>, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
    if (!await requireDatabaseAccess(req, res)) return res
    const input = req.query
    if (typeof input.instance !== 'string' || typeof input.database !== 'string' || !['contents', 'rows'].includes(input.mode)
        || [input.schema, input.table, input.cursor].some(value => value !== undefined && typeof value !== 'string')) return res.status(400).send({ message: 'Invalid database selection.' })
    try {
        return res.send(await browseDatabase(input))
    } catch {
        // Connection errors can contain credentials or addresses from other services.
        return res.status(503).send({ message: 'Database preview unavailable. Refresh the inventory and try again.' })
    }
}
