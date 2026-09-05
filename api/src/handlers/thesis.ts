import type { FastifyReply, FastifyRequest } from 'fastify'
import { queryOnce } from '#db'
import { validateSession } from '#utils/auth/session.ts'

export async function getThesis(req: FastifyRequest, res: FastifyReply) {
    try {
        const result = await queryOnce('SELECT title, content AS body FROM thesis WHERE id = 1')
        if (!result.rows[0]) return res.status(503).send({ error: 'The thesis is not initialized.' })
        return res.header('Cache-Control', 'no-store').send(result.rows[0])
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'The thesis could not be loaded.' })
    }
}

export async function putThesis(req: FastifyRequest, res: FastifyReply) {
    try {
        const authorization = req.headers.authorization || ''
        const id = typeof req.headers.id === 'string' ? req.headers.id : ''
        if (id !== 'eirikhanasand' || !authorization.startsWith('Bearer ')) {
            return res.status(403).send({ error: 'Only eirikhanasand can edit the thesis.' })
        }
        const session = await validateSession({ id, token: authorization.slice(7) })
        if (session?.user.id !== 'eirikhanasand') {
            return res.status(403).send({ error: 'Only eirikhanasand can edit the thesis.' })
        }
        const document = req.body as { title?: unknown, body?: unknown } | null
        if (typeof document?.title !== 'string' || !document.title.trim()
            || document.title.length > 500 || /[\r\n]/.test(document.title)
            || typeof document.body !== 'string' || document.body.length > 1_000_000) {
            return res.status(400).send({ error: 'Invalid thesis title or content.' })
        }
        await queryOnce('UPDATE thesis SET title = $1, content = $2, updated_at = NOW() WHERE id = 1', [document.title, document.body])
        return res.send({ saved: true })
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'The thesis could not be saved.' })
    }
}
