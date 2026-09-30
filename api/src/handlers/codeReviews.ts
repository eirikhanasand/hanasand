import type { FastifyReply, FastifyRequest } from 'fastify'
import { queryOnce } from '#db'
import { hasHanasandInternalPageAccess } from '#utils/auth/organizationPageAccess.ts'
import hasInternalToken from '#utils/auth/internalToken.ts'
import { thesisMember } from '#utils/thesisAccess.ts'

let schema: Promise<unknown> | undefined
async function prepare() {
    schema ??= queryOnce(`CREATE TABLE IF NOT EXISTS code_review_events (
        event_id UUID PRIMARY KEY,
        item_id TEXT NOT NULL CHECK (length(item_id) BETWEEN 1 AND 2000),
        content_hash TEXT NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
        review_hash TEXT NOT NULL CHECK (review_hash ~ '^[a-f0-9]{64}$'),
        approved BOOLEAN NOT NULL,
        reviewer TEXT NOT NULL,
        reviewed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
    )`).then(() => queryOnce('CREATE INDEX IF NOT EXISTS code_review_events_item_date ON code_review_events (item_id, reviewed_at DESC)')).catch(error => { schema = undefined; throw error })
    await schema
}
async function owner(req: FastifyRequest) {
    const id = typeof req.headers.id === 'string' ? req.headers.id : ''
    return Boolean(id && await hasHanasandInternalPageAccess(id))
}
export async function getCodeReviews(req: FastifyRequest, res: FastifyReply) {
    try {
        const internal = hasInternalToken(req)
        if (!internal) {
            const id = typeof req.headers.id === 'string' ? req.headers.id : ''
            const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : ''
            if (!await thesisMember(id, token)) return res.status(403).send({ error: 'Hanasand organization membership is required.' })
            if (!await owner(req)) return res.status(403).send({ error: 'Code access is required to read reviews.' })
        }
        const { id, before } = req.query as { id?: string, before?: string }
        if ((id !== undefined && (typeof id !== 'string' || !id || id.length > 2000)) || (before !== undefined && (!id || typeof before !== 'string' || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(before)))) return res.status(400).send({ error: 'Invalid review history request.' })
        await prepare()
        const result = id ? await queryOnce('SELECT * FROM code_review_events WHERE item_id = $1 AND ($2::uuid IS NULL OR (reviewed_at, event_id) < (SELECT reviewed_at, event_id FROM code_review_events WHERE event_id = $2 AND item_id = $1)) ORDER BY reviewed_at DESC, event_id DESC LIMIT 50', [id, before || null])
            : await queryOnce('SELECT DISTINCT ON (item_id) * FROM code_review_events ORDER BY item_id, reviewed_at DESC, event_id DESC')
        return res.header('Cache-Control', 'private, no-store').send(result.rows)
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Review history could not be loaded.' })
    }
}
export async function postCodeReview(req: FastifyRequest, res: FastifyReply) {
    try {
        const id = typeof req.headers.id === 'string' ? req.headers.id : ''
        const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : ''
        if (!await thesisMember(id, token)) return res.status(403).send({ error: 'Hanasand organization membership is required.' })
        if (!await owner(req)) return res.status(403).send({ error: 'Hanasand organization owners and editors can approve source code.' })
        const input = req.body as Record<string, unknown> | null
        if (!input || typeof input.id !== 'string' || !input.id || input.id.length > 2000 || typeof input.approved !== 'boolean' ||
            typeof input.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(input.sha256) || typeof input.reviewHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.reviewHash) ||
            typeof input.eventId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.eventId)) return res.status(400).send({ error: 'Invalid review.' })
        await prepare()
        await queryOnce('INSERT INTO code_review_events (event_id, item_id, content_hash, review_hash, approved, reviewer) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (event_id) DO NOTHING', [input.eventId, input.id, input.sha256, input.reviewHash, input.approved, id])
        const result = await queryOnce('SELECT * FROM code_review_events WHERE event_id = $1', [input.eventId])
        return res.header('Cache-Control', 'private, no-store').send(result.rows[0])
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'The review could not be saved. Please retry.' })
    }
}
