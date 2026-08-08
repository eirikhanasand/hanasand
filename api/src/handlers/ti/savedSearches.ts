import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

type SavedSearchBody = { query?: unknown }

export async function getSavedSearches(req: FastifyRequest, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) return res.status(401).send({ error: 'Unauthorized.' })
    const result = await run(`
        SELECT query, saved_at
        FROM ti_saved_searches
        WHERE user_id = $1
        ORDER BY saved_at DESC
        LIMIT 8
    `, [userId])
    return res.send({ savedSearches: result.rows.map(row => ({ query: row.query, savedAt: row.saved_at })) })
}

export async function postSavedSearch(req: FastifyRequest<{ Body: SavedSearchBody }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) return res.status(401).send({ error: 'Unauthorized.' })
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : ''
    if (!query || query.length > 200) return res.status(400).send({ error: 'Search query must be between 1 and 200 characters.' })
    const result = await run(`
        INSERT INTO ti_saved_searches (user_id, query, saved_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id, query) DO UPDATE SET saved_at = NOW()
        RETURNING query, saved_at
    `, [userId, query])
    await run(`
        DELETE FROM ti_saved_searches
        WHERE user_id = $1
          AND query NOT IN (
              SELECT query FROM ti_saved_searches WHERE user_id = $1 ORDER BY saved_at DESC LIMIT 8
          )
    `, [userId])
    return res.status(201).send({ savedSearch: { query: result.rows[0].query, savedAt: result.rows[0].saved_at } })
}

export async function deleteSavedSearch(req: FastifyRequest<{ Querystring: { query?: string } }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) return res.status(401).send({ error: 'Unauthorized.' })
    const query = typeof req.query?.query === 'string' ? req.query.query.trim() : ''
    if (!query) return res.status(400).send({ error: 'Search query is required.' })
    await run('DELETE FROM ti_saved_searches WHERE user_id = $1 AND query = $2', [userId, query])
    return res.send({ ok: true })
}
