import type { FastifyReply, FastifyRequest } from 'fastify'
import { performance } from 'node:perf_hooks'
import { queryOnce } from '#db'
import { compactThesisHistory, isThesisCached, readThesis, saveThesis, validThesis } from '#utils/thesis.ts'
import { thesisAccess, thesisCredentials } from '#utils/thesisAccess.ts'

export async function getThesis(req: FastifyRequest, res: FastifyReply) {
    const started = performance.now()
    try {
        const { id, token } = thesisCredentials(req)
        const access = await thesisAccess(id, token)
        if (!access.session) {
            logThesisRender(req, { authorizationMs: access.authorizationMs, cacheHit: isThesisCached(), documentMs: 0, totalMs: performance.now() - started })
            return res.status(401).header('Cache-Control', 'no-store').send({ error: 'A valid session is required.' })
        }
        if (!access.member) {
            logThesisRender(req, { authorizationMs: access.authorizationMs, cacheHit: isThesisCached(), documentMs: 0, totalMs: performance.now() - started })
            return res.status(403).header('Cache-Control', 'no-store').send({ error: 'Hanasand organization membership is required.' })
        }
        const cacheHit = isThesisCached()
        const documentStarted = performance.now()
        const document = await readThesis()
        const documentMs = performance.now() - documentStarted
        const totalMs = performance.now() - started
        logThesisRender(req, { authorizationMs: access.authorizationMs, cacheHit, documentMs, totalMs })
        const serverTiming = `authorization;dur=${access.authorizationMs.toFixed(2)}, thesis;dur=${documentMs.toFixed(2)}, total;dur=${totalMs.toFixed(2)}`
        return res.header('Cache-Control', 'no-store')
            .header('Server-Timing', serverTiming)
            .header('X-Thesis-Can-Edit', access.canEdit ? 'true' : 'false')
            .send(document)
    } catch (error) {
        req.log.error(error)
        req.log.info({ event: 'thesis_render_timing', total_ms: Number((performance.now() - started).toFixed(2)), status: 500 }, 'thesis_render_timing')
        return res.status(500).send({ error: 'The thesis could not be loaded.' })
    }
}

function logThesisRender(req: FastifyRequest, timing: { authorizationMs: number, cacheHit: boolean, documentMs: number, totalMs: number }) {
    req.log.info({
        event: 'thesis_render_timing',
        authorization_ms: Number(timing.authorizationMs.toFixed(2)),
        thesis_ms: Number(timing.documentMs.toFixed(2)),
        thesis_cache: timing.cacheHit ? 'hit' : 'miss',
        total_ms: Number(timing.totalMs.toFixed(2)),
    }, 'thesis_render_timing')
}

export async function putThesis(req: FastifyRequest, res: FastifyReply) {
    try {
        const { id, token } = thesisCredentials(req)
        const access = await thesisAccess(id, token)
        if (!access.member) return res.status(403).send({ error: 'Hanasand organization membership is required.' })
        if (!access.canEdit) return res.status(403).send({ error: 'Hanasand organization owners and editors can edit the thesis.' })
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
        const { id, token } = thesisCredentials(req)
        const access = await thesisAccess(id, token)
        if (!access.member) return res.status(403).send({ error: 'Hanasand organization membership is required.' })
        if (!access.canEdit) return res.status(403).send({ error: 'Hanasand organization owners and editors can view thesis history.' })
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
