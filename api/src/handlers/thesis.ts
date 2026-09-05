import type { FastifyReply, FastifyRequest } from 'fastify'
import { queryOnce } from '#db'
import { validateSession } from '#utils/auth/session.ts'
import { compactThesisHistory, readThesis, saveThesis, validThesis } from '#utils/thesis.ts'

async function owner(req: FastifyRequest) {
    const authorization = req.headers.authorization || ''
    const id = typeof req.headers.id === 'string' ? req.headers.id : ''
    if (id !== 'eirikhanasand' || !authorization.startsWith('Bearer ')) return false
    const session = await validateSession({ id, token: authorization.slice(7) })
    return session?.user.id === 'eirikhanasand'
}

export async function getThesis(req: FastifyRequest, res: FastifyReply) {
    try {
        return res.header('Cache-Control', 'no-store').send(await readThesis())
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'The thesis could not be loaded.' })
    }
}

export async function putThesis(req: FastifyRequest, res: FastifyReply) {
    try {
        if (!await owner(req)) return res.status(403).send({ error: 'Only eirikhanasand can edit the thesis.' })
        if (!validThesis(req.body)) return res.status(400).send({ error: 'Invalid thesis title, content or revision. Reload the editor if it was open before this update.' })
        const result = await saveThesis(req.body)
        return res.status(result.status).send(result.document)
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'The thesis could not be saved.' })
    }
}

export async function getThesisHistory(req: FastifyRequest, res: FastifyReply) {
    try {
        if (!await owner(req)) return res.status(403).send({ error: 'Only eirikhanasand can view thesis history.' })
        const { revision } = req.params as { revision?: string }
        if (revision !== undefined) {
            if (!/^\d+$/.test(revision) || !Number.isSafeInteger(Number(revision))) return res.status(400).send({ error: 'Invalid revision.' })
            const result = await queryOnce('SELECT title, content AS body, revision::float8 AS revision FROM thesis_history WHERE revision = $1 LIMIT 1', [Number(revision)])
            return result.rows[0] ? res.header('Cache-Control', 'no-store').send(result.rows[0]) : res.status(404).send({ error: 'This version is no longer available. Refresh history.' })
        }
        const { before } = req.query as { before?: string }
        if (before !== undefined && (!/^\d+$/.test(before) || !Number.isSafeInteger(Number(before)))) return res.status(400).send({ error: 'Invalid history cursor.' })
        await compactThesisHistory()
        const result = await queryOnce(`
            SELECT DISTINCT ON (revision) revision::float8 AS revision, title, saved_at, id = 'previous' AS immediate
            FROM thesis_history WHERE ($1::bigint IS NULL OR revision < $1)
            ORDER BY revision DESC, (id = 'previous') DESC LIMIT 50
        `, [before === undefined ? null : Number(before)])
        return res.header('Cache-Control', 'no-store').send(result.rows)
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'History could not be loaded.' })
    }
}
