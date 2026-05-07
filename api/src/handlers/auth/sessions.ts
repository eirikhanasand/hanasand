import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { listSessions, revokeAllTokens, revokeToken } from '#utils/auth/session.ts'

function bearerToken(req: FastifyRequest) {
    const authHeader = req.headers['authorization']
    return typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length)
        : undefined
}

export async function getSessions(req: FastifyRequest, res: FastifyReply) {
    const auth = await tokenWrapper(req, res)
    if (!auth.valid || !auth.id) {
        return res.status(auth.impersonating ? 403 : 401).send({ error: auth.error || 'Unauthorized.' })
    }

    const sessions = await listSessions(auth.id)
    return res.send({
        sessions: sessions.map(session => ({
            ...session,
            current: session.revoked_at === null && bearerToken(req) === undefined ? false : undefined,
        })),
    })
}

export async function revokeSession(req: FastifyRequest, res: FastifyReply) {
    const auth = await tokenWrapper(req, res)
    if (!auth.valid || !auth.id) {
        return res.status(auth.impersonating ? 403 : 401).send({ error: auth.error || 'Unauthorized.' })
    }

    const { token_id } = req.params as { token_id: string }
    const revoked = await revokeToken({ tokenId: Number(token_id), userId: auth.id, revokedBy: auth.id })
    return res.send({ revoked, token_id: Number(token_id) })
}

export async function revokeSessions(req: FastifyRequest, res: FastifyReply) {
    const auth = await tokenWrapper(req, res)
    if (!auth.valid || !auth.id) {
        return res.status(auth.impersonating ? 403 : 401).send({ error: auth.error || 'Unauthorized.' })
    }

    const { keep_current = true } = req.body as { keep_current?: boolean } ?? {}
    const count = await revokeAllTokens({ userId: auth.id, revokedBy: auth.id, exceptToken: keep_current ? bearerToken(req) : undefined })
    return res.send({ revoked: count })
}
